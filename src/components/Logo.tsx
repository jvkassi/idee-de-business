/** Marque : une ampoule-étincelle dans une tuile dégradée orange → violet. */
export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--ai)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-g)" />
      <path
        d="M16 7.5c-3.6 0-6.2 2.7-6.2 6 0 2.1 1 3.6 2.2 4.8.7.7 1.1 1.4 1.2 2.2h5.6c.1-.8.5-1.5 1.2-2.2 1.2-1.2 2.2-2.7 2.2-4.8 0-3.3-2.6-6-6.2-6Z"
        fill="#fff"
        opacity="0.95"
      />
      <path d="M13.4 23h5.2M14.2 25.3h3.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M24.5 5.5v3M23 7h3" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
