export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { isSuper } from "@/lib/perm";

export async function GET(req) {
  const user = userFromRequest(req);
  if (!isSuper(user)) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });

  const [users, entrants] = await Promise.all([
    db.from("users").select("name, emp, created_at").order("created_at", { ascending: true }),
    db.from("entrants").select("name"),
  ]);
  const entrantSet = new Set((entrants.data || []).map((e) => e.name));
  const list = (users.data || []).map((u) => ({ name: u.name, emp: u.emp, isEntrant: entrantSet.has(u.name) }));
  return NextResponse.json({ users: list });
}
