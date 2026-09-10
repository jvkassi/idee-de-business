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
};

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

/** Derniers messages d'un groupe, sans télécharger les médias (body + métadonnées). */
export async function getGroupMessages(chatId: string, limit = 30): Promise<WahaMessage[]> {
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
    }>
  >(`/api/${session()}/chats/${encodeURIComponent(chatId)}/messages?limit=${safeLimit}&downloadMedia=false`);
  return raw.map((m) => ({
    id: typeof m.id === "string" ? m.id : String(m.id ?? `${chatId}-${m.timestamp}`),
    body: typeof m.body === "string" ? m.body : "",
    timestamp: typeof m.timestamp === "number" ? m.timestamp : 0,
    from: typeof m.from === "string" ? m.from : "",
    participant: typeof m.participant === "string" ? m.participant : undefined,
    fromMe: m.fromMe === true,
    hasMedia: m.hasMedia === true,
  }));
}
