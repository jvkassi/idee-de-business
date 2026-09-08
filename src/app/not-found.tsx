import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-surface-2 text-4xl" aria-hidden>
        🔍
      </div>
      <p className="font-display text-sm font-bold uppercase tracking-widest text-brand">Erreur 404</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Cette idée n&apos;existe pas (encore)</h1>
      <p className="mt-3 text-ink-2">
        Le lien est peut-être erroné, ou l&apos;idée a été retirée. En revanche, il y en a plein d&apos;autres qui
        attendent ton avis.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Explorer les idées
        </Link>
        <Link href="/ideas/new" className="btn btn-outline">
          Proposer la mienne
        </Link>
      </div>
    </div>
  );
}
