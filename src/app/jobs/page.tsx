import Link from "next/link";
import { listJobOffers } from "@/lib/jobOffers";
import { getSession } from "@/lib/session";
import { getProfile, profileHasContent, profileReadyToMatch } from "@/lib/profile";
import { reportOfferFormAction } from "@/app/actions";
import { REPORT_REASONS } from "@/lib/reports";
import { ensureMatches, type MatchMap } from "@/lib/matching";
import {
  resolveApplyChannels,
  shortUrl,
  formatOfferBody,
  whatsappLink,
  jidToPhone,
  isPrivateApply,
} from "@/lib/applyChannels";

export const dynamic = "force-dynamic";
// Le matching (1 appel Djossi) peut prendre quelques secondes.
export const maxDuration = 60;
export const metadata = { title: "Offres d'emploi" };

function matchColor(score: number): string {
  if (score >= 75) return "bg-ok-soft text-ok";
  if (score >= 50) return "bg-sun-soft text-ink";
  return "bg-surface-2 text-ink-2";
}

type Filters = { q?: string; contrat?: string; tag?: string };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hrefWith(base: Filters, patch: Partial<Filters>): string {
  const p = new URLSearchParams();
  const merged = { ...base, ...patch };
  if (merged.q) p.set("q", merged.q);
  if (merged.contrat) p.set("contrat", merged.contrat);
  if (merged.tag) p.set("tag", merged.tag);
  const s = p.toString();
  return s ? `/jobs?${s}` : "/jobs";
}

/** Fraîcheur perçue : badge "Nouveau" sous 72 h, rien ne se périme en base. */
function isFresh(o: { postedAt: string | null; createdAt: string }): boolean {
  const t = new Date(o.postedAt ?? o.createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t < 72 * 3600 * 1000;
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const f = await searchParams;
  const q = (f.q ?? "").trim();
  const contrat = (f.contrat ?? "").trim();
  const tag = (f.tag ?? "").trim();
  const base: Filters = { ...(q ? { q } : {}), ...(contrat ? { contrat } : {}), ...(tag ? { tag } : {}) };
  const filtering = Boolean(q || contrat || tag);

  const [offers, user] = await Promise.all([listJobOffers(100), getSession()]);
  const analyzed = offers.filter((o) => o.aiStatus === "done" && o.ai?.isJobOffer);

  const nq = norm(q);
  const results = analyzed.filter((o) => {
    if (contrat && (o.ai?.contractType ?? "") !== contrat) return false;
    if (tag && !(o.ai?.skills ?? []).some((s) => norm(s) === norm(tag))) return false;
    if (nq) {
      const hay = norm(
        [o.ai?.title, o.ai?.summary, o.ai?.company, o.ai?.location, o.ai?.contractType, ...(o.ai?.skills ?? [])]
          .filter(Boolean)
          .join(" "),
      );
      if (!hay.includes(nq)) return false;
    }
    return true;
  });

  // Facette contrats (sur tout le corpus, pas seulement les résultats).
  const contratCounts = new Map<string, number>();
  for (const o of analyzed) {
    const c = o.ai?.contractType;
    if (c) contratCounts.set(c, (contratCounts.get(c) ?? 0) + 1);
  }
  const contrats = [...contratCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Matchs persos : seulement si connecté avec un profil assez rempli.
  // Le rappel "crée ton profil" disparaît dès qu'il existe un début de profil.
  let matches: MatchMap = new Map();
  let hasProfile = false;
  if (user) {
    const profile = await getProfile(user.id);
    hasProfile = profileHasContent(profile);
    if (profileReadyToMatch(profile) && profile) {
      matches = await ensureMatches(
        user.id,
        profile,
        analyzed
          .filter((o) => !o.direct)
          .slice(0, 15)
          .map((o) => ({
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
          <p className="label">Djossi · Emploi</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Offres d&apos;emploi
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {analyzed.length} offre{analyzed.length > 1 ? "s" : ""} relue{analyzed.length > 1 ? "s" : ""} par
            Djossi, mises à jour automatiquement.
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
      </div>

      <form method="get" action="/jobs" role="search" className="flex gap-2">
        {contrat ? <input type="hidden" name="contrat" value={contrat} /> : null}
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Chercher : chauffeur, serveuse, Cocody…"
          aria-label="Chercher une offre"
          className="input"
        />
        <button type="submit" className="btn btn-ink shrink-0">
          Chercher
        </button>
      </form>

      {contrats.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Filtrer par contrat">
          <Link href={hrefWith(base, { contrat: undefined })} className={`chip ${!contrat ? "chip-active" : ""}`}>
            Tout
          </Link>
          {contrats.map(([c, n]) => (
            <Link
              key={c}
              href={hrefWith(base, { contrat: c === contrat ? undefined : c })}
              aria-pressed={c === contrat}
              className={`chip tabular-nums ${c === contrat ? "chip-active" : ""}`}
            >
              {c} · {n}
            </Link>
          ))}
        </div>
      )}
      {filtering && (
        <p className="text-sm text-ink-2">
          {results.length} résultat{results.length > 1 ? "s" : ""}
          {q ? ` pour « ${q} »` : ""}
          {contrat ? ` · ${contrat}` : ""}
          {tag ? ` · ${tag}` : ""} —{" "}
          <Link href="/jobs" className="font-semibold underline underline-offset-4">
            tout effacer
          </Link>
        </p>
      )}

      {analyzed.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-xl border-[1.5px] border-line-2 bg-surface-2 text-3xl" aria-hidden>
            💼
          </div>
          <h2 className="font-display text-xl font-bold">Aucune offre pour l&apos;instant</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
            Djossi vérifie de nouvelles offres en continu. Repasse un peu plus tard.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <h2 className="font-display text-xl font-bold">Rien trouvé avec ces filtres</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
            Essaie un autre mot, ou reviens voir toutes les offres.
          </p>
          <Link href="/jobs" className="btn btn-sun mt-5">
            Tout voir
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map((o) => {
            const match = matches.get(o.id);
            const apply = resolveApplyChannels(o.body, o.ai);
            const hasApply = apply.emails.length > 0 || apply.phones.length > 0 || apply.urls.length > 0;
            // Offre "en privé" : le numéro de l'auteur, résolu par Djossi.
            const authorPhone = o.authorPhone ?? jidToPhone(o.author);
            const privateWanted =
              !hasApply &&
              isPrivateApply(
                [o.ai?.howToApply ?? "", o.ai?.contact ?? "", o.body.slice(0, 1000)].join("\n"),
              );
            return (
            <li key={o.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                {isFresh(o) && (
                  <span className="rounded-full border border-ink bg-sun px-2 py-0.5 font-mono font-bold uppercase tracking-wide text-ink">
                    Nouveau
                  </span>
                )}
                {o.ai?.contractType && (
                  <Link
                    href={hrefWith(base, { contrat: o.ai.contractType === contrat ? undefined : o.ai.contractType })}
                    title="Filtrer par ce contrat"
                    className="rounded-full bg-sun-soft px-2 py-0.5 font-medium hover:underline"
                  >
                    {o.ai.contractType}
                  </Link>
                )}
                {match ? (
                  <span
                    title={match.reason || undefined}
                    className={`ml-auto rounded-full px-2.5 py-0.5 font-mono font-bold tabular-nums text-ink ${matchColor(match.score)}`}
                  >
                    ✨ {match.score}% pour toi
                  </span>
                ) : (
                  o.aiScore !== null &&
                  o.aiScore >= 40 && (
                    <span
                      className="ml-auto font-mono font-bold tabular-nums text-ink"
                      title="Score de qualité Djossi"
                    >
                      ★ {o.aiScore}/100
                    </span>
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
              ) : authorPhone && privateWanted ? (
                <div className="mt-3">
                  <a
                    href={whatsappLink(authorPhone, o.ai?.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sun px-4 py-2 text-sm"
                  >
                    💬 Écrire en privé · {authorPhone}
                  </a>
                  <p className="mt-1.5 text-xs text-ink-3">
                    Numéro retrouvé par Djossi : présente-toi et précise le poste.
                  </p>
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
                  {o.ai.skills.map((s) => {
                    const active = norm(s) === norm(tag);
                    return (
                      <Link
                        key={s}
                        href={hrefWith(base, { tag: active ? undefined : s })}
                        aria-pressed={active}
                        title="Filtrer par ce mot-clé"
                        className={`chip ${active ? "chip-active" : ""}`}
                      >
                        {s}
                      </Link>
                    );
                  })}
                </div>
              )}
              <details className="mt-3 text-sm text-ink-2">
                <summary className="cursor-pointer text-xs font-medium text-ink-3 hover:text-ink">
                  Voir l&apos;annonce d&apos;origine
                </summary>
                <p className="mt-1 whitespace-pre-wrap border-l-[3px] border-line-2 pl-3">
                  {formatOfferBody(o.body)}
                </p>
              </details>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-xs font-medium text-ink-3 hover:text-bad">
                  Signaler un problème
                </summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {REPORT_REASONS.map((r) => (
                    <form key={r} action={reportOfferFormAction.bind(null, o.id, r)}>
                      <button type="submit" className="chip text-xs">
                        {r}
                      </button>
                    </form>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-3">Djossi relit chaque signalement.</p>
              </details>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
