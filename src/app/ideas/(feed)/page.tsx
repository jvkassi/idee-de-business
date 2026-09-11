import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getCategories, listIdeas, type SortOrder } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import { loginHref, plural } from "@/lib/format";
import { categoryStyle } from "@/lib/categoryColor";
import IdeaCard from "@/components/IdeaCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Toutes les idées",
  description:
    "Le fil Djossi : les idées des gens d'ici, notées par Djossi, poussées par vos votes. Lis, réagis, fais ta version à ta façon.",
};

type SearchParams = { cat?: string; q?: string; sort?: string };

const SORTS: { key: SortOrder; label: string; short: string }[] = [
  { key: "recent", label: "Récentes", short: "Récentes" },
  { key: "top", label: "Plus soutenues", short: "Votes" },
  { key: "score", label: "Meilleure note IA", short: "Note IA" },
];

/**
 * Le fil : toutes les idées publiques, filtrables par catégorie, recherche et
 * tri. C'est l'application elle-même — la page d'accueil (/) se charge de la
 * vendre, ici on la pratique.
 */
export default async function IdeasFeedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, user, h] = await Promise.all([searchParams, getSession(), headers()]);
  const sort: SortOrder = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SortOrder) : "recent";
  const q = sp.q?.trim() || undefined;
  // La recherche sémantique coûte un appel Gemini par requête et reste
  // accessible sans compte : limitée par IP, pas par utilisateur.
  const clientIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

  const [categories, ideas] = await Promise.all([
    getCategories(),
    listIdeas({ categorySlug: sp.cat, search: q, sort, viewerId: user?.id, clientIp }),
  ]);
  const activeCategory = categories.find((c) => c.slug === sp.cat);
  const filtered = Boolean(q || activeCategory);

  function hrefFor(overrides: Partial<SearchParams>) {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.cat) params.set("cat", merged.cat);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort && merged.sort !== "recent") params.set("sort", merged.sort);
    const qs = params.toString();
    return qs ? `/ideas?${qs}` : "/ideas";
  }

  return (
    <div className="space-y-8">
      <section id="idees" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Le fil</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {activeCategory ? (
                <span className="inline-flex items-center gap-2.5" style={categoryStyle(activeCategory.slug)}>
                  <span className="cat-dot h-3 w-3" aria-hidden />
                  {activeCategory.name}
                </span>
              ) : (
                "Toutes les idées"
              )}
              <span className="ml-2.5 align-middle text-sm font-medium text-ink-3">{plural(ideas.length, "idée")}</span>
            </h1>
            {!user && !filtered && (
              <p className="mt-1.5 max-w-xl text-sm text-ink-2">
                Tout est public : lis, vote, réagis, propose ta version.{" "}
                <Link href="/" className="font-medium text-ink underline-offset-4 hover:underline">
                  Comment ça marche ?
                </Link>
              </p>
            )}
          </div>

          <form action="/ideas" method="get" role="search" className="relative sm:w-72">
            {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
            {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
            <svg
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13 13l4 4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Rechercher une idée…"
              aria-label="Rechercher une idée"
              className="input pl-9 pr-9"
            />
            {q ? (
              <Link
                href={hrefFor({ q: undefined })}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                ×
              </Link>
            ) : (
              <button type="submit" className="sr-only">
                Rechercher
              </button>
            )}
          </form>
        </div>

        {/* Catégories : rail horizontal, une pastille de couleur par domaine */}
        <nav aria-label="Catégories" className="-mx-4 overflow-x-auto px-4 scrollbar-none">
          <ul className="flex w-max gap-2 pb-1">
            <li>
              <Link href={hrefFor({ cat: undefined })} className={`chip ${!sp.cat ? "chip-active" : ""}`}>
                Toutes
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug} style={categoryStyle(c.slug)}>
                <Link
                  href={hrefFor({ cat: c.slug })}
                  className={`chip ${sp.cat === c.slug ? "chip-active" : ""}`}
                  aria-current={sp.cat === c.slug ? "page" : undefined}
                >
                  <span className="cat-dot" aria-hidden /> {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="inline-flex rounded-xl border border-line bg-surface p-1 text-sm" aria-label="Trier">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={hrefFor({ sort: s.key })}
                aria-current={sort === s.key ? "true" : undefined}
                className={`inline-flex items-center rounded-lg px-3 py-1.5 font-medium transition-colors pointer-coarse:min-h-10 ${
                  sort === s.key ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
                }`}
              >
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </Link>
            ))}
          </nav>
          {filtered && (
            <Link href="/ideas" className="text-sm font-medium text-ink-2 underline-offset-4 hover:underline">
              Réinitialiser les filtres
            </Link>
          )}
        </div>

        {ideas.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <div
              className="mat mb-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl"
              style={activeCategory ? categoryStyle(activeCategory.slug) : undefined}
              aria-hidden
            >
              {activeCategory ? activeCategory.emoji : filtered ? "🔍" : "💡"}
            </div>
            {filtered ? (
              <>
                <h2 className="font-display text-xl font-bold">Rien par ici pour l&apos;instant</h2>
                <p className="mt-1 max-w-sm text-sm text-ink-2">
                  {q ? (
                    <>
                      Aucune idée pour « <span className="font-medium text-ink">{q}</span> »
                      {activeCategory ? ` dans ${activeCategory.name}` : ""}.
                    </>
                  ) : (
                    <>Pas encore d&apos;idée dans {activeCategory?.name}.</>
                  )}{" "}
                  C&apos;est peut-être une place à prendre.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link href="/ideas" className="btn btn-outline">
                    Voir toutes les idées
                  </Link>
                  <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-sun">
                    Proposer celle-là
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-xl font-bold">Le fil est vide, à toi d&apos;ouvrir</h2>
                <p className="mt-1 max-w-sm text-sm text-ink-2">
                  Publie la première idée : elle reçoit sa fiche, sa note et son illustration en quelques secondes.
                </p>
                <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-sun mt-5">
                  Proposer la première idée
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} loggedIn={!!user} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
