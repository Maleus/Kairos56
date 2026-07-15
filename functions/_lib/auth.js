// Shared auth helpers for Cloudflare Pages Functions.
// Session cookie format: "<expiryMs>.<hmacHex>", HMAC-SHA256 signed with
// env.SESSION_SECRET so it can't be forged client-side.

const COOKIE_NAME = 'kairos_session';
const SESSION_DAYS = 30;

export { COOKIE_NAME };

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSessionCookie(env) {
  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await hmacHex(env.SESSION_SECRET, String(expiry));
  const value = `${expiry}.${sig}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function hasValidSession(request, env) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [expiry, sig] = match[1].split('.');
  if (!expiry || !sig) return false;
  if (Number(expiry) < Date.now()) return false;
  const expected = await hmacHex(env.SESSION_SECRET, expiry);
  return timingSafeEqual(sig, expected);
}

// Constant-time string comparison
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// The team password hash lives in KV (key: team_password_hash) so the admin
// can change it without a redeploy. Falls back to env.TEAM_PASSWORD_HASH.
export async function getTeamPasswordHash(env) {
  const fromKv = await env.KAIROS.get('team_password_hash');
  return fromKv || env.TEAM_PASSWORD_HASH || null;
}
