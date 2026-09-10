import { NextResponse } from "next/server";
import { syncJobOffers } from "@/lib/jobOffers";

// Laisse le temps à Gemini d'analyser les messages (Vercel : 60 s max).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  // Cron Vercel (Authorization: Bearer <CRON_SECRET>) ou appel manuel.
  // Si CRON_SECRET n'est pas défini, on laisse passer (MVP) — à verrouiller
  // en prod en définissant la variable.
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 20)));
    const result = await syncJobOffers(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Pratique pour tester depuis un navigateur : /api/jobs/sync?secret=...
export async function GET(req: Request) {
  return POST(req);
}
