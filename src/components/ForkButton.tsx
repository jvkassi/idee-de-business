"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { forkIdeaVoiceAction } from "@/app/actions";
import VoiceRecorder from "@/components/VoiceRecorder";

const PROMPTS = [
  "Qu'est-ce que tu changerais dans cette idée ?",
  "Pour qui tu la ferais, toi, précisément ?",
  "Comment tu t'y prendrais différemment ?",
  "C'est quoi ton angle à toi là-dessus ?",
];

/**
 * Reprendre une idée demande sa propre voix : pas une copie silencieuse
 * de l'originale (elle n'apprendrait rien de neuf à l'IA), une vraie
 * fiche née de ce que TOI tu en ferais.
 */
export default function ForkButton({ ideaId, forkCount }: { ideaId: number; forkCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecorded(blob: Blob): Promise<{ ok: boolean; error?: string }> {
    const formData = new FormData();
    formData.append("ideaId", String(ideaId));
    formData.append("audio", blob, `version.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    const result = await forkIdeaVoiceAction(formData);
    if (result.ok) {
      router.push(`/ideas/${result.newIdeaId}?new=1`);
      return { ok: true };
    }
    setError(result.error);
    return { ok: false, error: result.error };
  }

  if (open) {
    return (
      <div className="w-full max-w-sm">
        <VoiceRecorder
          minSeconds={15}
          prompts={PROMPTS}
          idleTitle="Explique ta version, à voix haute"
          idleHint="Dis comment TU ferais cette idée. Quinze secondes minimum — l'IA note et illustre ta propre fiche."
          busyLabel="Création de ta version…"
          onRecorded={handleRecorded}
          onCancel={() => setOpen(false)}
          compact
        />
        {error && <p className="mt-1 text-xs text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="btn btn-outline gap-1.5 px-3 py-2 text-xs"
      title="Enregistre comment tu ferais cette idée à ta façon"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="7.5" y="2.5" width="5" height="8" rx="2.5" />
        <path d="M5 9.5a5 5 0 0 0 10 0M10 14.5v3M7.5 17.5h5" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">Faire ma version</span>
      <span className="sm:hidden">Ma version</span>
      {forkCount > 0 && <span className="tabular-nums text-ink-3">{forkCount}</span>}
    </button>
  );
}
