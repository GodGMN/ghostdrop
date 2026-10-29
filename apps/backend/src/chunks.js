import { open, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, join } from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash, createHmac } from 'node:crypto';
import {
  token,
  digest,
  equal,
  hashPassword,
  verifyPassword,
  rateLimiter,
  httpError,
} from './security.js';
import { lifetimes, detectType } from './upload.js';
import {
  uploadSession,
  discardSession,
  recoverSession,
  SESSION_IDLE_MS,
} from './upload-sessions.js';

export const CHUNK_BYTES = 512 * 1024;
const validToken = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/.test(value);
const deletionToken = (secret, id) =>
  createHmac('sha256', secret).update(`ghostdrop-delete:${id}`).digest('base64url');
function authorizedSession(req, store) {
  const session = uploadSession(store, req.params.id);
  const secret = req.headers['x-upload-token'];
  if (!session || !validToken(secret) || !equal(digest(secret), session.token_hash))
    throw httpError(404, 'Upload session not found.', 'upload_session_not_found');
  if (session.state === 'cancelled' || session.updated_at <= Date.now() - SESSION_IDLE_MS)
    throw httpError(410, 'This upload session has expired. Start again.', 'upload_session_expired');
  return session;
}
function summary(session, secret) {
  return {
    id: session.id,
    size: session.size,
    offset: session.offset,
    chunkSize: CHUNK_BYTES,
    state: session.state,
    error: session.error,
    ...(session.state === 'complete'
      ? {
          file: {
            ...JSON.parse(session.receipt_json),
            deletionToken: deletionToken(secret, session.id),
          },
        }
      : {}),
  };
}
function operation(store, id, work) {
  if (store.uploadOperations.has(id))
    throw httpError(409, 'This upload is busy. Try again.', 'upload_busy');
  const controller = new AbortController();
  const entry = { controller, promise: null };
  store.uploadOperations.set(id, entry);
  store.activeUploads.add(id);
  entry.promise = (async () => {
    try {
      return await work(controller.signal);
    } finally {
      try {
        if (uploadSession(store, id)?.state === 'cancelled') await discardSession(store, id);
      } finally {
        store.activeUploads.delete(id);
        store.uploadOperations.delete(id);
      }
    }
  })();
  return entry.promise;
}
function readChunk(req, signal) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/octet-stream')
    throw httpError(415, 'Send raw file bytes.', 'send_raw_bytes');
  if (Number(req.headers['content-length']) > CHUNK_BYTES)
    throw httpError(413, 'The upload chunk is too large.', 'chunk_too_large');
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    function cleanup() {
      for (const [name, listener] of [
        ['data', data],
        ['end', end],
        ['error', fail],
        ['aborted', aborted],
      ])
        req.removeListener(name, listener);
      signal.removeEventListener('abort', cancel);
    }
    function fail(error) {
      cleanup();
      req.resume();
      reject(error);
    }
    function aborted() {
      fail(httpError(400, 'The chunk was interrupted. Retry it.', 'chunk_interrupted'));
    }
    function cancel() {
      fail(httpError(410, 'Upload cancelled.', 'upload_cancelled'));
      req.destroy();
    }
    function data(chunk) {
      size += chunk.length;
      if (size > CHUNK_BYTES)
        fail(httpError(413, 'The upload chunk is too large.', 'chunk_too_large'));
      else chunks.push(chunk);
    }
    function end() {
      cleanup();
      if (!size) reject(httpError(400, 'The chunk is empty.', 'chunk_empty'));
      else resolve(Buffer.concat(chunks, size));
    }
    req.on('data', data);
    req.once('end', end);
    req.once('error', fail);
    req.once('aborted', aborted);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
async function appendChunk(store, id, offset, body, signal) {
  const session = uploadSession(store, id);
  if (session.state !== 'uploading' || signal.aborted)
    throw httpError(409, 'This upload is not accepting chunks.', 'upload_not_accepting');
  if (offset > session.offset)
    throw httpError(409, 'The chunk offset is ahead of the upload.', 'chunk_offset_ahead');
  if (offset + body.length > session.size)
    throw httpError(413, 'The chunk exceeds the declared file size.', 'chunk_exceeds_size');
  const handle = await open(join(store.partialDir, id), 'r+');
  try {
    if (offset < session.offset) {
      if (offset + body.length > session.offset)
        throw httpError(409, 'The chunk overlaps unacknowledged bytes.', 'chunk_overlap');
      const existing = Buffer.alloc(body.length);
      let read = 0;
      while (read < existing.length) {
        const result = await handle.read(existing, read, existing.length - read, offset + read);
        if (!result.bytesRead) break;
        read += result.bytesRead;
      }
      if (read !== body.length || !existing.equals(body))
        throw httpError(
          409,
          'The retried chunk does not match the stored bytes.',
          'chunk_mismatch',
        );
      return session;
    }
    await handle.truncate(session.offset);
    let written = 0;
    while (written < body.length) {
      signal.throwIfAborted();
      const result = await handle.write(body, written, body.length - written, offset + written);
      if (!result.bytesWritten) throw new Error('No bytes written');
      written += result.bytesWritten;
    }
    await handle.sync();
    signal.throwIfAborted();
    store.db
      .prepare('UPDATE upload_sessions SET offset = ?, updated_at = ?, error = NULL WHERE id = ?')
      .run(offset + body.length, Date.now(), id);
    return uploadSession(store, id);
  } catch (err) {
    await handle.truncate(session.offset).catch(() => {});
    throw err;
  } finally {
    await handle.close();
  }
}
async function finalize(store, id, secret, signal) {
  const session = uploadSession(store, id),
    partial = join(store.partialDir, id);
  store.db
    .prepare(
      "UPDATE upload_sessions SET state = 'finalizing', error = NULL, updated_at = ? WHERE id = ?",
    )
    .run(Date.now(), id);
  try {
    const hash = createHash('sha256');
    await pipeline(
      createReadStream(partial),
      new Writable({
        write(chunk, encoding, callback) {
          hash.update(chunk);
          callback();
        },
      }),
      { signal },
    );
    const mime = await detectType(partial, session.name);
    signal.throwIfAborted();
    await store.storage.save(partial, session, signal);
    signal.throwIfAborted();
    const now = Date.now();
    const file = {
      id,
      name: session.name,
      mime,
      size: session.size,
      expiresAt: now + lifetimes[session.expiration],
      passwordProtected: !!session.password_hash,
      oneTime: !!session.one_time,
    };
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db
        .prepare(
          'INSERT INTO files(id,name,mime,size,sha256,created_at,expires_at,password_hash,delete_hash,one_time,storage_backend,storage_key,storage_bucket) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          file.name,
          mime,
          file.size,
          hash.digest('hex'),
          now,
          file.expiresAt,
          session.password_hash,
          digest(deletionToken(secret, id)),
          session.one_time,
          session.storage_backend,
          session.storage_key,
          session.storage_bucket,
        );
      store.db
        .prepare(
          "UPDATE upload_sessions SET state = 'complete', receipt_json = ?, updated_at = ? WHERE id = ?",
        )
        .run(JSON.stringify(file), now, id);
      store.db.exec('COMMIT');
    } catch (err) {
      store.db.exec('ROLLBACK');
      throw err;
    }
    await rm(partial, { force: true });
  } catch (err) {
    const current = uploadSession(store, id);
    if (current?.state === 'finalizing') {
      store.db.prepare('UPDATE upload_sessions SET error = ? WHERE id = ?').run('save_failed', id);
      await recoverSession(store, current);
    }
    if (!signal.aborted) console.error('Upload finalization failed:', err.message);
  }
}
// Stored files plus the declared size of every unfinished upload, so concurrent
// uploads cannot jointly overrun the limit.
function committedBytes(store) {
  return store.db
    .prepare(
      "SELECT (SELECT coalesce(sum(size), 0) FROM files) + (SELECT coalesce(sum(size), 0) FROM upload_sessions WHERE state IN ('uploading', 'finalizing')) AS bytes",
    )
    .get().bytes;
}
const storageFull = () =>
  httpError(507, 'This server is out of upload space. Try again later.', 'storage_full');
export function registerChunkRoutes(app, store, config) {
  const limit = rateLimiter(60);
  app.post('/api/uploads/sessions', async (req, res) => {
    limit(req.ip);
    const input = req.body || {};
    if (
      typeof input.name !== 'string' ||
      !input.name ||
      input.name.length > 255 ||
      !Number.isSafeInteger(input.size) ||
      input.size < 0
    )
      throw httpError(400, 'Choose a valid file.', 'invalid_file');
    if (input.size > config.maxFileBytes)
      throw httpError(413, 'This file exceeds the upload limit.', 'file_exceeds_limit');
    const expiration = input.expiration ?? 'month',
      password = input.password ?? '',
      oneTime = input.oneTime ?? false;
    if (
      !Object.hasOwn(lifetimes, expiration) ||
      typeof password !== 'string' ||
      password.length > 256 ||
      typeof oneTime !== 'boolean'
    )
      throw httpError(400, 'Invalid upload settings.', 'invalid_upload_settings');
    if (
      (input.id !== undefined || input.token !== undefined) &&
      (!validToken(input.id) || !validToken(input.token))
    )
      throw httpError(400, 'Invalid upload credentials.', 'invalid_upload_credentials');
    const id = input.id || token(),
      secret = input.token || token();
    const name =
      basename(input.name)
        .replace(/[\x00-\x1f\x7f]/g, '')
        .slice(0, 200) || 'file';
    const existing = uploadSession(store, id);
    if (existing) {
      if (!equal(existing.token_hash, digest(secret)))
        throw httpError(409, 'This upload ID is already in use.', 'upload_id_in_use');
      if (existing.updated_at <= Date.now() - SESSION_IDLE_MS || existing.state === 'cancelled')
        throw httpError(
          410,
          'This upload session has expired. Start again.',
          'upload_session_expired',
        );
      if (
        existing.name !== name ||
        existing.size !== input.size ||
        existing.expiration !== expiration ||
        !!existing.one_time !== oneTime ||
        (existing.password_hash
          ? !(await verifyPassword(password, existing.password_hash))
          : !!password)
      )
        throw httpError(
          409,
          'The upload settings have changed. Start a new upload.',
          'upload_settings_changed',
        );
      return res.json({ ...summary(existing, secret), token: secret });
    }
    if (store.db.prepare('SELECT id FROM files WHERE id = ?').get(id))
      throw httpError(409, 'This upload ID is already in use.', 'upload_id_in_use');
    if (store.db.prepare('SELECT count(*) AS count FROM upload_sessions').get().count >= 1000)
      throw httpError(503, 'Too many active uploads. Try again later.', 'too_many_uploads');
    if (config.maxTotalBytes && committedBytes(store) + input.size > config.maxTotalBytes)
      throw storageFull();
    await operation(store, id, async (signal) => {
      const passwordHash = password ? await hashPassword(password) : null;
      if (req.aborted || res.destroyed || signal.aborted)
        throw httpError(400, 'Upload cancelled.', 'upload_cancelled');
      const handle = await open(join(store.partialDir, id), 'wx', 0o600);
      await handle.close();
      if (req.aborted || res.destroyed || signal.aborted) {
        await rm(join(store.partialDir, id), { force: true });
        throw httpError(400, 'Upload cancelled.', 'upload_cancelled');
      }
      // Re-check synchronously before reserving: other sessions may have been
      // created while this one hashed its password.
      if (config.maxTotalBytes && committedBytes(store) + input.size > config.maxTotalBytes) {
        await rm(join(store.partialDir, id), { force: true });
        throw storageFull();
      }
      const now = Date.now();
      const destination = store.storage.destination(id);
      store.db
        .prepare(
          'INSERT INTO upload_sessions(id,token_hash,name,size,password_hash,expiration,one_time,created_at,updated_at,storage_backend,storage_key,storage_bucket) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .run(
          id,
          digest(secret),
          name,
          input.size,
          passwordHash,
          expiration,
          oneTime ? 1 : 0,
          now,
          now,
          destination.storage_backend,
          destination.storage_key,
          destination.storage_bucket,
        );
      res.status(201).json({ ...summary(uploadSession(store, id), secret), token: secret });
    });
  });
  app.get('/api/uploads/sessions/:id', (req, res) =>
    res.json(summary(authorizedSession(req, store), req.headers['x-upload-token'])),
  );
  app.put('/api/uploads/sessions/:id/chunks', async (req, res) => {
    const session = authorizedSession(req, store);
    if (!/^\d+$/.test(req.headers['x-upload-offset'] || ''))
      throw httpError(400, 'Provide a valid chunk offset.', 'missing_chunk_offset');
    const offset = Number(req.headers['x-upload-offset']);
    if (!Number.isSafeInteger(offset))
      throw httpError(400, 'Invalid chunk offset.', 'invalid_chunk_offset');
    await operation(store, session.id, async (signal) => {
      const body = await readChunk(req, signal);
      const updated = await appendChunk(store, session.id, offset, body, signal);
      res.json(summary(updated, req.headers['x-upload-token']));
    });
  });
  app.post('/api/uploads/sessions/:id/complete', (req, res) => {
    const session = authorizedSession(req, store),
      secret = req.headers['x-upload-token'];
    if (session.state === 'complete') return res.json(summary(session, secret));
    if (session.offset !== session.size)
      throw httpError(409, 'The upload is not complete yet.', 'upload_incomplete');
    if (!store.uploadOperations.has(session.id))
      operation(store, session.id, (signal) => finalize(store, session.id, secret, signal)).catch(
        (err) => console.error('Upload operation failed:', err.message),
      );
    res
      .status(202)
      .json({ state: 'finalizing', id: session.id, offset: session.offset, size: session.size });
  });
  app.delete('/api/uploads/sessions/:id', async (req, res) => {
    const session = authorizedSession(req, store);
    store.db.prepare("UPDATE upload_sessions SET state = 'cancelled' WHERE id = ?").run(session.id);
    const pending = store.uploadOperations.get(session.id);
    if (pending) {
      pending.controller.abort();
      return res.status(202).json({ cancelled: true });
    }
    await operation(store, session.id, () => discardSession(store, session.id));
    res.json({ cancelled: true });
  });
}
