import { put } from "@vercel/blob";
import { query, ready } from "./db";
import {
  EMPTY_PROFILE,
  parseCvDocument,
  profileFromText,
  rewriteCv,
  sanitizeProfile,
  type CandidateProfile,
} from "./gemini";

export type { CandidateProfile };

function parseJson<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

export type Profile = CandidateProfile & { updatedAt: string | null; photoUrl: string | null };

export async function getProfile(userId: number): Promise<Profile | null> {
  await ready();
  const rows = await query("SELECT * FROM profiles WHERE user_id = $1", [userId]);
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    headline: String(r.headline ?? ""),
    summary: String(r.summary ?? ""),
    skills: parseJson<string[]>(r.skills, []),
    experience: parseJson<Profile["experience"]>(r.experience, []),
    education: parseJson<Profile["education"]>(r.education, []),
    languages: parseJson<string[]>(r.languages, []),
    location: r.location ? String(r.location) : null,
    phone: r.phone ? String(r.phone) : null,
    email: r.email ? String(r.email) : null,
    photoUrl: r.photo_url ? String(r.photo_url) : null,
    updatedAt: r.updated_at ? String(r.updated_at) : null,
  };
}

async function saveProfile(userId: number, p: CandidateProfile): Promise<void> {
  await ready();
  await query(
    `INSERT INTO profiles (user_id, headline, summary, skills, experience, education, languages, location, phone, email, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (user_id) DO UPDATE SET
       headline = $2, summary = $3, skills = $4, experience = $5, education = $6,
       languages = $7, location = $8, phone = $9, email = $10, updated_at = now()`,
    [
      userId,
      p.headline,
      p.summary,
      JSON.stringify(p.skills),
      JSON.stringify(p.experience),
      JSON.stringify(p.education),
      JSON.stringify(p.languages),
      p.location,
      p.phone,
      p.email,
    ],
  );
  // Le profil a changé : les anciens matchs ne veulent plus rien dire.
  await query("DELETE FROM job_matches WHERE user_id = $1", [userId]);
}

/** "Raconte-toi" : un texte libre devient un joli profil. */
export async function buildProfileFromText(userId: number, freeText: string): Promise<string> {
  const existing = (await getProfile(userId)) ?? EMPTY_PROFILE;
  const { reply, updatedProfile } = await profileFromText(freeText, existing);
  await saveProfile(userId, updatedProfile);
  return reply;
}

const MAX_CV_BYTES = 8 * 1024 * 1024;

/**
 * Upload d'un CV (PDF ou photo) : stocké sur Blob, lu par Gemini,
 * le profil est rempli avec ce qui est trouvé. Un seul bouton côté UI.
 */
export async function uploadCv(userId: number, file: File): Promise<string> {
  if (file.size === 0) throw new Error("Fichier vide.");
  if (file.size > MAX_CV_BYTES) throw new Error("CV trop lourd (max 8 Mo).");
  const mime = file.type || "";
  if (!mime.includes("pdf") && !mime.startsWith("image/")) {
    throw new Error("Envoie un PDF ou une photo de ton CV.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = mime.includes("pdf") ? "pdf" : "jpg";
  const blob = await put(`cvs/${userId}-${Date.now()}.${ext}`, buffer, {
    access: "public",
    contentType: mime,
  });
  await ready();
  const inserted = await query<{ id: number }>(
    "INSERT INTO cvs (user_id, blob_url, filename) VALUES ($1, $2, $3) RETURNING id",
    [userId, blob.url, file.name || null],
  );
  const cvId = Number(inserted[0].id);

  const parsed = await parseCvDocument(buffer.toString("base64"), mime);
  const existing = (await getProfile(userId)) ?? EMPTY_PROFILE;
  // Le CV remplit les trous, sans écraser ce que l'utilisateur a déjà raconté.
  const merged = sanitizeProfile({
    headline: existing.headline || parsed.headline,
    summary: existing.summary || parsed.summary,
    skills: existing.skills.length > 0 ? existing.skills : parsed.skills,
    experience: existing.experience.length > 0 ? existing.experience : parsed.experience,
    education: existing.education.length > 0 ? existing.education : parsed.education,
    languages: existing.languages.length > 0 ? existing.languages : parsed.languages,
    location: existing.location ?? parsed.location,
    phone: existing.phone ?? parsed.phone,
    email: existing.email ?? parsed.email,
  });
  await saveProfile(userId, merged);
  await query("UPDATE cvs SET parsed_json = $1 WHERE id = $2", [JSON.stringify(parsed), cvId]);
  return merged.headline || "Ton profil est prêt !";
}

/** "Refaire mon CV" : version soignée, prête à copier. */
export async function redoCv(userId: number): Promise<string> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error("Raconte-toi d'abord ou envoie ton CV.");
  return rewriteCv(profile);
}

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** Upload simple de la photo (sans IA) : instantané. */
export async function uploadPhoto(userId: number, file: File): Promise<string> {
  if (file.size === 0) throw new Error("Fichier vide.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Photo trop lourde (max 8 Mo).");
  if (!file.type.startsWith("image/")) throw new Error("Envoie une photo (JPG ou PNG).");

  const buffer = Buffer.from(await file.arrayBuffer());
  const blob = await put(`photos/${userId}-${Date.now()}.jpg`, buffer, {
    access: "public",
    contentType: file.type,
  });
  await setProfilePhoto(userId, blob.url);
  return blob.url;
}

/** Bouton "Rendre pro" : Gemini soigne la photo actuelle. */
export async function enhanceProfilePhoto(userId: number): Promise<string> {
  const profile = await getProfile(userId);
  if (!profile?.photoUrl) throw new Error("Ajoute d'abord ta photo.");

  const original = await fetch(profile.photoUrl, { signal: AbortSignal.timeout(30_000) });
  if (!original.ok) throw new Error("Photo introuvable.");
  const buffer = Buffer.from(await original.arrayBuffer());
  const mime = original.headers.get("content-type") || "image/jpeg";

  const { enhancePortrait } = await import("./gemini");
  const enhanced = await enhancePortrait(buffer.toString("base64"), mime);
  const ext = enhanced.mimeType === "image/png" ? "png" : "jpg";
  const blob = await put(`photos/${userId}-pro-${Date.now()}.${ext}`, Buffer.from(enhanced.base64, "base64"), {
    access: "public",
    contentType: enhanced.mimeType,
  });
  await setProfilePhoto(userId, blob.url);
  return blob.url;
}

async function setProfilePhoto(userId: number, url: string): Promise<void> {
  await ready();
  await query(
    `INSERT INTO profiles (user_id, photo_url, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET photo_url = $2, updated_at = now()`,
    [userId, url],
  );
}

/**
 * Vrai si le profil contient le moindre champ significatif rempli
 * (chaîne non vide / tableau non vide). Un profil null/undefined → false.
 * Sert à distinguer "jamais commencé" de "commencé mais incomplet" côté /jobs.
 */
export function profileHasContent(p: Profile | CandidateProfile | null | undefined): boolean {
  if (!p) return false;
  const hasText = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;
  const hasItems = (v: unknown): boolean => Array.isArray(v) && v.length > 0;
  return (
    hasText(p.headline) ||
    hasText(p.summary) ||
    hasItems(p.skills) ||
    hasItems(p.experience) ||
    hasItems(p.education) ||
    hasItems(p.languages) ||
    hasText(p.location) ||
    hasText(p.phone) ||
    hasText(p.email) ||
    hasText((p as Profile).photoUrl)
  );
}

/**
 * Règle stricte pour le matching IA : le profil est exploitable seulement
 * s'il a un titre, un résumé ou au moins une compétence.
 */
export function profileReadyToMatch(p: Profile | CandidateProfile | null | undefined): boolean {
  if (!p) return false;
  return Boolean(p.headline || p.summary || (p.skills?.length ?? 0) > 0);
}
