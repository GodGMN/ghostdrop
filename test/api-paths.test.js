import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';
import { fixture } from './helpers.js';
import { hashPassword } from '../apps/backend/src/security.js';

test('bare and prefixed backend paths return the same API configuration and errors', async (t) => {
  const { base } = await fixture(t);
  for (const prefix of ['', '/api']) {
    const response = await fetch(`${base}${prefix}/config?check=1`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { maxFileBytes: 104857600, chunkSize: 524288 });
    assert.deepEqual(await (await fetch(`${base}${prefix}/health`)).json(), { status: 'ok' });
    assert.equal((await fetch(`${base}${prefix}/unknown`)).status, 404);
  }
  assert.equal((await fetch(`${base}/apiary/config`)).status, 404);
});

test('stripped chunk routes preserve origin checks, session credentials and password access', async (t) => {
  const { base } = await fixture(t);
  const settings = { name: 'bare.txt', size: 5, password: 'secret', expiration: 'day' };
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(settings),
  };
  assert.equal(
    (
      await fetch(`${base}/uploads/sessions`, {
        ...options,
        headers: { ...options.headers, Origin: 'https://other.example' },
      })
    ).status,
    403,
  );
  const started = await fetch(`${base}/uploads/sessions`, options);
  assert.equal(started.status, 201);
  const session = await started.json();
  const url = `${base}/uploads/sessions/${session.id}`;
  assert.equal((await fetch(url)).status, 404);
  const headers = { 'X-Upload-Token': session.token };
  assert.equal(
    (
      await fetch(`${url}/chunks`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/octet-stream', 'X-Upload-Offset': '0' },
        body: 'hello',
      })
    ).status,
    200,
  );
  assert.ok(
    [200, 202].includes((await fetch(`${url}/complete`, { method: 'POST', headers })).status),
  );
  let state;
  for (let i = 0; i < 100; i++) {
    state = await (await fetch(url, { headers })).json();
    if (state.state === 'complete') break;
    await setTimeout(10);
  }
  assert.equal(state.state, 'complete');
  const fileUrl = `${base}/files/${state.file.id}`;
  assert.equal((await fetch(`${fileUrl}/download`)).status, 401);
  const unlock = await fetch(`${fileUrl}/unlock`, {
    ...options,
    body: JSON.stringify({ password: 'secret' }),
  });
  assert.equal(unlock.status, 200);
  const cookie = unlock.headers.get('set-cookie').split(';')[0];
  assert.match(unlock.headers.get('set-cookie'), /Path=\/api\/files\//);
  assert.equal(
    await (await fetch(`${fileUrl}/download`, { headers: { Cookie: cookie } })).text(),
    'hello',
  );
  assert.equal((await fetch(`${fileUrl}/preview`, { headers: { Cookie: cookie } })).status, 400);
});

test('stripped admin routes require the same session and CSRF checks', async (t) => {
  const { base } = await fixture(t, { adminPasswordHash: await hashPassword('secret') });
  assert.equal((await fetch(`${base}/admin/stats`)).status, 401);
  const login = await fetch(`${base}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify({ password: 'secret' }),
  });
  assert.equal(login.status, 200);
  const { csrf } = await login.json();
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /Path=\/api\/admin/);
  assert.equal((await fetch(`${base}/admin/stats`, { headers: { Cookie: cookie } })).status, 200);
  assert.equal(
    (await fetch(`${base}/admin/cleanup`, { method: 'POST', headers: { Cookie: cookie } })).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${base}/admin/cleanup`, {
        method: 'POST',
        headers: { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: base },
      })
    ).status,
    200,
  );
});
