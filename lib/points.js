// منطق احتساب النقاط — مشترك بين الخادم والواجهة
import { STAGE_BONUS } from "./matches";

export const PTS_EXACT = 5; // نتيجة دقيقة
export const PTS_OUTCOME = 2; // اتجاه صحيح فقط
export const SUPER_ADMIN_EMP = "190"; // الرقم الوظيفي لمدير النظام

// تقييم توقع واحد مقابل النتيجة الفعلية
export function judge(pred, res, matchId) {
  if (!res) return { points: 0, exact: false, hit: false, pending: true };
  const outcome = res.h > res.a ? "home" : res.h < res.a ? "away" : "draw";
  const mine = pred.eh > pred.ea ? "home" : pred.eh < pred.ea ? "away" : "draw";
  const mult = STAGE_BONUS(Number(matchId));
  if (pred.eh === res.h && pred.ea === res.a)
    return { points: PTS_EXACT * mult, exact: true, hit: true, pending: false };
  if (mine === outcome)
    return { points: PTS_OUTCOME * mult, exact: false, hit: true, pending: false };
  return { points: 0, exact: false, hit: false, pending: false };
}

// إجمالي نقاط مستخدم من قائمة توقعاته وخريطة النتائج
export function totalPoints(preds, resultsMap) {
  let pts = 0;
  for (const p of preds) {
    const r = resultsMap[p.match_id];
    if (r) pts += judge({ eh: p.eh, ea: p.ea }, r, p.match_id).points;
  }
  return pts;
}
