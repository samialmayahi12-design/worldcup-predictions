// عميل Supabase للخادم فقط — يستخدم مفتاح الخدمة (لا يُكشف للمتصفح أبدًا)
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  // رسالة واضحة أثناء التطوير إن نُسيت متغيرات البيئة
  console.warn("⚠️  متغيرات SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY غير مضبوطة");
}

export const db = createClient(url || "http://localhost", serviceKey || "anon", {
  auth: { persistSession: false },
});
