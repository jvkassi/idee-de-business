import { NextResponse } from "next/server";
import { backfillHistory } from "@/lib/waArchive";

// Archive seule (pas d'analyse IA) : même posture MVP que /api/jobs/sync,
// sans auth. Idempotent : rejouer ne duplique rien (ON CONFLICT DO NOTHING).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    // ?reprocess=1 rejoue l'archive dans le pipeline complet (IA + médias),
    // par lots chronologiques : ?reprocess=1&limit=8&offset=0 jusqu'à done:true.
    if (url.searchParams.get("reprocess") === "1") {
      const limit = Math.max(1, Math.min(25, Number(url.searchParams.get("limit") || 8)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
      const { reprocessArchive } = await import("@/lib/jobOffers");
      const result = await reprocessArchive(limit, offset);
      return NextResponse.json({ ok: true, mode: "reprocess", ...result });
    }
    const result = await backfillHistory();
    return NextResponse.json({ ok: true, mode: "archive", ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
