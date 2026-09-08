import type { AiStatus } from "@/lib/ideas";

export function scoreTier(score: number): "high" | "mid" | "low" {
  return score >= 70 ? "high" : score >= 40 ? "mid" : "low";
}

const TIER_CLASSES = {
  high: "bg-ok-soft text-ok",
  mid: "bg-warn-soft text-warn",
  low: "bg-surface-2 text-ink-2",
} as const;

export function SparkIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="currentColor" aria-hidden>
      <path d="M10 2.5l1.8 4.7 4.7 1.8-4.7 1.8L10 15.5l-1.8-4.7-4.7-1.8 4.7-1.8L10 2.5ZM16 13l.9 2.1L19 16l-2.1.9L16 19l-.9-2.1L13 16l2.1-.9L16 13Z" />
    </svg>
  );
}

/**
 * Pastille d'état IA, utilisée dans le fil et sur la page idée.
 * Le violet est réservé à l'IA dans toute l'interface.
 */
export default function AiBadge({ status, score }: { status: AiStatus; score: number | null }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums";

  if (status === "done" && score !== null) {
    return (
      <span className={`${base} ${TIER_CLASSES[scoreTier(score)]}`} title="Score de potentiel estimé par l'IA">
        <SparkIcon />
        {score}
        <span className="font-medium opacity-70">/100</span>
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className={`${base} bg-ai-soft text-ai`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ai" />
        </span>
        IA en cours
      </span>
    );
  }
  return (
    <span className={`${base} bg-bad-soft text-bad`}>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M10 6v5M10 14h.01" strokeLinecap="round" />
        <circle cx="10" cy="10" r="7.5" />
      </svg>
      IA indisponible
    </span>
  );
}
