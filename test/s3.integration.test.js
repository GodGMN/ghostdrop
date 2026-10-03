import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  S3Client,
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  PutBucketVersioningCommand,
  ListObjectVersionsCommand,
} from '@aws-sdk/client-s3';
import { fixture, upload } from './helpers.js';
import { init, chunk, complete, path, headers } from './chunk-helpers.js';
import { loadConfig } from '../apps/backend/src/config.js';
import { createApp } from '../apps/backend/src/app.js';
import { hashPassword, token } from '../apps/backend/src/security.js';

const enabled = !!process.env.TEST_S3_ENDPOINT;
const options = { skip: !enabled };
function settings(bucket) {
  return loadConfig({
    STORAGE_BACKEND: 's3',
    S3_BUCKET: bucket,
    S3_ENDPOINT: process.env.TEST_S3_ENDPOINT,
    S3_ACCESS_KEY_ID: process.env.TEST_S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.TEST_S3_SECRET_ACCESS_KEY,
    S3_REGION: process.env.TEST_S3_REGION || 'us-east-1',
  });
}
async function bucketFixture(t) {
  const bucket = `ghostdrop-test-${randomBytes(8).toString('hex')}`;
  const config = settings(bucket);
  const client = new S3Client(config.s3);
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  return {
    bucket,
    config,
    client,
    async clean() {
      const versions = await client.send(new ListObjectVersionsCommand({ Bucket: bucket }));
      for (const entry of [...(versions.Versions || []), ...(versions.DeleteMarkers || [])])
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: entry.Key, VersionId: entry.VersionId }),
        );
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
      client.destroy();
    },
  };
}
async function s3Fixture(t, overrides = {}) {
  const b = await bucketFixture(t);
  const { dataDir, ...settings } = b.config;
  const f = await fixture(t, { ...settings, ...overrides });
  t.after(() => b.clean());
  return { ...b, ...f, key: (id) => `ghostdrop/files/${id}` };
}
async function absent(client, bucket, key) {
  await assert.rejects(
    client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    (e) => e.$metadata?.httpStatusCode === 404,
  );
}

test(
  'S3 multipart finalization stores exact bytes remotely and leaves no local final copy',
  options,
  async (t) => {
    const { base, store, client, bucket, key } = await s3Fixture(t);
    const content = Buffer.alloc(6 * 1024 * 1024 + 19, 61);
    const session = await init(base, { name: 'multipart.bin', size: content.length });
    for (let offset = 0; offset < content.length; offset += 524288)
      assert.equal(
        (await chunk(base, session, offset, content.subarray(offset, offset + 524288))).status,
        200,
      );
    const file = await complete(base, session);
    await store.uploadOperations.get(session.id)?.promise;
    const record = store.db.prepare('SELECT * FROM files WHERE id = ?').get(file.id);
    assert.equal(record.storage_backend, 's3');
    assert.equal(record.storage_bucket, bucket);
    assert.equal(
      (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key(file.id) })))
        .ContentLength,
      content.length,
    );
    assert.equal(existsSync(join(store.filesDir, file.id)), false);
    assert.equal(existsSync(join(store.partialDir, file.id)), false);
    assert.deepEqual(
      Buffer.from(await (await fetch(`${base}/api/files/${file.id}/download`)).arrayBuffer()),
      content,
    );
    assert.equal((await complete(base, session)).deletionToken, file.deletionToken);
    assert.equal(
      (await fetch(path(base, session), { method: 'DELETE', headers: headers(session) })).status,
      200,
    );
    await absent(client, bucket, key(file.id));
  },
);

test(
  'S3 legacy upload, passwords, previews, deletion and admin bytes use the same storage',
  options,
  async (t) => {
    const adminPasswordHash = await hashPassword('admin-secret');
    const { base, client, bucket, key } = await s3Fixture(t, { adminPasswordHash });
    const file = await (await upload(base, { password: 'file-secret' })).json();
    const url = `${base}/api/files/${file.id}`;
    assert.equal((await fetch(`${url}/download`)).status, 401);
    const unlock = await fetch(`${url}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'file-secret' }),
    });
    const cookie = unlock.headers.get('set-cookie').split(';')[0];
    assert.equal(
      await (await fetch(`${url}/download`, { headers: { Cookie: cookie } })).text(),
      'hello from ghostdrop',
    );
    assert.equal((await fetch(`${url}/preview`, { headers: { Cookie: cookie } })).status, 400);
    const plain = await (await upload(base)).json();
    assert.equal(
      await (await fetch(`${base}/api/files/${plain.id}/preview`)).text(),
      'hello from ghostdrop',
    );
    const login = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin-secret' }),
    });
    const adminCookie = login.headers.get('set-cookie').split(';')[0];
    const stats = await (
      await fetch(`${base}/api/admin/stats`, { headers: { Cookie: adminCookie } })
    ).json();
    assert.equal(stats.storedBytes, Buffer.byteLength('hello from ghostdrop') * 2);
    assert.equal(
      (
        await fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'wrong' }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: file.deletionToken }),
        })
      ).status,
      200,
    );
    await absent(client, bucket, key(file.id));
  },
);

test(
  'S3 one-time claim deletes the object before response bytes and survives interruption',
  options,
  async (t) => {
    const { base, client, bucket, key, store } = await s3Fixture(t);
    const file = await (
      await upload(base, { oneTime: true, content: Buffer.alloc(2 * 1024 * 1024, 79) })
    ).json();
    const url = `${base}/api/files/${file.id}`;
    assert.equal((await fetch(`${url}/download`, { method: 'HEAD' })).status, 405);
    assert.equal((await fetch(`${url}/preview`)).status, 400);
    const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(`${url}/download`)));
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.equal(responses.filter((r) => r.status === 404).length, 3);
    await absent(client, bucket, key(file.id));
    const accepted = responses.find((r) => r.status === 200);
    await accepted.body.cancel();
    assert.equal((await fetch(url)).status, 404);
    assert.deepEqual(readdirSync(store.downloadsDir), []);
  },
);

test(
  'S3 expiration, orphan cleanup and failed deletion keep objects inaccessible',
  options,
  async (t) => {
    const { base, store, runCleanup, client, bucket, key } = await s3Fixture(t);
    const file = await (await upload(base)).json();
    store.db.prepare('UPDATE files SET expires_at = ? WHERE id = ?').run(Date.now() - 1, file.id);
    assert.equal((await fetch(`${base}/api/files/${file.id}`)).status, 410);
    await absent(client, bucket, key(file.id));
    const orphan = key(token());
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: orphan, Body: 'orphan' }));
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: 'unrelated/keep.txt', Body: 'keep' }),
    );
    await runCleanup();
    await absent(client, bucket, orphan);
    assert.equal(
      (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'unrelated/keep.txt' })))
        .ContentLength,
      4,
    );
    const single = await (await upload(base, { oneTime: true })).json();
    const remove = store.storage.remove;
    store.storage.remove = async () => {
      throw new Error('Simulated storage outage');
    };
    assert.equal((await fetch(`${base}/api/files/${single.id}/download`)).status, 500);
    assert.equal((await fetch(`${base}/api/files/${single.id}`)).status, 404);
    store.storage.remove = remove;
    await runCleanup();
    await absent(client, bucket, key(single.id));
  },
);

test(
  'S3 failed finalization is retryable, and pre-commit objects recover after restart',
  options,
  async (t) => {
    const { base, store, config, client, bucket, key, server, close } = await s3Fixture(t);
    const session = await init(base, { size: 16 });
    await chunk(base, session, 0, Buffer.alloc(16, 3));
    const save = store.storage.save;
    store.storage.save = async (...args) => {
      await save(...args);
      throw new Error('Simulated failed commit');
    };
    await fetch(`${path(base, session)}/complete`, { method: 'POST', headers: headers(session) });
    for (let i = 0; i < 100 && store.uploadOperations.has(session.id); i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      store.db.prepare('SELECT state FROM upload_sessions WHERE id = ?').get(session.id).state,
      'uploading',
    );
    await absent(client, bucket, key(session.id));
    store.storage.save = save;
    const file = await complete(base, session);
    assert.equal((await fetch(`${base}/api/files/${file.id}/download`)).status, 200);
    const incomplete = await init(base, { size: 16 });
    await chunk(base, incomplete, 0, Buffer.alloc(16, 4));
    store.db
      .prepare("UPDATE upload_sessions SET state = 'finalizing' WHERE id = ?")
      .run(incomplete.id);
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key(incomplete.id), Body: Buffer.alloc(16, 4) }),
    );
    await new Promise((resolve) => server.close(resolve));
    await close();
    const restarted = createApp(config);
    await restarted.ready;
    assert.equal(
      restarted.store.db
        .prepare('SELECT state FROM upload_sessions WHERE id = ?')
        .get(incomplete.id).state,
      'uploading',
    );
    await absent(client, bucket, key(incomplete.id));
    assert.equal(existsSync(join(store.partialDir, incomplete.id)), true);
    await restarted.close();
    const disabled = createApp({ ...loadConfig({}), dataDir: config.dataDir });
    await assert.rejects(disabled.ready, /configuration does not match/);
    await disabled.close();
  },
);

test(
  'S3 startup rejects versioned buckets and missing S3 configuration for remote records',
  options,
  async (t) => {
    const b = await bucketFixture(t);
    t.after(() => b.clean());
    await b.client.send(
      new PutBucketVersioningCommand({
        Bucket: b.bucket,
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    );
    const dataDir = mkdtempSync(join(tmpdir(), 'ghostdrop-s3-invalid-'));
    t.after(() => rmSync(dataDir, { recursive: true, force: true }));
    const runtime = createApp({ ...b.config, dataDir });
    await assert.rejects(runtime.ready, /versioning never enabled/);
    await runtime.close();
    await b.client.send(
      new PutBucketVersioningCommand({
        Bucket: b.bucket,
        VersioningConfiguration: { Status: 'Suspended' },
      }),
    );
    const suspended = createApp({ ...b.config, dataDir });
    await assert.rejects(suspended.ready, /versioning never enabled/);
    await suspended.close();
  },
);

test('S3 configuration rejects incomplete credentials and unsafe endpoint/prefix values', () => {
  const base = { STORAGE_BACKEND: 's3', S3_BUCKET: 'ghostdrop' };
  assert.throws(() => loadConfig({ ...base, S3_ACCESS_KEY_ID: 'only-one' }), /both/);
  assert.throws(
    () => loadConfig({ ...base, S3_ENDPOINT: 'https://user:pass@example.com' }),
    /origin/,
  );
  assert.throws(() => loadConfig({ ...base, S3_PREFIX: '../' }), /prefix|S3_PREFIX/);
  assert.throws(() => loadConfig({ ...base, STORAGE_BACKEND: 'unknown' }), /STORAGE_BACKEND/);
});

test('S3 zero-byte objects finalize and missing objects report unavailable', options, async (t) => {
  const { base, store, client, bucket, key } = await s3Fixture(t);
  const session = await init(base, { size: 0 });
  const file = await complete(base, session);
  assert.equal(
    (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key(file.id) }))).ContentLength,
    0,
  );
  const response = await fetch(`${base}/api/files/${file.id}/download`);
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key(file.id) }));
  assert.equal((await fetch(`${base}/api/files/${file.id}/download`)).status, 404);
  assert.equal(
    store.db.prepare('SELECT state FROM files WHERE id = ?').get(file.id).state,
    'available',
  );
});

test(
  'existing local files remain readable and new files use S3 after switching backend',
  options,
  async (t) => {
    const b = await bucketFixture(t);
    const dataDir = mkdtempSync(join(tmpdir(), 'ghostdrop-s3-switch-'));
    const local = await fixture(t, { ...loadConfig({}), dataDir });
    const file = await (await upload(local.base)).json();
    await new Promise((resolve) => local.server.close(resolve));
    await local.close();
    const migrated = createApp({ ...b.config, dataDir });
    await migrated.ready;
    t.after(async () => {
      await migrated.close();
      await b.clean();
      rmSync(dataDir, { recursive: true, force: true });
    });
    const record = migrated.store.db.prepare('SELECT * FROM files WHERE id = ?').get(file.id);
    assert.equal(record.storage_backend, 'local');
    const opened = await migrated.store.storage.open(record);
    let text = '';
    for await (const chunk of opened.stream) text += chunk.toString();
    await opened.close();
    assert.equal(text, 'hello from ghostdrop');
    assert.equal(migrated.store.storage.destination(token()).storage_backend, 's3');
  },
);

test(
  'cancelling S3 finalization removes the uploaded object and local staging',
  options,
  async (t) => {
    const { base, store, client, bucket, key } = await s3Fixture(t);
    const session = await init(base, { size: 16 });
    await chunk(base, session, 0, Buffer.alloc(16, 7));
    const save = store.storage.save;
    let uploaded = false;
    store.storage.save = async (file, record, signal) => {
      await save(file, record, signal);
      uploaded = true;
      await new Promise((resolve) => {
        signal.addEventListener('abort', resolve, { once: true });
        if (signal.aborted) resolve();
      });
      signal.throwIfAborted();
    };
    await fetch(`${path(base, session)}/complete`, { method: 'POST', headers: headers(session) });
    for (let i = 0; i < 100 && !uploaded; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(uploaded, true);
    assert.equal(
      (await fetch(path(base, session), { method: 'DELETE', headers: headers(session) })).status,
      202,
    );
    await store.uploadOperations.get(session.id)?.promise;
    assert.equal((await fetch(path(base, session), { headers: headers(session) })).status, 404);
    await absent(client, bucket, key(session.id));
    assert.equal(existsSync(join(store.partialDir, session.id)), false);
  },
);

test(
  'S3 namespace ownership refuses a fresh data volume and preserves existing objects',
  options,
  async (t) => {
    const { base, client, bucket, key, config } = await s3Fixture(t);
    const file = await (await upload(base)).json();
    const dataDir = mkdtempSync(join(tmpdir(), 'ghostdrop-s3-owner-'));
    const other = createApp({ ...config, dataDir });
    try {
      await assert.rejects(other.ready, /different Ghostdrop data volume/);
    } finally {
      await other.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
    assert.equal(
      (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key(file.id) })))
        .ContentLength,
      20,
    );
  },
);
