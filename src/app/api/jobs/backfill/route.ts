import { NextResponse } from "next/server";
import { backfillHistory } from "@/lib/waArchive";

// Archive seule (pas d'analyse IA) : même posture MVP que /api/jobs/sync,
// sans auth. Idempotent : rejouer ne duplique rien (ON CONFLICT DO NOTHING).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await backfillHistory();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
