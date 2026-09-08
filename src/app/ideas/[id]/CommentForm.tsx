"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { addCommentAction, type FormState } from "@/app/actions";

export default function CommentForm({
  ideaId,
  loggedIn,
}: {
  ideaId: number;
  loggedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    addCommentAction,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  if (!loggedIn) {
    return (
      <p className="text-sm text-neutral-500">
        <Link href="/login" className="underline">
          Connecte-toi
        </Link>{" "}
        pour laisser un commentaire.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="ideaId" value={ideaId} />
      <textarea
        name="body"
        required
        minLength={2}
        maxLength={1000}
        rows={3}
        placeholder="Ton avis sur cette idée…"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 text-white px-4 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? "Envoi…" : "Commenter"}
      </button>
    </form>
  );
}
