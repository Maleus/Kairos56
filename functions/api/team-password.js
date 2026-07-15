// POST /api/team-password — admin changes the team password.
// Auth: env.ADMIN_SECRET (set in Cloudflare Pages env vars).
// The new password's SHA-256 hash is stored in KV — no redeploy needed,
// takes effect immediately.

import { sha256Hex, timingSafeEqual } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    body = await request.json();
  } else {
    const fd = await request.formData();
    body = Object.fromEntries(fd.entries());
  }

  const adminKey = (body.admin_key || '').toString();
  const newPassword = (body.new_password || '').toString();

  if (!env.ADMIN_SECRET) {
    return new Response('ADMIN_SECRET not configured.', { status: 500 });
  }
  if (!timingSafeEqual(adminKey, env.ADMIN_SECRET)) {
    await new Promise((r) => setTimeout(r, 750));
    return new Response('Unauthorized.', { status: 401 });
  }
  if (newPassword.length < 8) {
    return new Response('Password must be at least 8 characters.', { status: 400 });
  }

  await env.KAIROS.put('team_password_hash', await sha256Hex(newPassword));

  return new Response('Team password updated. It takes effect immediately.', { status: 200 });
}
