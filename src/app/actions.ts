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
  getCategories,
  retryAiImprovement,
  retryCoverGeneration,
  toggleVote,
} from "@/lib/ideas";
import { loginHref, safeNext } from "@/lib/format";
import { transcribeIdeaAudio, type VoiceIdeaDraft } from "@/lib/gemini";

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

  if (title.length < 5 || title.length > 120) {
    return { error: "Le titre doit faire entre 5 et 120 caractères." };
  }
  if (pitch.length < 20 || pitch.length > 2000) {
    return { error: "La description doit faire entre 20 et 2000 caractères." };
  }
  if (!categorySlug) {
    return { error: "Choisis une catégorie." };
  }

  const id = await createIdea({ title, pitch, categorySlug, authorId: user.id });
  revalidatePath("/");
  // ?new=1 : la page de l'idée affiche la bannière "publiée, l'IA travaille".
  redirect(`/ideas/${id}?new=1`);
}

export type TranscribeResult = ({ ok: true } & VoiceIdeaDraft) | { ok: false; error: string };

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
    const draft = await transcribeIdeaAudio(base64, mimeType, categories);
    return { ok: true, ...draft };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la transcription." };
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

  await addComment(ideaId, user.id, body);
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/");
  return {};
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
