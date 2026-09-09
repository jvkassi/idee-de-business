import { AiTag, TIER_BG, TIER_LABEL, TIER_TEXT, scoreTier } from "@/components/AiBadge";

/**
 * La note IA, lisible d'un coup d'œil et honnête : un nombre, l'échelle
 * (/100), une jauge, un mot. Deux tailles : "sm" pour le rail d'une carte
 * (à côté du vote, les deux verdicts côte à côte), "lg" pour la fiche.
 */
export default function ScoreMeter({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const s = Math.min(100, Math.max(0, score));
  const tier = scoreTier(s);

  if (size === "sm") {
    return (
      <div
        className="flex w-14 flex-col items-center gap-1 rounded-xl border border-line bg-surface px-1.5 py-1.5"
        role="img"
        aria-label={`Note IA : ${s} sur 100, ${TIER_LABEL[tier]}`}
        title={`Note IA : ${s}/100 — ${TIER_LABEL[tier]}`}
      >
        <AiTag />
        <span className="font-display text-base font-bold leading-none tabular-nums">{s}</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
          <span className={`block h-full rounded-full ${TIER_BG[tier]}`} style={{ width: `${s}%` }} />
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-44" role="img" aria-label={`Note IA : ${s} sur 100, ${TIER_LABEL[tier]}`}>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-bold leading-none tracking-tight tabular-nums">{s}</span>
        <span className="text-sm font-medium text-ink-3">/100</span>
        <span className={`ml-auto text-sm font-semibold ${TIER_TEXT[tier]}`}>{TIER_LABEL[tier]}</span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className={`h-full rounded-full ${TIER_BG[tier]}`} style={{ width: `${s}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium tabular-nums text-ink-3" aria-hidden>
        <span>0</span>
        <span>40</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}
