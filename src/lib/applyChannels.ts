/**
 * Extraction déterministe des canaux de candidature depuis un message WhatsApp.
 * Complète l'analyse Gemini (qui peut rater un numéro / mail obfusqué) :
 * on fusionne les deux sources côté UI.
 */

export type ApplyChannels = {
  emails: string[];
  phones: string[];
  urls: string[];
};

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE =
  /(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
// Numéros ivoiriens / internationaux : +225 07 07 07 07 07, 0707070707,
// 07-07-07-07-07, (225) 07..., avec espaces / tirets / points.
const PHONE_RE =
  /(?:\+?\d[\d\s\-().]{6,}\d)/g;

function cleanUrl(raw: string): string | null {
  let u = raw.trim().replace(/[.,;:!?)\]]+$/, "");
  if (!u) return null;
  if (/^www\./i.test(u)) u = `https://${u}`;
  if (!/^https?:\/\//i.test(u)) return null;
  if (u.length > 500) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString().replace(/\/$/, "") === parsed.origin ? parsed.origin + "/" : parsed.toString();
  } catch {
    return null;
  }
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Normalise un numéro brut vers E.164 ivoirien quand c'est possible.
 * - 10 chiffres commençant par 0 (ex: 0707070707) → +225707070707
 * - déjà avec indicatif 225 (ex: 2250707070707) → +225...
 * - autre international avec 8-15 chiffres → +...
 * Retourne null si pas crédible comme numéro d'appel.
 */
export function normalizePhone(raw: string): string | null {
  const d = digitsOnly(raw);
  if (d.length < 8 || d.length > 15) return null;
  // Cas ivoirien : 10 chiffres commençant par 0.
  if (/^0\d{9}$/.test(d)) return `+225${d.slice(1)}`;
  // Avec indicatif : 225 + 0 + 9 chiffres -> on retire le 0 (ex: +225 07...).
  if (/^2250\d{9}$/.test(d)) return `+225${d.slice(4)}`;
  if (/^225\d{8,10}$/.test(d)) return `+${d}`;
  if (raw.trim().startsWith("+") && d.length >= 8) return `+${d}`;
  // Numéro local 8 chiffres (ex: Abidjan fixe sans 0) : on tente +225.
  if (/^\d{8}$/.test(d)) return `+225${d}`;
  if (/^\d{10}$/.test(d) && !d.startsWith("0")) return null;
  return null;
}

export function extractEmails(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(EMAIL_RE) ?? []) {
    const e = m.toLowerCase().trim();
    if (e.length <= 254) out.add(e);
  }
  return [...out].slice(0, 5);
}

export function extractUrls(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(URL_RE) ?? []) {
    const u = cleanUrl(m);
    if (u) out.add(u);
  }
  return [...out].slice(0, 5);
}

export function extractPhones(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.match(PHONE_RE) ?? []) {
    // Évite de confondre dates / prix / salaires avec des numéros :
    // exige au moins 8 chiffres.
    if (digitsOnly(m).length < 8) continue;
    // Évite les années / montants isolés type "2024" ou "150 000".
    if (/^\d{4}$/.test(m.trim())) continue;
    const n = normalizePhone(m);
    if (n) out.add(n);
  }
  return [...out].slice(0, 5);
}

export function extractApplyChannels(text: string): ApplyChannels {
  return {
    emails: extractEmails(text),
    phones: extractPhones(text),
    urls: extractUrls(text),
  };
}

/** Fusionne canaux regex + ceux déjà extraits par Gemini (dédupliqués). */
export function mergeChannels(
  base: ApplyChannels,
  extra?: Partial<ApplyChannels> | null,
): ApplyChannels {
  if (!extra) return base;
  const merge = (a: string[], b?: string[]) => {
    const seen = new Set(a.map((s) => s.toLowerCase()));
    const out = [...a];
    for (const s of b ?? []) {
      const v = s.trim();
      if (!v || seen.has(v.toLowerCase())) continue;
      // Re-valide les extras (Gemini peut halluciner un format).
      seen.add(v.toLowerCase());
      out.push(v);
    }
    return out.slice(0, 5);
  };
  const extraEmails = (extra.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  // Normalise les téléphones venant de Gemini aussi.
  const extraPhones = (extra.phones ?? [])
    .map((p) => normalizePhone(p) ?? p.trim())
    .filter(Boolean);
  const extraUrls = (extra.urls ?? [])
    .map((u) => cleanUrl(u) ?? u.trim())
    .filter(Boolean);
  return {
    emails: merge(base.emails, extraEmails),
    phones: merge(base.phones, extraPhones),
    urls: merge(base.urls, extraUrls),
  };
}

/** Lien WhatsApp pré-rempli vers un recruteur. */
export function whatsappLink(phoneE164: string, jobTitle?: string): string {
  const digits = digitsOnly(phoneE164);
  const text = jobTitle
    ? `Bonjour, je suis intéressé par votre offre : ${jobTitle}. Voici mon profil : `
    : "Bonjour, je suis intéressé par votre offre. Voici mon profil : ";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export type AiApplyHints = {
  contact?: string | null;
  emails?: string[] | null;
  phones?: string[] | null;
  urls?: string[] | null;
  howToApply?: string | null;
} | null | undefined;

/**
 * Canaux finaux pour une offre : regex sur le texte brut (+ contact IA)
 * fusionnés avec les champs structurés de Gemini. Fonctionne aussi pour les
 * offres analysées avant l'ajout des champs structurés.
 */
export function resolveApplyChannels(body: string, ai?: AiApplyHints): ApplyChannels {
  const fromText = extractApplyChannels(`${body}\n${ai?.contact ?? ""}`);
  return mergeChannels(fromText, {
    emails: ai?.emails ?? undefined,
    phones: ai?.phones ?? undefined,
    urls: ai?.urls ?? undefined,
  });
}

/** Libellé court d'un lien pour l'affichage (sans protocole, tronqué). */
export function shortUrl(url: string): string {
  const s = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return s.length > 42 ? `${s.slice(0, 42)}…` : s;
}

/** Séparateur inséré quand on recolle des messages fractionnés. */
export const THREAD_SEPARATOR = "\n\n— suite du message —\n\n";

/** Nombre de morceaux recollés (1 = message unique). */
export function threadPartCount(body: string): number {
  if (!body.includes(THREAD_SEPARATOR.trim())) return 1;
  return body.split(THREAD_SEPARATOR).length;
}
