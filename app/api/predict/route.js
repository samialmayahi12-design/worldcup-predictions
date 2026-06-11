import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { matchById } from "@/lib/matches";

export async function POST(req) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { matchId, eh, ea } = await req.json().catch(() => ({}));
  const m = matchById(matchId);
  if (!m) return NextResponse.json({ error: "مباراة غير موجودة" }, { status: 400 });

  // Server-side kickoff lock — cannot be bypassed from the browser
  if (new Date(m.t).getTime() <= Date.now())
    return NextResponse.json({ error: "أُغلق باب التوقع — انطلقت المباراة" }, { status: 403 });

  const H = Math.max(0, Math.min(20, parseInt(eh, 10) || 0));
  const A = Math.max(0, Math.min(20, parseInt(ea, 10) || 0));

  const { error } = await db.from("predictions").upsert(
    { user_emp: user.emp, match_id: m.i, eh: H, ea: A, updated_at: new Date().toISOString() },
    { onConflict: "user_emp,match_id" }
  );
  if (error) return NextResponse.json({ error: "تعذّر الحفظ" }, { status: 500 });

  return NextResponse.json({ ok: true, prediction: { match_id: m.i, eh: H, ea: A } });
}
