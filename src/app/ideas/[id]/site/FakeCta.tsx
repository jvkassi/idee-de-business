"use client";

import { useState } from "react";

/**
 * CTA de démo : ne persiste rien nulle part, juste un état local pour
 * montrer à quoi ressemblerait la landing page finie. La page entière est
 * un dossier de démarrage généré par l'IA, pas un vrai produit.
 */
export default function FakeCta({ label }: { label: string }) {
  const [sent, setSent] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <input
        type="email"
        required
        placeholder="ton@email.com"
        disabled={sent}
        className="input flex-1"
        aria-label="Adresse email (démo)"
      />
      <button type="submit" disabled={sent} className="btn btn-sun shrink-0 px-6 py-3 text-base">
        {sent ? "Merci ! (démo)" : label}
      </button>
    </form>
  );
}
