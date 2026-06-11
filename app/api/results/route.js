export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { isEntrant } from "@/lib/perm";
import { matchById } from "@/lib/matches";

export async function GET() {
  const { data } = await db.from("results").select("match_id, h, a, entered_by");
  const map = {};
  (data || []).forEach((r) => { map[r.match_id] = r; });
  return NextResponse.json({ results: map });
}

export async function POST(req) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!(await isEntrant(user)))
    return NextResponse.json({ error: "لا تملك صلاحية إدخال النتائج" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // يقبل نتيجة واحدة {matchId,h,a} أو دفعة {batch:[{matchId,h,a}]}
  const items = body.batch || [{ matchId: body.matchId, h: body.h, a: body.a }];
  const rows = [];
  for (const it of items) {
    const m = matchById(it.matchId);
    if (!m) continue;
    const h = parseInt(it.h, 10), a = parseInt(it.a, 10);
    if (!Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) continue;
    rows.push({ match_id: m.i, h, a, entered_by: user.name, entered_at: new Date().toISOString() });
  }
  if (!rows.length) return NextResponse.json({ error: "لا نتائج صالحة" }, { status: 400 });

  const { error } = await db.from("results").upsert(rows, { onConflict: "match_id" });
  if (error) return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });
  return NextResponse.json({ ok: true, count: rows.length });
}
