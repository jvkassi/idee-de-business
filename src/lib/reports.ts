import { query } from "./db";

export const REPORT_REASONS = [
  "Arnaque / demande d'argent",
  "Numéro injoignable",
  "Offre déjà pourvue",
  "Contenu inapproprié",
  "Autre",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type FileReportResult = { ok: true; duplicate?: true };

export function isValidReason(reason: string): reason is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(reason);
}

export async function ensureReportsSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS job_reports (
      id SERIAL PRIMARY KEY,
      job_offer_id INTEGER NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
      user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function fileReport(
  jobOfferId: number,
  reason: string,
  userId?: number | null,
): Promise<FileReportResult> {
  if (!isValidReason(reason)) {
    throw new Error("Motif invalide");
  }
  await ensureReportsSchema();
  // Un seul signalement par utilisateur et par offre. Les signalements
  // anonymes (userId null) ne sont pas dédupliqués entre eux.
  if (userId != null) {
    const existing = await query<{ id: number }>(
      "SELECT id FROM job_reports WHERE job_offer_id = $1 AND user_id = $2 LIMIT 1",
      [jobOfferId, userId],
    );
    if (existing.length > 0) {
      return { ok: true, duplicate: true };
    }
  }
  await query("INSERT INTO job_reports (job_offer_id, user_id, reason) VALUES ($1, $2, $3)", [
    jobOfferId,
    userId ?? null,
    reason,
  ]);
  return { ok: true };
}

export async function reportCounts(jobOfferIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  for (const id of jobOfferIds) {
    counts.set(id, 0);
  }
  if (jobOfferIds.length === 0) {
    return counts;
  }
  await ensureReportsSchema();
  const rows = await query<{ job_offer_id: number; count: string }>(
    "SELECT job_offer_id, COUNT(*) AS count FROM job_reports WHERE job_offer_id = ANY($1) GROUP BY job_offer_id",
    [jobOfferIds],
  );
  for (const row of rows) {
    counts.set(Number(row.job_offer_id), Number(row.count));
  }
  return counts;
}
