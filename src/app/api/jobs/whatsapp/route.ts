import { NextResponse } from "next/server";
import { ingestWahaWebhookMessage, syncJobOffersAfter } from "@/lib/jobOffers";

export const dynamic = "force-dynamic";

/**
 * Webhook WAHA → POST ici.
 * Dans le dashboard WAHA de la session Etd0MVpT9b, ajouter ce webhook :
 *   https://<ton-domaine-vercel>/api/jobs/whatsapp
 * avec l'event "message.any".
 *
 * Le payload WAHA varie selon l'engine ; on accepte plusieurs formes :
 * - { payload: { id, body, timestamp, from, participant, fromMe, ... }, ... }
 * - { event, session, payload: {...} }
 * - message brut { id, body, ... }
 * Si le message n'a pas de chatId exploitable, on retombe sur une petite
 * synchro des derniers messages (best-effort, non bloquant).
 */
type Loose = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function extractMessage(body: Loose): {
  chatId?: string;
  messageId?: string;
  text?: string;
  timestamp?: number;
  participant?: string;
  from?: string;
  fromMe?: boolean;
} {
  const payload = (body.payload as Loose | undefined) ?? body;
  const data = (payload._data as Loose | undefined) ?? {};

  // chatId : to (groupe) ou remote
  const chatId =
    str(payload.to) ||
    str((data.to as Loose | undefined)?.["_serialized"]) ||
    str((payload.id as Loose | undefined)?.remote) ||
    str((data.id as Loose | undefined)?.remote) ||
    str(payload.chatId) ||
    str(body.chatId);

  const messageId =
    str(payload.id) ||
    str((payload.id as Loose | undefined)?.["_serialized"]) ||
    str(payload.messageId) ||
    str(body.messageId);

  const text = str(payload.body) || str(payload.text) || str(data.body);
  const timestamp = num(payload.timestamp) ?? num(data.t) ?? num(body.timestamp);
  const participant =
    str(payload.participant) ||
    str((data.id as Loose | undefined)?.participant) ||
    str(payload.author);
  const from = str(payload.from) || str((data.from as Loose | undefined)?.["_serialized"]);
  const fromMe = (payload.fromMe as boolean | undefined) ?? (data.fromMe as boolean | undefined);

  return { chatId, messageId, text, timestamp, participant, from, fromMe };
}

export async function POST(req: Request) {
  let body: Loose;
  try {
    body = (await req.json()) as Loose;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalide" }, { status: 400 });
  }

  const msg = extractMessage(body);

  // Ignore les messages envoyés par le bot lui-même.
  if (msg.fromMe) return NextResponse.json({ ok: true, handled: false, reason: "fromMe" });

  if (msg.chatId && msg.messageId && msg.text) {
    const res = await ingestWahaWebhookMessage({
      chatId: msg.chatId,
      messageId: msg.messageId,
      body: msg.text,
      timestamp: msg.timestamp,
      participant: msg.participant,
      from: msg.from,
    });
    return NextResponse.json({ ok: true, ...res });
  }

  // Payload inattendu : petite synchro best-effort en arrière-plan.
  syncJobOffersAfter(10);
  return NextResponse.json({ ok: true, handled: false, reason: "payload inattendu, synchro planifiée" });
}
