"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { submitDirectOffer } from "@/lib/directOffers";

export type DirectOfferFormState = { error?: string; ok?: true } | undefined;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function submitDirectOfferAction(
  _prev: DirectOfferFormState,
  formData: FormData,
): Promise<DirectOfferFormState> {
  const user = await getSession();
  if (!user) return { error: "Connecte-toi pour publier une offre." };
  const result = await submitDirectOffer(user.id, {
    title: field(formData, "title"),
    company: field(formData, "company"),
    location: field(formData, "location"),
    contractType: field(formData, "contract"),
    salary: field(formData, "salary"),
    contact: field(formData, "contact"),
    description: field(formData, "description"),
  });
  if ("error" in result) return { error: result.error };
  revalidatePath("/publier");
  return { ok: true };
}
