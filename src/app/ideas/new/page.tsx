import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCategories } from "@/lib/ideas";
import { loginHref } from "@/lib/format";
import { AiTag } from "@/components/AiBadge";
import NewIdeaForm from "./NewIdeaForm";

export const metadata: Metadata = { title: "Proposer une idée" };
// createIdeaAction planifie les appels Gemini via after() après la réponse :
// on laisse à la fonction serverless le temps de les terminer.
export const maxDuration = 60;

const STEPS = [
  { who: "toi", title: "Tu la racontes à voix haute", text: "30 secondes minimum, sois verbeux. Tu peux aussi l'écrire si tu préfères." },
  { who: "ia", title: "Djossi la range et la note", text: "Cible, valeur, revenus, risques, premiers pas et une note sur 100. ~20 s." },
  { who: "ia", title: "Djossi lui dessine son image", text: "Dessinée à partir de ton texte. ~30 s." },
  { who: "eux", title: "La communauté tranche", text: "Votes et réactions : c'est là que ça se valide (ou pas)." },
];

export default async function NewIdeaPage() {
  const user = await getSession();
  if (!user) redirect(loginHref("/ideas/new"));
  const categories = await getCategories();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <section className="card p-5 sm:p-7">
        <p className="label">Nouvelle idée</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Raconte-la, <span className="hl">à voix haute.</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          Pas besoin de business plan : décris ton idée comme tu la raconterais à un ami. Tu pourras relire et
          corriger le texte avant de publier.
        </p>
        <div className="mt-7">
          <NewIdeaForm categories={categories} />
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-display text-sm font-bold">Ce qui se passe ensuite</div>
          <ol className="divide-y divide-line">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3 px-4 py-3.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink font-display text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {s.title}
                    {s.who === "ia" && <AiTag />}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="px-1 text-xs leading-relaxed text-ink-3">
          Une bonne description dit <span className="font-medium text-ink-2">pour qui</span>,{" "}
          <span className="font-medium text-ink-2">quel problème</span> et{" "}
          <span className="font-medium text-ink-2">comment ça rapporte</span>. Djossi comprend mieux quand
          c&apos;est concret — et une note moyenne, c&apos;est juste un point de départ pour discuter.
        </p>
      </aside>
    </div>
  );
}
