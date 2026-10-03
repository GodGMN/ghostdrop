import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createFrontend } from '../apps/frontend/server.js';
import { fixture, upload } from './helpers.js';

async function frontendFixture(t) {
  const backend = await fixture(t);
  const server = createFrontend(backend.base).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  backend.config.origin = base;
  return { base, backend };
}

test('frontend serves static assets and sharing routes while backend is API-only', async (t) => {
  const { base, backend } = await frontendFixture(t);
  for (const path of ['/', '/f/example', '/f/example/direct', '/delete/example', '/admin']) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  }
  assert.equal((await fetch(`${base}/app.js`)).status, 200);
  assert.equal((await fetch(`${base}/api/config`)).status, 200);
  assert.equal((await fetch(`${backend.base}/`)).status, 404);
  const missing = await fetch(`${base}/api/missing`);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type'), /json/);
  const redirect = await fetch(`${base}/f/example/preview`, { redirect: 'manual' });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get('location'), '/f/example');
});

test('frontend proxy preserves file bytes, password cookies and origin enforcement', async (t) => {
  const { base } = await frontendFixture(t);
  const response = await upload(base, { password: 'secret', content: 'private bytes' });
  assert.equal(response.status, 201);
  const file = await response.json();
  assert.equal((await fetch(`${base}/delete/${file.id}`)).status, 200);
  assert.equal((await fetch(`${base}/api/files/${file.id}`)).status, 200);
  const path = `${base}/api/files/${file.id}`;
  assert.equal((await fetch(`${path}/download`)).status, 401);
  const rejected = await fetch(`${path}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' },
    body: JSON.stringify({ password: 'secret' }),
  });
  assert.equal(rejected.status, 403);
  const unlocked = await fetch(`${path}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ password: 'secret' }),
  });
  assert.equal(unlocked.status, 200);
  const cookie = unlocked.headers.get('set-cookie').split(';')[0];
  const download = await fetch(`${path}/download`, { headers: { Cookie: cookie } });
  assert.equal(await download.text(), 'private bytes');
  assert.equal((await fetch(`${path}/preview`, { headers: { Cookie: cookie } })).status, 400);
});
