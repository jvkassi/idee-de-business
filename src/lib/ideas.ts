import { after } from "next/server";
import { getDb, ready } from "./db";
import { improveIdea, generateCoverImage, type IdeaImprovement } from "./gemini";

export type Category = { id: number; slug: string; name: string; emoji: string };

export type AiStatus = "pending" | "done" | "failed";
export type CoverStatus = "pending" | "done" | "failed" | "skipped";

export type IdeaListItem = {
  id: number;
  title: string;
  pitch: string;
  createdAt: string;
  authorPseudo: string;
  categorySlug: string;
  categoryName: string;
  categoryEmoji: string;
  aiStatus: AiStatus;
  aiScore: number | null;
  aiSummary: string | null;
  votes: number;
  /** true si l'utilisateur courant (viewerId) a voté pour cette idée. */
  voted: boolean;
  commentCount: number;
  coverStatus: CoverStatus;
  coverImage: string | null;
};

export type IdeaDetail = IdeaListItem & {
  coverError: string | null;
  ai: IdeaImprovement | null;
  aiError: string | null;
};

export type Comment = {
  id: number;
  body: string;
  createdAt: string;
  authorPseudo: string;
};

/** Client libsql prêt (schéma initialisé). */
async function db() {
  await ready();
  return getDb();
}

export async function getCategories(): Promise<Category[]> {
  const client = await db();
  // Ordre d'insertion (celui du seed) : "Autre" reste en dernier.
  const res = await client.execute("SELECT id, slug, name, emoji FROM categories ORDER BY id");
  return res.rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    emoji: String(r.emoji),
  }));
}

// Le premier paramètre positionnel est toujours viewerId (ou -1 si anonyme).
const LIST_SELECT = `
  SELECT
    i.id, i.title, i.pitch, i.created_at, i.ai_status, i.ai_score, i.ai_json, i.ai_error,
    u.pseudo AS author_pseudo,
    c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji,
    (SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id) AS votes,
    EXISTS(SELECT 1 FROM votes v2 WHERE v2.idea_id = i.id AND v2.user_id = ?) AS voted,
    (SELECT COUNT(*) FROM comments cm WHERE cm.idea_id = i.id) AS comment_count,
    i.cover_status, i.cover_image, i.cover_error
  FROM ideas i
  JOIN users u ON u.id = i.author_id
  JOIN categories c ON c.id = i.category_id
`;

function parseAi(raw: unknown): IdeaImprovement | null {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as IdeaImprovement;
  } catch {
    return null;
  }
}

function rowToListItem(r: Record<string, unknown>): IdeaListItem {
  return {
    id: Number(r.id),
    title: String(r.title),
    pitch: String(r.pitch),
    createdAt: String(r.created_at),
    authorPseudo: String(r.author_pseudo),
    categorySlug: String(r.category_slug),
    categoryName: String(r.category_name),
    categoryEmoji: String(r.category_emoji),
    aiStatus: String(r.ai_status) as AiStatus,
    aiScore: r.ai_score === null || r.ai_score === undefined ? null : Number(r.ai_score),
    aiSummary: parseAi(r.ai_json)?.summary ?? null,
    votes: Number(r.votes),
    voted: Number(r.voted) === 1,
    commentCount: Number(r.comment_count),
    coverStatus: String(r.cover_status || "pending") as CoverStatus,
    coverImage: r.cover_image ? String(r.cover_image) : null,
  };
}

export type SortOrder = "recent" | "top" | "score";

export async function listIdeas(opts: {
  categorySlug?: string;
  search?: string;
  sort?: SortOrder;
  viewerId?: number;
}): Promise<IdeaListItem[]> {
  const client = await db();
  const conds: string[] = [];
  const args: (string | number)[] = [opts.viewerId ?? -1];
  if (opts.categorySlug) {
    conds.push("c.slug = ?");
    args.push(opts.categorySlug);
  }
  if (opts.search) {
    conds.push("(i.title LIKE ? OR i.pitch LIKE ?)");
    args.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const order =
    opts.sort === "top"
      ? "ORDER BY votes DESC, i.created_at DESC"
      : opts.sort === "score"
        ? "ORDER BY (i.ai_score IS NULL), i.ai_score DESC, i.created_at DESC"
        : "ORDER BY i.created_at DESC";
  const res = await client.execute({
    sql: `${LIST_SELECT} ${where} ${order} LIMIT 100`,
    args,
  });
  return res.rows.map((r) => rowToListItem(r as Record<string, unknown>));
}

export async function getIdea(id: number, viewerId?: number): Promise<IdeaDetail | null> {
  const client = await db();
  const res = await client.execute({
    sql: `${LIST_SELECT} WHERE i.id = ?`,
    args: [viewerId ?? -1, id],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0] as Record<string, unknown>;
  return {
    ...rowToListItem(row),
    ai: parseAi(row.ai_json),
    aiError: row.ai_error ? String(row.ai_error) : null,
    coverError: row.cover_error ? String(row.cover_error) : null,
  };
}

export async function getComments(ideaId: number): Promise<Comment[]> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT cm.id, cm.body, cm.created_at, u.pseudo AS author_pseudo
          FROM comments cm JOIN users u ON u.id = cm.author_id
          WHERE cm.idea_id = ? ORDER BY cm.created_at ASC`,
    args: [ideaId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    body: String(r.body),
    createdAt: String(r.created_at),
    authorPseudo: String(r.author_pseudo),
  }));
}

export async function addComment(ideaId: number, authorId: number, body: string) {
  const client = await db();
  await client.execute({
    sql: "INSERT INTO comments (idea_id, author_id, body) VALUES (?, ?, ?)",
    args: [ideaId, authorId, body],
  });
}

/** Ajoute ou retire le vote ; renvoie true si l'utilisateur a maintenant voté. */
export async function toggleVote(ideaId: number, userId: number): Promise<boolean> {
  const client = await db();
  const deleted = await client.execute({
    sql: "DELETE FROM votes WHERE idea_id = ? AND user_id = ?",
    args: [ideaId, userId],
  });
  if (deleted.rowsAffected > 0) return false;
  await client.execute({
    sql: "INSERT INTO votes (idea_id, user_id) VALUES (?, ?)",
    args: [ideaId, userId],
  });
  return true;
}

export async function createIdea(opts: {
  title: string;
  pitch: string;
  categorySlug: string;
  authorId: number;
}): Promise<number> {
  const client = await db();
  const cat = await client.execute({
    sql: "SELECT id, name FROM categories WHERE slug = ?",
    args: [opts.categorySlug],
  });
  if (cat.rows.length === 0) throw new Error("Catégorie invalide");
  const categoryId = Number(cat.rows[0].id);
  const categoryName = String(cat.rows[0].name);

  const inserted = await client.execute({
    sql: `INSERT INTO ideas (title, pitch, category_id, author_id, ai_status, cover_status)
          VALUES (?, ?, ?, ?, 'pending', 'pending') RETURNING id`,
    args: [opts.title, opts.pitch, categoryId, opts.authorId],
  });
  const id = Number(inserted.rows[0].id);

  // Amélioration IA + illustration en arrière-plan, sans bloquer la réponse.
  // `after` garantit que la fonction serverless reste vivante jusqu'à la fin
  // du travail (un simple fire-and-forget serait gelé sur Vercel).
  after(() => Promise.all([
    runAiImprovement(id, opts.title, opts.pitch),
    runCoverGeneration(id, opts.title, opts.pitch, categoryName),
  ]));

  return id;
}

async function runAiImprovement(id: number, title: string, pitch: string) {
  const client = getDb();
  try {
    const improved = await improveIdea(title, pitch);
    await client.execute({
      sql: "UPDATE ideas SET ai_status = 'done', ai_json = ?, ai_score = ?, ai_error = NULL WHERE id = ?",
      args: [JSON.stringify(improved), improved.score, id],
    });
  } catch (err) {
    await client.execute({
      sql: "UPDATE ideas SET ai_status = 'failed', ai_error = ? WHERE id = ?",
      args: [err instanceof Error ? err.message : String(err), id],
    });
  }
}

async function runCoverGeneration(id: number, title: string, pitch: string, categoryName: string) {
  const client = getDb();
  try {
    const image = await generateCoverImage(title, pitch, categoryName);
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    await client.execute({
      sql: "UPDATE ideas SET cover_status = 'done', cover_image = ?, cover_error = NULL WHERE id = ?",
      args: [dataUrl, id],
    });
  } catch (err) {
    await client.execute({
      sql: "UPDATE ideas SET cover_status = 'failed', cover_error = ? WHERE id = ?",
      args: [err instanceof Error ? err.message : String(err), id],
    });
  }
}

/**
 * Repasse l'analyse en "pending" et relance le travail après la réponse :
 * le bouton rend la main immédiatement, la page se rafraîchit toute seule.
 */
export async function retryAiImprovement(id: number): Promise<void> {
  const client = await db();
  const res = await client.execute({ sql: "SELECT title, pitch FROM ideas WHERE id = ?", args: [id] });
  if (res.rows.length === 0) return;
  const { title, pitch } = res.rows[0];
  await client.execute({ sql: "UPDATE ideas SET ai_status = 'pending' WHERE id = ?", args: [id] });
  after(() => runAiImprovement(id, String(title), String(pitch)));
}

export async function retryCoverGeneration(id: number): Promise<void> {
  const client = await db();
  const res = await client.execute({
    sql: `SELECT i.title, i.pitch, c.name AS category_name
          FROM ideas i JOIN categories c ON c.id = i.category_id WHERE i.id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return;
  const { title, pitch, category_name } = res.rows[0];
  await client.execute({ sql: "UPDATE ideas SET cover_status = 'pending' WHERE id = ?", args: [id] });
  after(() => runCoverGeneration(id, String(title), String(pitch), String(category_name)));
}
