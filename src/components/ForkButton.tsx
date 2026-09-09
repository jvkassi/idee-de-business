"use client";

import { useTransition } from "react";
import { forkIdeaAction } from "@/app/actions";

/**
 * Fork : copie l'idée sous ton pseudo pour la faire évoluer de ton côté.
 * Ouvert à tout le monde, y compris l'auteur (il peut forker sa propre
 * idée pour explorer une variante) — comme sur GitHub.
 */
export default function ForkButton({ ideaId, forkCount }: { ideaId: number; forkCount: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => forkIdeaAction(ideaId))}
      className="btn btn-outline gap-1.5 px-3 py-2 text-xs"
      title="Reprendre cette idée pour la faire évoluer de ton côté"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <circle cx="4" cy="3.5" r="1.5" />
        <circle cx="12" cy="3.5" r="1.5" />
        <circle cx="8" cy="12.5" r="1.5" />
        <path d="M4 5v1.5A2.5 2.5 0 0 0 6.5 9h3A2.5 2.5 0 0 0 12 6.5V5M8 9v2" strokeLinecap="round" />
      </svg>
      {pending ? "Fork…" : "Forker"}
      {forkCount > 0 && <span className="tabular-nums text-ink-3">{forkCount}</span>}
    </button>
  );
}
