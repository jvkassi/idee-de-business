import Link from "next/link";
import { getCategories, listIdeas, type SortOrder } from "@/lib/ideas";
import { getSession } from "@/lib/session";
import { loginHref, plural } from "@/lib/format";
import { categoryStyle } from "@/lib/categoryColor";
import { AiTag } from "@/components/AiBadge";
import IdeaCard from "@/components/IdeaCard";

export const dynamic = "force-dynamic";

type SearchParams = { cat?: string; q?: string; sort?: string };

const SORTS: { key: SortOrder; label: string; short: string }[] = [
  { key: "recent", label: "Récentes", short: "Récentes" },
  { key: "top", label: "Plus soutenues", short: "Votes" },
  { key: "score", label: "Meilleure note IA", short: "Note IA" },
];

/**
 * Le mécanisme du produit, montré plutôt qu'expliqué : une note griffonnée
 * qui devient une fiche notée. Purement décoratif, en CSS.
 */
function BeforeAfter() {
  return (
    <div className="relative mx-auto flex w-full max-w-sm items-center justify-center gap-3 sm:gap-4" aria-hidden>
      {/* La note brute */}
      <div className="w-36 -rotate-3 rounded-xl border border-line-2 bg-surface p-3.5 shadow-lift">
        <div className="h-2 w-16 rounded-full bg-line-2" />
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full rounded-full bg-ink/70" />
          <div className="h-2 w-5/6 rounded-full bg-ink/70" />
          <div className="hl h-2 w-4/6 rounded-sm" />
          <div className="h-2 w-3/6 rounded-full bg-ink/70" />
        </div>
      </div>

      <svg viewBox="0 0 40 24" className="h-6 w-10 shrink-0 text-ink" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M2 12h32m0 0-7-7m7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* La fiche */}
      <div className="w-44 rotate-2 rounded-xl border border-line bg-surface p-2.5 shadow-lift" style={categoryStyle("agro")}>
        <div className="mat grid h-16 place-items-center rounded-lg text-2xl">🌾</div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="cat-dot" />
          <div className="h-2 w-14 rounded-full bg-cat/60" />
        </div>
        <div className="mt-2 h-2.5 w-11/12 rounded-full bg-ink" />
        <div className="mt-1.5 h-2 w-4/6 rounded-full bg-line-2" />
        <div className="mt-2.5 flex items-center justify-between">
          <div className="inline-flex items-center gap-1 rounded-md border border-ink bg-sun px-1.5 py-0.5 font-display text-[10px] font-bold">
            ▲ 12
          </div>
          <div className="inline-flex items-center gap-1">
            <AiTag />
            <span className="font-display text-sm font-bold">78</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="space-y-8">
      {!user && (
        <section className="grid items-center gap-8 border-b border-line pb-10 md:grid-cols-[1.2fr_1fr] md:gap-10">
          <div>
            <h1 className="font-display text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Une idée brute. <span className="hl">Une fiche notée</span> et illustrée, en trente secondes.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2">
              Publie ton idée telle qu&apos;elle te vient. L&apos;IA la structure, lui donne une note sur 100 et une
              illustration. La communauté vote, réagit, et tranche.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href={loginHref("/ideas/new")} className="btn btn-sun px-5 py-3 text-base">
                Proposer mon idée
              </Link>
              <a href="#idees" className="btn btn-ghost px-3 py-3 text-base">
                Voir le fil ↓
              </a>
            </div>
          </div>
          <BeforeAfter />
        </section>
      )}

      <section id="idees" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Le fil</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {activeCategory ? (
                <span className="inline-flex items-center gap-2.5" style={categoryStyle(activeCategory.slug)}>
                  <span className="cat-dot h-3 w-3" aria-hidden />
                  {activeCategory.name}
                </span>
              ) : (
                "Toutes les idées"
              )}
              <span className="ml-2.5 align-middle text-sm font-medium text-ink-3">{plural(ideas.length, "idée")}</span>
            </h2>
          </div>

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
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  sort === s.key ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"
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
            <div
              className="mat mb-4 grid h-16 w-16 place-items-center rounded-2xl text-3xl"
              style={activeCategory ? categoryStyle(activeCategory.slug) : undefined}
              aria-hidden
            >
              {activeCategory ? activeCategory.emoji : filtered ? "🔍" : "💡"}
            </div>
            {filtered ? (
              <>
                <h3 className="font-display text-xl font-bold">Rien par ici pour l&apos;instant</h3>
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
                  <Link href="/" className="btn btn-outline">
                    Voir toutes les idées
                  </Link>
                  <Link href={user ? "/ideas/new" : loginHref("/ideas/new")} className="btn btn-sun">
                    Proposer celle-là
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display text-xl font-bold">Le fil est vide, à toi d&apos;ouvrir</h3>
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
