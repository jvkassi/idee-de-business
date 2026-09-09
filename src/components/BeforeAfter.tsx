import { categoryStyle } from "@/lib/categoryColor";
import { AiTag } from "@/components/AiBadge";

/**
 * Le mécanisme du produit, montré plutôt qu'expliqué : une note griffonnée
 * qui devient une fiche notée. Purement décoratif, en CSS.
 */
export default function BeforeAfter() {
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
