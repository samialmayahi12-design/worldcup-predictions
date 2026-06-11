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

  const { data: existing } = await db.from("users").select("name").eq("name", n).maybeSingle();
  if (existing) return NextResponse.json({ error: "الاسم مستخدم — سجّل دخولك بدلًا من ذلك" }, { status: 409 });

  const { error } = await db.from("users").insert({ name: n, emp: e, pin_hash: hashPin(pin) });
  if (error) return NextResponse.json({ error: "تعذّر إنشاء الحساب" }, { status: 500 });

  const token = signToken({ name: n, emp: e });
  return NextResponse.json({ token, user: { name: n, emp: e } });
}
