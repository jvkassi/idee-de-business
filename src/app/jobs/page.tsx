import Link from "next/link";
import { listJobOffers } from "@/lib/jobOffers";
import { syncJobsAction } from "@/app/actions";
import { getSession } from "@/lib/session";
import { getProfile } from "@/lib/profile";
import { ensureMatches, type MatchMap } from "@/lib/matching";
import { formatDateTime, timeAgo } from "@/lib/format";
import { resolveApplyChannels, shortUrl, threadPartCount, whatsappLink } from "@/lib/applyChannels";

export const dynamic = "force-dynamic";
// Le matching (1 appel Gemini) peut prendre quelques secondes.
export const maxDuration = 60;
export const metadata = { title: "Offres d'emploi WhatsApp" };

function matchColor(score: number): string {
  if (score >= 75) return "bg-ok-soft text-ok";
  if (score >= 50) return "bg-sun-soft text-ink";
  return "bg-surface-2 text-ink-2";
}

export default async function JobsPage() {
  const [offers, user] = await Promise.all([listJobOffers(50), getSession()]);
  const analyzed = offers.filter((o) => o.aiStatus === "done" && o.ai?.isJobOffer);

  // Matchs persos : seulement si connecté avec un profil rempli.
  let matches: MatchMap = new Map();
  let hasProfile = false;
  if (user) {
    const profile = await getProfile(user.id);
    hasProfile = !!profile && Boolean(profile.headline || profile.summary || profile.skills.length > 0);
    if (hasProfile && profile) {
      matches = await ensureMatches(
        user.id,
        profile,
        analyzed.slice(0, 15).map((o) => ({
          id: o.id,
          title: o.ai?.title ?? o.body.slice(0, 80),
          summary: o.ai?.summary ?? o.body.slice(0, 300),
          skills: o.ai?.skills ?? [],
          location: o.ai?.location ?? null,
          contractType: o.ai?.contractType ?? null,
        })),
      );
    }
  }

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
          {user && !hasProfile && (
            <p className="mt-2 text-sm">
              👉{" "}
              <Link href="/profil" className="font-semibold underline underline-offset-4">
                Crée ton profil
              </Link>{" "}
              et Djossi te dira quelles offres sont pour toi.
            </p>
          )}
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
          {analyzed.map((o) => {
            const match = matches.get(o.id);
            const apply = resolveApplyChannels(o.body, o.ai);
            const parts = threadPartCount(o.body);
            const hasApply = apply.emails.length > 0 || apply.phones.length > 0 || apply.urls.length > 0;
            return (
            <li key={o.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold text-ink-2">
                  {o.sourceGroup}
                </span>
                {o.ai?.contractType && (
                  <span className="rounded-full bg-sun-soft px-2 py-0.5 font-medium">{o.ai.contractType}</span>
                )}
                {parts > 1 && (
                  <span className="rounded-full border border-line-2 bg-surface-2 px-2 py-0.5 font-mono font-bold tabular-nums" title="Offre reçue en plusieurs messages WhatsApp recollés">
                    🧩 {parts} messages
                  </span>
                )}
                {match ? (
                  <span
                    title={match.reason || undefined}
                    className={`ml-auto rounded-full px-2.5 py-0.5 font-mono font-bold tabular-nums text-ink ${matchColor(match.score)}`}
                  >
                    ✨ {match.score}% pour toi
                  </span>
                ) : (
                  o.aiScore !== null && (
                    <span className="ml-auto font-mono font-bold tabular-nums text-ink">IA {o.aiScore}/100</span>
                  )
                )}
              </div>
              {match?.reason && (
                <p className="mt-1.5 text-[13px] italic text-ink-2">{match.reason}</p>
              )}
              <h2 className="mt-2 font-display text-lg font-bold leading-snug">
                {o.ai?.title || "Offre d'emploi"}
              </h2>
              {(o.ai?.company || o.ai?.location || o.ai?.salary) && (
                <p className="mt-1 text-sm text-ink-2">
                  {[o.ai?.company, o.ai?.location, o.ai?.salary].filter(Boolean).join(" · ")}
                </p>
              )}
              {o.ai?.summary && <p className="mt-2 text-[15px] leading-relaxed">{o.ai.summary}</p>}
              {o.ai?.howToApply && (
                <p className="mt-2 text-sm text-ink-2">
                  <span className="font-semibold text-ink">Comment postuler : </span>
                  {o.ai.howToApply}
                </p>
              )}
              {hasApply ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {apply.phones.map((p) => (
                    <a
                      key={`wa-${p}`}
                      href={whatsappLink(p, o.ai?.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sun px-3 py-2 text-sm"
                    >
                      WhatsApp {p}
                    </a>
                  ))}
                  {apply.phones.map((p) => (
                    <a key={`tel-${p}`} href={`tel:${p.replace(/\s/g, "")}`} className="btn px-3 py-2 text-sm">
                      📞 Appeler
                    </a>
                  ))}
                  {apply.emails.map((e) => (
                    <a
                      key={`mail-${e}`}
                      href={`mailto:${e}?subject=${encodeURIComponent(`Candidature : ${o.ai?.title || "offre"}`)}`}
                      className="btn px-3 py-2 text-sm"
                    >
                      ✉️ {e}
                    </a>
                  ))}
                  {apply.urls.map((u) => (
                    <a
                      key={`url-${u}`}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn px-3 py-2 text-sm"
                    >
                      🔗 {shortUrl(u)}
                    </a>
                  ))}
                </div>
              ) : (
                o.ai?.contact && (
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Contact : </span>
                    <span className="whitespace-pre-wrap">{o.ai.contact}</span>
                  </p>
                )
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
