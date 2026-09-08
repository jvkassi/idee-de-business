"use client";

import { useTransition } from "react";
import { retryAiAction } from "@/app/actions";

export default function RetryAiButton({ ideaId }: { ideaId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => retryAiAction(ideaId))}
      className="rounded-md border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {pending ? "Nouvelle tentative…" : "Réessayer l'analyse IA"}
    </button>
  );
}
