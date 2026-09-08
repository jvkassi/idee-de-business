"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-bad-soft text-4xl" aria-hidden>
        ⚡
      </div>
      <p className="font-display text-sm font-bold uppercase tracking-widest text-bad">Oups</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Quelque chose a court-circuité</h1>
      <p className="mt-3 text-ink-2">
        Une erreur inattendue s&apos;est produite de notre côté. Réessaie dans un instant.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-ink-3">Référence : {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Réessayer
        </button>
        <Link href="/" className="btn btn-outline">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
