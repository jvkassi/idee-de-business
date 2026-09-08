import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCategories } from "@/lib/ideas";
import { loginHref } from "@/lib/format";
import { SparkIcon } from "@/components/AiBadge";
import NewIdeaForm from "./NewIdeaForm";

export const metadata: Metadata = { title: "Proposer une idée" };
// createIdeaAction planifie les appels Gemini via after() après la réponse :
// on laisse à la fonction serverless le temps de les terminer.
export const maxDuration = 60;

const STEPS = [
  { icon: "✍️", title: "Tu décris ton idée", text: "Un titre, une catégorie, quelques lignes. Pas besoin d'être parfait." },
  { icon: "🧠", title: "L'IA la structure", text: "Cible, proposition de valeur, revenus, risques, premiers pas et un score sur 100." },
  { icon: "🎨", title: "Elle reçoit son illustration", text: "Une image générée dans le style de la plateforme, en ~30 secondes." },
  { icon: "🗳️", title: "La communauté tranche", text: "Votes et réactions t'aident à valider (ou pivoter) avant d'investir." },
];

export default async function NewIdeaPage() {
  const user = await getSession();
  if (!user) redirect(loginHref("/ideas/new"));
  const categories = await getCategories();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="card p-5 sm:p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Proposer une idée</h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Décris-la simplement, comme à un ami. L&apos;IA se charge de la structurer juste après.
        </p>
        <div className="mt-6">
          <NewIdeaForm categories={categories} />
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ai/15 bg-[linear-gradient(120deg,var(--ai-soft),transparent_70%)] px-4 py-3 font-display text-sm font-bold text-ai">
            <SparkIcon className="h-4 w-4" />
            Ce qui se passe ensuite
          </div>
          <ol className="space-y-4 p-4">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-base" aria-hidden>
                  {s.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="text-xs leading-relaxed text-ink-2">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="px-1 text-xs leading-relaxed text-ink-3">
          Astuce : une bonne description dit <span className="font-medium text-ink-2">pour qui</span>,{" "}
          <span className="font-medium text-ink-2">quel problème</span> et{" "}
          <span className="font-medium text-ink-2">comment tu gagnes de l&apos;argent</span>. L&apos;IA note
          mieux ce qu&apos;elle comprend bien.
        </p>
      </aside>
    </div>
  );
}
