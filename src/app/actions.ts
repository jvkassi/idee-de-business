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
import { addComment, createIdea, retryAiImprovement, retryCoverGeneration, toggleVote } from "@/lib/ideas";
import { loginHref, safeNext } from "@/lib/format";

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
