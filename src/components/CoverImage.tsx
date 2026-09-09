"use client";

import { useState } from "react";

/**
 * Illustration générée par Gemini (URL Vercel Blob). Rien à optimiser côté
 * next/image ; en revanche l'image peut être lente, absente ou en erreur :
 * si elle ne charge pas, on la retire pour laisser voir le passe-partout et
 * l'emoji de catégorie placés derrière par le parent.
 */
export default function CoverImage({
  src,
  title,
  className = "",
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Illustration : ${title}`}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
