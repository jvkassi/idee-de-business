/**
 * SQLite `datetime('now')` renvoie "YYYY-MM-DD HH:MM:SS" en UTC sans fuseau.
 * `new Date()` l'interpréterait en heure locale : on force l'UTC.
 */
export function parseDbDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return new Date(value.replace(" ", "T") + "Z");
  }
  return new Date(value);
}

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const DATETIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDateTime(value: string): string {
  return DATETIME_FMT.format(parseDbDate(value)) + " (UTC)";
}

/**
 * Format compact façon fil d'actualité : "à l'instant", "5 min", "3 h",
 * "hier", "4 j", puis la date. (Le `title` de <time> porte la date complète.)
 */
export function timeAgo(value: string, now: number = Date.now()): string {
  const d = parseDbDate(value);
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return "hier";
  if (days < 7) return `${days} j`;
  return DATE_FMT.format(d);
}

/**
 * Chemin de redirection post-connexion : uniquement un chemin relatif interne
 * ("/ideas/12"), jamais une URL absolue ou protocol-relative ("//evil.com").
 */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function loginHref(next?: string): string {
  return next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/** Teinte stable (0-359) dérivée d'un pseudo, pour les avatars. */
export function hueFor(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}
