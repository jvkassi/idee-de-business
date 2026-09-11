import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publier une offre" };

// Dépôt direct en pause : Djossi pêche déjà les offres, on rouvre quand la
// relecture suit. Le code (lib + formulaire) reste, seule l'entrée est fermée.
export default async function PublierPage() {
  redirect("/jobs");
}
