import { query, ready } from "./db";

export type RateLimitResult = { ok: true } | { ok: false; error: string };

export function formatWindow(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60} h`;
  return `${minutes} min`;
}

/**
 * Anti-abus compteur glissant en base (pas de mémoire partagée entre
 * instances serverless Vercel). Chaque appel IA coûte réellement de
 * l'argent (Gemini, Blob) : on ferme la porte avant la dépense, pas après.
 */
export async function checkRateLimit(
  userId: number,
  action: string,
  max: number,
  windowMinutes: number,
): Promise<RateLimitResult> {
  await ready();
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM usage_events
     WHERE user_id = $1 AND action = $2 AND created_at > now() - ($3 || ' minutes')::interval`,
    [userId, action, windowMinutes],
  );
  if (Number(rows[0]?.count ?? 0) >= max) {
    console.warn("[rate-limit]", action, "blocked user", userId, `(${max}/${windowMinutes}min)`);
    return { ok: false, error: `Limite atteinte (${max} par ${formatWindow(windowMinutes)}). Réessaie plus tard.` };
  }
  await query("INSERT INTO usage_events (user_id, action) VALUES ($1, $2)", [userId, action]);
  return { ok: true };
}

export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export function checkAudioSize(size: number): RateLimitResult {
  if (size > MAX_AUDIO_BYTES) {
    return { ok: false, error: "Enregistrement trop volumineux (max 20 Mo)." };
  }
  return { ok: true };
}
