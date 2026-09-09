"use client";

import { useActionState, useEffect, useRef } from "react";
import { addCommentAction, type FormState } from "@/app/actions";
import Avatar from "@/components/Avatar";

export default function CommentForm({ ideaId, pseudo }: { ideaId: number; pseudo: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addCommentAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Après un envoi réussi (state = {}), on vide le champ.
    if (!pending && state && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="card flex gap-3 p-4">
      <Avatar pseudo={pseudo} />
      <div className="min-w-0 flex-1 space-y-2">
        <input type="hidden" name="ideaId" value={ideaId} />
        <label htmlFor="comment-body" className="sr-only">
          Ta réaction
        </label>
        <textarea
          id="comment-body"
          name="body"
          required
          minLength={2}
          maxLength={1000}
          rows={3}
          placeholder="Ton avis, une question, une piste pour aller plus loin…"
          className="input resize-y"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-bad" role="alert">
            {state?.error}
          </p>
          <button type="submit" disabled={pending} className="btn btn-sun px-4 py-2">
            {pending ? "Envoi…" : "Réagir"}
          </button>
        </div>
      </div>
    </form>
  );
}
