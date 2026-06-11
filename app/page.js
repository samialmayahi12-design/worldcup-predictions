"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./globals.css";
import { MATCHES, STAGE, STAGE_BONUS } from "@/lib/matches";
import { judge, PTS_EXACT, PTS_OUTCOME, SUPER_ADMIN_EMP } from "@/lib/points";

/* ─── أدوات ─── */
const fmtDay = (d) => d.toLocaleDateString("ar", { weekday: "long", day: "numeric", month: "long" });
const fmtTime = (d) => d.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
const TOKEN_KEY = "wc26-token";

function flagCode(emoji) {
  if (!emoji) return null;
  const cps = [...emoji].map((c) => c.codePointAt(0));
  const letters = cps.filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff).map((cp) => String.fromCharCode(cp - 0x1f1e6 + 97));
  return letters.length === 2 ? letters.join("") : null;
}
function Flag({ f, size = 34, round = false }) {
  const [err, setErr] = useState(false);
  const code = flagCode(f);
  if (!code || err) return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{f || "🏳️"}</span>;
  return (
    <img src={`https://flagcdn.com/w80/${code}.png`} alt="" onError={() => setErr(true)}
      style={{ width: size, height: size * 0.72, objectFit: "cover", borderRadius: round ? 6 : 4,
        border: "1px solid rgba(0,0,0,.12)", boxShadow: "0 1px 3px rgba(0,0,0,.15)", display: "inline-block", verticalAlign: "middle" }} />
  );
}

/* طلب API مع التوكن */
async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch("/api/" + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

/* ─── التطبيق ─── */
export default function Page() {
  const [token, setToken] = useState(null);
  const [me, setMe] = useState(null);          // { user, isEntrant, isSuper }
  const [preds, setPreds] = useState({});      // map matchId -> {eh,ea}
  const [results, setResults] = useState({});
  const [tab, setTab] = useState("matches");
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [booting, setBooting] = useState(true);

  const flash = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2600); };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    const saved = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (saved) loadMe(saved);
    else setBooting(false);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  const loadMe = async (tk) => {
    try {
      const data = await api("me", { token: tk });
      setToken(tk);
      setMe({ user: data.user, isEntrant: data.isEntrant, isSuper: data.isSuper });
      const pm = {};
      (data.predictions || []).forEach((p) => { pm[p.match_id] = { eh: p.eh, ea: p.ea }; });
      setPreds(pm);
      setResults(data.results || {});
      localStorage.setItem(TOKEN_KEY, tk);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
    setBooting(false);
  };

  const refreshResults = useCallback(async () => {
    try { const d = await api("results"); setResults(d.results || {}); return d.results; }
    catch { return results; }
  }, [results]);

  const logout = () => { localStorage.removeItem(TOKEN_KEY); setToken(null); setMe(null); setPreds({}); };

  const savePred = async (matchId, eh, ea) => {
    await api("predict", { method: "POST", token, body: { matchId, eh, ea } });
    setPreds((p) => ({ ...p, [matchId]: { eh, ea } }));
  };

  if (booting) return <div style={{ ...S.root, padding: 40, textAlign: "center", color: "#5a6b5f" }}>جاري التحميل…</div>;

  return (
    <div style={S.root}>
      <Header me={me} preds={preds} results={results} onLogout={logout} />
      {!me ? (
        <Auth onAuth={loadMe} flash={flash} />
      ) : (
        <>
          <Tabs tab={tab} setTab={setTab} me={me} />
          <main style={S.main}>
            {tab === "matches" && <MatchList preds={preds} results={results} now={now} savePred={savePred} flash={flash} refreshResults={refreshResults} />}
            {tab === "mypreds" && <MyPreds preds={preds} results={results} />}
            {tab === "board" && <Leaderboard meName={me.user.name} />}
            {tab === "rules" && <Rules />}
            {tab === "entry" && me.isEntrant && <ResultsEntry token={token} results={results} now={now} flash={flash} refreshResults={refreshResults} who={me.user.name} />}
            {tab === "control" && me.isSuper && <ControlPanel token={token} flash={flash} meName={me.user.name} />}
          </main>
        </>
      )}
      {toast && <div className="toast" style={{ ...S.toast, background: toast.ok ? "#1E8A4C" : "#C44536" }}>{toast.msg}</div>}
      <footer style={S.footer}>تطبيق توقعات داخلي · نقاط معنوية للتنافس فقط — لا قيمة مالية لها</footer>
    </div>
  );
}

/* ─── النقاط الفعلية ─── */
function effPoints(preds, results) {
  let pts = 0;
  for (const [mid, p] of Object.entries(preds)) {
    if (results[mid]) pts += judge(p, results[mid], mid).points;
  }
  return pts;
}

/* ─── الترويسة ─── */
function Header({ me, preds, results, onLogout }) {
  const pts = me ? effPoints(preds, results) : null;
  return (
    <header style={S.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 30 }}>🏆</span>
        <div>
          <div className="num" style={{ fontSize: 24, lineHeight: 1, color: "#F6F4ED" }}>دوري التوقعات</div>
          <div style={{ fontSize: 12, color: "#9FBFA8", marginTop: 2 }}>كأس العالم 2026</div>
        </div>
      </div>
      {me && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={S.pointsChip}>
            <span style={{ fontSize: 12, color: "#0B231A" }}>{me.user.name}{me.isSuper && " ⭐"}</span>
            <span className="num" style={{ fontSize: 20, color: "#0B231A" }}>{pts}</span>
            <span style={{ fontSize: 11, color: "#5a6b5f" }}>نقطة</span>
          </div>
          <button onClick={onLogout} style={S.ghostBtn}>خروج</button>
        </div>
      )}
    </header>
  );
}

/* ─── تسجيل الدخول ─── */
function Auth({ onAuth, flash }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [emp, setEmp] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      const data = await api(mode === "login" ? "login" : "register", { method: "POST", body: { name: name.trim(), emp: emp.trim(), pin } });
      flash(mode === "login" ? "أهلًا بعودتك 👋" : "تم إنشاء حسابك 🎉");
      onAuth(data.token);
    } catch (e) { flash(e.message, false); }
    setBusy(false);
  };

  return (
    <div style={S.authWrap}>
      <div style={S.authBoard}>
        <div className="num" style={{ fontSize: 36, color: "#E5B53A", lineHeight: 1.1 }}>توقّع · اجمع · تصدّر</div>
        <p style={{ color: "#CFE3D5", fontSize: 14, margin: "10px 0 20px", lineHeight: 1.8 }}>
          توقّع نتيجة كل مباراة قبل انطلاقها: نتيجة دقيقة = <b style={{ color: "#E5B53A" }}>{PTS_EXACT} نقاط</b>،
          اتجاه صحيح = <b style={{ color: "#E5B53A" }}>{PTS_OUTCOME} نقطة</b>، مع مضاعفة النقاط في الأدوار الإقصائية.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setMode("login")} style={{ ...S.segBtn, ...(mode === "login" ? S.segOn : {}) }}>تسجيل الدخول</button>
          <button onClick={() => setMode("register")} style={{ ...S.segBtn, ...(mode === "register" ? S.segOn : {}) }}>حساب جديد</button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" style={S.input} />
        <input value={emp} onChange={(e) => setEmp(e.target.value.replace(/\D/g, ""))} placeholder="الرقم الوظيفي" inputMode="numeric" style={{ ...S.input, marginTop: 10 }} />
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="رمز سري — 4 أرقام أو أكثر" type="password" inputMode="numeric" style={{ ...S.input, marginTop: 10 }} />
        <button onClick={go} disabled={busy} style={S.primaryBtn}>{busy ? "لحظة…" : mode === "login" ? "دخول" : "إنشاء الحساب"}</button>
        <div style={{ fontSize: 11.5, color: "#7fa089", marginTop: 14, lineHeight: 1.7 }}>
          صاحب الرقم الوظيفي {SUPER_ADMIN_EMP} يملك لوحة التحكم ويحدد مدخلي النتائج.
        </div>
      </div>
    </div>
  );
}

/* ─── التبويبات ─── */
function Tabs({ tab, setTab, me }) {
  const items = [
    ["matches", "المباريات"], ["mypreds", "توقعاتي"], ["board", "المتصدرون"], ["rules", "النظام"],
    ...(me.isEntrant ? [["entry", "إدخال النتائج"]] : []),
    ...(me.isSuper ? [["control", "لوحة التحكم ⭐"]] : []),
  ];
  return (
    <nav style={S.tabs}>
      {items.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} style={{ ...S.tabBtn, ...(tab === k ? S.tabActive : {}) }}>{l}</button>
      ))}
    </nav>
  );
}

/* ─── قائمة المباريات ─── */
function MatchList({ preds, results, now, savePred, flash, refreshResults }) {
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState("upcoming");

  const groups = useMemo(() => {
    const list = MATCHES.filter((m) => {
      const started = new Date(m.t).getTime() <= now;
      if (filter === "upcoming") return !started;
      if (filter === "finished") return !!results[m.i];
      return true;
    });
    const g = {};
    for (const m of list) { const d = fmtDay(new Date(m.t)); (g[d] = g[d] || []).push(m); }
    return g;
  }, [filter, now, results]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[["upcoming", "القادمة"], ["all", "الكل"], ["finished", "المنتهية"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ ...S.chip, ...(filter === k ? S.chipActive : {}) }}>{l}</button>
        ))}
        <button onClick={() => refreshResults().then(() => flash("تم تحديث النتائج"))} style={{ ...S.chip, marginInlineStart: "auto" }}>⟳ تحديث</button>
      </div>
      {Object.keys(groups).length === 0 && <div style={S.empty}>لا توجد مباريات ضمن هذا الفلتر.</div>}
      {Object.entries(groups).map(([day, ms]) => (
        <section key={day} style={{ marginBottom: 18 }}>
          <div style={S.dayHead}>{day}</div>
          {ms.map((m) => (
            <MatchCard key={m.i} m={m} pred={preds[m.i]} res={results[m.i]} now={now}
              open={open === m.i} setOpen={setOpen} savePred={savePred} flash={flash} />
          ))}
        </section>
      ))}
    </div>
  );
}

function MatchCard({ m, pred, res, now, open, setOpen, savePred, flash }) {
  const kick = new Date(m.t);
  const locked = kick.getTime() <= now;
  return (
    <div className="card" style={S.matchCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={S.stageBadge}>{STAGE(m.i)} · م{m.i}</span>
        {STAGE_BONUS(m.i) > 1 && <span style={{ ...S.stageBadge, background: "#0B231A", color: "#E5B53A" }}>نقاط ×{STAGE_BONUS(m.i)}</span>}
        <span style={{ fontSize: 12, color: "#5a6b5f" }}>{fmtTime(kick)}</span>
        {locked && !res && <span style={{ ...S.stageBadge, background: "#fdf1d8", color: "#8a6a14" }}>بانتظار النتيجة</span>}
      </div>
      <div style={S.teamsRow}>
        <TeamSide flag={m.hf} name={m.h} />
        <div className="num" style={S.scoreMid}>{res ? `${res.h} : ${res.a}` : "—"}</div>
        <TeamSide flag={m.af} name={m.a} />
      </div>
      {pred && !open && <PredTicket pred={pred} m={m} res={res} />}
      {!locked && (open ? (
        <PredForm m={m} existing={pred} flash={flash} savePred={savePred} close={() => setOpen(null)} />
      ) : (
        <button onClick={() => setOpen(m.i)} style={{ ...S.primaryBtn, marginTop: 10, padding: "9px 0" }}>{pred ? "تعديل توقعي" : "ضع توقعك"}</button>
      ))}
      {locked && !pred && !res && <div style={{ fontSize: 12, color: "#9aa79e", marginTop: 8 }}>أُغلق باب التوقع عند انطلاق المباراة.</div>}
    </div>
  );
}

function TeamSide({ flag, name }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <Flag f={flag} size={42} round />
      <span style={{ fontSize: 13.5, fontWeight: 700, color: "#14201A" }}>{name}</span>
    </div>
  );
}

function PredForm({ m, existing, flash, savePred, close }) {
  const [eh, setEh] = useState(existing?.eh ?? 0);
  const [ea, setEa] = useState(existing?.ea ?? 0);
  const [busy, setBusy] = useState(false);
  const mult = STAGE_BONUS(m.i);
  const dir = eh > ea ? `فوز ${m.h}` : eh < ea ? `فوز ${m.a}` : "تعادل";

  const save = async () => {
    setBusy(true);
    try { await savePred(m.i, eh, ea); flash(existing ? "تم تحديث توقعك ✏️" : "تم تسجيل توقعك 🍀"); close(); }
    catch (e) { flash(e.message, false); }
    setBusy(false);
  };

  return (
    <div style={S.betBoard}>
      <div style={{ fontSize: 12, color: "#9FBFA8", marginBottom: 10 }}>توقعك لنتيجة المباراة</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <Stepper val={eh} set={setEh} label={m.h} flag={m.hf} />
        <span className="num" style={{ color: "#E5B53A", fontSize: 30 }}>:</span>
        <Stepper val={ea} set={setEa} label={m.a} flag={m.af} />
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: "#CFE3D5", marginTop: 10 }}>توقعك يعني: <b style={{ color: "#E5B53A" }}>{dir}</b></div>
      <div style={{ textAlign: "center", fontSize: 11.5, color: "#9FBFA8", marginTop: 6 }}>
        نتيجة دقيقة = <b className="num" style={{ color: "#E5B53A" }}>{PTS_EXACT * mult}</b> · اتجاه صحيح = <b className="num" style={{ color: "#E5B53A" }}>{PTS_OUTCOME * mult}</b>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={save} disabled={busy} style={{ ...S.goldBtn, flex: 1 }}>{busy ? "…" : existing ? "حفظ التعديل" : "تأكيد التوقع"}</button>
        <button onClick={close} style={S.ghostBtnDark}>إلغاء</button>
      </div>
    </div>
  );
}

function Stepper({ val, set, label, flag }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: 6 }}><Flag f={flag} size={28} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => set(Math.min(15, val + 1))} style={S.stepBtn}>+</button>
        <div className="num" style={S.stepDigit}>{val}</div>
        <button onClick={() => set(Math.max(0, val - 1))} style={S.stepBtn}>−</button>
      </div>
      <div style={{ fontSize: 10.5, color: "#9FBFA8", marginTop: 4, maxWidth: 110 }}>{label}</div>
    </div>
  );
}

function PredTicket({ pred, m, res }) {
  const j = res ? judge(pred, res, m.i) : null;
  const status = !res ? { txt: "قيد الانتظار", bg: "#fdf1d8", c: "#8a6a14" }
    : j.exact ? { txt: `نتيجة دقيقة! 🎯 +${j.points}`, bg: "#e2f3e8", c: "#1E8A4C" }
    : j.hit ? { txt: `اتجاه صحيح ✅ +${j.points}`, bg: "#e2f3e8", c: "#1E8A4C" }
    : { txt: "لم يصب ✖", bg: "#fbe7e4", c: "#C44536" };
  return (
    <div style={{ ...S.ticket, marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 13 }}>🔮 توقعك: <b className="num" style={{ direction: "ltr", display: "inline-block" }}>{pred.eh} : {pred.ea}</b></div>
        <span style={{ fontSize: 12, fontWeight: 700, background: status.bg, color: status.c, borderRadius: 99, padding: "3px 10px" }}>{status.txt}</span>
      </div>
    </div>
  );
}

/* ─── توقعاتي ─── */
function MyPreds({ preds, results }) {
  const entries = Object.entries(preds);
  const totals = entries.reduce((acc, [mid, p]) => {
    const r = results[mid];
    if (r) { acc.done++; const j = judge(p, r, mid); acc.pts += j.points; if (j.exact) acc.exact++; else if (j.hit) acc.hit++; }
    return acc;
  }, { done: 0, pts: 0, exact: 0, hit: 0 });

  if (!entries.length) return <div style={S.empty}>لم تضع أي توقع بعد — توجّه إلى تبويب «المباريات».</div>;
  return (
    <div>
      <div style={S.statsRow}>
        <Stat label="عدد التوقعات" val={entries.length} />
        <Stat label="نتائج دقيقة 🎯" val={totals.exact} />
        <Stat label="اتجاه صحيح" val={totals.hit} />
        <Stat label="نقاطك" val={totals.pts} gold />
      </div>
      {entries.sort((a, b) => Number(a[0]) - Number(b[0])).map(([mid, p]) => {
        const m = MATCHES.find((x) => x.i === Number(mid));
        return (
          <div key={mid} className="card" style={{ ...S.matchCard, padding: "12px 14px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Flag f={m.hf} size={20} /> {m.h} — <Flag f={m.af} size={20} /> {m.a}
              <span style={{ fontWeight: 400, color: "#5a6b5f", fontSize: 11.5 }}>· {STAGE(m.i)}</span>
            </div>
            <PredTicket pred={p} m={m} res={results[mid]} />
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, val, gold }) {
  return (
    <div style={{ ...S.stat, ...(gold ? { background: "#0B231A", color: "#E5B53A" } : {}) }}>
      <div className="num" style={{ fontSize: 26 }}>{val}</div>
      <div style={{ fontSize: 11.5, opacity: 0.8 }}>{label}</div>
    </div>
  );
}

/* ─── المتصدرون ─── */
function Leaderboard({ meName }) {
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    try { const d = await api("leaderboard"); setRows(d.board || []); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!rows) return <div style={S.empty}>جاري تحميل لوحة المتصدرين…</div>;
  if (!rows.length) return <div style={S.empty}>لا مشاركين بعد.</div>;
  return (
    <div>
      <button onClick={load} style={{ ...S.chip, marginBottom: 12 }}>⟳ تحديث اللوحة</button>
      {rows.map((r, i) => (
        <div key={r.name} className="card" style={{ ...S.boardRow, ...(r.name === meName ? { borderColor: "#E5B53A", background: "#fffaf0" } : {}) }}>
          <span className="num" style={{ ...S.rank, ...(i === 0 ? { background: "#E5B53A", color: "#0B231A" } : {}) }}>
            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}{r.name === meName && " (أنت)"}</div>
            <div style={{ fontSize: 11.5, color: "#5a6b5f" }}>{r.preds} توقعًا · 🎯 {r.exact} · ✅ {r.hit} — من {r.done} مباراة</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 24, color: "#0B231A" }}>{r.pts}</div>
            <div style={{ fontSize: 10.5, color: "#5a6b5f" }}>نقطة</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── النظام ─── */
function Rules() {
  const Row = ({ stage, exact, dir }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px dashed #e2ded2" }}>
      <div style={{ flex: 1, fontWeight: 700, fontSize: 13.5 }}>{stage}</div>
      <div style={{ textAlign: "center", width: 90 }}><div className="num" style={{ fontSize: 22, color: "#1E8A4C" }}>{exact}</div><div style={{ fontSize: 10.5, color: "#5a6b5f" }}>دقيقة 🎯</div></div>
      <div style={{ textAlign: "center", width: 90 }}><div className="num" style={{ fontSize: 22, color: "#0B231A" }}>{dir}</div><div style={{ fontSize: 10.5, color: "#5a6b5f" }}>اتجاه</div></div>
    </div>
  );
  return (
    <div className="card" style={{ ...S.matchCard, padding: "18px 20px" }}>
      <div className="num" style={{ fontSize: 22, color: "#0B231A", marginBottom: 4 }}>كيف تُحتسب النقاط؟</div>
      <p style={{ fontSize: 13, color: "#5a6b5f", lineHeight: 1.8 }}>توقّع نتيجة المباراة بالأهداف قبل انطلاقها. النتيجة الدقيقة تمنحك أعلى نقاط، وإصابة الاتجاه فقط تمنحك نقاطًا أقل. يمكنك تعديل توقعك حتى صافرة البداية.</p>
      <Row stage="دور المجموعات" exact={PTS_EXACT} dir={PTS_OUTCOME} />
      <Row stage="دور الـ32 والـ16 (×2)" exact={PTS_EXACT * 2} dir={PTS_OUTCOME * 2} />
      <Row stage="ربع النهائي فصاعدًا (×3)" exact={PTS_EXACT * 3} dir={PTS_OUTCOME * 3} />
      <p style={{ fontSize: 12, color: "#9aa79e", lineHeight: 1.7, marginTop: 12 }}>التوقع الخاطئ لا يخصم شيئًا. النتائج يعتمدها مدخلو النتائج المعيّنون من الإدارة.</p>
    </div>
  );
}

/* ─── إدخال النتائج ─── */
function ResultsEntry({ token, results, now, flash, refreshResults, who }) {
  const [scores, setScores] = useState({});
  const [fetched, setFetched] = useState({});
  const [busy, setBusy] = useState(false);
  const startedNoResult = MATCHES.filter((m) => new Date(m.t).getTime() <= now && !results[m.i]);
  const withResult = MATCHES.filter((m) => results[m.i]);

  const save = async (m) => {
    const s = scores[m.i];
    if (!s || s.h === "" || s.h == null || s.a === "" || s.a == null) return flash("أدخل نتيجة الفريقين", false);
    try {
      await api("results", { method: "POST", token, body: { matchId: m.i, h: Number(s.h), a: Number(s.a) } });
      setFetched((f) => { const n = { ...f }; delete n[m.i]; return n; });
      await refreshResults();
      flash(`تم اعتماد نتيجة المباراة ${m.i}`);
    } catch (e) { flash(e.message, false); }
  };

  const autoFetch = async () => {
    setBusy(true);
    try {
      const ids = startedNoResult.slice(0, 25).map((m) => m.i);
      const d = await api("autofetch", { method: "POST", token, body: { matchIds: ids } });
      const valid = d.results || {};
      if (!Object.keys(valid).length) flash("لم يُعثر على نتائج نهائية مؤكدة بعد", false);
      else {
        setFetched(valid);
        setScores((s) => { const n = { ...s }; for (const [id, r] of Object.entries(valid)) n[id] = { h: String(r.h), a: String(r.a) }; return n; });
        flash(`جُلبت ${Object.keys(valid).length} نتيجة — راجعها ثم اعتمدها ✅`);
      }
    } catch (e) { flash(e.message || "تعذّر الجلب الآلي", false); }
    setBusy(false);
  };

  const approveAll = async () => {
    try {
      const batch = Object.entries(fetched).map(([id, r]) => ({ matchId: Number(id), h: r.h, a: r.a }));
      const d = await api("results", { method: "POST", token, body: { batch } });
      setFetched({});
      await refreshResults();
      flash(`تم اعتماد ${d.count} نتيجة دفعة واحدة ✅`);
    } catch (e) { flash(e.message, false); }
  };

  return (
    <div>
      <div style={{ ...S.empty, background: "#0B231A", color: "#CFE3D5", marginBottom: 14 }}>
        أنت من مدخلي النتائج المعتمدين. أدخل النتائج يدويًا، أو استخدم الجلب الآلي (إن كان مفعّلًا) ثم راجع واعتمد. يُسجَّل اسمك على كل نتيجة.
      </div>
      {startedNoResult.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <button onClick={autoFetch} disabled={busy} style={{ ...S.primaryBtn, marginTop: 0, flex: 1, minWidth: 220, padding: "11px 16px" }}>{busy ? "🔎 جاري البحث…" : "🔎 جلب النتائج آليًا"}</button>
          {Object.keys(fetched).length > 0 && <button onClick={approveAll} style={{ ...S.goldBtn, padding: "11px 18px" }}>✅ اعتماد الكل ({Object.keys(fetched).length})</button>}
        </div>
      )}
      {startedNoResult.length === 0 && <div style={S.empty}>لا مباريات بانتظار إدخال نتيجتها حاليًا.</div>}
      {startedNoResult.map((m) => (
        <div key={m.i} className="card" style={{ ...S.matchCard, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", ...(fetched[m.i] ? { borderColor: "#E5B53A", background: "#fffaf0" } : {}) }}>
          <div style={{ flex: 1, minWidth: 180, fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            م{m.i} · <Flag f={m.hf} size={20} /> {m.h} — <Flag f={m.af} size={20} /> {m.a}
            {fetched[m.i] && <span style={{ ...S.stageBadge, background: "#fdf1d8", color: "#8a6a14" }}>مجلوبة آليًا</span>}
          </div>
          <input type="number" min="0" placeholder={m.h} style={S.adminScore} value={scores[m.i]?.h ?? ""} onChange={(e) => setScores({ ...scores, [m.i]: { ...scores[m.i], h: e.target.value } })} />
          <span className="num">:</span>
          <input type="number" min="0" placeholder={m.a} style={S.adminScore} value={scores[m.i]?.a ?? ""} onChange={(e) => setScores({ ...scores, [m.i]: { ...scores[m.i], a: e.target.value } })} />
          <button onClick={() => save(m)} style={{ ...S.goldBtn, padding: "8px 16px" }}>اعتماد</button>
        </div>
      ))}
      {withResult.length > 0 && (
        <>
          <div style={S.dayHead}>نتائج معتمدة ({withResult.length})</div>
          {withResult.map((m) => (
            <div key={m.i} style={{ ...S.matchCard, padding: "10px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              م{m.i} · <Flag f={m.hf} size={18} /> {m.h} <b className="num" style={{ direction: "ltr" }}>{results[m.i].h} : {results[m.i].a}</b> <Flag f={m.af} size={18} /> {m.a}
              {results[m.i].entered_by && <span style={{ fontSize: 11, color: "#9aa79e" }}>· أدخلها: {results[m.i].entered_by}</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ─── لوحة التحكم ─── */
function ControlPanel({ token, flash, meName }) {
  const [users, setUsers] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const d = await api("users", { token }); setUsers(d.users || []); } catch (e) { flash(e.message, false); setUsers([]); }
  }, [token]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const toggle = async (name, grant) => {
    setBusy(true);
    try { await api("entrants", { method: "POST", token, body: { name, grant } }); flash(grant ? `${name} أصبح مدخل نتائج ✅` : `أُلغيت صلاحية ${name}`); await load(); }
    catch (e) { flash(e.message, false); }
    setBusy(false);
  };

  const entrantCount = (users || []).filter((u) => u.isEntrant).length;
  return (
    <div>
      <div style={{ ...S.empty, background: "#0B231A", color: "#CFE3D5", marginBottom: 14, textAlign: "right" }}>
        <b style={{ color: "#E5B53A" }}>⭐ لوحة تحكم المدير</b> — بصفتك صاحب الرقم الوظيفي {SUPER_ADMIN_EMP}، تحدد من يحق له إدخال نتائج المباريات. صلاحيتك دائمة.
      </div>
      <div style={S.statsRow}>
        <Stat label="عدد المسجلين" val={users ? users.length : "…"} />
        <Stat label="مدخلو النتائج" val={entrantCount} gold />
      </div>
      {!users && <div style={S.empty}>جاري التحميل…</div>}
      {users && users.map((u) => (
        <div key={u.name} className="card" style={S.boardRow}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              {u.name}{u.name === meName && " (أنت)"}
              {u.isEntrant && <span style={{ ...S.stageBadge, background: "#e2f3e8", color: "#1E8A4C", marginInlineStart: 8 }}>مدخل نتائج</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "#5a6b5f" }}>الرقم الوظيفي: <span className="num">{u.emp}</span></div>
          </div>
          {u.emp !== SUPER_ADMIN_EMP && (
            <button onClick={() => toggle(u.name, !u.isEntrant)} disabled={busy}
              style={u.isEntrant ? { ...S.chip, background: "#fbe7e4", color: "#C44536", border: "1px solid #C44536" } : { ...S.goldBtn, padding: "8px 16px" }}>
              {u.isEntrant ? "سحب الصلاحية" : "منح الصلاحية"}
            </button>
          )}
        </div>
      ))}
      <button onClick={load} style={{ ...S.chip, marginTop: 8 }}>⟳ تحديث القائمة</button>
    </div>
  );
}

/* ─── الأنماط ─── */
const S = {
  root: { fontFamily: "'Tajawal', sans-serif", background: "#F6F4ED", minHeight: "100vh", color: "#14201A", maxWidth: 760, margin: "0 auto" },
  header: { background: "#0B231A", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "4px solid #E5B53A", flexWrap: "wrap", gap: 10 },
  pointsChip: { background: "#E5B53A", borderRadius: 99, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 },
  ghostBtn: { background: "transparent", border: "1px solid #3d5a48", color: "#CFE3D5", borderRadius: 8, padding: "6px 12px", fontSize: 12 },
  ghostBtnDark: { background: "transparent", border: "1px solid #3d5a48", color: "#CFE3D5", borderRadius: 10, padding: "10px 16px", fontSize: 13 },
  main: { padding: "16px 14px 30px" },
  authWrap: { padding: "28px 16px" },
  authBoard: { background: "#0B231A", borderRadius: 18, padding: "28px 24px", boxShadow: "0 10px 30px rgba(11,35,26,.25)", border: "1px solid #1c4030" },
  input: { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1px solid #2c4f3b", background: "#102e21", color: "#F6F4ED", fontSize: 14 },
  segBtn: { flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid #2c4f3b", background: "#102e21", color: "#CFE3D5", fontSize: 13, fontWeight: 700 },
  segOn: { background: "#E5B53A", color: "#0B231A", border: "1px solid #E5B53A" },
  primaryBtn: { width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 10, border: "none", background: "#1E8A4C", color: "#fff", fontWeight: 700, fontSize: 15 },
  goldBtn: { padding: "10px 0", borderRadius: 10, border: "none", background: "#E5B53A", color: "#0B231A", fontWeight: 700, fontSize: 14 },
  tabs: { display: "flex", gap: 6, padding: "10px 14px 0", position: "sticky", top: 0, background: "#F6F4ED", zIndex: 5, borderBottom: "1px solid #e2ded2", flexWrap: "wrap" },
  tabBtn: { border: "none", background: "transparent", padding: "10px 14px", fontSize: 14, fontWeight: 700, color: "#5a6b5f", borderBottom: "3px solid transparent" },
  tabActive: { color: "#0B231A", borderBottom: "3px solid #E5B53A" },
  chip: { border: "1px solid #d8d3c4", background: "#fff", borderRadius: 99, padding: "6px 14px", fontSize: 12.5, color: "#14201A" },
  chipActive: { background: "#0B231A", color: "#F6F4ED", border: "1px solid #0B231A" },
  dayHead: { fontSize: 13, fontWeight: 700, color: "#5a6b5f", margin: "14px 2px 8px", borderBottom: "1px dashed #d8d3c4", paddingBottom: 4 },
  matchCard: { background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 10, border: "1px solid #e7e3d6" },
  stageBadge: { fontSize: 11, background: "#eef2ec", color: "#3d5a48", borderRadius: 99, padding: "2px 10px", fontWeight: 700 },
  teamsRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  scoreMid: { minWidth: 84, textAlign: "center", fontSize: 28, color: "#0B231A", background: "#F6F4ED", borderRadius: 10, padding: "4px 8px", border: "1px solid #e7e3d6", direction: "ltr" },
  betBoard: { background: "#0B231A", borderRadius: 14, padding: "16px", marginTop: 12, border: "1px solid #1c4030" },
  stepBtn: { width: 34, height: 34, borderRadius: 9, border: "1px solid #2c4f3b", background: "#102e21", color: "#E5B53A", fontSize: 18, fontWeight: 700 },
  stepDigit: { width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, background: "#061711", color: "#E5B53A", borderRadius: 10, border: "1px solid #2c4f3b" },
  ticket: { background: "#fbf8ef", border: "1px dashed #d9c98f", borderRadius: 10, padding: "8px 12px" },
  statsRow: { display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  stat: { flex: 1, minWidth: 110, background: "#fff", border: "1px solid #e7e3d6", borderRadius: 12, padding: "10px 12px", textAlign: "center" },
  boardRow: { display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "1px solid #e7e3d6" },
  rank: { width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "#eef2ec", fontSize: 17 },
  adminScore: { width: 64, padding: "8px", borderRadius: 9, border: "1px solid #d8d3c4", fontSize: 16, textAlign: "center", direction: "ltr" },
  empty: { background: "#fff", border: "1px dashed #d8d3c4", borderRadius: 12, padding: "18px", textAlign: "center", fontSize: 13.5, color: "#5a6b5f" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", color: "#fff", padding: "10px 20px", borderRadius: 99, fontSize: 13.5, fontWeight: 700, zIndex: 50, boxShadow: "0 6px 20px rgba(0,0,0,.25)" },
  footer: { textAlign: "center", fontSize: 11, color: "#9aa79e", padding: "10px 0 26px" },
};
