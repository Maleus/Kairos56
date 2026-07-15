// POST /api/login — verify team password, set signed session cookie.

import { sha256Hex, createSessionCookie, getTeamPasswordHash, timingSafeEqual } from '../_lib/auth.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let password = '';
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    password = (await request.json()).password || '';
  } else {
    password = (await request.formData()).get('password') || '';
  }

  const storedHash = await getTeamPasswordHash(env);
  if (!storedHash) {
    return new Response('Team password not configured. See SETUP.md.', { status: 500 });
  }

  const inputHash = await sha256Hex(password);

  if (timingSafeEqual(inputHash, storedHash)) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/members/',
        'Set-Cookie': await createSessionCookie(env),
      },
    });
  }

  // Small delay to slow brute-force attempts
  await new Promise((r) => setTimeout(r, 750));
  return new Response(null, {
    status: 302,
    headers: { Location: '/members/?error=1' },
  });
}
