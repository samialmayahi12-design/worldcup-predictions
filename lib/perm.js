// تحقق الصلاحيات على الخادم
import { db } from "./db";
import { SUPER_ADMIN_EMP } from "./points";

export async function isEntrant(user) {
  if (!user) return false;
  if (user.emp === SUPER_ADMIN_EMP) return true;
  const { data } = await db.from("entrants").select("name").eq("name", user.name).maybeSingle();
  return !!data;
}

export function isSuper(user) {
  return !!user && user.emp === SUPER_ADMIN_EMP;
}
