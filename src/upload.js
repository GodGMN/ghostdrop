import busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { rename, rm, open } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { token, digest, hashPassword, httpError } from './security.js';

export const lifetimes = {
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 30 * 86_400_000,
};
async function detectType(path, name) {
  const file = await open(path, 'r');
  const buffer = Buffer.alloc(16);
  try {
    await file.read(buffer, 0, 16, 0);
  } finally {
    await file.close();
  }
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return 'image/gif';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (/\.(txt|md|csv|log|json)$/i.test(name)) return 'text/plain';
  return 'application/octet-stream';
}

export async function receiveUpload(req, store, config, res) {
  const id = token(),
    deletionToken = token();
  const partial = join(store.partialDir, id);
  const final = join(store.filesDir, id);
  const fields = {};
  let filename,
    size = 0,
    writing,
    failure,
    aborted = false;
  const hash = createHash('sha256');
  const active = (store.activeUploads ||= new Set());
  let parser;
  try {
    parser = busboy({
      headers: req.headers,
      limits: { files: 1, fields: 3, parts: 5, fileSize: config.maxFileBytes + 1, fieldSize: 1024 },
    });
  } catch {
    throw httpError(400, 'Send a file using multipart form data.');
  }
  active.add(id);
  const onAbort = () => {
    aborted = true;
    parser.destroy(httpError(400, 'Upload cancelled.'));
  };
  req.once('aborted', onAbort);
  res?.once('close', onAbort);
  try {
    await new Promise((resolve, reject) => {
      parser.on('field', (name, value, info) => {
        if (
          !['password', 'expiration', 'oneTime'].includes(name) ||
          name in fields ||
          info.valueTruncated
        )
          failure = httpError(400, 'Invalid upload settings.');
        fields[name] = value;
      });
      parser.on('file', (field, stream, info) => {
        if (field !== 'file') {
          failure = httpError(400, 'Expected a single file.');
          stream.resume();
          return;
        }
        filename =
          basename(info.filename || 'file')
            .replace(/[\x00-\x1f\x7f]/g, '')
            .slice(0, 200) || 'file';
        stream.on('limit', () => {
          failure = httpError(413, 'This file exceeds the upload limit.');
        });
        const counter = new Transform({
          transform(chunk, encoding, callback) {
            size += chunk.length;
            hash.update(chunk);
            callback(null, chunk);
          },
        });
        writing = pipeline(
          stream,
          counter,
          createWriteStream(partial, { flags: 'wx', mode: 0o600 }),
        ).catch((err) => {
          failure ||= err;
        });
        parser.once('error', (err) => stream.destroy(err));
      });
      for (const event of ['filesLimit', 'fieldsLimit', 'partsLimit'])
        parser.on(event, () => {
          failure = httpError(400, 'Expected one file and valid settings.');
        });
      parser.once('error', reject);
      parser.once('close', resolve);
      req.pipe(parser);
    });
    await writing;
    if (size > config.maxFileBytes) failure = httpError(413, 'This file exceeds the upload limit.');
    if (failure) throw failure;
    if (aborted || !filename) throw httpError(400, 'Choose a file to upload.');
    const expiration = fields.expiration || 'month';
    const lifetime = Object.hasOwn(lifetimes, expiration) ? lifetimes[expiration] : undefined;
    if (
      !lifetime ||
      !['true', 'false', undefined].includes(fields.oneTime) ||
      (fields.password?.length || 0) > 256
    )
      throw httpError(400, 'Invalid upload settings.');
    const passwordHash = fields.password ? await hashPassword(fields.password) : null;
    if (req.aborted || aborted) throw httpError(400, 'Upload cancelled.');
    const mime = await detectType(partial, filename);
    const now = Date.now();
    await rename(partial, final);
    if (aborted) throw httpError(400, 'Upload cancelled.');
    store.db
      .prepare(
        'INSERT INTO files(id,name,mime,size,sha256,created_at,expires_at,password_hash,delete_hash,one_time) VALUES(?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        filename,
        mime,
        size,
        hash.digest('hex'),
        now,
        now + lifetime,
        passwordHash,
        digest(deletionToken),
        fields.oneTime === 'true' ? 1 : 0,
      );
    return {
      id,
      name: filename,
      mime,
      size,
      expiresAt: now + lifetime,
      passwordProtected: !!passwordHash,
      oneTime: fields.oneTime === 'true',
      deletionToken,
    };
  } catch (err) {
    parser.destroy();
    await writing;
    await Promise.all([rm(partial, { force: true }), rm(final, { force: true })]);
    if (!err.status) throw httpError(400, 'Upload could not be completed. Please try again.');
    throw err;
  } finally {
    req.removeListener('aborted', onAbort);
    res?.removeListener('close', onAbort);
    active.delete(id);
  }
}
