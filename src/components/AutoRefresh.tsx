"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-rend les composants serveur de la page à intervalle régulier tant qu'il
 * est monté (la page ne le monte que lorsqu'un traitement IA est en cours).
 * `router.refresh()` conserve l'état client et le scroll : on ne "recharge"
 * pas la page, on met à jour le contenu.
 */
export default function AutoRefresh({
  intervalMs = 3000,
  maxMs = 4 * 60_000,
}: {
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > maxMs) {
        clearInterval(timer);
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs, maxMs]);
  return null;
}
