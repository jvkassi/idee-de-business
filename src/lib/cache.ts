import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Cache de données partagé (Vercel Data Cache via `unstable_cache`).
 *
 * Pourquoi pas `"use cache"` : toutes nos pages lisent le cookie de session,
 * donc tout est rendu à la requête. Dans ce cas, `"use cache"` ne garde ses
 * entrées qu'en mémoire de l'instance serverless (taux de hit ~0), et
 * `"use cache: remote"` impose de migrer toute l'app vers Cache Components.
 * `unstable_cache` est, sur Vercel, stocké dans le Data Cache régional :
 * partagé entre instances, invalidable par tag, et il survit aux déploiements.
 * Toute la logique de cache passe par ce fichier : migrer vers
 * `"use cache: remote"` plus tard ne touchera que lui.
 *
 * Règle : on ne met en cache QUE des données identiques pour tous les
 * visiteurs. Le "a voté ?" propre à chacun est lu à part (voir votedIdeaIds).
 */

/** Monter ce numéro quand la forme d'un objet mis en cache change (le cache survit aux déploiements). */
const CACHE_VERSION = "v1";

export const TAGS = {
  /** Listes d'idées, idées mises en avant, compteurs du site. */
  ideas: "ideas",
  idea: (id: number) => `idea:${id}`,
  categories: "categories",
  votesOf: (userId: number) => `votes:user:${userId}`,
  jobs: "jobs",
} as const;

/** Durées de fraîcheur (secondes) : filet de sécurité si une invalidation est manquée. */
export const TTL = {
  short: 60,
  medium: 300,
  long: 86_400,
} as const;

// Tests et scripts lancés hors de Next : pas de Data Cache, on appelle la fonction.
const outsideNext = process.env.VITEST === "true" || !process.env.NEXT_RUNTIME;

export function cached<Args extends unknown[], R>(
  key: string,
  fn: (...args: Args) => Promise<R>,
  opts: { tags: string[] | ((...args: Args) => string[]); revalidate: number },
): (...args: Args) => Promise<R> {
  if (outsideNext) return fn;
  return (...args: Args) => {
    const tags = typeof opts.tags === "function" ? opts.tags(...args) : opts.tags;
    return unstable_cache(fn, [CACHE_VERSION, key], { tags, revalidate: opts.revalidate })(...args);
  };
}

/**
 * Invalide immédiatement les entrées portant ces tags. Appelable depuis une
 * Server Action, un Route Handler ou un callback `after()`. Ne lève jamais :
 * hors contexte Next (script, test) il n'y a simplement rien à invalider.
 */
export function invalidate(...tags: string[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (err) {
      if (!outsideNext) console.warn("[cache] invalidation impossible", tag, err);
    }
  }
}
