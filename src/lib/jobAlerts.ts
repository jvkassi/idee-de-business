import { query, ready } from "./db";
import { getProfile, type CandidateProfile } from "./profile";
import { matchJobsToProfile, type JobMatch, type JobMatchInput } from "./gemini";
import { notifyUser } from "./push";

const ALERT_THRESHOLD = 70;
const MAX_OFFERS_PER_MATCH = 15;

/** Crée la table de déduplication des alertes si besoin (sans toucher à db.ts). */
export async function ensureAlertSchema(): Promise<void> {
  await ready();
  await query(`
    CREATE TABLE IF NOT EXISTS job_alert_sends (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, job_offer_id)
    )
  `);
}

/** Un profil est exploitable pour le matching dès qu'il contient un minimum. */
export function isMatchReady(profile: CandidateProfile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.headline?.trim()) return true;
  if (profile.summary?.trim()) return true;
  return Array.isArray(profile.skills) && profile.skills.length > 0;
}

/**
 * Parse défensif d'une ligne job_offers vers JobMatchInput.
 * Retourne null si la ligne est à ignorer (pas de JSON, invalide, pas une offre).
 */
export function parseOfferInput(id: number, aiJson: unknown): JobMatchInput | null {
  if (aiJson === null || aiJson === undefined) return null;
  let parsed: Record<string, unknown>;
  try {
    const raw = typeof aiJson === "string" ? aiJson : String(aiJson);
    if (!raw.trim()) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }
  if (parsed.isJobOffer !== true) return null;
  const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim().slice(0, 150) : "Offre d'emploi";
  const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "";
  const skills = Array.isArray(parsed.skills) ? parsed.skills.map(String).slice(0, 8) : [];
  const location = typeof parsed.location === "string" && parsed.location.trim() ? parsed.location.trim().slice(0, 150) : null;
  const contractType =
    typeof parsed.contractType === "string" && parsed.contractType.trim() ? parsed.contractType.trim().slice(0, 80) : null;
  return { id, title, summary, skills, location, contractType };
}

/** Filtre les matchs au seuil et les trie par score décroissant (sans muter l'entrée). */
export function topMatches(matches: JobMatch[], threshold = ALERT_THRESHOLD): JobMatch[] {
  if (!Array.isArray(matches)) return [];
  return matches
    .filter((m) => typeof m?.score === "number" && m.score >= threshold)
    .slice()
    .sort((a, b) => b.score - a.score);
}

/** Notification push en français pour un match. */
export function buildAlertPayload(match: JobMatch, jobTitle: string): { title: string; body: string; url: string } {
  const title = `💼 ${match.score}% : ${jobTitle?.trim() || "Nouvelle offre"}`.slice(0, 150);
  const body = typeof match.reason === "string" && match.reason.trim() ? match.reason.trim().slice(0, 200) : "Nouvelle offre compatible avec ton profil.";
  return { title, body, url: "/jobs" };
}

type OfferRow = { id: number; ai_status: string; ai_json: string | null };
type SubscriberRow = { user_id: number };

/**
 * Notifie les utilisateurs abonnés au push dont le profil matche les nouvelles offres.
 * Un seul appel matching par utilisateur (max 15 offres), un push par match ≥ 70,
 * dédupliqué via job_alert_sends. Best-effort : ne lève jamais d'erreur.
 */
export async function processNewMatches(jobOfferIds: number[]): Promise<{ checked: number; sent: number }> {
  let checked = 0;
  let sent = 0;
  const ids = [...new Set((jobOfferIds ?? []).filter((id) => Number.isInteger(id) && (id as number) > 0))] as number[];
  if (ids.length === 0) return { checked, sent };

  try {
    await ensureAlertSchema();

    const rows = await query<OfferRow>("SELECT id, ai_status, ai_json FROM job_offers WHERE id = ANY($1)", [ids]);
    const offers: JobMatchInput[] = [];
    for (const row of rows) {
      if (row.ai_status !== "done") continue;
      const input = parseOfferInput(Number(row.id), row.ai_json);
      if (input) offers.push(input);
    }
    if (offers.length === 0) return { checked, sent };
    const limited = offers.slice(0, MAX_OFFERS_PER_MATCH);
    const titleById = new Map(limited.map((o) => [o.id, o.title]));

    const subscribers = await query<SubscriberRow>("SELECT DISTINCT user_id FROM push_subscriptions");
    for (const sub of subscribers) {
      const userId = Number(sub.user_id);
      if (!Number.isFinite(userId)) continue;
      try {
        const profile = await getProfile(userId);
        if (!profile || !isMatchReady(profile)) continue;
        checked += 1;
        const matches = await matchJobsToProfile(profile, limited);
        const top = topMatches(matches, ALERT_THRESHOLD);
        for (const match of top) {
          try {
            const inserted = await query(
              "INSERT INTO job_alert_sends (user_id, job_offer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id",
              [userId, match.id],
            );
            if (inserted.length === 0) continue;
            try {
              await notifyUser(userId, buildAlertPayload(match, titleById.get(match.id) ?? "Nouvelle offre"));
            } catch {
              // Envoi best-effort : l'alerte reste marquée comme envoyée.
            }
            sent += 1;
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Best-effort : on retourne les compteurs partiels au lieu de lever.
  }
  return { checked, sent };
}
