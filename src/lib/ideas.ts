import { after } from "next/server";
import { put, del } from "@vercel/blob";
import { query, ready } from "./db";
import { KIT_SCORE_THRESHOLD } from "./constants";
import { notifyUser } from "./push";
import {
  improveIdea,
  generateCoverImage,
  generateFlyerImage,
  generateStarterKit,
  refineIdeaPitch,
  type IdeaImprovement,
  type StarterKit,
} from "./gemini";

export type Category = { id: number; slug: string; name: string; emoji: string };

export type AiStatus = "pending" | "done" | "failed";
export type CoverStatus = "pending" | "done" | "failed" | "skipped";
export type KitStatus = "none" | "pending" | "done" | "failed";
export { KIT_SCORE_THRESHOLD };

export type IdeaListItem = {
  id: number;
  title: string;
  pitch: string;
  createdAt: string;
  authorId: number;
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
  audioUrl: string | null;
  parentIdeaId: number | null;
  forkCount: number;
  kitStatus: KitStatus;
  /** Nombre de jalons réels franchis (0-2) pendant kit_status='pending' — sert d'ancrage à la progression affichée. */
  kitStep: number;
  kitFlyerImage: string | null;
};

export type IdeaDetail = IdeaListItem & {
  coverError: string | null;
  ai: IdeaImprovement | null;
  aiError: string | null;
  kit: StarterKit | null;
  kitError: string | null;
  parentIdea: { id: number; title: string; authorPseudo: string } | null;
};

export type Comment = {
  id: number;
  body: string;
  createdAt: string;
  authorPseudo: string;
  audioUrl: string | null;
};

export async function getCategories(): Promise<Category[]> {
  await ready();
  // Ordre d'insertion (celui du seed) : "Autre" reste en dernier.
  const rows = await query<{ id: number; slug: string; name: string; emoji: string }>(
    "SELECT id, slug, name, emoji FROM categories ORDER BY id",
  );
  return rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    emoji: String(r.emoji),
  }));
}

// Le premier paramètre positionnel est toujours viewerId (ou -1 si anonyme).
const LIST_SELECT = `
  SELECT
    i.id, i.title, i.pitch, i.created_at, i.author_id, i.ai_status, i.ai_score, i.ai_json, i.ai_error,
    u.pseudo AS author_pseudo,
    c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji,
    (SELECT COUNT(*) FROM votes v WHERE v.idea_id = i.id) AS votes,
    EXISTS(SELECT 1 FROM votes v2 WHERE v2.idea_id = i.id AND v2.user_id = $1) AS voted,
    (SELECT COUNT(*) FROM comments cm WHERE cm.idea_id = i.id) AS comment_count,
    (SELECT COUNT(*) FROM ideas f WHERE f.parent_idea_id = i.id) AS fork_count,
    i.cover_status, i.cover_image, i.cover_error,
    i.audio_url, i.parent_idea_id,
    i.kit_status, i.kit_step, i.kit_json, i.kit_flyer_image, i.kit_error
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

function parseKit(raw: unknown): StarterKit | null {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw)) as StarterKit;
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
    authorId: Number(r.author_id),
    authorPseudo: String(r.author_pseudo),
    categorySlug: String(r.category_slug),
    categoryName: String(r.category_name),
    categoryEmoji: String(r.category_emoji),
    aiStatus: String(r.ai_status) as AiStatus,
    aiScore: r.ai_score === null || r.ai_score === undefined ? null : Number(r.ai_score),
    aiSummary: parseAi(r.ai_json)?.summary ?? null,
    votes: Number(r.votes),
    voted: r.voted === true,
    commentCount: Number(r.comment_count),
    coverStatus: String(r.cover_status || "pending") as CoverStatus,
    coverImage: r.cover_image ? String(r.cover_image) : null,
    audioUrl: r.audio_url ? String(r.audio_url) : null,
    parentIdeaId: r.parent_idea_id === null || r.parent_idea_id === undefined ? null : Number(r.parent_idea_id),
    forkCount: Number(r.fork_count || 0),
    kitStatus: String(r.kit_status || "none") as KitStatus,
    kitStep: Number(r.kit_step || 0),
    kitFlyerImage: r.kit_flyer_image ? String(r.kit_flyer_image) : null,
  };
}

export type SortOrder = "recent" | "top" | "score";

export async function listIdeas(opts: {
  categorySlug?: string;
  search?: string;
  sort?: SortOrder;
  viewerId?: number;
}): Promise<IdeaListItem[]> {
  await ready();
  const conds: string[] = [];
  const args: (string | number)[] = [opts.viewerId ?? -1];
  if (opts.categorySlug) {
    args.push(opts.categorySlug);
    conds.push(`c.slug = $${args.length}`);
  }
  if (opts.search) {
    args.push(`%${opts.search}%`);
    const idx = args.length;
    conds.push(`(i.title ILIKE $${idx} OR i.pitch ILIKE $${idx})`);
  }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const order =
    opts.sort === "top"
      ? "ORDER BY votes DESC, i.created_at DESC"
      : opts.sort === "score"
        ? "ORDER BY (i.ai_score IS NULL), i.ai_score DESC, i.created_at DESC"
        : "ORDER BY i.created_at DESC";
  const rows = await query(`${LIST_SELECT} ${where} ${order} LIMIT 100`, args);
  return rows.map((r) => rowToListItem(r as Record<string, unknown>));
}

/**
 * Les idées à mettre en avant sur la page d'accueil : analysées, de
 * préférence illustrées, les plus soutenues d'abord. Preuve sociale réelle,
 * pas des exemples inventés.
 */
export async function listFeaturedIdeas(limit = 3): Promise<IdeaListItem[]> {
  await ready();
  const rows = await query(
    `${LIST_SELECT}
     WHERE i.ai_status = 'done'
     ORDER BY (i.cover_image IS NULL), votes DESC, i.ai_score DESC NULLS LAST, i.created_at DESC
     LIMIT $2`,
    [-1, limit],
  );
  return rows.map((r) => rowToListItem(r as Record<string, unknown>));
}

export type SiteStats = {
  ideas: number;
  votes: number;
  comments: number;
  users: number;
  /** Idées ayant atteint le seuil du starter kit. */
  validated: number;
  /** Starter kits effectivement générés. */
  kits: number;
  forks: number;
};

/** Compteurs globaux affichés sur la page d'accueil (une seule requête). */
export async function getSiteStats(): Promise<SiteStats> {
  await ready();
  const rows = await query<Record<string, unknown>>(
    `SELECT
       (SELECT COUNT(*) FROM ideas) AS ideas,
       (SELECT COUNT(*) FROM votes) AS votes,
       (SELECT COUNT(*) FROM comments) AS comments,
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM ideas WHERE ai_score >= $1) AS validated,
       (SELECT COUNT(*) FROM ideas WHERE kit_status = 'done') AS kits,
       (SELECT COUNT(*) FROM ideas WHERE parent_idea_id IS NOT NULL) AS forks`,
    [KIT_SCORE_THRESHOLD],
  );
  const r = rows[0] ?? {};
  return {
    ideas: Number(r.ideas ?? 0),
    votes: Number(r.votes ?? 0),
    comments: Number(r.comments ?? 0),
    users: Number(r.users ?? 0),
    validated: Number(r.validated ?? 0),
    kits: Number(r.kits ?? 0),
    forks: Number(r.forks ?? 0),
  };
}

export async function getIdea(id: number, viewerId?: number): Promise<IdeaDetail | null> {
  await ready();
  const rows = await query(`${LIST_SELECT} WHERE i.id = $2`, [viewerId ?? -1, id]);
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;

  let parentIdea: IdeaDetail["parentIdea"] = null;
  if (row.parent_idea_id) {
    const parentRows = await query<{ id: number; title: string; author_pseudo: string }>(
      `SELECT i.id, i.title, u.pseudo AS author_pseudo
       FROM ideas i JOIN users u ON u.id = i.author_id WHERE i.id = $1`,
      [Number(row.parent_idea_id)],
    );
    if (parentRows.length > 0) {
      parentIdea = { id: Number(parentRows[0].id), title: String(parentRows[0].title), authorPseudo: String(parentRows[0].author_pseudo) };
    }
  }

  return {
    ...rowToListItem(row),
    ai: parseAi(row.ai_json),
    aiError: row.ai_error ? String(row.ai_error) : null,
    coverError: row.cover_error ? String(row.cover_error) : null,
    kit: parseKit(row.kit_json),
    kitError: row.kit_error ? String(row.kit_error) : null,
    parentIdea,
  };
}

export async function getComments(ideaId: number): Promise<Comment[]> {
  await ready();
  const rows = await query(
    `SELECT cm.id, cm.body, cm.created_at, cm.audio_url, u.pseudo AS author_pseudo
     FROM comments cm JOIN users u ON u.id = cm.author_id
     WHERE cm.idea_id = $1 ORDER BY cm.created_at ASC`,
    [ideaId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    body: String(r.body),
    createdAt: String(r.created_at),
    authorPseudo: String(r.author_pseudo),
    audioUrl: r.audio_url ? String(r.audio_url) : null,
  }));
}

export async function addComment(ideaId: number, authorId: number, body: string, audioUrl?: string | null) {
  await ready();
  await query("INSERT INTO comments (idea_id, author_id, body, audio_url) VALUES ($1, $2, $3, $4)", [
    ideaId,
    authorId,
    body,
    audioUrl ?? null,
  ]);
  const rows = await query<{ author_id: number; title: string }>("SELECT author_id, title FROM ideas WHERE id = $1", [ideaId]);
  const idea = rows[0];
  if (idea && Number(idea.author_id) !== authorId) {
    after(() =>
      notifyUser(Number(idea.author_id), {
        title: "Nouvelle réaction",
        body: `Quelqu'un a réagi à « ${idea.title} ».`,
        url: `/ideas/${ideaId}`,
      }),
    );
  }
}

/** Ajoute ou retire le vote ; renvoie true si l'utilisateur a maintenant voté. */
export async function toggleVote(ideaId: number, userId: number): Promise<boolean> {
  await ready();
  const deleted = await query(
    "DELETE FROM votes WHERE idea_id = $1 AND user_id = $2 RETURNING idea_id",
    [ideaId, userId],
  );
  if (deleted.length > 0) return false;
  await query("INSERT INTO votes (idea_id, user_id) VALUES ($1, $2)", [ideaId, userId]);
  const rows = await query<{ author_id: number; title: string }>("SELECT author_id, title FROM ideas WHERE id = $1", [ideaId]);
  const idea = rows[0];
  if (idea && Number(idea.author_id) !== userId) {
    after(() =>
      notifyUser(Number(idea.author_id), {
        title: "Nouveau soutien",
        body: `Quelqu'un soutient « ${idea.title} ».`,
        url: `/ideas/${ideaId}`,
      }),
    );
  }
  return true;
}

/** Upload une note vocale (soumission, précision, commentaire) sur Vercel Blob. */
export async function uploadVoiceNote(buffer: Buffer, mimeType: string, folder = "voice"): Promise<string> {
  const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("wav") ? "wav" : "webm";
  const blob = await put(`${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, buffer, {
    access: "public",
    contentType: mimeType,
  });
  return blob.url;
}

export async function createIdea(opts: {
  title: string;
  pitch: string;
  categorySlug: string;
  authorId: number;
  audioUrl?: string | null;
  parentIdeaId?: number | null;
}): Promise<number> {
  await ready();
  const cat = await query<{ id: number; name: string }>(
    "SELECT id, name FROM categories WHERE slug = $1",
    [opts.categorySlug],
  );
  if (cat.length === 0) throw new Error("Catégorie invalide");
  const categoryId = Number(cat[0].id);
  const categoryName = String(cat[0].name);

  const inserted = await query<{ id: number }>(
    `INSERT INTO ideas (title, pitch, category_id, author_id, audio_url, parent_idea_id, ai_status, cover_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending') RETURNING id`,
    [opts.title, opts.pitch, categoryId, opts.authorId, opts.audioUrl ?? null, opts.parentIdeaId ?? null],
  );
  const id = Number(inserted[0].id);

  // Amélioration IA + illustration en arrière-plan, sans bloquer la réponse.
  // `after` garantit que la fonction serverless reste vivante jusqu'à la fin
  // du travail (un simple fire-and-forget serait gelé sur Vercel).
  after(() =>
    Promise.all([
      runAiImprovement(id, opts.title, opts.pitch, opts.authorId),
      runCoverGeneration(id, opts.title, opts.pitch, categoryName),
    ]),
  );

  return id;
}

/**
 * Reprendre une idée : crée une nouvelle idée indépendante sous un nouvel
 * auteur, à partir de SA propre vision (sa note vocale), pas d'une copie
 * silencieuse de l'originale — sans quoi la fiche n'apporterait rien de
 * neuf à analyser. Repart de zéro sur l'analyse IA et l'illustration,
 * comme un fork de dépôt, mais avec un texte qui vient vraiment de la
 * personne qui reprend la main.
 */
export async function forkIdea(originalId: number, forkerId: number, myPitch: string, audioUrl: string): Promise<number> {
  await ready();
  const rows = await query<{ title: string; category_slug: string; author_id: number }>(
    `SELECT i.title, c.slug AS category_slug, i.author_id
     FROM ideas i JOIN categories c ON c.id = i.category_id WHERE i.id = $1`,
    [originalId],
  );
  if (rows.length === 0) throw new Error("Idée introuvable");
  const { title, category_slug, author_id } = rows[0];
  const newId = await createIdea({
    title: String(title),
    pitch: myPitch,
    categorySlug: String(category_slug),
    authorId: forkerId,
    audioUrl,
    parentIdeaId: originalId,
  });
  if (Number(author_id) !== forkerId) {
    after(() =>
      notifyUser(Number(author_id), {
        title: "Quelqu'un a repris ton idée",
        body: `Quelqu'un a fait sa propre version de « ${title} ».`,
        url: `/ideas/${newId}`,
      }),
    );
  }
  return newId;
}

/**
 * Suppression définitive, réservée à l'auteur (vérifié ici en base, pas
 * seulement côté Server Action). Les forks ne sont pas supprimés — ils
 * deviennent des idées indépendantes (parent_idea_id repassé à NULL) —
 * seuls les commentaires et votes de CETTE idée disparaissent (cascade SQL).
 */
export async function deleteIdea(id: number, requesterId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await ready();
  const rows = await query<{ author_id: number; audio_url: string | null; cover_image: string | null; kit_flyer_image: string | null }>(
    "SELECT author_id, audio_url, cover_image, kit_flyer_image FROM ideas WHERE id = $1",
    [id],
  );
  if (rows.length === 0) return { ok: false, error: "Idée introuvable." };
  const idea = rows[0];
  if (Number(idea.author_id) !== requesterId) {
    return { ok: false, error: "Seul l'auteur de l'idée peut la supprimer." };
  }

  const commentAudio = await query<{ audio_url: string }>(
    "SELECT audio_url FROM comments WHERE idea_id = $1 AND audio_url IS NOT NULL",
    [id],
  );
  const blobUrls = [idea.audio_url, idea.cover_image, idea.kit_flyer_image, ...commentAudio.map((c) => c.audio_url)].filter(
    (u): u is string => Boolean(u),
  );

  await query("UPDATE ideas SET parent_idea_id = NULL WHERE parent_idea_id = $1", [id]);
  await query("DELETE FROM ideas WHERE id = $1", [id]);

  if (blobUrls.length > 0) {
    // Best effort : la suppression de la fiche ne doit pas échouer si le
    // nettoyage des fichiers Blob rencontre un souci.
    del(blobUrls).catch((err) => console.error("[deleteIdea] nettoyage Blob échoué", id, err));
  }

  return { ok: true };
}

async function runAiImprovement(id: number, title: string, pitch: string, authorId: number) {
  try {
    const improved = await improveIdea(title, pitch);
    await query(
      "UPDATE ideas SET ai_status = 'done', ai_json = $1, ai_score = $2, ai_error = NULL WHERE id = $3",
      [JSON.stringify(improved), improved.score, id],
    );
    if (improved.score >= KIT_SCORE_THRESHOLD) {
      after(() =>
        notifyUser(authorId, {
          title: "Seuil atteint 🎉",
          body: `« ${title} » a atteint ${improved.score}/100 — débloque le dossier de démarrage.`,
          url: `/ideas/${id}`,
        }),
      );
    }
  } catch (err) {
    console.error("[gemini:analysis]", "idea", id, err);
    await query("UPDATE ideas SET ai_status = 'failed', ai_error = $1 WHERE id = $2", [
      err instanceof Error ? err.message : String(err),
      id,
    ]);
  }
}

async function runCoverGeneration(id: number, title: string, pitch: string, categoryName: string) {
  try {
    const image = await generateCoverImage(title, pitch, categoryName);
    const ext = image.mimeType === "image/png" ? "png" : "jpg";
    const blob = await put(`covers/${id}-${Date.now()}.${ext}`, Buffer.from(image.base64, "base64"), {
      access: "public",
      contentType: image.mimeType,
    });
    await query(
      "UPDATE ideas SET cover_status = 'done', cover_image = $1, cover_error = NULL WHERE id = $2",
      [blob.url, id],
    );
  } catch (err) {
    console.error("[gemini:cover]", "idea", id, err);
    await query("UPDATE ideas SET cover_status = 'failed', cover_error = $1 WHERE id = $2", [
      err instanceof Error ? err.message : String(err),
      id,
    ]);
  }
}

/**
 * Repasse l'analyse en "pending" et relance le travail après la réponse :
 * le bouton rend la main immédiatement, la page se rafraîchit toute seule.
 */
export async function retryAiImprovement(id: number): Promise<void> {
  await ready();
  const rows = await query<{ title: string; pitch: string; author_id: number }>(
    "SELECT title, pitch, author_id FROM ideas WHERE id = $1",
    [id],
  );
  if (rows.length === 0) return;
  const { title, pitch, author_id } = rows[0];
  await query("UPDATE ideas SET ai_status = 'pending' WHERE id = $1", [id]);
  after(() => runAiImprovement(id, String(title), String(pitch), Number(author_id)));
}

export async function retryCoverGeneration(id: number): Promise<void> {
  await ready();
  const rows = await query<{ title: string; pitch: string; category_name: string }>(
    `SELECT i.title, i.pitch, c.name AS category_name
     FROM ideas i JOIN categories c ON c.id = i.category_id WHERE i.id = $1`,
    [id],
  );
  if (rows.length === 0) return;
  const { title, pitch, category_name } = rows[0];
  await query("UPDATE ideas SET cover_status = 'pending' WHERE id = $1", [id]);
  after(() => runCoverGeneration(id, String(title), String(pitch), String(category_name)));
}

/**
 * Fusionne une note vocale de précision dans l'idée existante et relance
 * l'analyse. Réservé à l'auteur (vérifié en amont, côté Server Action).
 */
export async function refineIdeaWithVoice(id: number, transcript: string, audioUrl: string): Promise<void> {
  await ready();
  const rows = await query<{ title: string; pitch: string; author_id: number }>(
    "SELECT title, pitch, author_id FROM ideas WHERE id = $1",
    [id],
  );
  if (rows.length === 0) throw new Error("Idée introuvable");
  const { title, pitch, author_id } = rows[0];

  const mergedPitch = await refineIdeaPitch(String(pitch), transcript);
  await query("UPDATE ideas SET pitch = $1, audio_url = $2, ai_status = 'pending' WHERE id = $3", [
    mergedPitch,
    audioUrl,
    id,
  ]);
  after(() => runAiImprovement(id, String(title), mergedPitch, Number(author_id)));
}

/** Marque un jalon réel franchi, sans écraser un échec/relance concurrent. */
async function bumpKitStep(id: number) {
  await query("UPDATE ideas SET kit_step = kit_step + 1 WHERE id = $1 AND kit_status = 'pending'", [id]);
}

async function runStarterKit(
  id: number,
  title: string,
  pitch: string,
  categoryName: string,
  analysis: IdeaImprovement,
  authorId: number,
) {
  try {
    // Les deux appels tournent en parallèle (pas de perte de temps), mais
    // chacun signale son propre jalon dès qu'il termine : deux avancées
    // réelles pour ancrer la progression affichée, dans l'ordre où elles
    // arrivent.
    const [kit, flyer] = await Promise.all([
      generateStarterKit(title, pitch, analysis).then(async (r) => {
        await bumpKitStep(id);
        return r;
      }),
      generateFlyerImage(title, pitch, categoryName).then(async (r) => {
        await bumpKitStep(id);
        return r;
      }),
    ]);
    const ext = flyer.mimeType === "image/png" ? "png" : "jpg";
    const blob = await put(`flyers/${id}-${Date.now()}.${ext}`, Buffer.from(flyer.base64, "base64"), {
      access: "public",
      contentType: flyer.mimeType,
    });
    await query(
      "UPDATE ideas SET kit_status = 'done', kit_json = $1, kit_flyer_image = $2, kit_error = NULL WHERE id = $3",
      [JSON.stringify(kit), blob.url, id],
    );
    after(() =>
      notifyUser(authorId, {
        title: "Dossier prêt 🚀",
        body: `Le dossier de démarrage de « ${title} » est généré.`,
        url: `/ideas/${id}/site`,
      }),
    );
  } catch (err) {
    console.error("[gemini:kit]", "idea", id, err);
    await query("UPDATE ideas SET kit_status = 'failed', kit_error = $1 WHERE id = $2", [
      err instanceof Error ? err.message : String(err),
      id,
    ]);
    after(() =>
      notifyUser(authorId, {
        title: "Génération échouée",
        body: `La génération du dossier de « ${title} » n'a pas abouti — tu peux réessayer.`,
        url: `/ideas/${id}`,
      }),
    );
  }
}

/**
 * Déclenche la génération du starter kit (landing page, design système,
 * flyer, périmètre MVP). Réservé à l'auteur, et seulement si le score IA a
 * atteint le seuil de validation — vérifié ici en base, pas seulement côté
 * client, pour ne pas dépendre d'un état affiché qui pourrait être périmé.
 */
export async function validateAndGenerateKit(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  await ready();
  const rows = await query<{ title: string; pitch: string; ai_score: number | null; category_name: string; author_id: number }>(
    `SELECT i.title, i.pitch, i.ai_score, c.name AS category_name, i.author_id
     FROM ideas i JOIN categories c ON c.id = i.category_id WHERE i.id = $1`,
    [id],
  );
  if (rows.length === 0) return { ok: false, error: "Idée introuvable" };
  const { title, pitch, ai_score, category_name, author_id } = rows[0];
  if (ai_score === null || ai_score < KIT_SCORE_THRESHOLD) {
    return { ok: false, error: `Le score doit atteindre ${KIT_SCORE_THRESHOLD}/100 avant de générer le dossier.` };
  }

  const analysisRows = await query<{ ai_json: string | null }>("SELECT ai_json FROM ideas WHERE id = $1", [id]);
  const analysis = parseAi(analysisRows[0]?.ai_json);
  if (!analysis) return { ok: false, error: "Analyse IA manquante." };

  await query("UPDATE ideas SET kit_status = 'pending', kit_step = 0, kit_error = NULL WHERE id = $1", [id]);
  after(() => runStarterKit(id, String(title), String(pitch), String(category_name), analysis, Number(author_id)));
  return { ok: true };
}

export async function retryStarterKit(id: number): Promise<void> {
  await ready();
  const rows = await query<{ title: string; pitch: string; ai_json: string | null; category_name: string; author_id: number }>(
    `SELECT i.title, i.pitch, i.ai_json, c.name AS category_name, i.author_id
     FROM ideas i JOIN categories c ON c.id = i.category_id WHERE i.id = $1`,
    [id],
  );
  if (rows.length === 0) return;
  const { title, pitch, ai_json, category_name, author_id } = rows[0];
  const analysis = parseAi(ai_json);
  if (!analysis) return;
  await query("UPDATE ideas SET kit_status = 'pending', kit_step = 0 WHERE id = $1", [id]);
  after(() => runStarterKit(id, String(title), String(pitch), String(category_name), analysis, Number(author_id)));
}
