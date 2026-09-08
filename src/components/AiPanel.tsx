import type { IdeaDetail } from "@/lib/ideas";
import { retryAiAction } from "@/app/actions";
import { SparkIcon } from "@/components/AiBadge";
import ScoreRing from "@/components/ScoreRing";
import RetryButton from "@/components/RetryButton";

function Fact({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2/70 p-3.5">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
        <span aria-hidden>{icon}</span> {label}
      </h3>
      <div className="text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

/** Le bloc "analyse IA" de la page idée, dans ses trois états. */
export default function AiPanel({ idea }: { idea: IdeaDetail }) {
  return (
    <section
      aria-labelledby="ai-title"
      className="card overflow-hidden border-ai/25"
    >
      <div className="flex items-center justify-between gap-3 border-b border-ai/15 bg-[linear-gradient(120deg,var(--ai-soft),transparent_70%)] px-4 py-3 sm:px-5">
        <h2 id="ai-title" className="flex items-center gap-2 font-display text-base font-bold text-ai">
          <SparkIcon className="h-4 w-4" />
          Analyse IA
        </h2>
        {idea.aiStatus === "done" && idea.ai && (
          <span className="text-xs font-medium text-ink-3">Potentiel estimé</span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {idea.aiStatus === "pending" && (
          <div className="space-y-4" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ai" />
              </span>
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">L&apos;IA analyse cette idée</span> — cible, modèle de
                revenus, risques, premiers pas et score. Une vingtaine de secondes ; la page se met à jour toute seule.
              </p>
            </div>
            <div className="space-y-2.5" aria-hidden>
              <div className="skeleton h-3.5 w-11/12" />
              <div className="skeleton h-3.5 w-4/5" />
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
                <div className="skeleton h-20" />
              </div>
            </div>
          </div>
        )}

        {idea.aiStatus === "failed" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-bad">L&apos;analyse n&apos;a pas abouti.</p>
              <p className="mt-0.5 text-ink-2">
                Ça arrive quand le modèle est saturé. Relance-la, ça prend ~20 secondes.
              </p>
              {idea.aiError && (
                <p className="mt-1 truncate font-mono text-[11px] text-ink-3" title={idea.aiError}>
                  {idea.aiError}
                </p>
              )}
            </div>
            <RetryButton
              action={retryAiAction.bind(null, idea.id)}
              label="Relancer l'analyse"
              className="border-bad/40 text-bad hover:border-bad"
            />
          </div>
        )}

        {idea.aiStatus === "done" && idea.ai && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <ScoreRing score={idea.ai.score} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-relaxed text-ink">{idea.ai.summary}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Fact icon="🎯" label="Cible">
                <p>{idea.ai.targetAudience}</p>
              </Fact>
              <Fact icon="💎" label="Proposition de valeur">
                <p>{idea.ai.valueProposition}</p>
              </Fact>
              <Fact icon="💰" label="Modèle de revenus">
                <p>{idea.ai.revenueModel}</p>
              </Fact>
              <Fact icon="⚠️" label="Risques">
                <ul className="space-y-1">
                  {idea.ai.risks.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Fact>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                <span aria-hidden>🚀</span> Premiers pas
              </h3>
              <ol className="space-y-2">
                {idea.ai.firstSteps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ai-soft font-display text-xs font-bold text-ai">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
