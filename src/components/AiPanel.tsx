import type { IdeaDetail } from "@/lib/ideas";
import { retryAiAction } from "@/app/actions";
import { AiTag, Pulse } from "@/components/AiBadge";
import ScoreMeter from "@/components/ScoreMeter";
import RetryButton from "@/components/RetryButton";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 border-t border-line py-4 first:border-t-0 first:pt-0 sm:grid-cols-[150px_1fr] sm:gap-6">
      <dt className="label pt-0.5">{label}</dt>
      <dd className="text-[15px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

function StatusLine({
  status,
  label,
  doneLabel,
  pendingLabel,
}: {
  status: string;
  label: string;
  doneLabel: string;
  pendingLabel: string;
}) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="grid w-4 place-items-center">
        {status === "pending" ? (
          <Pulse />
        ) : status === "done" ? (
          <svg viewBox="0 0 20 20" className="h-4 w-4 text-ok" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-line-2" aria-hidden />
        )}
      </span>
      <span className="font-medium text-ink">{label}</span>
      <span className="text-ink-3">{status === "pending" ? pendingLabel : status === "done" ? doneLabel : "—"}</span>
    </li>
  );
}

/**
 * La fiche IA : la voix de la machine. Encre sur papier, libellés en
 * capitales, filets fins, une jauge honnête. Trois états : en cours (avec
 * l'avancement réel des deux traitements), échec, terminé.
 */
export default function AiPanel({ idea }: { idea: IdeaDetail }) {
  return (
    <section aria-labelledby="ai-title" className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <h2 id="ai-title" className="flex items-center gap-2 font-display text-base font-bold">
          <AiTag />
          Fiche générée
        </h2>
        <span className="text-xs text-ink-3">Gemini · estimation automatique</span>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {idea.aiStatus === "pending" && (
          <div className="grid gap-6 sm:grid-cols-[240px_1fr]" aria-live="polite">
            <div>
              <p className="font-display text-lg font-bold leading-snug">La machine lit ton idée.</p>
              <p className="mt-1 text-sm text-ink-2">
                Une vingtaine de secondes. La page se met à jour toute seule.
              </p>
              <ul className="mt-4 space-y-2.5">
                <StatusLine
                  status={idea.aiStatus}
                  label="Analyse"
                  doneLabel="terminée"
                  pendingLabel="cible, valeur, revenus, risques, note…"
                />
                <StatusLine
                  status={idea.coverStatus}
                  label="Illustration"
                  doneLabel="prête"
                  pendingLabel="en cours de dessin"
                />
              </ul>
            </div>
            <div className="space-y-3" aria-hidden>
              <div className="skeleton h-10 w-28" />
              <div className="skeleton h-3.5 w-11/12" />
              <div className="skeleton h-3.5 w-4/5" />
              <div className="skeleton h-3.5 w-2/3" />
              <div className="mt-5 space-y-2.5">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-3.5 w-full" />
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-3.5 w-11/12" />
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
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-[200px_1fr] sm:gap-8">
              <ScoreMeter score={idea.ai.score} />
              <p className="text-[15px] leading-relaxed text-ink sm:text-base">{idea.ai.summary}</p>
            </div>

            <dl className="border-t border-line pt-4">
              <Row label="Cible">
                <p>{idea.ai.targetAudience}</p>
              </Row>
              <Row label="Proposition de valeur">
                <p>{idea.ai.valueProposition}</p>
              </Row>
              <Row label="Modèle de revenus">
                <p>{idea.ai.revenueModel}</p>
              </Row>
              <Row label="Risques">
                <ul className="space-y-1.5">
                  {idea.ai.risks.map((r, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="mt-[11px] h-px w-3 shrink-0 bg-ink" aria-hidden />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Row>
              <Row label="Premiers pas">
                <ol className="space-y-2">
                  {idea.ai.firstSteps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-ink font-display text-xs font-bold tabular-nums">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{s}</span>
                    </li>
                  ))}
                </ol>
              </Row>
            </dl>

            <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
              Cette fiche est déduite du texte de l&apos;idée, rien de plus. La note situe un potentiel, elle ne le
              prouve pas — les votes et les réactions de la communauté pèsent autant.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
