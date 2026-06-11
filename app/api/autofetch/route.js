import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { isEntrant } from "@/lib/perm";
import { matchById } from "@/lib/matches";

// جلب النتائج الرسمية آليًا (اختياري — يتطلب ANTHROPIC_API_KEY في متغيرات البيئة)
export async function POST(req) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  if (!(await isEntrant(user)))
    return NextResponse.json({ error: "لا تملك صلاحية إدخال النتائج" }, { status: 403 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return NextResponse.json({ error: "الجلب الآلي غير مفعّل — أضف ANTHROPIC_API_KEY", disabled: true }, { status: 503 });

  const { matchIds } = await req.json().catch(() => ({}));
  const fixtures = (matchIds || []).map(matchById).filter(Boolean)
    .map((m) => ({ id: m.i, home: m.h, away: m.a, date: m.t }));
  if (!fixtures.length) return NextResponse.json({ results: {} });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content:
            "ابحث عن النتائج النهائية الرسمية لمباريات كأس العالم 2026 التالية (اعتمد fifa.com والمصادر الموثوقة). " +
            "أعد فقط المباريات المنتهية بنتيجة مؤكدة.\nالمباريات: " + JSON.stringify(fixtures) +
            '\nأجب بـ JSON فقط بلا أي نص آخر: {"results":{"<id>":{"h":<n>,"a":<n>}}}',
        }],
      }),
    });
    const data = await r.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean.slice(clean.indexOf("{")));
    const found = parsed.results || {};
    const valid = {};
    for (const [id, v] of Object.entries(found)) {
      if (fixtures.some((f) => String(f.id) === String(id)) &&
          Number.isInteger(Number(v.h)) && Number.isInteger(Number(v.a)) &&
          Number(v.h) >= 0 && Number(v.a) >= 0) {
        valid[id] = { h: Number(v.h), a: Number(v.a) };
      }
    }
    return NextResponse.json({ results: valid });
  } catch {
    return NextResponse.json({ error: "تعذّر الجلب الآلي" }, { status: 502 });
  }
}
