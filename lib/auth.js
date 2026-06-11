// مصادقة بسيطة مناسبة لمسابقة داخلية: تجزئة الرمز السري + توكن موقّع بـ HMAC
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "change-me-in-production";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();

export function hashPin(pin) {
  return crypto.createHmac("sha256", SECRET).update("pin:" + pin).digest("hex");
}

export function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("hex").slice(0, 32);
  return body + "." + sig;
}

export function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("hex").slice(0, 32);
  if (sig !== expected) return null;
  try { return JSON.parse(fromB64url(body)); }
  catch { return null; }
}

// يستخرج المستخدم من ترويسة Authorization: Bearer <token>
export function userFromRequest(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  return verifyToken(token);
}
