"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { IdeaDetail } from "@/lib/ideas";
import { KIT_SCORE_THRESHOLD } from "@/lib/constants";
import { refineIdeaVoiceAction, retryKitAction, validateKitAction } from "@/app/actions";
import VoiceRecorder from "@/components/VoiceRecorder";
import KitProgress from "@/components/KitProgress";

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
        {pending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
            </svg>
            Lancement…
          </>
        ) : (
          "Générer mon dossier de démarrage"
        )}
      </button>
      <p className="text-center text-xs text-ink-3">Gratuit · environ 3 minutes · une seule fois</p>
      {error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}
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
      className="btn btn-sun w-full py-3 text-base sm:w-auto"
    >
      {pending ? "Relance…" : "Réessayer la génération"}
    </button>
  );
}

/** Une ligne de "ce qu'il manque" ou de "ce qu'on construit" : tiret court + texte. */
function DashList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`space-y-1.5 text-sm ${className}`}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-[9px] h-px w-3 shrink-0 bg-ink" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Le portillon entre l'analyse IA et le starter kit : sous le seuil, on
 * demande une précision vocale plutôt qu'une nouvelle idée de zéro — au
 * seuil, l'auteur décide seul de lancer la suite (personne d'autre).
 *
 * Pour l'auteur, ce bloc est LA prochaine action : cadre encre, titre
 * explicite, un seul bouton soleil. Pour les autres, c'est une information
 * calme sur l'état de l'idée.
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

  const ownerFrame = isOwner ? "border-ink" : "";

  if (score < KIT_SCORE_THRESHOLD) {
    const missing = KIT_SCORE_THRESHOLD - score;
    return (
      <section className={`card space-y-4 p-5 sm:p-6 ${ownerFrame}`} aria-labelledby="gate-title">
        <div>
          <p className="label">{isOwner ? "Ta prochaine étape" : "Dossier de démarrage"}</p>
          <h3 id="gate-title" className="mt-1 font-display text-xl font-bold leading-snug">
            {isOwner ? (
              <>
                Encore <span className="hl">{missing} point{missing > 1 ? "s" : ""}</span> pour débloquer ton dossier de
                démarrage
              </>
            ) : (
              <>
                {score}/100 — il faut {KIT_SCORE_THRESHOLD}/100 pour débloquer le dossier de démarrage
              </>
            )}
          </h3>
          {isOwner && (
            <p className="mt-1.5 text-sm text-ink-2">
              Ta fiche est à {score}/100, le seuil est à {KIT_SCORE_THRESHOLD}. Le plus souvent, il manque juste des
              détails — pas une autre idée.
            </p>
          )}
        </div>

        {improvementTips.length > 0 && (
          <div>
            <p className="label mb-2">Ce que l&apos;IA n&apos;a pas trouvé dans ta description</p>
            <DashList items={improvementTips} />
          </div>
        )}

        {isOwner ? (
          <div className="border-t border-line pt-4">
            <VoiceRecorder
              minSeconds={10}
              idleTitle="Réponds à ces points à voix haute"
              idleHint="10 secondes minimum. L'IA fusionne ta précision avec la description existante et recalcule la note."
              busyLabel="L'IA retravaille ta fiche…"
              onRecorded={handleRefine}
            />
          </div>
        ) : (
          <p className="border-t border-line pt-4 text-sm text-ink-2">
            Seul <span className="font-medium text-ink">@{idea.authorPseudo}</span> peut préciser cette idée. Tes
            réactions plus bas peuvent l&apos;aider à voir ce qui manque.
          </p>
        )}
      </section>
    );
  }

  if (idea.kitStatus === "none") {
    return (
      <section className={`card space-y-4 p-5 sm:p-6 ${ownerFrame}`} aria-labelledby="gate-title">
        <div>
          <p className="label">{isOwner ? "Ta prochaine étape" : "Seuil atteint"}</p>
          <h3 id="gate-title" className="mt-1 font-display text-xl font-bold leading-snug">
            {isOwner ? (
              <>
                <span className="hl">{score}/100</span> — ton dossier de démarrage est débloqué
              </>
            ) : (
              "Prête pour le dossier de démarrage"
            )}
          </h3>
        </div>
        <DashList
          items={[
            "Une landing page de démo, à ton nom, à montrer et partager",
            "Une esquisse d'architecture et une stack suggérée",
            "Le périmètre MVP : quoi construire d'abord",
            "Un flyer pour WhatsApp, Instagram ou le quartier",
          ]}
        />
        {isOwner ? (
          <ValidateButton ideaId={idea.id} />
        ) : (
          <p className="border-t border-line pt-4 text-sm text-ink-2">
            Seul <span className="font-medium text-ink">@{idea.authorPseudo}</span> peut lancer la génération. Une fois
            prêt, le dossier sera visible ici par tout le monde.
          </p>
        )}
      </section>
    );
  }

  if (idea.kitStatus === "pending") {
    return <KitProgress realStep={idea.kitStep} />;
  }

  if (idea.kitStatus === "failed") {
    return (
      <section className={`card space-y-3 p-5 sm:p-6 ${ownerFrame}`} aria-labelledby="gate-title">
        <div>
          <p className="label text-bad">Dossier de démarrage</p>
          <h3 id="gate-title" className="mt-1 font-display text-xl font-bold leading-snug">
            La génération n&apos;a pas abouti
          </h3>
          <p className="mt-1.5 text-sm text-ink-2">
            Ça arrive quand le modèle est saturé. Rien n&apos;est perdu : ta fiche et ta note restent acquises.
            {isOwner ? " Relance quand tu veux, ça prend jusqu'à 3 minutes." : ` Seul @${idea.authorPseudo} peut relancer.`}
          </p>
        </div>
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Débloqué à {score}/100</p>
            <h3 id="kit-title" className="mt-1 font-display text-xl font-bold leading-snug">
              Dossier de démarrage
            </h3>
          </div>
          <Link href={`/ideas/${idea.id}/site`} className="btn btn-sun w-full sm:w-auto">
            Voir la landing page
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 10h11m0 0-4-4m4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {idea.kitFlyerImage && (
            <div>
              <p className="label mb-2">Flyer</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={idea.kitFlyerImage}
                alt="Flyer généré pour l'idée"
                loading="lazy"
                decoding="async"
                className="mat w-full rounded-xl border border-line"
              />
              <a
                href={idea.kitFlyerImage}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                Ouvrir en grand pour l&apos;enregistrer ou le partager
              </a>
            </div>
          )}

          <div className="space-y-5">
            <div>
              <p className="label mb-2">Périmètre MVP — par quoi commencer</p>
              <DashList items={k.mvpCoreFeatures} />
              <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
                <span className="font-semibold text-ink">Premier jalon :</span> {k.mvpFirstMilestone}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <p className="label mb-2">Architecture</p>
          <p className="text-sm leading-relaxed text-ink-2">{k.systemDesignOverview}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {k.systemComponents.map((c, i) => (
              <li key={i} className="rounded-xl border border-line px-3.5 py-3 text-sm">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="mt-0.5 leading-relaxed text-ink-2">{c.description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            <span className="font-semibold uppercase tracking-[0.08em]">Stack suggérée</span> · {k.techStack.join(" · ")}
          </p>
        </div>
      </section>
    );
  }

  return null;
}
