import { Pool, type QueryResultRow } from "@neondatabase/serverless";

// Une seule connexion partagée (le HMR de Next recharge les modules).
const globalForDb = globalThis as unknown as { __ideasPool?: Pool; __ideasDbReady?: Promise<void> };

// Volontairement resserré (14 -> 8) : trop de catégories noyait le rail de
// puces et forçait un choix difficile au moment de publier. "Autre" reste
// en secours pour tout ce qui ne rentre pas ailleurs.
const CATEGORIES: Array<[slug: string, name: string, emoji: string]> = [
  ["tech", "Tech & Apps", "💻"],
  ["commerce", "Commerce & Retail", "🛍️"],
  ["agro", "Agro & Alimentation", "🌾"],
  ["fintech", "Finance & Fintech", "💳"],
  ["sante", "Santé & Bien-être", "🩺"],
  ["education", "Éducation & Formation", "🎓"],
  ["mode", "Mode & Beauté", "👗"],
  ["autre", "Autre", "💡"],
];

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    pseudo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_pseudo_lower ON users (lower(pseudo));

  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    pitch TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    author_id INTEGER NOT NULL REFERENCES users(id),
    ai_status TEXT NOT NULL DEFAULT 'pending',
    ai_json TEXT,
    ai_score INTEGER,
    ai_error TEXT,
    cover_status TEXT NOT NULL DEFAULT 'pending',
    cover_image TEXT,
    cover_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category_id);
  CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at);

  CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_comments_idea ON comments(idea_id);

  CREATE TABLE IF NOT EXISTS votes (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (idea_id, user_id)
  );
`;

function makeConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL manquant. Ce projet utilise Neon Postgres : configure " +
        "DATABASE_URL (fournie automatiquement quand Neon est connecté au " +
        "projet Vercel) dans tes variables d'environnement.",
    );
  }
  return url;
}

async function init(pool: Pool) {
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
    await pool.query(stmt);
  }
  for (const [slug, name, emoji] of CATEGORIES) {
    await pool.query(
      "INSERT INTO categories (slug, name, emoji) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING",
      [slug, name, emoji],
    );
  }
  // Retire les catégories qui ne sont plus dans la liste ci-dessus, mais
  // seulement si elles n'ont aucune idée rattachée : on resserre la liste
  // sans jamais casser une idée déjà publiée.
  const keepSlugs = CATEGORIES.map(([slug]) => slug);
  await pool.query(
    `DELETE FROM categories
     WHERE slug <> ALL($1)
       AND id NOT IN (SELECT DISTINCT category_id FROM ideas)`,
    [keepSlugs],
  );
}

function getPool(): Pool {
  if (!globalForDb.__ideasPool) {
    globalForDb.__ideasPool = new Pool({ connectionString: makeConnectionString() });
    globalForDb.__ideasDbReady = init(globalForDb.__ideasPool);
  }
  return globalForDb.__ideasPool;
}

export async function ready(): Promise<void> {
  getPool();
  await globalForDb.__ideasDbReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(sql, args);
  return result.rows;
}
