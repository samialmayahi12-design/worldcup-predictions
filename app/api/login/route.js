import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPin, signToken } from "@/lib/auth";

export async function POST(req) {
  const { emp, pin } = await req.json().catch(() => ({}));
  const e = (emp || "").trim();
  if (!e) return NextResponse.json({ error: "أدخل الرقم الوظيفي" }, { status: 400 });

  const { data: u } = await db.from("users").select("*").eq("emp", e).maybeSingle();
  if (!u) return NextResponse.json({ error: "لا يوجد حساب بهذا الرقم الوظيفي" }, { status: 404 });
  if (u.pin_hash !== hashPin(pin)) return NextResponse.json({ error: "الرمز السري غير صحيح" }, { status: 401 });

  const token = signToken({ emp: u.emp, name: u.name });
  return NextResponse.json({ token, user: { emp: u.emp, name: u.name } });
}
