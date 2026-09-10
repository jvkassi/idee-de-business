"use client";

import { useActionState, useState, useTransition } from "react";
import {
  describeYourselfAction,
  enhancePhotoAction,
  redoCvAction,
  uploadCvAction,
  uploadPhotoAction,
  type FormState,
} from "@/app/actions";

function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
      {error}
    </p>
  );
}

export function PhotoUploadForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(uploadPhotoAction, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="photo" className="block text-sm font-semibold">
        📸 Ma photo
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="photo" name="photo" type="file" accept="image/*" required className="input max-w-xs text-sm" />
        <button type="submit" disabled={pending} className="btn btn-outline px-4 py-2 text-sm">
          {pending ? "Envoi…" : "Mettre ma photo"}
        </button>
      </div>
      <ErrorNote error={state?.error} />
    </form>
  );
}

export function EnhancePhotoButton() {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setResult(null);
          const r = await enhancePhotoAction();
          setResult(r.ok ? "✨ Ta photo est prête !" : (r.error ?? "Raté, réessaie."));
        })}
        className="btn btn-sun px-4 py-2 text-sm"
      >
        {pending ? "Djossi retouche… (30 s)" : "✨ Rendre ma photo pro"}
      </button>
      {result && <p className="text-sm text-ink-2">{result}</p>}
    </div>
  );
}

export function CvUploadForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(uploadCvAction, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="cv" className="block text-sm font-semibold">
        📄 Mon CV
      </label>
      <p className="text-xs text-ink-3">PDF ou photo — Djossi le lit et remplit ton profil tout seul.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="cv"
          name="cv"
          type="file"
          accept="application/pdf,image/*"
          required
          className="input max-w-xs text-sm"
        />
        <button type="submit" disabled={pending} className="btn btn-outline px-4 py-2 text-sm">
          {pending ? "Lecture… (20 s)" : "Envoyer mon CV"}
        </button>
      </div>
      <ErrorNote error={state?.error} />
      {"ok" in (state ?? {}) && (
        <p className="text-sm font-medium text-ok">Bien reçu ! Ton profil est rempli 👇</p>
      )}
    </form>
  );
}

export function AboutForm({ hasProfile }: { hasProfile: boolean }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(describeYourselfAction, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <label htmlFor="about" className="block text-sm font-semibold">
        ✏️ {hasProfile ? "Préciser mon profil" : "Je me raconte"}
      </label>
      <p className="text-xs text-ink-3">
        Quelques phrases : ce que tu fais, ce que tu cherches, où tu es. Djossi s&apos;occupe du reste.
      </p>
      <textarea
        id="about"
        name="about"
        rows={4}
        minLength={30}
        maxLength={3000}
        required
        placeholder="Ex : Je m'appelle Awa, je suis serveuse à Abidjan depuis 3 ans, je cherche un poste en restauration à Cocody…"
        className="input min-h-24"
      />
      <button type="submit" disabled={pending} className="btn btn-sun px-4 py-2 text-sm">
        {pending ? "Djossi écrit… (15 s)" : hasProfile ? "Mettre à jour" : "Créer mon profil"}
      </button>
      <ErrorNote error={state?.error} />
      {"ok" in (state ?? {}) && <p className="text-sm font-medium text-ok">C&apos;est noté ! 👇</p>}
    </form>
  );
}

export function RedoCvSection() {
  const [cv, setCv] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const r = await redoCvAction();
          if (r.ok) setCv(r.cv);
          else setError(r.error);
        })}
        className="btn btn-sun px-4 py-2 text-sm"
      >
        {pending ? "Djossi réécrit… (20 s)" : "📝 Refaire mon CV"}
      </button>
      {error && <ErrorNote error={error} />}
      {cv && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Ton nouveau CV — à copier où tu veux</p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(cv).catch(() => {})}
              className="btn btn-ghost px-3 py-1.5 text-xs"
            >
              Copier
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed">{cv}</pre>
        </div>
      )}
    </div>
  );
}
