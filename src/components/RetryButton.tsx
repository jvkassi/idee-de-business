"use client";

import { useTransition } from "react";

/**
 * Bouton "réessayer" générique : reçoit une Server Action déjà liée
 * (ex. `retryAiAction.bind(null, id)`) depuis un composant serveur.
 */
export default function RetryButton({
  action,
  label = "Réessayer",
  pendingLabel = "Relance…",
  className = "",
}: {
  action: () => Promise<void>;
  label?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => action())}
      className={`btn btn-outline shrink-0 px-3 py-1.5 text-xs ${className}`}
    >
      <svg
        viewBox="0 0 20 20"
        className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {pending ? pendingLabel : label}
    </button>
  );
}
