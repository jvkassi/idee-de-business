"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Analyse du concept et du marché ivoirien",
  "Étude de la concurrence locale",
  "Définition du modèle économique",
  "Conception de l'architecture système",
  "Choix de la stack technique",
  "Cadrage du périmètre MVP",
  "Rédaction de la page de vente",
  "Création du flyer promotionnel",
  "Vérification de cohérence du dossier",
  "Finalisation",
];

// Deux jalons réels arrivent pendant la génération (texte du dossier, puis
// visuel du flyer — dans un ordre qui peut varier). Entre ces jalons, on
// avance une étape affichée toutes les ~4 s pour que l'attente (jusqu'à 3
// min) ne ressemble pas à un simple sablier figé — plafonnée pour ne
// jamais dépasser ce que le jalon réel courant autorise.
const CEILING_BY_REAL_STEP = [6, 9, STEPS.length];
const TICK_MS = 4000;

/** Progression affichée pendant kit_status='pending' : ancrée par les jalons réels, comblée par un défilement cosmétique. */
export default function KitProgress({ realStep }: { realStep: number }) {
  const ceiling = CEILING_BY_REAL_STEP[Math.min(realStep, CEILING_BY_REAL_STEP.length - 1)];
  const [tick, setTick] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => Math.min(t + 1, STEPS.length));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const current = Math.min(tick, ceiling);
  const pct = Math.round(((current - 1) / STEPS.length) * 100);

  return (
    <section className="card space-y-4 border-ink p-5 sm:p-6" aria-live="polite" aria-label="Génération du dossier de démarrage en cours">
      <div>
        <p className="label">Dossier de démarrage</p>
        <div className="mt-1 flex items-center gap-3">
          <svg className="h-5 w-5 shrink-0 animate-spin text-ink-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M10 3a7 7 0 1 1-7 7" strokeLinecap="round" />
          </svg>
          <h3 className="font-display text-xl font-bold leading-snug">Ton dossier se prépare</h3>
        </div>
        <p className="mt-1.5 text-sm text-ink-2">
          Jusqu&apos;à 3 minutes. Tu peux fermer cette page : le dossier restera ici, et la page se met à jour toute
          seule si tu attends.
        </p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-sun transition-[width] duration-700" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>

      <ul className="space-y-1.5">
        {STEPS.map((label, i) => {
          const stepNo = i + 1;
          const done = stepNo < current;
          const active = stepNo === current;
          return (
            <li
              key={label}
              className={`flex items-center gap-2.5 text-sm ${
                done ? "text-ink-2" : active ? "font-medium text-ink" : "text-ink-3"
              }`}
            >
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] ${
                  done ? "bg-ink text-surface" : active ? "bg-sun" : "border border-line-2"
                }`}
                aria-hidden
              >
                {done ? "✓" : ""}
              </span>
              {label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
