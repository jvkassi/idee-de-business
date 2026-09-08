"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <div className="max-w-sm mx-auto rounded-lg border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-semibold mb-1">Connexion</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Pas de mot de passe : choisis un pseudo, c&apos;est ton identité ici. Si le
        pseudo existe déjà, tu te reconnectes dessus.
      </p>
      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="pseudo" className="block text-sm font-medium mb-1">
            Pseudo
          </label>
          <input
            id="pseudo"
            name="pseudo"
            required
            minLength={3}
            maxLength={20}
            placeholder="ex: jean_biz"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 text-white py-2 text-sm font-medium hover:bg-neutral-700 disabled:opacity-60"
        >
          {pending ? "Connexion…" : "Continuer"}
        </button>
      </form>
    </div>
  );
}
