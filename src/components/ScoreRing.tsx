import { scoreTier } from "@/components/AiBadge";

const TIER_STROKE = { high: "text-ok", mid: "text-warn", low: "text-ink-3" } as const;

/** Anneau de score 0-100 (SVG pur, rendu serveur). */
export default function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score IA : ${score} sur 100`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="stroke-line" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`stroke-current ${TIER_STROKE[scoreTier(score)]}`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-xl font-bold leading-none tabular-nums">{score}</span>
      </div>
    </div>
  );
}
