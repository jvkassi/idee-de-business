import { after } from "next/server";
import { query, ready } from "./db";
import {
  JOB_SOURCE_GROUPS,
  MAX_ATTACHMENTS,
  downloadMediaFile,
  getGroupMessages,
  getLidToPhoneMap,
  guessMediaUrl,
  resolveGroupChatId,
  type MediaAttachment,
  type WahaMessage,
} from "./waha";
import { analyzeJobMessage, type JobOfferAnalysis } from "./gemini";
import { THREAD_SEPARATOR, jidToPhone, jobLinkFromBody, normalizePhone } from "./applyChannels";

/** Une offre est souvent fractionnée : même auteur, messages rapprochés. */
export const THREAD_GAP_SEC = 15 * 60;
export const MAX_THREAD_CHARS = 6000;

export function threadAuthor(m: Pick<WahaMessage, "participant" | "from">): string {
  return (m.participant ?? m.from ?? "").trim().toLowerCase();
}

export type MessageThread = {
  thread: WahaMessage;
  partIds: string[];
  media: Array<{ url: string; mime?: string }>;
};

function threadMedia(m: WahaMessage): Array<{ url: string; mime?: string }> {
  return m.hasMedia && m.mediaUrl ? [{ url: m.mediaUrl, mime: m.mediaMime }] : [];
}

/**
 * Recolle les messages successifs d'un même auteur (fenêtre de 15 min,
 * 6000 caractères max) en un seul thread analysable. Les messages sont
 * triés chronologiquement ; l'ID du thread = ID du premier message.
 * Les pièces jointes (flyers, PDF) suivent le thread pour l'IA.
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
        for (const a of threadMedia(m)) {
          if (last.media.length < MAX_ATTACHMENTS && !last.media.some((x) => x.url === a.url)) {
            last.media.push(a);
          }
        }
        continue;
      }
    }
    out.push({ thread: { ...m }, partIds: [m.id], media: threadMedia(m) });
  }
  return out;
}

/** Télécharge les pièces du thread pour l'IA (best-effort, plafonné). */
async function fetchThreadAttachments(t: MessageThread): Promise<MediaAttachment[]> {
  const out: MediaAttachment[] = [];
  for (const a of t.media.slice(0, MAX_ATTACHMENTS)) {
    const dl = await downloadMediaFile(a.url);
    if (dl) out.push(dl);
  }
  return out;
}

/**
 * Numéro de l'auteur pour les offres "en privé" : direct si le JID porte un
 * numéro (@c.us), sinon via la table LID→numéro de WAHA.
 */
export function resolveAuthorPhone(
  authorJid: string | null | undefined,
  lidMap?: Map<string, string> | null,
): string | null {
  const direct = jidToPhone(authorJid);
  if (direct) return direct;
  const lid = (authorJid ?? "").trim().toLowerCase();
  const pn = lid && lidMap ? lidMap.get(lid) : undefined;
  if (!pn) return null;
  return normalizePhone(pn) ?? null;
}

export type JobOffer = {
  id: number;
  sourceGroup: string;
  groupChatId: string;
  waMessageId: string;
  author: string | null;
  authorPhone: string | null;
  body: string;
  postedAt: string | null;
  aiStatus: "pending" | "done" | "failed" | "skipped";
  ai: JobOfferAnalysis | null;
  aiScore: number | null;
  aiError: string | null;
  createdAt: string;
  /** Offre déposée directement (pas de matching IA dessus pour l'instant). */
  direct?: boolean;
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
    authorPhone: r.author_phone ? String(r.author_phone) : null,
    body: String(r.body),
    postedAt: r.posted_at ? String(r.posted_at) : null,
    aiStatus: String(r.ai_status || "pending") as JobOffer["aiStatus"],
    ai: parseAnalysis(r.ai_json),
    aiScore: r.ai_score === null || r.ai_score === undefined ? null : Number(r.ai_score),
    aiError: r.ai_error ? String(r.ai_error) : null,
    createdAt: String(r.created_at),
  };
}

function directToJobOffer(r: Record<string, unknown>): JobOffer {
  const id = Number(r.id);
  const contact = String(r.contact ?? "");
  const description = String(r.description ?? "");
  const at = String(r.created_at);
  return {
    id: -id,
    sourceGroup: "Djossi",
    groupChatId: "",
    waMessageId: `direct-${id}`,
    author: null,
    authorPhone: null,
    body: `${description}\n\nContact : ${contact}`.trim(),
    postedAt: at,
    aiStatus: "done",
    ai: {
      isJobOffer: true,
      title: String(r.title ?? "Offre d'emploi").slice(0, 150),
      company: r.company ? String(r.company) : null,
      location: r.location ? String(r.location) : null,
      contractType: r.contract_type ? String(r.contract_type) : null,
      salary: r.salary ? String(r.salary) : null,
      contact: contact.slice(0, 300) || null,
      emails: [],
      phones: [],
      urls: [],
      howToApply: null,
      summary: description.slice(0, 500),
      skills: [],
      score: 85,
    },
    aiScore: 85,
    aiError: null,
    createdAt: at,
    direct: true,
  };
}

export async function listJobOffers(limit = 50): Promise<JobOffer[]> {
  await ready();
  const rows = await query(
    `SELECT * FROM job_offers ORDER BY COALESCE(posted_at, created_at) DESC LIMIT $1`,
    [limit],
  );
  const offers = rows.map((r) => toJobOffer(r as Record<string, unknown>));
  // Offres déposées directement (relues par Djossi) : elles vivent avec les autres.
  try {
    const direct = await query(
      `SELECT * FROM direct_offers WHERE status = 'published' ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    for (const r of direct) offers.push(directToJobOffer(r as Record<string, unknown>));
  } catch {
    // Table pas encore créée : rien à fusionner.
  }
  offers.sort((a, b) => {
    const ta = new Date(a.postedAt ?? a.createdAt).getTime();
    const tb = new Date(b.postedAt ?? b.createdAt).getTime();
    return tb - ta;
  });
  return offers.slice(0, Math.max(1, limit));
}

/**
 * L'IA tranche : un texte trop court seul ne vaut pas l'appel, sauf si une
 * image/PDF l'accompagne (flyer = souvent toute l'annonce).
 */
function isAnalyzable(m: { body: string; mediaCount?: number }): boolean {
  const text = m.body.trim();
  if (text.length >= 30 && !/^(https?:\/\/\S+)$/.test(text)) return true;
  // Texte court ou vide mais image/PDF jointe : l'IA lit le flyer.
  return (m.mediaCount ?? 0) > 0;
}

async function runAnalysis(
  rowId: number,
  body: string,
  attachments: MediaAttachment[] = [],
): Promise<"created" | "skipped"> {
  try {
    const analysis = await analyzeJobMessage(body, attachments);
    if (!analysis.isJobOffer) {
      await query("UPDATE job_offers SET ai_status = 'skipped', ai_json = $1, ai_media = $2 WHERE id = $3", [
        JSON.stringify(analysis),
        attachments.length,
        rowId,
      ]);
      return "skipped";
    }
    await query(
      "UPDATE job_offers SET ai_status = 'done', ai_json = $1, ai_score = $2, ai_media = $3, ai_error = NULL WHERE id = $4",
      [JSON.stringify(analysis), analysis.score, attachments.length, rowId],
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
  lidMap?: Map<string, string> | null,
  media?: Array<{ url: string; mime?: string }>,
): Promise<"created" | "skipped" | "exists"> {
  await ready();
  const body = m.body.slice(0, MAX_THREAD_CHARS);
  const author = m.participant ?? m.from ?? null;
  const authorPhone = resolveAuthorPhone(author, lidMap);
  const attachments = await fetchThreadAttachments({ thread: m, partIds, media: media ?? [] });

  const already = await query<{ id: number; body: string; wa_message_id: string; ai_media: number | null }>(
    "SELECT id, body, wa_message_id, ai_media FROM job_offers WHERE wa_message_id = ANY($1)",
    [partIds],
  );
  if (already.length > 0) {
    // Thread déjà stocké : on ré-analyse si le corps a grandi OU si des
    // pièces jointes arrivent après coup (webhook texte d'abord, médias à la synchro).
    const main =
      already.find((r) => String(r.wa_message_id) === m.id) ?? already.sort((a, b) => a.id - b.id)[0];
    const mainId = Number(main.id);
    const seenMedia = Number(main.ai_media ?? 0);
    if (
      (String(main.body ?? "") !== body || attachments.length > seenMedia) &&
      isAnalyzable({ body, mediaCount: attachments.length })
    ) {
      await query(
        "UPDATE job_offers SET body = $1, author_phone = COALESCE(author_phone, $2), ai_status = 'pending', ai_error = NULL WHERE id = $3",
        [body, authorPhone, mainId],
      );
      return runAnalysis(mainId, body, attachments);
    }
    // Même sans nouveau texte, on complète le numéro manquant (résolution LID).
    if (authorPhone) {
      await query("UPDATE job_offers SET author_phone = $1 WHERE id = $2 AND author_phone IS NULL", [
        authorPhone,
        mainId,
      ]);
    }
    return "exists";
  }

  // Message réduit à un lien d'offre connu (LinkedIn & co) : pas besoin de
  // l'IA, rien à inventer — l'annonce se lit en cliquant.
  const jobLink = jobLinkFromBody(body);
  if (jobLink && attachments.length === 0) {
    const linkAi = {
      isJobOffer: true,
      title: `Offre ${jobLink.label}`,
      company: null,
      location: null,
      contractType: null,
      salary: null,
      contact: null,
      emails: [],
      phones: [],
      urls: [jobLink.url],
      howToApply: "Postule via le lien.",
      summary: `Annonce publiée via ${jobLink.label} : voir le détail en cliquant.`,
      skills: [],
      score: 50,
    };
    const linked = await query<{ id: number }>(
      `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, author_phone, body, posted_at, ai_status, ai_json, ai_score, ai_media)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), 'done', $8, 50, 0)
       ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`,
      [groupName, chatId, m.id, author, authorPhone, body, m.timestamp || null, JSON.stringify(linkAi)],
    );
    return linked.length > 0 ? "created" : "exists";
  }

  if (!isAnalyzable({ body, mediaCount: attachments.length })) {
    await query(
      `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, author_phone, body, posted_at, ai_status, ai_media)
       VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), 'skipped', $8)
       ON CONFLICT (wa_message_id) DO NOTHING`,
      [groupName, chatId, m.id, author, authorPhone, body, m.timestamp || null, attachments.length],
    );
    return "skipped";
  }

  const inserted = await query<{ id: number }>(
    `INSERT INTO job_offers (source_group, group_chat_id, wa_message_id, author, author_phone, body, posted_at, ai_status, ai_media)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7), 'pending', $8)
     ON CONFLICT (wa_message_id) DO NOTHING RETURNING id`,
    [groupName, chatId, m.id, author, authorPhone, body, m.timestamp || null, attachments.length],
  );
  if (inserted.length === 0) return "exists";
  return runAnalysis(Number(inserted[0].id), body, attachments);
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
  const startedAt = Math.floor(Date.now() / 1000);
  // Résolution LID → numéro en un seul appel (bouton "Écrire en privé").
  const lidMap = await getLidToPhoneMap();
  const groups: SyncResult["groups"] = [];
  for (const g of JOB_SOURCE_GROUPS) {
    const chatId = await resolveGroupChatId(g.name, g.chatId);
    // downloadMedia=true : l'IA lit les flyers/PDF (souvent toute l'annonce).
    const messages = await getGroupMessages(chatId, limitPerGroup, true);
    // Archive brute (rejouable pour ré-analyse future), best-effort.
    try {
      const { storeRawMessages } = await import("./waArchive");
      await storeRawMessages(chatId, messages);
    } catch {
      // L'archive ne doit jamais bloquer la synchro.
    }
    const threads = buildMessageThreads(messages);
    let created = 0;
    let skipped = 0;
    for (const t of threads) {
      const res = await analyzeAndStoreThread(g.name, chatId, t.thread, t.partIds, lidMap, t.media);
      if (res === "created") created += 1;
      else if (res === "skipped" || res === "exists") skipped += 1;
    }
    groups.push({ group: g.name, chatId, fetched: messages.length, created, skipped });
  }
  await backfillAuthorPhones(lidMap);
  // Alertes push des nouvelles offres matchées (best-effort, jamais bloquant).
  try {
    const fresh = await query<{ id: number }>(
      "SELECT id FROM job_offers WHERE ai_status = 'done' AND created_at > to_timestamp($1) LIMIT 20",
      [startedAt],
    );
    if (fresh.length > 0) {
      const { processNewMatches } = await import("./jobAlerts");
      await processNewMatches(fresh.map((r) => Number(r.id)));
    }
  } catch {
    // Les alertes ne doivent jamais bloquer la synchro.
  }
  return { groups };
}

/**
 * Complète les numéros d'auteur manquants (offres "PV" arrivées par webhook
 * ou avant la résolution LID) sans ré-analyser.
 */
export async function backfillAuthorPhones(lidMap?: Map<string, string> | null): Promise<number> {
  await ready();
  const map = lidMap ?? (await getLidToPhoneMap());
  if (map.size === 0) return 0;
  const rows = await query<{ id: number; author: string | null }>(
    "SELECT id, author FROM job_offers WHERE author_phone IS NULL AND author IS NOT NULL LIMIT 200",
  );
  let fixed = 0;
  for (const r of rows) {
    const phone = resolveAuthorPhone(r.author, map);
    if (phone) {
      await query("UPDATE job_offers SET author_phone = $1 WHERE id = $2", [phone, Number(r.id)]);
      fixed += 1;
    }
  }
  return fixed;
}

export type ReprocessResult = {
  processed: number;
  created: number;
  skipped: number;
  nextOffset: number;
  done: boolean;
};

type RawRow = {
  wa_message_id: string;
  group_chat_id: string;
  author: string | null;
  body: string;
  posted_at: string | null;
  has_media: boolean;
  media_mime: string | null;
  raw_media_url: string | null;
};

/**
 * Rejoue l'archive brute dans le pipeline complet (threads, médias, IA,
 * numéro auteur). Par lots chronologiques, idempotent : relancer ne
 * duplique rien (conflit sur wa_message_id).
 */
export async function reprocessArchive(
  limit = 8,
  offset = 0,
  lidMap?: Map<string, string> | null,
): Promise<ReprocessResult> {
  await ready();
  const safeLimit = Math.max(1, Math.min(25, limit));
  const safeOffset = Math.max(0, offset);
  const rows = await query<RawRow>(
    `SELECT wa_message_id, group_chat_id, author, body, posted_at, has_media, media_mime, raw_media_url
     FROM wa_raw_messages ORDER BY posted_at ASC NULLS LAST LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset],
  );
  if (rows.length === 0) {
    return { processed: 0, created: 0, skipped: 0, nextOffset: safeOffset, done: true };
  }
  const map = lidMap ?? (await getLidToPhoneMap());
  const groupName = (chatId: string): string =>
    JOB_SOURCE_GROUPS.find((g) => g.chatId === chatId)?.name ?? "Archives";

  let created = 0;
  let skipped = 0;
  // Threads par groupe pour recoller les annonces fractionnées.
  const byGroup = new Map<string, WahaMessage[]>();
  for (const r of rows) {
    const mediaUrl = r.raw_media_url || guessMediaUrl(r.wa_message_id, r.media_mime) || undefined;
    const list = byGroup.get(r.group_chat_id) ?? [];
    list.push({
      id: r.wa_message_id,
      body: r.body ?? "",
      timestamp: r.posted_at ? Math.floor(new Date(String(r.posted_at)).getTime() / 1000) : 0,
      from: "",
      participant: r.author ?? undefined,
      fromMe: false,
      hasMedia: r.has_media === true,
      mediaUrl,
      mediaMime: r.media_mime ?? undefined,
    });
    byGroup.set(r.group_chat_id, list);
  }
  for (const [chatId, messages] of byGroup) {
    for (const t of buildMessageThreads(messages)) {
      const res = await analyzeAndStoreThread(groupName(chatId), chatId, t.thread, t.partIds, map, t.media);
      if (res === "created") created += 1;
      else skipped += 1;
    }
  }
  return {
    processed: rows.length,
    created,
    skipped,
    nextOffset: safeOffset + rows.length,
    done: rows.length < safeLimit,
  };
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
