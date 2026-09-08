import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import { getDb, ready } from "./db";

const COOKIE_NAME = "idee_session";

function secret() {
  return process.env.SESSION_SECRET || "dev-secret-change-me";
}

function sign(value: string) {
  const h = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${h}`;
}

function verify(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export type SessionUser = { id: number; pseudo: string };

const PSEUDO_RE = /^[a-zA-Z0-9_\-]{3,20}$/;

export function validatePseudo(pseudo: string): string | null {
  const p = pseudo.trim();
  if (!PSEUDO_RE.test(p)) {
    return "Le pseudo doit faire 3 à 20 caractères (lettres, chiffres, _ ou -).";
  }
  return null;
}

export async function loginOrCreate(pseudoRaw: string): Promise<SessionUser> {
  await ready();
  const pseudo = pseudoRaw.trim();
  const db = getDb();
  const existing = await db.execute({
    sql: "SELECT id, pseudo FROM users WHERE pseudo = ? COLLATE NOCASE",
    args: [pseudo],
  });
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return { id: Number(row.id), pseudo: String(row.pseudo) };
  }
  const inserted = await db.execute({
    sql: "INSERT INTO users (pseudo) VALUES (?) RETURNING id, pseudo",
    args: [pseudo],
  });
  const row = inserted.rows[0];
  return { id: Number(row.id), pseudo: String(row.pseudo) };
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  const h = await headers();
  // Sur Vercel/serverless, la connexion externe est en HTTPS même si le
  // proxy interne parle en HTTP : on se base donc sur l'en-tête plutôt
  // que sur NODE_ENV pour décider du flag Secure.
  const proto = h.get("x-forwarded-proto");
  const isHttps = proto ? proto === "https" : process.env.NODE_ENV === "production";
  jar.set(COOKIE_NAME, sign(JSON.stringify(user)), {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const value = verify(raw);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed?.id === "number" && typeof parsed?.pseudo === "string") {
      return parsed as SessionUser;
    }
  } catch {
    // ignore
  }
  return null;
}
