import type { AiStatus } from "@/lib/ideas";

export type Tier = "high" | "mid" | "low";

export function scoreTier(score: number): Tier {
  return score >= 70 ? "high" : score >= 40 ? "mid" : "low";
}

export const TIER_LABEL: Record<Tier, string> = {
  high: "Prometteuse",
  mid: "À creuser",
  low: "Fragile",
};

export const TIER_TEXT: Record<Tier, string> = {
  high: "text-ok",
  mid: "text-warn",
  low: "text-bad",
};

export const TIER_BG: Record<Tier, string> = {
  high: "bg-ok",
  mid: "bg-warn",
  low: "bg-bad",
};

/** Le sigle "IA" : la machine se signale en encre, sans étincelle. */
export function AiTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-[18px] items-center rounded-[5px] border border-ink px-1 font-display text-[10px] font-bold leading-none tracking-wide text-ink ${className}`}
      aria-label="Généré par l'IA"
    >
      IA
    </span>
  );
}

/** Point qui pulse : un traitement IA est en cours. */
export function Pulse({ className = "" }: { className?: string }) {
  return (
    <span className={`relative flex h-2 w-2 ${className}`} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink opacity-50" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
    </span>
  );
}

/**
 * État IA compact, pour les endroits où on manque de place (fil mobile,
 * barre d'actions). Le score détaillé est porté par <ScoreMeter />.
 */
export default function AiBadge({ status, score }: { status: AiStatus; score: number | null }) {
  const base = "inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums";

  if (status === "done" && score !== null) {
    const tier = scoreTier(score);
    return (
      <span className={`${base} text-ink`} title="Note de potentiel estimée par l'IA">
        <AiTag />
        <span className="font-display text-sm font-bold">{score}</span>
        <span className="font-medium text-ink-3">/100</span>
        <span className={`hidden font-medium sm:inline ${TIER_TEXT[tier]}`}>· {TIER_LABEL[tier]}</span>
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className={`${base} text-ink-2`}>
        <Pulse />
        Analyse en cours
      </span>
    );
  }
  return (
    <span className={`${base} text-bad`}>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M10 6v5M10 14h.01" strokeLinecap="round" />
        <circle cx="10" cy="10" r="7.5" />
      </svg>
      Analyse échouée
    </span>
  );
}
