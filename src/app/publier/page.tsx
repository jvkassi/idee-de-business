import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loginHref } from "@/lib/format";
import { listMyDirectOffers, type DirectOfferStatus } from "@/lib/directOffers";
import PublierForm from "./PublierForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publier une offre" };

function StatusBadge({ status }: { status: DirectOfferStatus }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok">
        Publiée
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad">
        Refusée
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
      En relecture
    </span>
  );
}

export default async function PublierPage() {
  const user = await getSession();
  if (!user) redirect(loginHref("/publier"));
  const offers = await listMyDirectOffers(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="label">Djossi · proposer un poste</p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Tu recrutes ? <span className="hl">Dis-le ici.</span>
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          Décris le poste simplement, comme tu le raconterais sur WhatsApp. Djossi relit chaque offre avant
          publication (moins de 24 h) — c&apos;est gratuit, et pas besoin de quitter l&apos;appli.
        </p>
      </div>

      <section className="card p-4 sm:p-6" aria-label="Proposer une offre d'emploi">
        <PublierForm />
      </section>

      <section className="card p-4 sm:p-5" aria-label="Tes offres envoyées">
        <h2 className="font-display text-lg font-bold">Tes offres envoyées</h2>
        {offers.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-2">
            Rien pour l&apos;instant — ta première offre apparaîtra ici dès que tu l&apos;auras envoyée 👆
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {offers.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{o.title}</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {[o.company, o.location, o.contractType].filter(Boolean).join(" · ") || "Sans précision"}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
