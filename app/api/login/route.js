import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPin, signToken } from "@/lib/auth";

export async function POST(req) {
  const { name, emp, pin } = await req.json().catch(() => ({}));
  const n = (name || "").trim();
  const e = (emp || "").trim();

  const { data: u } = await db.from("users").select("*").eq("name", n).maybeSingle();
  if (!u) return NextResponse.json({ error: "لا يوجد حساب بهذا الاسم" }, { status: 404 });
  if (u.pin_hash !== hashPin(pin)) return NextResponse.json({ error: "الرمز السري غير صحيح" }, { status: 401 });
  if (u.emp && e && u.emp !== e) return NextResponse.json({ error: "الرقم الوظيفي لا يطابق المسجّل" }, { status: 401 });

  const token = signToken({ name: u.name, emp: u.emp });
  return NextResponse.json({ token, user: { name: u.name, emp: u.emp } });
}
