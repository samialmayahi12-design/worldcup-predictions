export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { judge } from "@/lib/points";

export async function GET() {
  const [users, preds, results] = await Promise.all([
    db.from("users").select("emp, name"),
    db.from("predictions").select("user_emp, match_id, eh, ea"),
    db.from("results").select("match_id, h, a"),
  ]);

  const resultsMap = {};
  (results.data || []).forEach((r) => { resultsMap[r.match_id] = r; });

  const acc = {};
  (users.data || []).forEach((u) => { acc[u.emp] = { emp: u.emp, name: u.name, pts: 0, preds: 0, exact: 0, hit: 0, done: 0 }; });

  (preds.data || []).forEach((p) => {
    const a = acc[p.user_emp];
    if (!a) return;
    a.preds++;
    const r = resultsMap[p.match_id];
    if (r) {
      a.done++;
      const j = judge({ eh: p.eh, ea: p.ea }, r, p.match_id);
      a.pts += j.points;
      if (j.exact) a.exact++;
      else if (j.hit) a.hit++;
    }
  });

  const board = Object.values(acc).sort((x, y) => y.pts - x.pts || y.exact - x.exact);
  return NextResponse.json({ board });
}
