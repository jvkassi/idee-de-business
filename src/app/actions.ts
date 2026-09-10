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

  const id = await createIdea({ title, pitch, categorySlug, authorId: user.id, audioUrl: audioUrl || null });
  revalidatePath("/");
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

  const result = await validateAndGenerateKit(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
  return result;
}

export async function retryKitAction(ideaId: number): Promise<void> {
  await retryStarterKit(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
}

/** Fork : n'importe qui peut reprendre une idée pour la faire évoluer de son côté. */
export async function forkIdeaAction(ideaId: number): Promise<void> {
  const user = await getSession();
  if (!user) redirect(loginHref(`/ideas/${ideaId}`));
  const newId = await forkIdea(ideaId, user.id);
  revalidatePath("/");
  redirect(`/ideas/${newId}?new=1`);
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

  await addComment(ideaId, user.id, body);
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/");
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
}

export async function retryAiAction(ideaId: number): Promise<void> {
  await retryAiImprovement(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
}

export async function retryCoverAction(ideaId: number): Promise<void> {
  await retryCoverGeneration(ideaId);
  revalidatePath(`/ideas/${ideaId}`);
}

export async function syncJobsAction(): Promise<void> {
  const { syncJobOffers } = await import("@/lib/jobOffers");
  await syncJobOffers(20);
  revalidatePath("/jobs");
}
