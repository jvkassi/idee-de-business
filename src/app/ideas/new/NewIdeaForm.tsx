"use client";

import { useActionState } from "react";
import { createIdeaAction, type FormState } from "@/app/actions";
import type { Category } from "@/lib/ideas";

export default function NewIdeaForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createIdeaAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          Titre
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={5}
          maxLength={120}
          placeholder="ex: Livraison de repas faits maison entre voisins"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium mb-1">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          required
          defaultValue=""
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pitch" className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          id="pitch"
          name="pitch"
          required
          minLength={20}
          maxLength={2000}
          rows={6}
          placeholder="Explique le problème, la solution, et pour qui c'est utile."
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60"
      >
        {pending ? "Publication…" : "Publier l'idée"}
      </button>
    </form>
  );
}
