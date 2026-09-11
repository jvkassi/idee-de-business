"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_PROMPTS = [
  "Quel problème as-tu remarqué ? Sois concret.",
  "Comment tu le résous ? Décris ta solution en détail.",
  "Qui en a besoin, ici, en Côte d'Ivoire ?",
  "Comment ça gagne de l'argent ? Mobile Money, abonnement, commission ?",
  "Un détail de plus ne fera pas de mal — continue.",
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type Status = "idle" | "requesting" | "recording" | "submitting" | "error";

function Spinner({ className = "h-6 w-6 text-ink-2" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0Zm6 9v2h-2v-2Z" />
    </svg>
  );
}

/**
 * Enregistreur vocal, quatre états visibles : prêt, micro demandé,
 * enregistrement, envoi. Le bouton de départ porte toujours un libellé
 * écrit — un rond jaune seul ne dit pas ce qui va se passer à quelqu'un qui
 * arrive pour la première fois.
 */
export default function VoiceRecorder({
  minSeconds = 30,
  prompts = DEFAULT_PROMPTS,
  idleTitle = "Raconte ton idée à voix haute",
  idleHint = "Le problème, ta solution, pour qui, comment ça rapporte. Minimum 30 secondes — sois verbeux, plus tu donnes de détails, mieux Djossi te comprend.",
  busyLabel = "Transcription en cours…",
  onRecorded,
  onCancel,
  compact = false,
}: {
  minSeconds?: number;
  prompts?: string[];
  idleTitle?: string;
  idleHint?: string;
  busyLabel?: string;
  onRecorded: (blob: Blob) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setStatus("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setStatus("error");
      setError(
        "Micro inaccessible. Autorise le micro pour ce site dans ton navigateur (souvent l'icône à gauche de l'adresse), puis réessaie — ou tape ton idée.",
      );
    }
  }

  function stopTracks() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function finish() {
    const recorder = recorderRef.current;
    if (!recorder) return;

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      recorder.stop();
    });
    stopTracks();
    setStatus("submitting");

    const result = await onRecorded(blob);
    if (!result.ok) {
      setStatus("error");
      setError(result.error || "Échec du traitement de l'enregistrement.");
      return;
    }
    setStatus("idle");
    setSeconds(0);
  }

  function cancel() {
    recorderRef.current?.stop();
    stopTracks();
    setStatus("idle");
    setSeconds(0);
    onCancel?.();
  }

  const canFinish = seconds >= minSeconds;
  const remaining = Math.max(0, minSeconds - seconds);
  const promptIndex = Math.min(Math.floor(seconds / 8), prompts.length - 1);
  const pad = compact ? "py-6" : "py-8 sm:py-10";

  if (status === "submitting") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-4 ${pad} text-center`}
        role="status"
        aria-live="polite"
      >
        <Spinner />
        <div>
          <p className="text-sm font-semibold">{busyLabel}</p>
          <p className="mt-1 max-w-xs text-xs text-ink-3">
            Envoi de ta voix puis transcription : une dizaine de secondes, un peu plus si la connexion est lente. Ne
            ferme pas la page.
          </p>
        </div>
      </div>
    );
  }

  if (status === "recording") {
    return (
      <div className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-ink bg-surface px-4 ${pad} text-center`}>
        <div className="flex items-center gap-2 font-mono text-3xl font-bold tabular-nums" aria-live="off">
          <span className="h-3 w-3 animate-pulse rounded-full bg-bad" aria-hidden />
          {formatTime(seconds)}
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-bad">Enregistrement en cours</p>
        {minSeconds > 0 && (
          <>
            <p className="min-h-[1.5rem] max-w-sm px-2 text-sm font-medium text-ink-2" aria-live="polite">
              {prompts[promptIndex]}
            </p>
            <div className="w-full max-w-xs">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-sun transition-[width]"
                  style={{ width: `${Math.min(100, (seconds / minSeconds) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {canFinish ? "Minimum atteint — continue si tu as encore des détails, ou termine." : `Minimum ${minSeconds} s — encore ${remaining} s.`}
              </p>
            </div>
          </>
        )}
        <div className="flex w-full max-w-xs flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
          <button type="button" onClick={cancel} className="btn btn-ghost px-4 py-2.5 text-sm">
            Annuler
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!canFinish}
            title={canFinish ? undefined : `Encore ${remaining}s`}
            className="btn btn-sun flex-1 px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canFinish ? "Terminer l'enregistrement" : `Encore ${remaining} s…`}
          </button>
        </div>
      </div>
    );
  }

  const requesting = status === "requesting";

  if (compact) {
    return (
      <div className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 ${pad} text-center`}>
        <button
          type="button"
          onClick={start}
          disabled={requesting}
          className="btn btn-sun px-5 py-3 text-sm"
        >
          {requesting ? <Spinner className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          {requesting ? "Autorise le micro…" : idleTitle}
        </button>
        {onCancel && !requesting && (
          <button type="button" onClick={onCancel} className="text-xs font-medium text-ink-2 underline-offset-4 hover:underline">
            Plutôt écrire
          </button>
        )}
        {error && (
          <p role="alert" className="max-w-xs rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs text-bad">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface px-4 ${pad} text-center`}>
      <button
        type="button"
        onClick={start}
        disabled={requesting}
        className="group flex flex-col items-center gap-3 rounded-2xl px-4 py-2 disabled:opacity-60"
      >
        <span className="grid h-20 w-20 place-items-center rounded-full border-2 border-ink bg-sun text-ink shadow-pop transition-transform group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-none">
          {requesting ? <Spinner className="h-7 w-7 text-ink" /> : <MicIcon className="h-8 w-8" />}
        </span>
        <span className="btn btn-ink pointer-events-none px-5 py-2.5 text-sm">
          {requesting ? "Autorise le micro…" : "Appuie pour enregistrer"}
        </span>
      </button>
      <div>
        <p className="text-sm font-semibold">{idleTitle}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-ink-3">{idleHint}</p>
      </div>
      {error && (
        <p role="alert" className="max-w-sm rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-left text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
