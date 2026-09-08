/**
 * Illustrations générées par Gemini, stockées en data URL : next/image n'a
 * rien à optimiser ici, on garde un <img> natif.
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
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Illustration : ${title}`} className={className} loading="lazy" decoding="async" />;
}
