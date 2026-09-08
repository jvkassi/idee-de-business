"use client";

import { useState } from "react";

/** Copie l'URL de la page (ou ouvre le partage natif sur mobile). */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // partage annulé ou presse-papiers indisponible : on ignore
    }
  }

  return (
    <button type="button" onClick={share} className="btn btn-outline px-3 py-2 text-xs">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M8.5 11.5l3-3M7 13a3 3 0 0 1 0-4.2l1.5-1.5a3 3 0 0 1 4.2 0M13 7a3 3 0 0 1 0 4.2l-1.5 1.5a3 3 0 0 1-4.2 0" strokeLinecap="round" />
      </svg>
      {copied ? "Lien copié !" : "Partager"}
    </button>
  );
}
