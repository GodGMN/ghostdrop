import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, upload } from './helpers.js';
import { hashPassword } from '../apps/backend/src/security.js';
import { loadConfig } from '../apps/backend/src/config.js';

const access = (base, headers = {}) =>
  fetch(`${base}/api/uploads/access`, { headers }).then((response) => response.json());
const unlock = (base, password) =>
  fetch(`${base}/api/uploads/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
const startSession = (base, headers = {}) =>
  fetch(`${base}/api/uploads/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ name: 'large.bin', size: 16 }),
  });

test('uploads stay open when no restriction is configured', async (t) => {
  const { base } = await fixture(t);
  assert.deepEqual(await access(base), { allowed: true, passwordRequired: false, unlocked: true });
  assert.equal((await upload(base)).status, 201);
});

test('the upload password protects every upload route but not downloads', async (t) => {
  const { base } = await fixture(t, { uploadPasswordHash: await hashPassword('let-me-in') });
  assert.deepEqual(await access(base), { allowed: true, passwordRequired: true, unlocked: false });
  assert.equal((await upload(base)).status, 401);
  assert.equal((await startSession(base)).status, 401);
  assert.equal(
    (await fetch(`${base}/api/uploads/sessions/x/chunks`, { method: 'PUT' })).status,
    401,
  );
  assert.equal((await unlock(base, 'wrong')).status, 401);

  const response = await unlock(base, 'let-me-in');
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Path=\/api\/uploads/);
  const Cookie = setCookie.split(';')[0];
  assert.equal((await access(base, { Cookie })).unlocked, true);
  assert.equal((await startSession(base, { Cookie })).status, 201);

  const uploaded = await upload(base, { headers: { Cookie } });
  assert.equal(uploaded.status, 201);
  const file = await uploaded.json();
  assert.equal((await fetch(`${base}/api/files/${file.id}/download`)).status, 200);
});

test('upload password attempts are rate limited', async (t) => {
  const { base } = await fixture(t, { uploadPasswordHash: await hashPassword('let-me-in') });
  for (let i = 0; i < 8; i++) assert.equal((await unlock(base, 'wrong')).status, 401);
  assert.equal((await unlock(base, 'let-me-in')).status, 429);
});

test('the IP allowlist rejects other clients, including the unlock endpoint', async (t) => {
  const { base } = await fixture(t, {
    uploadAllowedIps: ['10.0.0.0/8'],
    uploadPasswordHash: await hashPassword('let-me-in'),
  });
  assert.equal((await access(base)).allowed, false);
  assert.equal((await upload(base)).status, 403);
  assert.equal((await unlock(base, 'let-me-in')).status, 403);
});

test('an allowlisted client can upload without a password', async (t) => {
  const { base } = await fixture(t, { uploadAllowedIps: ['127.0.0.1', '::1'] });
  assert.equal((await access(base)).allowed, true);
  assert.equal((await upload(base)).status, 201);
});

test('forwarded client addresses are used only when the proxy is trusted', async (t) => {
  const forwarded = { 'X-Forwarded-For': '203.0.113.7' };
  const options = { uploadAllowedIps: ['203.0.113.0/24'] };
  const direct = await fixture(t, options);
  assert.equal((await access(direct.base, forwarded)).allowed, false);
  const proxied = await fixture(t, { ...options, trustProxy: 1 });
  assert.equal((await access(proxied.base, forwarded)).allowed, true);
  assert.equal((await access(proxied.base)).allowed, false);
});

test('configuration validates upload restrictions and proxy trust', () => {
  assert.throws(() => loadConfig({ UPLOAD_PASSWORD_HASH: 'plaintext' }));
  assert.throws(() => loadConfig({ UPLOAD_ALLOWED_IPS: '10.0.0.0/33' }));
  assert.throws(() => loadConfig({ UPLOAD_ALLOWED_IPS: 'example.com' }));
  assert.throws(() => loadConfig({ TRUST_PROXY: 'true' }));
  const config = loadConfig({
    UPLOAD_ALLOWED_IPS: ' 10.0.0.0/8, 2001:db8::/32 ',
    TRUST_PROXY: '1',
  });
  assert.deepEqual(config.uploadAllowedIps, ['10.0.0.0/8', '2001:db8::/32']);
  assert.equal(config.trustProxy, 1);
  assert.equal(loadConfig({}).trustProxy, false);
});
