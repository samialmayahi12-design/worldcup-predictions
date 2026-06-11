import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { isSuper } from "@/lib/perm";

export async function POST(req) {
  const user = userFromRequest(req);
  if (!isSuper(user)) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });

  const { emp, grant } = await req.json().catch(() => ({}));
  if (!emp) return NextResponse.json({ error: "الرقم الوظيفي مطلوب" }, { status: 400 });

  if (grant) {
    await db.from("entrants").upsert({ emp }, { onConflict: "emp" });
  } else {
    await db.from("entrants").delete().eq("emp", emp);
  }
  return NextResponse.json({ ok: true, emp, grant: !!grant });
}
