// Archive brute de l'historique WhatsApp (WAHA) vers Postgres.
//
// Lecture seule côté WAHA + INSERT dans wa_raw_messages : le pipeline live
// (job_offers + analyse Gemini) n'est ni lu ni modifié. Les offres pourront
// être ré-analysées plus tard à partir de cette table.
//
// Pagination constatée sur l'endpoint messages (sondage du 11/09/2026) :
// - `limit=N` respecté (testé jusqu'à 200), ordre antif-chronologique.
// - `offset=N` saute les N plus récents, MAIS les fenêtres glissent sur un
//   groupe actif (pages successives se recouvrent) : déduplication par ID
//   obligatoire, arrêt dès qu'une page n'apporte rien de nouveau.
// - `before=<id>` ignoré par cette version de WAHA : mêmes résultats avec
//   ou sans, donc non utilisé ici.

import { query, ready } from "./db";
import { JOB_SOURCE_GROUPS, resolveGroupChatId, type WahaMessage } from "./waha";

/** Taille de page : 100 messages par requête (maximum utile constaté). */
export const HISTORY_PAGE_SIZE = 100;
/** Garde-fou : jamais plus de 1000 messages par groupe et par backfill. */
export const HISTORY_MAX_TOTAL = 1000;

function wahaBaseUrl(): string {
  const url = process.env.WAHA_BASE_URL || "https://bot.labs.synelia.tech";
  return url.replace(/\/$/, "");
}

function wahaApiKey(): string {
  const key = process.env.WAHA_API_KEY;
  if (!key) throw new Error("WAHA_API_KEY manquant");
  return key;
}

function wahaSession(): string {
  return process.env.WAHA_SESSION || "Etd0MVpT9b";
}

type RawHistoryMessage = {
  id?: unknown;
  body?: unknown;
  timestamp?: unknown;
  from?: unknown;
  participant?: unknown;
  fromMe?: unknown;
  hasMedia?: unknown;
  media?: unknown;
};

/**
 * Une page d'historique (downloadMedia=false : on n'archive que le texte et
 * les métadonnées, pas les binaires). Défini ici plutôt que dans waha.ts
 * car getGroupMessages plafonne limit à 50 et ne gère pas offset.
 */
async function fetchHistoryPage(chatId: string, limit: number, offset: number): Promise<WahaMessage[]> {
  const safeLimit = Math.max(1, Math.min(HISTORY_PAGE_SIZE, limit));
  const safeOffset = Math.max(0, offset);
  const res = await fetch(
    `${wahaBaseUrl()}/api/${wahaSession()}/chats/${encodeURIComponent(chatId)}/messages?limit=${safeLimit}&offset=${safeOffset}&downloadMedia=false`,
    {
      headers: { accept: "application/json", "x-api-key": wahaApiKey() },
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WAHA ${res.status}: ${text.slice(0, 300)}`);
  }
  const raw = (await res.json()) as RawHistoryMessage[];
  return raw.map((m) => {
    const media = (m.media ?? {}) as { url?: unknown; mimetype?: unknown };
    return {
      id: typeof m.id === "string" ? m.id : String(m.id ?? `${chatId}-${m.timestamp}`),
      body: typeof m.body === "string" ? m.body : "",
      timestamp: typeof m.timestamp === "number" ? m.timestamp : 0,
      from: typeof m.from === "string" ? m.from : "",
      participant: typeof m.participant === "string" ? m.participant : undefined,
      fromMe: m.fromMe === true,
      hasMedia: m.hasMedia === true,
      mediaUrl: typeof media.url === "string" ? media.url : undefined,
      mediaMime: typeof media.mimetype === "string" ? media.mimetype : undefined,
    };
  });
}

/** Déduplique par ID de message en gardant la première occurrence. */
export function dedupeById(messages: WahaMessage[]): WahaMessage[] {
  const seen = new Set<string>();
  const out: WahaMessage[] = [];
  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

export type PagingState = {
  /** Messages renvoyés par la page qui vient d'être lue. */
  pageLength: number;
  /** Taille demandée pour cette page (une page courte = fin du store). */
  requested: number;
  /** Parmi eux, combien d'IDs encore jamais vus. */
  addedNew: number;
  /** Total unique collecté jusqu'ici. */
  totalSoFar: number;
  /** Plafond demandé par l'appelant. */
  maxTotal: number;
};

/**
 * Condition d'arrêt pure (testable) de la pagination : page vide, que des
 * doublons (fenêtre déjà vue — cas normal sur un groupe actif), plafond
 * atteint, ou page partielle (fin du store côté WAHA).
 */
export function shouldStopPaging(s: PagingState): boolean {
  if (s.pageLength === 0) return true;
  if (s.addedNew === 0) return true;
  if (s.totalSoFar >= s.maxTotal) return true;
  if (s.pageLength < s.requested) return true;
  return false;
}

/**
 * Lit l'historique d'un groupe page par page (100 + offset) jusqu'à page
 * vide / que des doublons / page partielle / plafond maxTotal.
 */
export async function fetchHistoryMessages(
  chatId: string,
  maxTotal = HISTORY_MAX_TOTAL,
): Promise<WahaMessage[]> {
  const cap = Math.max(1, Math.min(HISTORY_MAX_TOTAL, maxTotal));
  const out: WahaMessage[] = [];
  const seen = new Set<string>();
  let offset = 0;
  for (;;) {
    const requested = Math.min(HISTORY_PAGE_SIZE, cap - out.length);
    const page = await fetchHistoryPage(chatId, requested, offset);
    let addedNew = 0;
    for (const m of page) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
      addedNew += 1;
    }
    if (shouldStopPaging({ pageLength: page.length, requested, addedNew, totalSoFar: out.length, maxTotal: cap })) {
      break;
    }
    offset += page.length;
  }
  return out;
}

/**
 * Stocke les messages bruts (INSERT ... ON CONFLICT DO NOTHING : rejouer le
 * backfill ne duplique rien). Retourne le nombre de lignes insérées.
 */
export async function storeRawMessages(groupChatId: string, messages: WahaMessage[]): Promise<number> {
  await ready();
  let inserted = 0;
  for (const m of dedupeById(messages)) {
    const author = m.participant ?? m.from ?? null;
    const ts = typeof m.timestamp === "number" && m.timestamp > 0 ? m.timestamp : null;
    const rows = await query<{ wa_message_id: string }>(
      `INSERT INTO wa_raw_messages (wa_message_id, group_chat_id, author, body, posted_at, has_media, media_mime, raw_media_url)
       VALUES ($1, $2, $3, $4, to_timestamp($5), $6, $7, $8)
       ON CONFLICT (wa_message_id) DO NOTHING RETURNING wa_message_id`,
      [
        m.id,
        groupChatId,
        author || null,
        m.body ?? "",
        ts,
        m.hasMedia === true,
        m.mediaMime ?? null,
        m.mediaUrl ?? null,
      ],
    );
    inserted += rows.length;
  }
  return inserted;
}

/** Étendue temporelle réelle couverte par des messages, en jours (null si aucune date). */
export function historySpanDays(messages: Array<Pick<WahaMessage, "timestamp">>): number | null {
  const tss = messages
    .map((m) => m.timestamp)
    .filter((t): t is number => typeof t === "number" && t > 0);
  if (tss.length === 0) return null;
  return (Math.max(...tss) - Math.min(...tss)) / 86400;
}

export type BackfillGroupResult = {
  group: string;
  chatId: string;
  fetched: number;
  stored: number;
  spanDays: number | null;
  oldestAt: string | null;
  newestAt: string | null;
};

export type BackfillResult = { groups: BackfillGroupResult[] };

/**
 * Backfill d'archive pour les deux groupes sources : lit l'historique WAHA
 * et le stocke brut. Idempotent (ON CONFLICT DO NOTHING), sans analyse IA
 * et sans toucher à job_offers.
 */
export async function backfillHistory(maxTotalPerGroup = HISTORY_MAX_TOTAL): Promise<BackfillResult> {
  await ready();
  const groups: BackfillGroupResult[] = [];
  for (const g of JOB_SOURCE_GROUPS) {
    const chatId = await resolveGroupChatId(g.name, g.chatId);
    const messages = await fetchHistoryMessages(chatId, maxTotalPerGroup);
    const stored = await storeRawMessages(chatId, messages);
    const tss = messages
      .map((m) => m.timestamp)
      .filter((t): t is number => typeof t === "number" && t > 0);
    groups.push({
      group: g.name,
      chatId,
      fetched: messages.length,
      stored,
      spanDays: historySpanDays(messages),
      oldestAt: tss.length > 0 ? new Date(Math.min(...tss) * 1000).toISOString() : null,
      newestAt: tss.length > 0 ? new Date(Math.max(...tss) * 1000).toISOString() : null,
    });
  }
  return { groups };
}
