// Outils partagés : réponses JSON, CORS, jetons signés, mots de passe, limites de débit.
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
export { now };

export class HttpError extends Error {
  constructor(status, code, extra) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
export const fail = (status, code, extra) => { throw new HttpError(status, code, extra); };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}

export function corsHeaders(env, req) {
  const origin = req.headers.get("Origin") || "";
  const allowed = [env.SITE_ORIGIN, ...(env.DEV_ORIGINS || "").split(",")].map(s => s && s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function randomId(len = 12) {
  const b = crypto.getRandomValues(new Uint8Array(len)); let s = "";
  for (const x of b) s += ALPHA[x % ALPHA.length]; // 57 symboles ; le léger biais est négligeable ici
  return s;
}

export function b64url(bytes) {
  let s = ""; const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("");

const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) keyCache.set(secret, crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
  return keyCache.get(secret);
}
export async function hmac(secret, msg) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), typeof msg === "string" ? enc.encode(msg) : msg));
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function signingKey(env) {
  if (!env.SIGNING_KEY || env.SIGNING_KEY.length < 32) fail(500, "server_not_configured");
  return env.SIGNING_KEY;
}

// Jeton : base64url(JSON) + "." + HMAC tronqué.
export async function makeToken(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url((await hmac(signingKey(env), "tok." + body)).subarray(0, 24));
  return body + "." + sig;
}
export async function readToken(env, token) {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = b64url((await hmac(signingKey(env), "tok." + body)).subarray(0, 24));
  if (!safeEqual(sig, want)) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64url(body)));
    if (!p.e || p.e < now()) return null;
    return p;
  } catch { return null; }
}
export function bearer(req) {
  const h = req.headers.get("Authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// Signature courte pour les URL de fichiers (<img>, <a download>), qui ne peuvent pas porter d'en-tête.
export async function signPath(env, path, exp) {
  return b64url((await hmac(signingKey(env), `url.${path}.${exp}`)).subarray(0, 18));
}
export async function checkPath(env, path, exp, sig) {
  if (!exp || !sig || +exp < now()) return false;
  return safeEqual(sig, await signPath(env, path, +exp));
}

// Mots de passe de galerie : HMAC(poivre secret, sel:mot de passe). Le poivre (SIGNING_KEY) n'est jamais en base.
export async function hashPassword(env, password) {
  const salt = randomId(16);
  return `h1$${salt}$${hex(await hmac(signingKey(env), `pw.${salt}:${password}`))}`;
}
export async function checkPassword(env, stored, password) {
  if (!stored) return true;
  const [v, salt, h] = stored.split("$");
  if (v !== "h1" || !salt || !h || typeof password !== "string") return false;
  return safeEqual(h, hex(await hmac(signingKey(env), `pw.${salt}:${password}`)));
}
// Empreinte du mot de passe administrateur, portée par le jeton : changer le mot de passe déconnecte les sessions ouvertes.
export async function adminKey(env) {
  return b64url((await hmac(signingKey(env), "admk." + (env.ADMIN_PASSWORD || ""))).subarray(0, 9));
}
export async function checkAdminPassword(env, password) {
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 10) fail(500, "admin_not_configured");
  if (typeof password !== "string") return false;
  const k = signingKey(env);
  return safeEqual(hex(await hmac(k, "adm." + password)), hex(await hmac(k, "adm." + env.ADMIN_PASSWORD)));
}

// Adresse IP pseudonymisée (jamais stockée en clair).
export async function clientKey(env, req) {
  // Seul CF-Connecting-IP fait foi (posé par Cloudflare) ; X-Forwarded-For peut être forgé par le client.
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  return b64url((await hmac(signingKey(env), "ip." + ip)).subarray(0, 12));
}

// Limite de débit à fenêtre fixe, stockée dans D1.
export async function rateLimit(env, key, max, windowSec) {
  const t = now();
  const row = await env.DB.prepare("SELECT n, reset_at FROM attempts WHERE k = ?").bind(key).first();
  if (!row || row.reset_at <= t) {
    await env.DB.prepare("INSERT INTO attempts (k, n, reset_at) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, reset_at = excluded.reset_at").bind(key, t + windowSec).run();
    return true;
  }
  if (row.n >= max) fail(429, "too_many_attempts", { retryAfter: row.reset_at - t });
  await env.DB.prepare("UPDATE attempts SET n = n + 1 WHERE k = ?").bind(key).run();
  return true;
}

// Lecture bornée du corps JSON, même sans Content-Length (transfert en morceaux).
export async function readJson(req, maxBytes = 256 * 1024) {
  const len = +req.headers.get("Content-Length") || 0;
  if (len > maxBytes) fail(413, "too_large");
  if (!req.body) fail(400, "bad_json");
  const reader = req.body.getReader(); const parts = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > maxBytes) { try { await reader.cancel(); } catch {} fail(413, "too_large"); }
    parts.push(value);
  }
  const buf = new Uint8Array(n); let o = 0; for (const x of parts) { buf.set(x, o); o += x.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(buf)); } catch { fail(400, "bad_json"); }
}

export function contentDisposition(name) {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "-").replace(/["\\]/g, "-");
  const star = encodeURIComponent(name).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  return ascii === name ? `attachment; filename="${ascii}"` : `attachment; filename="${ascii}"; filename*=UTF-8''${star}`;
}

export function cleanName(name, fallback = "photo") {
  const n = String(name || "").split(/[\\/]/).pop().replace(/[\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/, "").trim();
  return (n || fallback).slice(0, 180);
}
