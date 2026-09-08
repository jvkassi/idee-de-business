import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

const globalForDb = globalThis as unknown as { __ideasDb?: Client; __ideasDbReady?: Promise<void> };

const CATEGORIES: Array<[slug: string, name: string, emoji: string]> = [
  ["tech", "Tech & Apps", "💻"],
  ["agro", "Agro & Alimentation", "🌾"],
  ["commerce", "Commerce & Retail", "🛍️"],
  ["fintech", "Finance & Fintech", "💳"],
  ["education", "Éducation & Formation", "🎓"],
  ["sante", "Santé & Bien-être", "🩺"],
  ["transport", "Transport & Logistique", "🚚"],
  ["immobilier", "Immobilier & BTP", "🏗️"],
  ["energie", "Énergie & Environnement", "⚡"],
  ["services", "Services aux entreprises", "🧰"],
  ["media", "Médias & Divertissement", "🎬"],
  ["mode", "Mode & Beauté", "👗"],
  ["tourisme", "Tourisme & Hôtellerie", "🧳"],
  ["autre", "Autre", "💡"],
];

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    pitch TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    ai_status TEXT NOT NULL DEFAULT 'pending',
    ai_json TEXT,
    ai_score INTEGER,
    ai_error TEXT,
    cover_status TEXT NOT NULL DEFAULT 'pending', -- pending | done | failed | skipped
    cover_image TEXT, -- data URL (base64) de l'illustration générée par l'IA
    cover_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category_id);
  CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at);

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_comments_idea ON comments(idea_id);

  CREATE TABLE IF NOT EXISTS votes (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (idea_id, user_id)
  );
`;

function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url) {
    return createClient({ url, authToken });
  }

  // Sur Vercel (et toute plateforme serverless), le système de fichiers du
  // déploiement est en lecture seule (sauf /tmp, éphémère et non partagé
  // entre invocations) : sans base Turso distante, les données ne
  // persisteraient pas. On échoue explicitement plutôt que silencieusement.
  if (process.env.VERCEL) {
    throw new Error(
      "TURSO_DATABASE_URL manquant. Sur Vercel, configure une base Turso " +
        "(https://turso.tech) et définis TURSO_DATABASE_URL + TURSO_AUTH_TOKEN " +
        "dans les variables d'environnement du projet.",
    );
  }

  // Dev local uniquement : fichier SQLite sur disque via libsql.
  const file = process.env.DATABASE_PATH || "./data/ideas.db";
  const abs = path.resolve(/* turbopackIgnore: true */ process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  return createClient({ url: `file:${abs}` });
}

const MIGRATIONS = [
  "ALTER TABLE ideas ADD COLUMN cover_status TEXT NOT NULL DEFAULT 'pending'",
  "ALTER TABLE ideas ADD COLUMN cover_image TEXT",
  "ALTER TABLE ideas ADD COLUMN cover_error TEXT",
];

async function init(client: Client) {
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
  // Migrations best-effort pour les bases déjà créées avant l'ajout d'une colonne.
  for (const stmt of MIGRATIONS) {
    try {
      await client.execute(stmt);
    } catch {
      // colonne déjà présente : on ignore.
    }
  }
  for (const [slug, name, emoji] of CATEGORIES) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO categories (slug, name, emoji) VALUES (?, ?, ?)",
      args: [slug, name, emoji],
    });
  }
}

export function getDb(): Client {
  if (!globalForDb.__ideasDb) {
    globalForDb.__ideasDb = makeClient();
    globalForDb.__ideasDbReady = init(globalForDb.__ideasDb);
  }
  return globalForDb.__ideasDb;
}

export async function ready(): Promise<void> {
  getDb();
  await globalForDb.__ideasDbReady;
}
