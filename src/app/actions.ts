"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getSession,
  loginOrCreate,
  setSessionCookie,
  clearSessionCookie,
  validatePseudo,
} from "@/lib/session";
import {
  addComment,
  createIdea,
  deleteIdea,
  forkIdea,
  getCategories,
  getIdea,
  refineIdeaWithVoice,
  retryAiImprovement,
  retryCoverGeneration,
  retryStarterKit,
  toggleVote,
  uploadVoiceNote,
  validateAndGenerateKit,
} from "@/lib/ideas";
import { loginHref, safeNext } from "@/lib/format";
import { transcribeIdeaAudio, transcribeShortAudio, type VoiceIdeaDraft } from "@/lib/gemini";
import { checkAudioSize, checkRateLimit } from "@/lib/rateLimit";
import { removeSubscription, saveSubscription, type PushSubscriptionInput } from "@/lib/push";

export type FormState = { error?: string } | undefined;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const pseudo = String(formData.get("pseudo") || "");
  const err = validatePseudo(pseudo);
  if (err) return { error: err };
  const user = await loginOrCreate(pseudo);
  await setSessionCookie(user);
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/");
}

export async function createIdeaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSession();
  if (!user) return { error: "Connecte-toi d'abord." };

  const title = String(formData.get("title") || "").trim();
  const pitch = String(formData.get("pitch") || "").trim();
  const categorySlug = String(formData.get("category") || "").trim();
  const audioUrl = String(formData.get("audioUrl") || "").trim();

  if (title.length < 5 || title.length > 120) {
    return { error: "Le titre doit faire entre 5 et 120 caractères." };
  }
  if (pitch.length < 20 || pitch.length > 2000) {
    return { error: "La description doit faire entre 20 et 2000 caractères." };
  }
  if (!categorySlug) {
    return { error: "Choisis une catégorie." };
  }

  const limit = await checkRateLimit(user.id, "create_idea", 5, 60);
  if (!limit.ok) return { error: limit.error };

  const id = await createIdea({ title, pitch, categorySlug, authorId: user.id, audioUrl: audioUrl || null });
  revalidatePath("/");
  revalidatePath("/ideas");
  // ?new=1 : la page de l'idée affiche la bannière "publiée, l'IA travaille".
  redirect(`/ideas/${id}?new=1`);
}

export type TranscribeResult = ({ ok: true; audioUrl: string } & VoiceIdeaDraft) | { ok: false; error: string };

export async function transcribeIdeaAudioAction(formData: FormData): Promise<TranscribeResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return { ok: false, error: "Aucun enregistrement reçu." };
  }
  // Un enregistrement trop court n'aura pas assez de matière pour une bonne
  // analyse IA ; on encourage 30 s minimum côté client, mais on protège aussi
  // ici (l'API pourrait être appelée directement).
  if (audio.size < 15_000) {
    return { ok: false, error: "Enregistrement trop court, réessaie en donnant plus de détails." };
  }
  const sizeCheck = checkAudioSize(audio.size);
  if (!sizeCheck.ok) return { ok: false, error: sizeCheck.error };

  const limit = await checkRateLimit(user.id, "transcribe", 10, 60);
  if (!limit.ok) return { ok: false, error: limit.error };

  const categories = await getCategories();
  const buffer = Buffer.from(await audio.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = audio.type || "audio/webm";

  try {
    // Toutes les notes vocales sont conservées (Vercel Blob), pas juste
    // transcrites puis jetées : elles restent l'enregistrement d'origine.
    const [draft, audioUrl] = await Promise.all([
      transcribeIdeaAudio(base64, mimeType, categories),
      uploadVoiceNote(buffer, mimeType, "voice/ideas"),
    ]);
    return { ok: true, audioUrl, ...draft };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la transcription." };
  }
}

export type RefineResult = { ok: true } | { ok: false; error: string };

/**
 * Réenregistrement vocal pour préciser une idée dont le score est trop bas.
 * Réservé à l'auteur de l'idée.
 */
export async function refineIdeaVoiceAction(formData: FormData): Promise<RefineResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const ideaId = Number(formData.get("ideaId"));
  const audio = formData.get("audio");
  if (!ideaId) return { ok: false, error: "Idée invalide." };
  if (!(audio instanceof File) || audio.size === 0) {
    return { ok: false, error: "Aucun enregistrement reçu." };
  }

  const idea = await getIdea(ideaId);
  if (!idea) return { ok: false, error: "Idée introuvable." };
  if (idea.authorId !== user.id) {
    return { ok: false, error: "Seul l'auteur de l'idée peut la préciser." };
  }
  const sizeCheck = checkAudioSize(audio.size);
  if (!sizeCheck.ok) return { ok: false, error: sizeCheck.error };
  const limit = await checkRateLimit(user.id, "voice_refine", 5, 60);
  if (!limit.ok) return { ok: false, error: limit.error };

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  try {
    const [transcript, audioUrl] = await Promise.all([
      transcribeShortAudio(buffer.toString("base64"), mimeType),
      uploadVoiceNote(buffer, mimeType, "voice/refinements"),
    ]);
    await refineIdeaWithVoice(ideaId, transcript, audioUrl);
    revalidatePath(`/ideas/${ideaId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la précision vocale." };
  }
}

/**
 * Débloque et lance la génération du starter kit (landing page, design
 * système, flyer, périmètre MVP). Réservé à l'auteur, et seulement si le
 * score est au-dessus du seuil — revérifié en base par validateAndGenerateKit.
 */
export async function validateKitAction(ideaId: number): Promise<RefineResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const idea = await getIdea(ideaId);
  if (!idea) return { ok: false, error: "Idée introuvable." };
  if (idea.authorId !== user.id) {
    return { ok: false, error: "Seul l'auteur de l'idée peut lancer la génération." };
  }
  const limit = await checkRateLimit(user.id, "kit_generation", 3, 24 * 60);
  if (!limit.ok) return limit;

  const result = await validateAndGenerateKit(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
  return result;
}

// Génère 2 appels Gemini (texte + flyer) : réservé à l'auteur, comme
// validateKitAction — sans quoi n'importe qui pourrait relancer la
// génération sur l'idée de n'importe qui d'autre.
export async function retryKitAction(ideaId: number): Promise<void> {
  const user = await getSession();
  if (!user) return;
  const idea = await getIdea(ideaId);
  if (!idea || idea.authorId !== user.id) return;
  const limit = await checkRateLimit(user.id, "kit_generation", 3, 24 * 60);
  if (!limit.ok) return;

  await retryStarterKit(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
}

export type ForkResult = { ok: true; newIdeaId: number } | { ok: false; error: string };

/**
 * Reprendre une idée : n'importe qui peut la reprendre à sa façon, mais
 * doit expliquer à voix haute comment IL la ferait — pas une copie
 * silencieuse de l'originale, une vraie nouvelle fiche à analyser.
 */
export async function forkIdeaVoiceAction(formData: FormData): Promise<ForkResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const ideaId = Number(formData.get("ideaId"));
  const audio = formData.get("audio");
  if (!ideaId) return { ok: false, error: "Idée invalide." };
  if (!(audio instanceof File) || audio.size === 0) {
    return { ok: false, error: "Aucun enregistrement reçu." };
  }
  const sizeCheck = checkAudioSize(audio.size);
  if (!sizeCheck.ok) return { ok: false, error: sizeCheck.error };
  const limit = await checkRateLimit(user.id, "create_idea", 5, 60);
  if (!limit.ok) return { ok: false, error: limit.error };

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  try {
    const [transcript, audioUrl] = await Promise.all([
      transcribeShortAudio(buffer.toString("base64"), mimeType),
      uploadVoiceNote(buffer, mimeType, "voice/forks"),
    ]);
    const newIdeaId = await forkIdea(ideaId, user.id, transcript, audioUrl);
    revalidatePath("/");
    revalidatePath("/ideas");
    return { ok: true, newIdeaId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la reprise." };
  }
}

export async function addCommentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSession();
  if (!user) return { error: "Connecte-toi pour commenter." };

  const ideaId = Number(formData.get("ideaId"));
  const body = String(formData.get("body") || "").trim();
  if (!ideaId) return { error: "Idée invalide." };
  if (body.length < 2 || body.length > 1000) {
    return { error: "Le commentaire doit faire entre 2 et 1000 caractères." };
  }
  const limit = await checkRateLimit(user.id, "comment", 30, 60);
  if (!limit.ok) return { error: limit.error };

  await addComment(ideaId, user.id, body);
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/");
  revalidatePath("/ideas");
  return {};
}

export type VoiceCommentResult = { ok: true } | { ok: false; error: string };

export async function addVoiceCommentAction(formData: FormData): Promise<VoiceCommentResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi pour commenter." };

  const ideaId = Number(formData.get("ideaId"));
  const audio = formData.get("audio");
  if (!ideaId) return { ok: false, error: "Idée invalide." };
  if (!(audio instanceof File) || audio.size === 0) {
    return { ok: false, error: "Aucun enregistrement reçu." };
  }
  const sizeCheck = checkAudioSize(audio.size);
  if (!sizeCheck.ok) return { ok: false, error: sizeCheck.error };
  const limit = await checkRateLimit(user.id, "voice_comment", 15, 60);
  if (!limit.ok) return { ok: false, error: limit.error };

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = audio.type || "audio/webm";

  try {
    const [transcript, audioUrl] = await Promise.all([
      transcribeShortAudio(buffer.toString("base64"), mimeType),
      uploadVoiceNote(buffer, mimeType, "voice/comments"),
    ]);
    await addComment(ideaId, user.id, transcript.slice(0, 1000), audioUrl);
    revalidatePath(`/ideas/${ideaId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec du commentaire vocal." };
  }
}

export async function voteAction(ideaId: number): Promise<void> {
  const user = await getSession();
  if (!user) redirect(loginHref(`/ideas/${ideaId}`));
  await toggleVote(ideaId, user.id);
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/");
  revalidatePath("/ideas");
}

// Réservés à l'auteur : sans quoi n'importe quel visiteur, même déconnecté,
// pourrait relancer un appel Gemini sur l'idée de n'importe qui via ces
// Server Actions (elles restent appelables directement, pas seulement
// depuis le bouton visible dans l'UI).
export async function retryAiAction(ideaId: number): Promise<void> {
  const user = await getSession();
  if (!user) return;
  const idea = await getIdea(ideaId);
  if (!idea || idea.authorId !== user.id) return;
  const limit = await checkRateLimit(user.id, "retry", 10, 60);
  if (!limit.ok) return;

  await retryAiImprovement(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
}

export async function deleteIdeaAction(ideaId: number): Promise<RefineResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };

  const result = await deleteIdea(ideaId, user.id);
  if (!result.ok) return result;
  revalidatePath("/");
  revalidatePath("/ideas");
  redirect("/ideas");
}

export async function subscribePushAction(sub: PushSubscriptionInput): Promise<{ ok: boolean }> {
  const user = await getSession();
  if (!user) return { ok: false };
  await saveSubscription(user.id, sub);
  return { ok: true };
}

export async function unsubscribePushAction(endpoint: string): Promise<void> {
  await removeSubscription(endpoint);
}

export async function retryCoverAction(ideaId: number): Promise<void> {
  const user = await getSession();
  if (!user) return;
  const idea = await getIdea(ideaId);
  if (!idea || idea.authorId !== user.id) return;
  const limit = await checkRateLimit(user.id, "retry", 10, 60);
  if (!limit.ok) return;

  await retryCoverGeneration(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
}

export async function uploadCvAction(_prev: FormState, formData: FormData): Promise<FormState & { ok?: boolean }> {
  const user = await getSession();
  if (!user) return { error: "Connecte-toi d'abord." };
  const limit = await checkRateLimit(user.id, "upload_cv", 5, 60);
  if (!limit.ok) return { error: limit.error };

  const file = formData.get("cv");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis ton CV (PDF ou photo)." };

  const { uploadCv } = await import("@/lib/profile");
  try {
    await uploadCv(user.id, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de la lecture du CV." };
  }
  revalidatePath("/profil");
  return { ok: true };
}

export async function describeYourselfAction(_prev: FormState, formData: FormData): Promise<FormState & { ok?: boolean }> {
  const user = await getSession();
  if (!user) return { error: "Connecte-toi d'abord." };
  const text = String(formData.get("about") || "").trim();
  if (text.length < 30) return { error: "Raconte-m'en un peu plus (au moins quelques phrases)." };
  if (text.length > 3000) return { error: "Un peu plus court (max 3000 caractères)." };
  const limit = await checkRateLimit(user.id, "describe", 10, 60);
  if (!limit.ok) return { error: limit.error };

  const { buildProfileFromText } = await import("@/lib/profile");
  try {
    await buildProfileFromText(user.id, text);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Djossi n'a pas compris, réessaie." };
  }
  revalidatePath("/profil");
  return { ok: true };
}

export type RedoCvResult = { ok: true; cv: string } | { ok: false; error: string };
export async function redoCvAction(): Promise<RedoCvResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };
  const limit = await checkRateLimit(user.id, "redo_cv", 5, 60);
  if (!limit.ok) return { ok: false, error: limit.error };

  const { redoCv } = await import("@/lib/profile");
  try {
    return { ok: true, cv: await redoCv(user.id) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la réécriture." };
  }
}

export async function uploadPhotoAction(_prev: FormState, formData: FormData): Promise<FormState & { ok?: boolean }> {
  const user = await getSession();
  if (!user) return { error: "Connecte-toi d'abord." };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis ta photo." };

  const { uploadPhoto } = await import("@/lib/profile");
  try {
    await uploadPhoto(user.id, file);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec de l'envoi." };
  }
  revalidatePath("/profil");
  return { ok: true };
}

export type EnhancePhotoResult = { ok: true } | { ok: false; error: string };

export async function enhancePhotoAction(): Promise<EnhancePhotoResult> {
  const user = await getSession();
  if (!user) return { ok: false, error: "Connecte-toi d'abord." };
  const limit = await checkRateLimit(user.id, "enhance_photo", 5, 60);
  if (!limit.ok) return { ok: false, error: limit.error };

  const { enhanceProfilePhoto } = await import("@/lib/profile");
  try {
    await enhanceProfilePhoto(user.id);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la retouche." };
  }
  revalidatePath("/profil");
  return { ok: true };
}
