/**
 * Verifies the CORS policy: which origins the API accepts.
 * Run with: npm run smoke:cors
 */
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/db.js';

const ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://127.0.0.1:8080',
  'http://192.168.1.20:5173',
  'https://buildstock.example.com',
];

let baseUrl = '';
let failures = 0;

async function main() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  for (const origin of ORIGINS) {
    const res = await fetch(`${baseUrl}/settings/branding`, { headers: { Origin: origin } });
    const allow = res.headers.get('access-control-allow-origin');
    const body = await res.json().catch(() => ({}));
    const loopback = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(origin);
    const allowed = allow === origin || allow === '*';
    const expected = loopback; // dev mode accepts every loopback port
    const ok = allowed === expected;
    if (!ok) failures += 1;
    // eslint-disable-next-line no-console
    console.log(
      `  [${ok ? 'PASS' : 'FAIL'}] ${origin.padEnd(38)} -> status ${res.status} allow-origin=${allow || '-'} ${
        body?.code ? `code=${body.code}` : ''
      }`
    );
  }

  // A preflight for the setup (POST) call must also succeed from a loopback origin.
  const preflight = await fetch(`${baseUrl}/auth/setup`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5174',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  const preflightOk = preflight.status < 300 || preflight.headers.get('access-control-allow-origin');
  if (!preflightOk) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`  [${preflightOk ? 'PASS' : 'FAIL'}] OPTIONS preflight from http://localhost:5174 -> status ${preflight.status}`);

  // The real "create account" call must succeed from a loopback origin.
  const setup = await fetch(`${baseUrl}/auth/setup`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5174', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'CORS Test Owner',
      email: `cors-${Date.now()}@buildstock.et`,
      password: 'CorsTest@2024',
      businessName: 'CORS Test Business',
    }),
  });
  const setupBody = await setup.json().catch(() => ({}));
  const setupOk = setup.status === 201 && Boolean(setupBody?.data?.token);
  if (!setupOk) failures += 1;
  // eslint-disable-next-line no-console
  console.log(
    `  [${setupOk ? 'PASS' : 'FAIL'}] POST /auth/setup from http://localhost:5174 -> status ${setup.status} ${
      setupBody?.message ? `message=${setupBody.message}` : ''
    }`
  );

  // eslint-disable-next-line no-console
  console.log(failures ? `\n  ${failures} CORS check(s) failed` : '\n  All CORS checks passed');
  server.close();
  await disconnectDatabase();
  process.exit(failures ? 1 : 0);
}

main().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('[cors] crashed:', error);
  await disconnectDatabase();
  process.exit(1);
});
