"use client";

import { useEffect, useState } from "react";
import { subscribePushAction, unsubscribePushAction } from "@/app/actions";

function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer;
}

type Status = "unsupported" | "loading" | "off" | "on" | "denied";

/**
 * Abonnement compte-large (pas par idée) : une fois activées, les notifs
 * couvrent toute l'activité de l'utilisateur (réactions, seuil IA, dossier
 * prêt, forks) — cohérent avec notifyUser() côté serveur, ciblé par userId.
 */
export default function PushBell() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      await Promise.resolve();
      if (cancelled) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await subscribePushAction(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setStatus("on");
    } catch {
      setStatus("off");
    }
  }

  async function disable() {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setStatus("on");
    }
  }

  if (status === "unsupported") return null;

  const denied = status === "denied";
  const on = status === "on";

  return (
    <button
      type="button"
      disabled={status === "loading" || denied}
      onClick={on ? disable : enable}
      title={
        denied
          ? "Notifications bloquées par le navigateur"
          : on
            ? "Désactiver les notifications"
            : "Activer les notifications (réactions, votes, seuil atteint, dossier prêt)"
      }
      aria-label={on ? "Désactiver les notifications" : "Activer les notifications"}
      className={`icon-btn ${
        on ? "bg-sun-soft text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink"
      } ${denied ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path
          d="M10 3.5a4 4 0 0 0-4 4v2.3c0 .6-.2 1.2-.6 1.7L4 13.5h12l-1.4-2c-.4-.5-.6-1.1-.6-1.7V7.5a4 4 0 0 0-4-4Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8.3 16a1.8 1.8 0 0 0 3.4 0" strokeLinecap="round" />
      </svg>
    </button>
  );
}
