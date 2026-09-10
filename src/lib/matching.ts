import { query, ready } from "./db";
import { matchJobsToProfile, type CandidateProfile, type JobMatch } from "./gemini";
import { checkRateLimit } from "./rateLimit";

export type MatchMap = Map<number, { score: number; reason: string }>;

/** Matchs en cache pour ces offres. */
export async function getMatches(userId: number, offerIds: number[]): Promise<MatchMap> {
  await ready();
  if (offerIds.length === 0) return new Map();
  const rows = await query<{ job_offer_id: number; score: number; reason: string | null }>(
    "SELECT job_offer_id, score, reason FROM job_matches WHERE user_id = $1 AND job_offer_id = ANY($2)",
    [userId, offerIds],
  );
  const map: MatchMap = new Map();
  for (const r of rows) {
    map.set(Number(r.job_offer_id), { score: Number(r.score), reason: r.reason ?? "" });
  }
  return map;
}

export type MatchableOffer = {
  id: number;
  title: string;
  summary: string;
  skills: string[];
  location: string | null;
  contractType: string | null;
};

/**
 * Calcule les matchs manquants en UN seul appel Gemini, les stocke, et
 * renvoie le tout (cache + frais). Silencieux si la limite est atteinte :
 * la page s'affiche quand même, sans badges.
 */
export async function ensureMatches(
  userId: number,
  profile: CandidateProfile,
  offers: MatchableOffer[],
): Promise<MatchMap> {
  const ids = offers.map((o) => o.id);
  const cached = await getMatches(userId, ids);
  const missing = offers.filter((o) => !cached.has(o.id)).slice(0, 15);
  if (missing.length === 0) return cached;

  const limit = await checkRateLimit(userId, "match", 20, 60);
  if (!limit.ok) return cached;

  let fresh: JobMatch[] = [];
  try {
    fresh = await matchJobsToProfile(profile, missing);
  } catch {
    return cached;
  }
  await ready();
  for (const m of fresh) {
    await query(
      `INSERT INTO job_matches (user_id, job_offer_id, score, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, job_offer_id) DO UPDATE SET score = $3, reason = $4, created_at = now()`,
      [userId, m.id, m.score, m.reason],
    );
    cached.set(m.id, { score: m.score, reason: m.reason });
  }
  return cached;
}
