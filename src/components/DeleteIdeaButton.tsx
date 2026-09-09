"use client";

import { useState, useTransition } from "react";
import { deleteIdeaAction } from "@/app/actions";

export default function DeleteIdeaButton({ ideaId, title }: { ideaId: number; title: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run() {
    startTransition(async () => {
      const result = await deleteIdeaAction(ideaId);
      if (result && !result.ok) setError(result.error);
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn btn-outline border-bad/40 px-3 py-1.5 text-xs text-bad hover:border-bad"
      >
        Supprimer
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 rounded-xl border border-bad/40 bg-bad-soft p-3 text-right">
      <p className="max-w-[16rem] text-xs text-ink-2">
        Supprimer « {title} » définitivement ? Réactions et votes disparaissent aussi. Les versions reprises par
        d&apos;autres restent, indépendantes.
      </p>
      {error && <p className="text-xs font-medium text-bad">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="btn btn-ghost px-3 py-1.5 text-xs">
          Annuler
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={run}
          className="btn px-3 py-1.5 text-xs text-surface"
          style={{ backgroundColor: "var(--color-bad)" }}
        >
          {pending ? "Suppression…" : "Confirmer"}
        </button>
      </div>
    </div>
  );
}
