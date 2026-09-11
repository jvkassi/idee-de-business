"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCommentAction, addVoiceCommentAction, type FormState } from "@/app/actions";
import Avatar from "@/components/Avatar";
import VoiceRecorder from "@/components/VoiceRecorder";

export default function CommentForm({ ideaId, pseudo }: { ideaId: number; pseudo: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(addCommentAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [voiceMode, setVoiceMode] = useState(false);

  useEffect(() => {
    // Après un envoi réussi (state = {}), on vide le champ.
    if (!pending && state && !state.error) formRef.current?.reset();
  }, [pending, state]);

  async function handleVoiceComment(blob: Blob) {
    const formData = new FormData();
    formData.append("ideaId", String(ideaId));
    formData.append("audio", blob, `commentaire.${blob.type.includes("mp4") ? "m4a" : "webm"}`);
    const result = await addVoiceCommentAction(formData);
    if (result.ok) {
      setVoiceMode(false);
      router.refresh();
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  return (
    <div className="card flex gap-3 p-4">
      <Avatar pseudo={pseudo} />
      <div className="min-w-0 flex-1 space-y-2">
        {voiceMode ? (
          <VoiceRecorder
            minSeconds={0}
            compact
            idleTitle="Enregistrer ma réaction"
            busyLabel="Djossi écoute ta réaction…"
            onRecorded={handleVoiceComment}
            onCancel={() => setVoiceMode(false)}
          />
        ) : (
          <form ref={formRef} action={formAction} className="space-y-2">
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
            {state?.error && (
              <p className="text-xs text-bad" role="alert">
                {state.error}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setVoiceMode(true)}
                className="btn btn-outline px-3 py-2 text-xs"
                title="Réagir à voix haute"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <rect x="6" y="1.5" width="4" height="8" rx="2" />
                  <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0h-1.3a3.2 3.2 0 0 1-6.4 0Zm4.5 6v1.3H6.6v1.2h2.8v-1.2H8Z" />
                </svg>
                Réagir en vocal
              </button>
              <button type="submit" disabled={pending} className="btn btn-sun px-4 py-2">
                {pending ? "Envoi…" : "Réagir"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
