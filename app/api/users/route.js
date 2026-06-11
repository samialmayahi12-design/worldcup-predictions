export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth";
import { isSuper } from "@/lib/perm";

export async function GET(req) {
  const user = userFromRequest(req);
  if (!isSuper(user)) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });

  const [users, entrants] = await Promise.all([
    db.from("users").select("emp, name, created_at").order("created_at", { ascending: true }),
    db.from("entrants").select("emp"),
  ]);
  const entrantSet = new Set((entrants.data || []).map((e) => e.emp));
  const list = (users.data || []).map((u) => ({ emp: u.emp, name: u.name, isEntrant: entrantSet.has(u.emp) }));
  return NextResponse.json({ users: list });
}
