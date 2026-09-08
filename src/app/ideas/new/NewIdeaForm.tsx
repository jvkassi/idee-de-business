"use client";

import { useActionState, useState } from "react";
import { createIdeaAction, type FormState } from "@/app/actions";
import type { Category } from "@/lib/ideas";

const LIMITS = { title: { min: 5, max: 120 }, pitch: { min: 20, max: 2000 } };

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const tooShort = value > 0 && value < min;
  return (
    <span className={`text-xs tabular-nums ${tooShort ? "text-warn" : value > max * 0.9 ? "text-bad" : "text-ink-3"}`}>
      {value}/{max}
    </span>
  );
}

export default function NewIdeaForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(createIdeaAction, undefined);
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="title" className="text-sm font-semibold">
            Titre
          </label>
          <Counter value={title.length} {...LIMITS.title} />
        </div>
        <input
          id="title"
          name="title"
          required
          minLength={LIMITS.title.min}
          maxLength={LIMITS.title.max}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ex : Livraison de repas faits maison entre voisins"
          className="input text-base font-medium"
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Catégorie</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c, i) => (
            <label
              key={c.slug}
              className="chip cursor-pointer select-none has-checked:border-ink has-checked:bg-ink has-checked:text-canvas has-focus-visible:ring-2 has-focus-visible:ring-brand"
            >
              <input type="radio" name="category" value={c.slug} required={i === 0} className="sr-only" />
              <span aria-hidden>{c.emoji}</span> {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="pitch" className="text-sm font-semibold">
            Description
          </label>
          <Counter value={pitch.length} {...LIMITS.pitch} />
        </div>
        <textarea
          id="pitch"
          name="pitch"
          required
          minLength={LIMITS.pitch.min}
          maxLength={LIMITS.pitch.max}
          rows={7}
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          placeholder="Le problème que tu as repéré, ta solution, pour qui, et comment ça rapporte."
          className="input resize-y leading-relaxed"
        />
        <p className="mt-1.5 text-xs text-ink-3">
          Minimum {LIMITS.pitch.min} caractères. Plus c&apos;est concret, plus l&apos;analyse IA est utile.
        </p>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-3 text-base">
        {pending ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
            </svg>
            Publication…
          </>
        ) : (
          "Publier l'idée"
        )}
      </button>
    </form>
  );
}
