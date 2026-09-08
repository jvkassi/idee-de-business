import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCategories } from "@/lib/ideas";
import NewIdeaForm from "./NewIdeaForm";

export default async function NewIdeaPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  const categories = await getCategories();

  return (
    <div className="max-w-xl mx-auto rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-semibold mb-1">Proposer une idée</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Décris ton idée simplement, l&apos;IA se charge de la structurer et de
        l&apos;améliorer juste après publication.
      </p>
      <NewIdeaForm categories={categories} />
    </div>
  );
}
