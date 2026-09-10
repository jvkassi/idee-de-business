import { after } from "next/server";
import { query, ready } from "./db";
import { JOB_SOURCE_GROUPS, getGroupMessages, resolveGroupChatId, type WahaMessage } from "./waha";
import { analyzeJobMessage, type JobOfferAnalysis } from "./gemini";
import { THREAD_SEPARATOR } from "./applyChannels";

/** Une offre est souvent fractionnée : même auteur, messages rapprochés. */
export const THREAD_GAP_SEC = 15 * 60;
export const MAX_THREAD_CHARS = 6000;

export function threadAuthor(m: Pick<WahaMessage, "participant" | "from">): string {
  return (m.participant ?? m.from ?? "").trim().toLowerCase();
}

export type MessageThread = { thread: WahaMessage; partIds: string[] };

/**
 * Recolle les messages successifs d'un même auteur (fenêtre de 15 min,
 * 6000 caractères max) en un seul thread analysable. Les messages sont
 * triés chronologiquement ; l'ID du thread = ID du premier message.
 */
export function buildMessageThreads(messages: WahaMessage[]): MessageThread[] {
  const sorted = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const out: MessageThread[] = [];
  for (const m of sorted) {
    const last = out[out.length - 1];
    if (last) {
      const gap = (m.timestamp || 0) - (last.thread.timestamp || 0);
      const sameAuthor =
        threadAuthor(m) !== "" && threadAuthor(m) === threadAuthor(last.thread);
      const mergedLen = last.thread.body.length + THREAD_SEPARATOR.length + m.body.length;
      if (sameAuthor && gap >= 0 && gap <= THREAD_GAP_SEC && mergedLen <= MAX_THREAD_CHARS) {
        last.thread = { ...last.thread, body: `${last.thread.body}${THREAD_SEPARATOR}${m.body}` };
        last.partIds.push(m.id);
        continue;
      }
    }
    out.push({ thread: { ...m }, partIds: [m.id] });
  }
  return out;
}

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
    const p = JSON.parse(String(raw)) as Partial<JobOfferAnalysis>;
    // Compat : offres analysées avant l'ajout des canaux structurés.
    return {
      isJobOffer: p.isJobOffer === true,
      title: typeof p.title === "string" ? p.title : "",
      company: p.company ?? null,
      location: p.location ?? null,
      contractType: p.contractType ?? null,
      salary: p.salary ?? null,
      contact: p.contact ?? null,
      emails: Array.isArray(p.emails) ? p.emails.map(String) : [],
      phones: Array.isArray(p.phones) ? p.phones.map(String) : [],
      urls: Array.isArray(p.urls) ? p.urls.map(String) : [],
      howToApply: typeof p.howToApply === "string" ? p.howToApply : null,
      summary: typeof p.summary === "string" ? p.summary : "",
      skills: Array.isArray(p.skills) ? p.skills.map(String) : [],
      score: typeof p.score === "number" ? p.score : 0,
    };
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
function isAnalyzable(m: Pick<WahaMessage, "body">): boolean {
  const text = m.body.trim();
  if (text.length < 30) return false;
  // Liens seuls, "ok", "merci", etc.
  if (/^(https?:\/\/\S+)$/.test(text)) return false;
  return true;
}

async function runAnalysis(rowId: number, body: string): Promise<"created" | "skipped"> {
  try {
    const analysis = await analyzeJobMessage(body);
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

async function analyzeAndStore(
  groupName: string,
  chatId: string,
  m: WahaMessage,
): Promise<"created" | "skipped" | "exists"> {
  return analyzeAndStoreThread(groupName, chatId, m, [m.id]);
}

/**
 * Stocke + analyse un thread (1+ messages recollés). Si un des morceaux
 * existe déjà, on complète la ligne existante avec le corps fusionné et on
 * ré-analyse (cas d'une offre arrivée en plusieurs fois entre 2 syncs).
 */
async function analyzeAndStoreThread(
  groupName: string,
  chatId: string,
  m: WahaMessage,
  partIds: string[],
): Promise<"created" | "skipped" | "exists"> {
  await ready();
  const body = m.body.slice(0, MAX_THREAD_CHARS);
  const author = m.participant ?? m.from ?? null;

  const already = await query<{ id: number; body: string; wa_message_id: string }>(
    "SELECT id, body, wa_message_id FROM job_offers WHERE wa_message_id = ANY($1)",
    [partIds],
  );
  if (already.length > 0) {
    // Thread déjà stocké : si le corps a grandi (suite reçue), on met à jour + ré-analyse.
    const main =
      already.find((r) => String(r.wa_message_id) === m.id) ?? already.sort((a, b) => a.id - b.id)[0];
    const mainId = Number(main.id);
    if (String(main.body ?? "") !== body && isAnalyzable({ body })) {
      await query("UPDATE job_offers SET body = $1, ai_status = 'pending', ai_error = NULL WHERE id = $2", [
        body,
        mainId,
      ]);
      return runAnalysis(mainId, body);
    }
    return "exists";
  }

  if (!isAnalyzable({ body })) {
    await query(
      `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, body, posted_at, ai_status)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6), 'skipped')
       ON CONFLICT (wa_message_id) DO NOTHING`,
      [groupName, chatId, m.id, author, body, m.timestamp || null],
    );
    return "skipped";
  }

  const inserted = await query<{ id: number }>(
    `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, body, posted_at, ai_status)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), 'pending')
     ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`,
    [groupName, chatId, m.id, author, body, m.timestamp || null],
  );
  if (inserted.length === 0) return "exists";
  return runAnalysis(Number(inserted[0].id), body);
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
    const threads = buildMessageThreads(messages);
    let created = 0;
    let skipped = 0;
    for (const t of threads) {
      const res = await analyzeAndStoreThread(g.name, chatId, t.thread, t.partIds);
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
 * Si le message suit de près un autre du même auteur (< 15 min), on le
 * recolle à l'offre existante (cas fréquent : annonce en plusieurs morceaux,
 * contact envoyé dans un 2e message) au lieu de créer un doublon.
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

  const timestamp = payload.timestamp ?? Math.floor(Date.now() / 1000);
  const author = payload.participant ?? payload.from ?? null;
  await ready();

  const dup = await query("SELECT id FROM job_offers WHERE wa_message_id = $1", [payload.messageId]);
  if (dup.length > 0) return { handled: false, reason: "déjà traité" };

  if (author) {
    const recent = await query<{ id: number; body: string; posted_at: string }>(
      `SELECT id, body, posted_at FROM job_offers
       WHERE group_chat_id = $1 AND author = $2
       ORDER BY COALESCE(posted_at, created_at) DESC LIMIT 1`,
      [chatId, author],
    );
    if (recent.length > 0) {
      const r = recent[0] as { id: number; body: string; posted_at: string | null };
      const prevTs = r.posted_at ? Math.floor(new Date(String(r.posted_at)).getTime() / 1000) : 0;
      const gap = timestamp - prevTs;
      const merged = `${String(r.body ?? "")}${THREAD_SEPARATOR}${payload.body}`.slice(0, MAX_THREAD_CHARS);
      if (gap >= 0 && gap <= THREAD_GAP_SEC && merged.length <= MAX_THREAD_CHARS) {
        const rowId = Number(r.id);
        await query(
          "UPDATE job_offers SET body = $1, ai_status = 'pending', ai_error = NULL WHERE id = $2",
          [merged, rowId],
        );
        if (isAnalyzable({ body: merged })) await runAnalysis(rowId, merged);
        return { handled: true, reason: "suite recollée" };
      }
    }
  }

  await analyzeAndStore(group.name, chatId, {
    id: payload.messageId,
    body: payload.body,
    timestamp,
    from: payload.from ?? "",
    participant: payload.participant,
    fromMe: false,
    hasMedia: false,
  });
  return { handled: true };
}
