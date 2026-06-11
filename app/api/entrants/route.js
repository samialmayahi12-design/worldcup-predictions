import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { isSuper } from "@/lib/perm";

export async function POST(req) {
  const user = userFromRequest(req);
  if (!isSuper(user)) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });

  const { name, grant } = await req.json().catch(() => ({}));
  if (!name) return NextResponse.json({ error: "اسم مطلوب" }, { status: 400 });

  if (grant) {
    await db.from("entrants").upsert({ name }, { onConflict: "name" });
  } else {
    await db.from("entrants").delete().eq("name", name);
  }
  return NextResponse.json({ ok: true, name, grant: !!grant });
}
