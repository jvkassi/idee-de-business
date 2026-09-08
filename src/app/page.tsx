import Link from "next/link";
import { getCategories, listIdeas, type SortOrder } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import { loginHref, plural } from "@/lib/format";
import IdeaCard from "@/components/IdeaCard";

export const dynamic = "force-dynamic";

type SearchParams = { cat?: string; q?: string; sort?: string };

const SORTS: { key: SortOrder; label: string; short: string }[] = [
  { key: "recent", label: "Récentes", short: "Récentes" },
  { key: "top", label: "Plus soutenues", short: "Top votes" },
  { key: "score", label: "Meilleur score IA", short: "Score IA" },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [sp, user] = await Promise.all([searchParams, getSession()]);
  const sort: SortOrder = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SortOrder) : "recent";
  const q = sp.q?.trim() || undefined;

  const [categories, ideas] = await Promise.all([
    getCategories(),
    listIdeas({ categorySlug: sp.cat, search: q, sort, viewerId: user?.id }),
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
    return qs ? `/?${qs}` : "/";
  }

  return (
    <div className="space-y-6">
      {!user && (
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(115deg,var(--brand)_0%,#ff7a45_45%,var(--ai)_100%)] px-6 py-8 text-white shadow-lift sm:px-10 sm:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative max-w-xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              Communauté · Votes · IA
            </p>
            <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Ton idée de business mérite mieux qu&apos;une note dans ton téléphone.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/90 sm:text-base">
              Publie-la en deux minutes. La communauté vote et réagit, l&apos;IA la structure, la note sur 100 et
              l&apos;illustre — automatiquement.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={loginHref("/ideas/new")}
                className="btn bg-white text-[#17141f] shadow-lg hover:bg-white/90"
              >
                Proposer mon idée
              </Link>
              <a href="#idees" className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20">
                Voir les idées
              </a>
            </div>
          </div>
        </section>
      )}

      <section id="idees" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            {activeCategory ? (
              <>
                {activeCategory.emoji} {activeCategory.name}
              </>
            ) : (
              "Explorer les idées"
            )}
            <span className="ml-2 align-middle text-sm font-medium text-ink-3">{plural(ideas.length, "idée")}</span>
          </h2>

          <form action="/" method="get" role="search" className="relative sm:w-72">
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

        {/* Catégories : rail horizontal, scanne vite et tient sur mobile */}
        <nav aria-label="Catégories" className="-mx-4 overflow-x-auto px-4 scrollbar-none">
          <ul className="flex w-max gap-2 pb-1">
            <li>
              <Link href={hrefFor({ cat: undefined })} className={`chip ${!sp.cat ? "chip-active" : ""}`}>
                Toutes
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={hrefFor({ cat: c.slug })}
                  className={`chip ${sp.cat === c.slug ? "chip-active" : ""}`}
                  aria-current={sp.cat === c.slug ? "page" : undefined}
                >
                  <span aria-hidden>{c.emoji}</span> {c.name}
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
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  sort === s.key ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink"
                }`}
              >
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </Link>
            ))}
          </nav>
          {filtered && (
            <Link href="/" className="text-sm font-medium text-ink-2 underline-offset-4 hover:underline">
              Réinitialiser les filtres
            </Link>
          )}
        </div>

        {ideas.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-3xl" aria-hidden>
              {filtered ? "🔍" : "💡"}
            </div>
            {filtered ? (
              <>
                <h3 className="font-display text-lg font-bold">Aucune idée ne correspond</h3>
                <p className="mt-1 max-w-sm text-sm text-ink-2">
                  {q ? (
                    <>
                      Rien pour « <span className="font-medium text-ink">{q}</span> »
                      {activeCategory ? ` dans ${activeCategory.name}` : ""}.
                    </>
                  ) : (
                    <>Pas encore d&apos;idée dans {activeCategory?.name}.</>
                  )}{" "}
                  C&apos;est peut-être le signe qu&apos;il y a une place à prendre.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Link href="/" className="btn btn-outline">
                    Voir toutes les idées
                  </Link>
                  <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-primary">
                    Proposer celle-là
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display text-lg font-bold">Le fil est vide, à toi d&apos;ouvrir le bal</h3>
                <p className="mt-1 max-w-sm text-sm text-ink-2">
                  Publie la première idée : l&apos;IA la structure, lui donne un score et une illustration en
                  quelques secondes.
                </p>
                <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-primary mt-5">
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
