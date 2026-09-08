"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "@/app/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="pseudo" className="mb-1.5 block text-sm font-semibold">
          Ton pseudo
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-base font-bold text-ink-3">
            @
          </span>
          <input
            id="pseudo"
            name="pseudo"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_\-]{3,20}"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
            placeholder="jean_biz"
            className="input pl-9 text-base font-medium"
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-3">3 à 20 caractères : lettres, chiffres, _ ou -.</p>
      </div>

      {state?.error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft px-3.5 py-2.5 text-sm text-bad">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-3 text-base">
        {pending ? "Connexion…" : "C'est parti"}
      </button>
      {next !== "/" && (
        <p className="text-center text-xs text-ink-3">Tu seras redirigé là où tu en étais.</p>
      )}
    </form>
  );
}
