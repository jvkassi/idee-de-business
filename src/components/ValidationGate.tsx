"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IdeaDetail } from "@/lib/ideas";
import { KIT_SCORE_THRESHOLD } from "@/lib/constants";
import { refineIdeaVoiceAction, retryKitAction, validateKitAction } from "@/app/actions";
import VoiceRecorder from "@/components/VoiceRecorder";

function ValidateButton({ ideaId }: { ideaId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      const result = await validateKitAction(ideaId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={run} disabled={pending} className="btn btn-sun w-full py-3 text-base">
        {pending ? "Lancement…" : "Valider et lancer la génération"}
      </button>
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}

function RetryKitButton({ ideaId }: { ideaId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => {
        await retryKitAction(ideaId);
        router.refresh();
      })}
      className="btn btn-outline border-bad/40 px-4 py-2 text-sm text-bad hover:border-bad"
    >
      {pending ? "Relance…" : "Réessayer la génération"}
    </button>
  );
}

/**
 * Le portillon entre l'analyse IA et le starter kit : sous le seuil, on
 * demande une précision vocale plutôt qu'une nouvelle idée de zéro — au
 * seuil, l'auteur décide seul de lancer la suite (personne d'autre).
 */
export default function ValidationGate({ idea, isOwner }: { idea: IdeaDetail; isOwner: boolean }) {
  const router = useRouter();

  if (idea.aiStatus !== "done" || !idea.ai) return null;
  const { score, improvementTips } = idea.ai;

  async function handleRefine(blob: Blob): Promise<{ ok: boolean; error?: string }> {
    const formData = new FormData();
    formData.append("ideaId", String(idea.id));
    formData.append("audio", blob, `precision.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    const result = await refineIdeaVoiceAction(formData);
    if (result.ok) router.refresh();
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  if (score < KIT_SCORE_THRESHOLD) {
    return (
      <section className="card space-y-4 p-5 sm:p-6" aria-labelledby="gate-title">
        <div>
          <p className="label">Pas encore assez solide</p>
          <h3 id="gate-title" className="mt-1 font-display text-lg font-bold">
            {score}/100 — il faut {KIT_SCORE_THRESHOLD}/100 pour débloquer le dossier de démarrage
          </h3>
        </div>
        {improvementTips.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {improvementTips.map((tip, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[9px] h-px w-3 shrink-0 bg-ink" aria-hidden />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
        {isOwner ? (
          <div className="border-t border-line pt-4">
            <p className="mb-3 text-sm font-medium">Précise ton idée à voix haute pour améliorer la note :</p>
            <VoiceRecorder
              minSeconds={10}
              idleTitle="Ajoute une précision vocale"
              idleHint="Réponds aux points ci-dessus. L'IA fusionne avec ta description existante et relance l'analyse."
              busyLabel="L'IA retravaille ta fiche…"
              onRecorded={handleRefine}
            />
          </div>
        ) : (
          <p className="border-t border-line pt-4 text-sm text-ink-2">
            Seul <span className="font-medium text-ink">@{idea.authorPseudo}</span> peut préciser cette idée.
          </p>
        )}
      </section>
    );
  }

  if (idea.kitStatus === "none") {
    return (
      <section className="card space-y-3 p-5 sm:p-6">
        <p className="label">Seuil atteint</p>
        <h3 className="font-display text-lg font-bold">Prête pour le dossier de démarrage</h3>
        <p className="text-sm text-ink-2">
          Landing page, esquisse d&apos;architecture, périmètre MVP et un flyer — généré à partir de cette fiche.
        </p>
        {isOwner ? (
          <ValidateButton ideaId={idea.id} />
        ) : (
          <p className="text-sm text-ink-2">
            Seul <span className="font-medium text-ink">@{idea.authorPseudo}</span> peut lancer la génération.
          </p>
        )}
      </section>
    );
  }

  if (idea.kitStatus === "pending") {
    return (
      <section className="card space-y-2 p-5 text-center sm:p-6" aria-live="polite">
        <svg className="mx-auto h-6 w-6 animate-spin text-ink-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium">Le dossier de démarrage se prépare (~40 s)…</p>
      </section>
    );
  }

  if (idea.kitStatus === "failed") {
    return (
      <section className="card space-y-3 p-5 sm:p-6">
        <p className="text-sm font-semibold text-bad">La génération n&apos;a pas abouti.</p>
        {idea.kitError && (
          <p className="truncate font-mono text-[11px] text-ink-3" title={idea.kitError}>
            {idea.kitError}
          </p>
        )}
        {isOwner && <RetryKitButton ideaId={idea.id} />}
      </section>
    );
  }

  if (idea.kitStatus === "done" && idea.kit) {
    const k = idea.kit;
    return (
      <section className="card space-y-5 p-5 sm:p-6" aria-labelledby="kit-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="kit-title" className="font-display text-lg font-bold">
            Dossier de démarrage
          </h3>
          <Link href={`/ideas/${idea.id}/site`} className="btn btn-sun px-4 py-2 text-sm">
            Voir la landing page
          </Link>
        </div>

        {idea.kitFlyerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.kitFlyerImage} alt="Flyer de l'idée" className="w-full max-w-xs rounded-xl border border-line" />
        )}

        <div>
          <p className="label mb-2">Architecture</p>
          <p className="text-sm leading-relaxed text-ink-2">{k.systemDesignOverview}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {k.systemComponents.map((c, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{c.name}</span> — {c.description}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">{k.techStack.join(" · ")}</p>
        </div>

        <div>
          <p className="label mb-2">Périmètre MVP</p>
          <ul className="space-y-1 text-sm">
            {k.mvpCoreFeatures.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[9px] h-px w-3 shrink-0 bg-ink" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">Premier jalon : {k.mvpFirstMilestone}</p>
        </div>
      </section>
    );
  }

  return null;
}
