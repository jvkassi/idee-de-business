import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getIdea } from "@/lib/ideas";
import { categoryStyle } from "@/lib/categoryColor";
import CoverImage from "@/components/CoverImage";
import FakeCta from "./FakeCta";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ideaId = parseId((await params).id);
  const idea = ideaId ? await getIdea(ideaId) : null;
  if (!idea?.kit) return { title: "Landing page" };
  return { title: `${idea.kit.landingHeadline} (démo)` };
}

/**
 * Landing page 100 % factice, générée à partir du starter kit d'une idée
 * validée : ni base de données ni logique réelle, juste le contenu généré
 * par l'IA mis en page — un aperçu à quoi pourrait ressembler le vrai
 * produit, pas le produit lui-même.
 */
export default async function IdeaSitePage({ params }: { params: Params }) {
  const ideaId = parseId((await params).id);
  if (!ideaId) notFound();
  const idea = await getIdea(ideaId);
  if (!idea || idea.kitStatus !== "done" || !idea.kit) notFound();
  const k = idea.kit;

  return (
    <div style={categoryStyle(idea.categorySlug)}>
      <div className="rounded-2xl border border-dashed border-line bg-surface-2 px-4 py-2.5 text-center text-xs text-ink-3">
        Page de démonstration préparée par Djossi à partir d&apos;une idée publiée ici — rien
        n&apos;est enregistré ici. <Link href={`/ideas/${idea.id}`} className="font-medium text-ink underline underline-offset-4">Retour à la fiche</Link>
      </div>

      {/* Hero */}
      <section className="mt-8 grid gap-8 sm:grid-cols-2 sm:items-center">
        <div>
          <p className="label mb-3">{idea.categoryName}</p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            {k.landingHeadline}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-2">{k.landingSubheadline}</p>
          <div className="mt-6 max-w-sm">
            <FakeCta label={k.ctaLabel} />
          </div>
        </div>
        {idea.coverStatus === "done" && idea.coverImage && (
          <div className="mat rounded-2xl p-2">
            <div className="aspect-video overflow-hidden rounded-xl">
              <CoverImage src={idea.coverImage} title={idea.title} className="h-full w-full object-cover" />
            </div>
          </div>
        )}
      </section>

      {/* Value props */}
      <section className="mt-16 grid gap-5 sm:grid-cols-3">
        {k.valueProps.map((v, i) => (
          <div key={i} className="card p-5">
            <h2 className="font-display text-lg font-bold">{v.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{v.text}</p>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section className="mt-16 max-w-2xl">
        <h2 className="font-display text-2xl font-bold tracking-tight">Questions fréquentes</h2>
        <dl className="mt-4 divide-y divide-line border-t border-line">
          {k.faq.map((f, i) => (
            <div key={i} className="py-4">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-2">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 mb-8 rounded-2xl border border-dashed border-line bg-surface-2 p-6 text-center">
        <p className="text-sm text-ink-2">Convaincu ? La suite se joue sur la vraie fiche.</p>
        <Link href={`/ideas/${idea.id}`} className="btn btn-outline mt-3 px-5 py-2.5 text-sm">
          Retour à l&apos;idée
        </Link>
      </section>
    </div>
  );
}
