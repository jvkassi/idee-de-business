// Client minimal pour WAHA (WhatsApp HTTP API).
// Docs : https://waha.devlike.pro/docs/
// Session utilisée : Etd0MVpT9b sur https://bot.labs.synelia.tech

export type WahaMessage = {
  id: string;
  body: string;
  timestamp: number;
  from: string;
  participant?: string;
  fromMe: boolean;
  hasMedia: boolean;
  mediaUrl?: string;
  mediaMime?: string;
};

export type MediaAttachment = { mimeType: string; base64: string; bytes: number };

/** L'IA lit ces pièces jointes (flyers, PDF d'offres). Le reste est ignoré. */
const MEDIA_ALLOW = [/^image\/(jpeg|png|webp|gif)$/, /^application\/pdf$/];
const MAX_MEDIA_BYTES = 7 * 1024 * 1024;
export const MAX_ATTACHMENTS = 3;

export function isAnalyzableMedia(mime: string | undefined, bytes: number): boolean {
  if (!mime || bytes <= 0 || bytes > MAX_MEDIA_BYTES) return false;
  return MEDIA_ALLOW.some((re) => re.test(mime));
}

/**
 * WAHA rend des URL internes (http://waha:3000/...) : on les réécrit vers
 * l'hôte public, qui expose aussi /api/files.
 */
export function rewriteMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const publicBase = new URL(baseUrl());
    const u = new URL(url);
    u.protocol = publicBase.protocol;
    u.host = publicBase.host;
    u.port = publicBase.port;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Télécharge une pièce jointe (image/PDF, 7 Mo max). Best-effort : null sinon. */
export async function downloadMediaFile(rawUrl: string): Promise<MediaAttachment | null> {
  try {
    const url = rewriteMediaUrl(rawUrl);
    if (!url) return null;
    const res = await fetch(url, {
      headers: { "x-api-key": apiKey() },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const mimeType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isAnalyzableMedia(mimeType, buf.length)) return null;
    return { mimeType, base64: buf.toString("base64"), bytes: buf.length };
  } catch {
    return null;
  }
}

export type WahaChat = {
  id: string;
  name: string;
};

export const JOB_SOURCE_GROUPS = [
  {
    name: "Opportunités emploi et services VH AGM",
    // ID connu (résolution par nom en priorité, fallback sur cet ID).
    chatId: "120363406705817551@g.us",
  },
  {
    name: "Emploi-Business-Vente 💺🛍️🛒",
    chatId: "22578966814-1603710561@g.us",
  },
] as const;

function baseUrl(): string {
  const url = process.env.WAHA_BASE_URL || "https://bot.labs.synelia.tech";
  return url.replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.WAHA_API_KEY;
  if (!key) throw new Error("WAHA_API_KEY manquant");
  return key;
}

function session(): string {
  return process.env.WAHA_SESSION || "Etd0MVpT9b";
}

async function wahaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { accept: "application/json", "x-api-key": apiKey() },
    // Les groupes ciblés sont volumineux : on évite de bloquer Vercel.
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WAHA ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

/** Liste les chats (jusqu'à 200) et en extrait id + nom. */
export async function listWahaChats(): Promise<WahaChat[]> {
  const raw = await wahaFetch<Array<{ id: unknown; name?: unknown }>>(
    `/api/${session()}/chats?limit=200&offset=0`,
  );
  return raw.map((c) => ({
    id: typeof c.id === "string" ? c.id : String((c.id as { _serialized?: string })?._serialized ?? ""),
    name: typeof c.name === "string" ? c.name : "",
  }));
}

/**
 * Résout l'ID d'un groupe à partir de son nom (insensible à la casse).
 * Fallback sur l'ID codé en dur si le groupe n'est pas trouvé par nom.
 */
export async function resolveGroupChatId(groupName: string, fallbackId: string): Promise<string> {
  try {
    const chats = await listWahaChats();
    const found = chats.find((c) => c.name.trim().toLowerCase() === groupName.trim().toLowerCase());
    if (found?.id) return found.id;
  } catch {
    // Pas bloquant : on utilise le fallback.
  }
  return fallbackId;
}

/**
 * Table LID → numéro (WAHA Plus) : les participants des groupes arrivent en
 * `@lid` opaque, cette route rend leur vrai numéro pour les offres "PV".
 * Best-effort : liste vide si la route est indisponible.
 */
export async function getLidToPhoneMap(limit = 10000): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    // Pagnie jusqu'à épuisement : un auteur PV hors première page = bouton perdu.
    const pageSize = 1000;
    let offset = 0;
    for (let page = 0; page < 12; page++) {
      const raw = await wahaFetch<Array<{ lid?: unknown; pn?: unknown }>>(
        `/api/${session()}/lids?limit=${pageSize}&offset=${offset}`,
      );
      if (raw.length === 0) break;
      for (const e of raw) {
        if (typeof e.lid === "string" && typeof e.pn === "string") {
          map.set(e.lid.trim().toLowerCase(), e.pn.trim());
        }
      }
      if (raw.length < pageSize || map.size >= Math.max(1, Math.min(20000, limit))) break;
      offset += pageSize;
    }
  } catch {
    // Pas bloquant : les offres PV resteront sans bouton direct.
  }
  return map;
}

/**
 * Derniers messages d'un groupe. Avec downloadMedia=true, WAHA joint
 * media.url (à télécharger via downloadMediaFile) pour les images/PDF.
 */
export async function getGroupMessages(
  chatId: string,
  limit = 30,
  downloadMedia = false,
): Promise<WahaMessage[]> {
  const safeLimit = Math.max(1, Math.min(50, limit));
  const raw = await wahaFetch<
    Array<{
      id?: unknown;
      body?: unknown;
      timestamp?: unknown;
      from?: unknown;
      participant?: unknown;
      fromMe?: unknown;
      hasMedia?: unknown;
      media?: unknown;
    }>
  >(
    `/api/${session()}/chats/${encodeURIComponent(chatId)}/messages?limit=${safeLimit}&downloadMedia=${downloadMedia ? "true" : "false"}`,
  );
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
