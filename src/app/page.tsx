import Link from "next/link";
import { getCategories, listIdeas, type SortOrder } from "@/lib/ideas";
import IdeaCard from "@/components/IdeaCard";

export const dynamic = "force-dynamic";

type SearchParams = { cat?: string; q?: string; sort?: string };

const SORTS: { key: SortOrder; label: string }[] = [
  { key: "recent", label: "Récentes" },
  { key: "top", label: "Plus votées" },
  { key: "score", label: "Meilleur score IA" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sort: SortOrder = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as SortOrder) : "recent";

  const [categories, ideas] = await Promise.all([
    getCategories(),
    listIdeas({ categorySlug: sp.cat, search: sp.q, sort }),
  ]);

  function hrefFor(overrides: Partial<SearchParams>) {
    const params = new URLSearchParams();
    const merged = { ...sp, ...overrides };
    if (merged.cat) params.set("cat", merged.cat);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort) params.set("sort", merged.sort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <aside className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            Catégories
          </h2>
          <ul className="space-y-1 text-sm">
            <li>
              <Link
                href={hrefFor({ cat: undefined })}
                className={`block rounded-md px-2 py-1 ${!sp.cat ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
              >
                Toutes
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={hrefFor({ cat: c.slug })}
                  className={`block rounded-md px-2 py-1 ${sp.cat === c.slug ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`}
                >
                  {c.emoji} {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="space-y-4">
        <form className="flex flex-wrap gap-2" action="/" method="get">
          {sp.cat && <input type="hidden" name="cat" value={sp.cat} />}
          {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
          <input
            type="text"
            name="q"
            defaultValue={sp.q}
            placeholder="Rechercher une idée…"
            className="flex-1 min-w-[180px] rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Rechercher
          </button>
        </form>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Trier :</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={hrefFor({ sort: s.key })}
              className={`rounded-full px-3 py-1 ${sort === s.key ? "bg-neutral-900 text-white" : "bg-neutral-100 hover:bg-neutral-200"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {ideas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
            Aucune idée pour l&apos;instant.{" "}
            <Link href="/ideas/new" className="underline">
              Sois le premier à en proposer une
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
