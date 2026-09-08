"use client";

import { useTransition } from "react";
import { retryCoverAction } from "@/app/actions";

export default function RetryCoverButton({ ideaId }: { ideaId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => retryCoverAction(ideaId))}
      className="shrink-0 rounded-md border border-red-300 px-3 py-1 hover:bg-red-100 disabled:opacity-60"
    >
      {pending ? "Nouvelle tentative…" : "Réessayer"}
    </button>
  );
}
