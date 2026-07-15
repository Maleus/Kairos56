// Server-side gate for everything under /members/.
// Unlike the old client-side check, protected content is never sent
// to the browser without a valid signed session cookie.

import { hasValidSession } from '../_lib/auth.js';

const loginPage = (error = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Login</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <nav>
      <a href="/" class="logo">← Back to site</a>
    </nav>
  </header>
  <main>
    <div class="login-page">
      <h1>Team Member Login</h1>
      <p>Enter the team password to access the dashboard.</p>
      <form method="post" action="/api/login">
        <input type="password" name="password" placeholder="Password" required autofocus>
        <button type="submit" class="btn">Login</button>
      </form>
      ${error ? `<p class="error">${error}</p>` : ''}
    </div>
  </main>
</body>
</html>`;

export async function onRequest(context) {
  const { request, env, next } = context;

  if (await hasValidSession(request, env)) {
    return next(); // authenticated — serve the static dashboard
  }

  const url = new URL(request.url);
  const error = url.searchParams.get('error') === '1' ? 'Incorrect password. Try again.' : '';
  return new Response(loginPage(error), {
    status: 401,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
