import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPin, signToken } from "@/lib/auth";

export async function POST(req) {
  const { name, emp, pin } = await req.json().catch(() => ({}));
  const n = (name || "").trim();
  const e = (emp || "").trim();
  if (n.length < 2) return NextResponse.json({ error: "اكتب اسمًا من حرفين على الأقل" }, { status: 400 });
  if (!e) return NextResponse.json({ error: "أدخل الرقم الوظيفي" }, { status: 400 });
  if ((pin || "").length < 4) return NextResponse.json({ error: "الرمز السري: 4 أرقام على الأقل" }, { status: 400 });

  // Employee number is the primary key — no duplicates allowed
  const { data: existing } = await db.from("users").select("emp").eq("emp", e).maybeSingle();
  if (existing) return NextResponse.json({ error: "هذا الرقم الوظيفي مسجّل من قبل — سجّل دخولك" }, { status: 409 });

  const { error } = await db.from("users").insert({ emp: e, name: n, pin_hash: hashPin(pin) });
  if (error) return NextResponse.json({ error: "تعذّر إنشاء الحساب" }, { status: 500 });

  const token = signToken({ emp: e, name: n });
  return NextResponse.json({ token, user: { emp: e, name: n } });
}
