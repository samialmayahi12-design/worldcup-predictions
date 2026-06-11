// Server-side permission checks (identity = employee number)
import { db } from "./db";
import { SUPER_ADMIN_EMP } from "./points";

export async function isEntrant(user) {
  if (!user) return false;
  if (user.emp === SUPER_ADMIN_EMP) return true;
  const { data } = await db.from("entrants").select("emp").eq("emp", user.emp).maybeSingle();
  return !!data;
}

export function isSuper(user) {
  return !!user && user.emp === SUPER_ADMIN_EMP;
}
