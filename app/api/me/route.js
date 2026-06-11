export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { isEntrant, isSuper } from "@/lib/perm";

export async function GET(req) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const [preds, results, entrant] = await Promise.all([
    db.from("predictions").select("match_id, eh, ea").eq("user_emp", user.emp),
    db.from("results").select("match_id, h, a, entered_by"),
    isEntrant(user),
  ]);

  const resultsMap = {};
  (results.data || []).forEach((r) => { resultsMap[r.match_id] = r; });

  return NextResponse.json({
    user,
    isEntrant: entrant,
    isSuper: isSuper(user),
    predictions: preds.data || [],
    results: resultsMap,
  });
}
