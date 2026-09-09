/**
 * Marque : un point (l'idée brute) qui devient une fiche (l'idée structurée),
 * encre sur soleil. C'est le mécanisme du produit, pas une ampoule.
 */
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--sun)" />
      <circle cx="11.5" cy="11.5" r="5.5" fill="var(--ink)" />
      <rect x="14.5" y="14" width="11" height="12.5" rx="2.5" fill="var(--ink)" />
      <path d="M17.5 18.5h5M17.5 21.5h3.5" stroke="var(--sun)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
