/**
 * Optional live smoke against the backend (default http://localhost:3000).
 * Usage: node scripts/smoke-api.mjs
 * Does not require credentials — only checks that the API is reachable.
 */
const base = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  console.log(`Smoke: probing ${base} …`);
  try {
    const res = await fetch(`${base}/auth/validate`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    // 401 without token is healthy — means the route exists
    console.log(`GET /auth/validate → ${res.status} ${res.statusText}`);
    if (res.status === 401 || res.status === 200) {
      console.log('OK: API is reachable.');
      process.exit(0);
    }
    console.warn('Unexpected status — server responded but check routing.');
    process.exit(0);
  } catch (err) {
    console.error('FAIL: cannot reach API.', err?.message || err);
    console.error('Start the BiDi backend on port 3000, then re-run.');
    process.exit(1);
  }
}

main();
