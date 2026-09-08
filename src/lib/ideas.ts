import { getDb, ready } from "./db";
import { improveIdea, generateCoverImage } from "./gemini";

export type Category = { id: number; slug: string; name: string; emoji: string };

export type IdeaListItem = {
  id: number;
  title: string;
  pitch: string;
  createdAt: string;
  authorPseudo: string;
  categorySlug: string;
  categoryName: string;
  categoryEmoji: string;
  aiStatus: "pending" | "done" | "failed";
  aiScore: number | null;
  aiSummary: string | null;
  votes: number;
  commentCount: number;
  coverStatus: "pending" | "done" | "failed" | "skipped";
  coverImage: string | null;
};

export type IdeaDetail = IdeaListItem & {
  coverError: string | null;
  ai: {
    summary: string;
    targetAudience: string;
    valueProposition: string;
    revenueModel: string;
    firstSteps: string[];
    risks: string[];
    score: number;
  } | null;
  aiError: string | null;
};

export type Comment = {
  id: number;
  body: string;
  createdAt: string;
  authorPseudo: string;
};

export async function getCategories(): Promise<Category[]> {
  await ready();
  const db = getDb();
  const res = await db.execute("SELECT id, slug, name, emoji FROM categories ORDER BY name");
  return res.rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    emoji: String(r.emoji),
  }));
}

const LIST_SELECT = `
  SELECT
    i.id, i.title, i.pitch, i.created_at, i.ai_status, i.ai_score, i.ai_json,
    u.pseudo AS author_pseudo,
    c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji,
    (SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id) AS votes,
    (SELECT COUNT(*) FROM comments cm WHERE cm.idea_id = i.id) AS comment_count,
    i.cover_status, i.cover_image
  FROM ideas i
  JOIN users u ON u.id = i.author_id
  JOIN categories c ON c.id = i.category_id
`;

function rowToListItem(r: Record<string, unknown>): IdeaListItem {
  let summary: string | null = null;
  if (r.ai_json) {
    try {
      summary = JSON.parse(String(r.ai_json)).summary ?? null;
    } catch {
      summary = null;
    }
  }
  return {
    id: Number(r.id),
    title: String(r.title),
    pitch: String(r.pitch),
    createdAt: String(r.created_at),
    authorPseudo: String(r.author_pseudo),
    categorySlug: String(r.category_slug),
    categoryName: String(r.category_name),
    categoryEmoji: String(r.category_emoji),
    aiStatus: String(r.ai_status) as IdeaListItem["aiStatus"],
    aiScore: r.ai_score === null || r.ai_score === undefined ? null : Number(r.ai_score),
    aiSummary: summary,
    votes: Number(r.votes),
    commentCount: Number(r.comment_count),
    coverStatus: String(r.cover_status || "pending") as IdeaListItem["coverStatus"],
    coverImage: r.cover_image ? String(r.cover_image) : null,
  };
}

export type SortOrder = "recent" | "top" | "score";

export async function listIdeas(opts: {
  categorySlug?: string;
  search?: string;
  sort?: SortOrder;
}): Promise<IdeaListItem[]> {
  await ready();
  const db = getDb();
  const conds: string[] = [];
  const args: (string | number)[] = [];
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
  const res = await db.execute({
    sql: `${LIST_SELECT} ${where} ${order} LIMIT 100`,
    args,
  });
  return res.rows.map((r) => rowToListItem(r as Record<string, unknown>));
}

export async function getIdea(id: number): Promise<IdeaDetail | null> {
  await ready();
  const db = getDb();
  const res = await db.execute({
    sql: `${LIST_SELECT} WHERE i.id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0] as Record<string, unknown>;
  const base = rowToListItem(row);
  let ai: IdeaDetail["ai"] = null;
  if (row.ai_json) {
    try {
      ai = JSON.parse(String(row.ai_json));
    } catch {
      ai = null;
    }
  }
  return {
    ...base,
    ai,
    aiError: row.ai_error ? String(row.ai_error) : null,
    coverError: row.cover_error ? String(row.cover_error) : null,
  };
}

export async function getComments(ideaId: number): Promise<Comment[]> {
  await ready();
  const db = getDb();
  const res = await db.execute({
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
  await ready();
  const db = getDb();
  await db.execute({
    sql: "INSERT INTO comments (idea_id, author_id, body) VALUES (?, ?, ?)",
    args: [ideaId, authorId, body],
  });
}

export async function toggleVote(ideaId: number, userId: number): Promise<boolean> {
  await ready();
  const db = getDb();
  const existing = await db.execute({
    sql: "SELECT 1 FROM votes WHERE idea_id = ? AND user_id = ?",
    args: [ideaId, userId],
  });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: "DELETE FROM votes WHERE idea_id = ? AND user_id = ?",
      args: [ideaId, userId],
    });
    return false;
  }
  await db.execute({
    sql: "INSERT INTO votes (idea_id, user_id) VALUES (?, ?)",
    args: [ideaId, userId],
  });
  return true;
}

export async function hasVoted(ideaId: number, userId: number): Promise<boolean> {
  await ready();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT 1 FROM votes WHERE idea_id = ? AND user_id = ?",
    args: [ideaId, userId],
  });
  return res.rows.length > 0;
}

export async function createIdea(opts: {
  title: string;
  pitch: string;
  categorySlug: string;
  authorId: number;
}): Promise<number> {
  await ready();
  const db = getDb();
  const cat = await db.execute({
    sql: "SELECT id FROM categories WHERE slug = ?",
    args: [opts.categorySlug],
  });
  if (cat.rows.length === 0) throw new Error("Catégorie invalide");
  const categoryId = Number(cat.rows[0].id);
  const catNameRes = await db.execute({
    sql: "SELECT name FROM categories WHERE id = ?",
    args: [categoryId],
  });
  const categoryName = String(catNameRes.rows[0]?.name || opts.categorySlug);

  const inserted = await db.execute({
    sql: `INSERT INTO ideas (title, pitch, category_id, author_id, ai_status, cover_status)
          VALUES (?, ?, ?, ?, 'pending', 'pending') RETURNING id`,
    args: [opts.title, opts.pitch, categoryId, opts.authorId],
  });
  const id = Number(inserted.rows[0].id);

  // Amélioration IA + illustration en arrière-plan : on ne bloque pas la création.
  runAiImprovement(id, opts.title, opts.pitch).catch(() => {});
  runCoverGeneration(id, opts.title, opts.pitch, categoryName).catch(() => {});

  return id;
}

export async function runAiImprovement(id: number, title: string, pitch: string) {
  const db = getDb();
  try {
    const improved = await improveIdea(title, pitch);
    await db.execute({
      sql: "UPDATE ideas SET ai_status = 'done', ai_json = ?, ai_score = ?, ai_error = NULL WHERE id = ?",
      args: [JSON.stringify(improved), improved.score, id],
    });
  } catch (err) {
    await db.execute({
      sql: "UPDATE ideas SET ai_status = 'failed', ai_error = ? WHERE id = ?",
      args: [err instanceof Error ? err.message : String(err), id],
    });
  }
}

export async function retryAiImprovement(id: number): Promise<void> {
  await ready();
  const db = getDb();
  const res = await db.execute({
    sql: "SELECT title, pitch FROM ideas WHERE id = ?",
    args: [id],
  });
  if (res.rows.length === 0) return;
  const row = res.rows[0];
  await db.execute({ sql: "UPDATE ideas SET ai_status = 'pending' WHERE id = ?", args: [id] });
  await runAiImprovement(id, String(row.title), String(row.pitch));
}

export async function runCoverGeneration(
  id: number,
  title: string,
  pitch: string,
  categoryName: string,
) {
  const db = getDb();
  try {
    const image = await generateCoverImage(title, pitch, categoryName);
    const dataUrl = `data:${image.mimeType};base64,${image.base64}`;
    await db.execute({
      sql: "UPDATE ideas SET cover_status = 'done', cover_image = ?, cover_error = NULL WHERE id = ?",
      args: [dataUrl, id],
    });
  } catch (err) {
    await db.execute({
      sql: "UPDATE ideas SET cover_status = 'failed', cover_error = ? WHERE id = ?",
      args: [err instanceof Error ? err.message : String(err), id],
    });
  }
}

export async function retryCoverGeneration(id: number): Promise<void> {
  await ready();
  const db = getDb();
  const res = await db.execute({
    sql: `SELECT i.title, i.pitch, c.name AS category_name
          FROM ideas i JOIN categories c ON c.id = i.category_id WHERE i.id = ?`,
    args: [id],
  });
  if (res.rows.length === 0) return;
  const row = res.rows[0];
  await db.execute({ sql: "UPDATE ideas SET cover_status = 'pending' WHERE id = ?", args: [id] });
  await runCoverGeneration(id, String(row.title), String(row.pitch), String(row.category_name));
}
