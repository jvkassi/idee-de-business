import { listJobOffers } from "@/lib/jobOffers";
import { syncJobsAction } from "@/app/actions";
import { formatDateTime, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offres d'emploi WhatsApp" };

export default async function JobsPage() {
  const offers = await listJobOffers(50);
  const analyzed = offers.filter((o) => o.aiStatus === "done" && o.ai?.isJobOffer);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">WhatsApp → Gemini</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Offres d&apos;emploi des groupes
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            Opportunités emploi et services VH AGM · Emploi-Business-Vente — {analyzed.length} offre
            {analyzed.length > 1 ? "s" : ""} détectée{analyzed.length > 1 ? "s" : ""} par l&apos;IA
            sur {offers.length} messages.
          </p>
        </div>
        <form action={syncJobsAction}>
          <button type="submit" className="btn btn-sun px-4 py-2 text-sm">
            Synchroniser maintenant
          </button>
        </form>
      </div>

      {analyzed.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-surface-2 text-3xl" aria-hidden>
            💼
          </div>
          <h2 className="font-display text-xl font-bold">Aucune offre détectée pour l&apos;instant</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
            Lance une synchronisation pour récupérer les derniers messages WhatsApp et les faire analyser par
            Gemini. Assure-toi que <code>WAHA_API_KEY</code> est définie sur Vercel.
          </p>
          <form action={syncJobsAction} className="mt-5">
            <button type="submit" className="btn btn-sun">
              Lancer la synchro
            </button>
          </form>
        </div>
      ) : (
        <ul className="space-y-3">
          {analyzed.map((o) => (
            <li key={o.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-2">
                  {o.sourceGroup}
                </span>
                {o.ai?.contractType && (
                  <span className="rounded-full bg-sun-soft px-2 py-0.5 font-medium">{o.ai.contractType}</span>
                )}
                {o.aiScore !== null && (
                  <span className="ml-auto font-display font-bold text-ink">IA {o.aiScore}/100</span>
                )}
              </div>
              <h2 className="mt-2 font-display text-lg font-bold leading-snug">
                {o.ai?.title || "Offre d'emploi"}
              </h2>
              {(o.ai?.company || o.ai?.location || o.ai?.salary) && (
                <p className="mt-1 text-sm text-ink-2">
                  {[o.ai?.company, o.ai?.location, o.ai?.salary].filter(Boolean).join(" · ")}
                </p>
              )}
              {o.ai?.summary && <p className="mt-2 text-[15px] leading-relaxed">{o.ai.summary}</p>}
              {o.ai?.contact && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">Contact : </span>
                  <span className="whitespace-pre-wrap">{o.ai.contact}</span>
                </p>
              )}
              {o.ai?.skills && o.ai.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.ai.skills.map((s) => (
                    <span key={s} className="chip">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <details className="mt-3 text-sm text-ink-2">
                <summary className="cursor-pointer text-xs font-medium text-ink-3 hover:text-ink">
                  Voir le message d&apos;origine
                </summary>
                <p className="mt-1 whitespace-pre-wrap border-l-[3px] border-line-2 pl-3">{o.body}</p>
                <p className="mt-1 text-xs text-ink-3" title={o.postedAt ? formatDateTime(o.postedAt) : undefined}>
                  {o.postedAt ? timeAgo(o.postedAt) : "date inconnue"}
                  {o.author ? ` · ${o.author}` : ""}
                </p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
