"use client";

import { useEffect, useRef, useState } from "react";
import { transcribeIdeaAudioAction } from "@/app/actions";
import type { VoiceIdeaDraft } from "@/lib/gemini";

const MIN_SECONDS = 30;

// Guide la personne à travers un pitch complet plutôt qu'une phrase vague ;
// change au fil de l'enregistrement pour encourager la verbosité demandée.
const PROMPTS = [
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

type Status = "idle" | "requesting" | "recording" | "transcribing" | "error";

export default function VoiceRecorder({ onTranscribed }: { onTranscribed: (draft: VoiceIdeaDraft) => void }) {
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
      setError("Micro inaccessible. Vérifie l'autorisation du navigateur, ou écris ton idée directement.");
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
    setStatus("transcribing");

    const formData = new FormData();
    formData.append("audio", blob, `idee.${blob.type.includes("mp4") ? "m4a" : "webm"}`);

    const result = await transcribeIdeaAudioAction(formData);
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      return;
    }
    setStatus("idle");
    setSeconds(0);
    onTranscribed(result);
  }

  function cancel() {
    recorderRef.current?.stop();
    stopTracks();
    setStatus("idle");
    setSeconds(0);
  }

  const canFinish = seconds >= MIN_SECONDS;
  const promptIndex = Math.min(Math.floor(seconds / 8), PROMPTS.length - 1);

  if (status === "transcribing") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface py-10 text-center">
        <svg className="h-6 w-6 animate-spin text-ink-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium">L&apos;IA transcrit ton idée…</p>
        <p className="max-w-xs text-xs text-ink-3">Ça prend quelques secondes, le temps que Gemini écoute tout.</p>
      </div>
    );
  }

  if (status === "recording") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-ink bg-surface py-10 text-center">
        <div className="flex items-center gap-2 font-mono text-3xl font-bold tabular-nums">
          <span className="h-3 w-3 animate-pulse rounded-full bg-bad" aria-hidden />
          {formatTime(seconds)}
        </div>
        <p className="min-h-[1.5rem] max-w-sm px-4 text-sm font-medium text-ink-2">{PROMPTS[promptIndex]}</p>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-sun transition-[width]"
            style={{ width: `${Math.min(100, (seconds / MIN_SECONDS) * 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={cancel} className="btn btn-ghost px-4 py-2 text-sm">
            Annuler
          </button>
          <button
            type="button"
            onClick={finish}
            disabled={!canFinish}
            title={canFinish ? undefined : `Encore ${MIN_SECONDS - seconds}s pour donner assez de détails`}
            className="btn btn-sun px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canFinish ? "Terminer l'enregistrement" : `Encore ${MIN_SECONDS - seconds}s…`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface py-10 text-center">
      <button
        type="button"
        onClick={start}
        disabled={status === "requesting"}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sun text-ink shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
        aria-label="Démarrer l'enregistrement"
      >
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0Zm6 9v2h-2v-2Z" />
        </svg>
      </button>
      <div>
        <p className="text-sm font-semibold">Raconte ton idée à voix haute</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-ink-3">
          Le problème, ta solution, pour qui, comment ça rapporte. Minimum 30 secondes — sois verbeux,
          plus tu donnes de détails, meilleure sera l&apos;analyse.
        </p>
      </div>
      {error && (
        <p role="alert" className="max-w-xs rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
