import { after } from "next/server";
import { query, ready } from "./db";
import { JOB_SOURCE_GROUPS, getGroupMessages, resolveGroupChatId, type WahaMessage } from "./waha";
import { analyzeJobMessage, type JobOfferAnalysis } from "./gemini";

export type JobOffer = {
  id: number;
  sourceGroup: string;
  groupChatId: string;
  waMessageId: string;
  author: string | null;
  body: string;
  postedAt: string | null;
  aiStatus: "pending" | "done" | "failed" | "skipped";
  ai: JobOfferAnalysis | null;
  aiScore: number | null;
  aiError: string | null;
  createdAt: string;
};

function parseAnalysis(raw: unknown): JobOfferAnalysis | null {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as JobOfferAnalysis;
  } catch {
    return null;
  }
}

function toJobOffer(r: Record<string, unknown>): JobOffer {
  return {
    id: Number(r.id),
    sourceGroup: String(r.source_group),
    groupChatId: String(r.group_chat_id),
    waMessageId: String(r.wa_message_id),
    author: r.author ? String(r.author) : null,
    body: String(r.body),
    postedAt: r.posted_at ? String(r.posted_at) : null,
    aiStatus: String(r.ai_status || "pending") as JobOffer["aiStatus"],
    ai: parseAnalysis(r.ai_json),
    aiScore: r.ai_score === null || r.ai_score === undefined ? null : Number(r.ai_score),
    aiError: r.ai_error ? String(r.ai_error) : null,
    createdAt: String(r.created_at),
  };
}

export async function listJobOffers(limit = 50): Promise<JobOffer[]> {
  await ready();
  const rows = await query(
    `SELECT * FROM job_offers ORDER BY COALESCE(posted_at, created_at) DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => toJobOffer(r as Record<string, unknown>));
}

/** Messages trop courts / médias sans texte : pas la peine d'appeler Gemini. */
function isAnalyzable(m: WahaMessage): boolean {
  const text = m.body.trim();
  if (text.length < 30) return false;
  // Liens seuls, "ok", "merci", etc.
  if (/^(https?:\/\/\S+)$/.test(text)) return false;
  return true;
}

async function analyzeAndStore(
  groupName: string,
  chatId: string,
  m: WahaMessage,
): Promise<"created" | "skipped" | "exists"> {
  await ready();
  const existing = await query("SELECT id FROM job_offers WHERE wa_message_id = $1", [m.id]);
  if (existing.length > 0) return "exists";

  if (!isAnalyzable(m)) {
    await query(
      `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, body, posted_at, ai_status)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), 'skipped')
       ON CONFLICT (wa_message_id) DO NOTHING`,
      [groupName, chatId, m.id, m.participant ?? m.from ?? null, m.body.slice(0, 4000), m.timestamp || null],
    );
    return "skipped";
  }

  const inserted = await query<{ id: number }>(
    `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, body, posted_at, ai_status)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), 'pending')
     ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`,
    [groupName, chatId, m.id, m.participant ?? m.from ?? null, m.body.slice(0, 4000), m.timestamp || null],
  );
  if (inserted.length === 0) return "exists";
  const rowId = Number(inserted[0].id);

  try {
    const analysis = await analyzeJobMessage(m.body);
    if (!analysis.isJobOffer) {
      await query("UPDATE job_offers SET ai_status = 'skipped', ai_json = $1 WHERE id = $2", [
        JSON.stringify(analysis),
        rowId,
      ]);
      return "skipped";
    }
    await query(
      "UPDATE job_offers SET ai_status = 'done', ai_json = $1, ai_score = $2, ai_error = NULL WHERE id = $3",
      [JSON.stringify(analysis), analysis.score, rowId],
    );
    return "created";
  } catch (err) {
    await query("UPDATE job_offers SET ai_status = 'failed', ai_error = $1 WHERE id = $2", [
      err instanceof Error ? err.message : String(err),
      rowId,
    ]);
    return "created";
  }
}

export type SyncResult = {
  groups: Array<{ group: string; chatId: string; fetched: number; created: number; skipped: number }>;
};

/**
 * Synchronisation : récupère les N derniers messages de chaque groupe
 * WhatsApp, les stocke et les fait analyser par Gemini.
 * Limite basse par défaut (Vercel : 60 s max par exécution).
 */
export async function syncJobOffers(limitPerGroup = 20): Promise<SyncResult> {
  await ready();
  const groups: SyncResult["groups"] = [];
  for (const g of JOB_SOURCE_GROUPS) {
    const chatId = await resolveGroupChatId(g.name, g.chatId);
    const messages = await getGroupMessages(chatId, limitPerGroup);
    let created = 0;
    let skipped = 0;
    for (const m of messages) {
      const res = await analyzeAndStore(g.name, chatId, m);
      if (res === "created") created += 1;
      else if (res === "skipped" || res === "exists") skipped += 1;
    }
    groups.push({ group: g.name, chatId, fetched: messages.length, created, skipped });
  }
  return { groups };
}

/** Planifie une synchro en arrière-plan (webhook WAHA). */
export function syncJobOffersAfter(limitPerGroup = 20): void {
  after(() => syncJobOffers(limitPerGroup).catch(() => {}));
}

/**
 * Ingestion unitaire depuis le webhook WAHA (event message.any) :
 * on ne traite que les messages des groupes suivis.
 */
export async function ingestWahaWebhookMessage(payload: {
  chatId?: string;
  messageId?: string;
  body?: string;
  timestamp?: number;
  participant?: string;
  from?: string;
}): Promise<{ handled: boolean; reason?: string }> {
  const chatId = payload.chatId || "";
  const group = JOB_SOURCE_GROUPS.find((g) => g.chatId === chatId);
  if (!group) return { handled: false, reason: "groupe non suivi" };
  if (!payload.messageId || !payload.body?.trim()) return { handled: false, reason: "message vide" };

  await analyzeAndStore(group.name, chatId, {
    id: payload.messageId,
    body: payload.body,
    timestamp: payload.timestamp ?? Math.floor(Date.now() / 1000),
    from: payload.from ?? "",
    participant: payload.participant,
    fromMe: false,
    hasMedia: false,
  });
  return { handled: true };
}
