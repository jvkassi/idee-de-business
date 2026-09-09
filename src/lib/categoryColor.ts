import type { CSSProperties } from "react";

/**
 * Une teinte vive par catégorie. C'est la seule couleur "libre" de
 * l'interface : elle identifie l'idée (pastille, passe-partout de
 * l'illustration) sans jamais servir de fond à un bloc entier.
 * Le jaune est réservé à l'action humaine, il n'apparaît donc pas ici.
 */
const COLORS: Record<string, string> = {
  tech: "#2f5cff",
  agro: "#1f9d4d",
  commerce: "#d1258b",
  fintech: "#4f46e5",
  education: "#7e22ce",
  sante: "#0d9488",
  transport: "#ea6a12",
  immobilier: "#a16207",
  energie: "#65a30d",
  services: "#0e7490",
  media: "#dc2626",
  mode: "#ff4d6d",
  tourisme: "#0284c7",
  autre: "#6b7280",
};

export function categoryColor(slug: string): string {
  return COLORS[slug] ?? COLORS.autre;
}

/** À poser en `style` sur l'élément : ses enfants lisent `--cat`. */
export function categoryStyle(slug: string): CSSProperties {
  return { "--cat": categoryColor(slug) } as CSSProperties;
}
