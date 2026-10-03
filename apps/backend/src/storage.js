import { createReadStream, createWriteStream } from 'node:fs';
import { open, rename, rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  S3Client,
  HeadBucketCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { token, httpError } from './security.js';

const missing = (error) =>
  ['NoSuchKey', 'NotFound'].includes(error.name) || error.$metadata?.httpStatusCode === 404;
const storedRemotely = (record) => record.storage_backend === 's3';

export function createStorage(store, config) {
  const s3 = config.s3;
  const client =
    config.storageBackend === 's3'
      ? new S3Client({
          endpoint: s3.endpoint,
          region: s3.region,
          credentials: s3.credentials,
          forcePathStyle: s3.forcePathStyle,
          maxAttempts: 3,
          requestHandler: { connectionTimeout: 10_000, requestTimeout: 120_000 },
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        })
      : null;
  const prefix = s3 ? `${s3.prefix}files/` : null;
  function remote(record) {
    if (!client || record.storage_bucket !== s3.bucket || !record.storage_key)
      throw new Error('S3 storage configuration does not match stored files');
    return { Bucket: record.storage_bucket, Key: record.storage_key };
  }
  async function unversioned() {
    const result = await client.send(new GetBucketVersioningCommand({ Bucket: s3.bucket }));
    if (result.Status)
      throw new Error('Ghostdrop requires a private bucket with versioning never enabled');
  }
  async function namespaceOwner() {
    const scope = JSON.stringify([s3.endpoint || 'aws', s3.region, s3.bucket, s3.prefix]);
    let owner = store.db
      .prepare('SELECT owner FROM storage_namespaces WHERE scope = ?')
      .get(scope)?.owner;
    if (!owner) {
      owner = token();
      store.db.prepare('INSERT INTO storage_namespaces(scope,owner) VALUES(?,?)').run(scope, owner);
    }
    const params = { Bucket: s3.bucket, Key: `${s3.prefix}owner` };
    let remoteOwner;
    try {
      const result = await client.send(new GetObjectCommand(params));
      try {
        if (result.ContentLength !== 32) throw new Error('Invalid S3 namespace ownership marker');
        remoteOwner = await result.Body.transformToString();
      } finally {
        result.Body.destroy();
      }
    } catch (error) {
      if (!missing(error)) throw error;
      const existing = await client.send(
        new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, MaxKeys: 1 }),
      );
      if (existing.Contents?.length)
        throw new Error(
          'S3 prefix already contains files without an ownership marker; choose an unused prefix',
        );
      await client.send(
        new PutObjectCommand({
          ...params,
          Body: owner,
          ContentType: 'text/plain',
          IfNoneMatch: '*',
        }),
      );
      remoteOwner = owner;
    }
    if (owner !== remoteOwner)
      throw new Error(
        'S3 prefix belongs to a different Ghostdrop data volume; restore its DATA_DIR or choose an unused prefix',
      );
  }
  async function remove(record) {
    if (storedRemotely(record)) {
      const params = remote(record);
      await unversioned();
      await client.send(new DeleteObjectCommand(params));
    } else await rm(join(store.filesDir, record.id), { force: true });
  }
  async function openLocal(path) {
    const handle = await open(path, 'r');
    return {
      stream: handle.createReadStream({ autoClose: false }),
      close: async () => {
        await handle.close();
      },
    };
  }
  return {
    destination(id) {
      return {
        storage_backend: client ? 's3' : 'local',
        storage_key: client ? `${prefix}${id}` : null,
        storage_bucket: s3?.bucket || null,
      };
    },
    async init() {
      for (const table of ['files', 'upload_sessions']) {
        for (const record of store.db
          .prepare(`SELECT * FROM ${table} WHERE storage_backend = 's3'`)
          .all())
          remote(record);
      }
      if (client) {
        await client.send(new HeadBucketCommand({ Bucket: s3.bucket }));
        await unversioned();
        await namespaceOwner();
      }
      // Only one app process may own DATA_DIR. Remove transfer leftovers after a crash.
      for (const name of await readdir(store.downloadsDir))
        await rm(join(store.downloadsDir, name), { force: true });
    },
    async save(path, record, signal) {
      if (!storedRemotely(record)) return rename(path, join(store.filesDir, record.id));
      const params = remote(record);
      await unversioned();
      const size = (await stat(path)).size;
      const body = createReadStream(path);
      const controller = new AbortController();
      const upload = new Upload({
        client,
        params: {
          ...params,
          Body: body,
          ContentLength: size,
          ContentType: 'application/octet-stream',
        },
        queueSize: 1,
        partSize: Math.max(5 * 1024 * 1024, Math.ceil(size / 10_000)),
        leavePartsOnError: false,
        abortController: controller,
      });
      const abort = () => {
        controller.abort();
        body.destroy();
      };
      signal?.addEventListener('abort', abort, { once: true });
      try {
        signal?.throwIfAborted();
        await upload.done();
      } finally {
        signal?.removeEventListener('abort', abort);
        body.destroy();
      }
    },
    async open(record, signal) {
      try {
        if (!storedRemotely(record)) return await openLocal(join(store.filesDir, record.id));
        const result = await client.send(new GetObjectCommand(remote(record)), {
          abortSignal: signal,
        });
        if (!record.one_time)
          return {
            stream: result.Body,
            close: async () => {
              result.Body.destroy();
            },
          };
        // S3 has no unlinkable descriptor. Stage a one-time object before claiming it,
        // then delete the remote object before sending any bytes to the recipient.
        const name = token(),
          path = join(store.downloadsDir, name);
        store.activeDownloads.add(name);
        try {
          await pipeline(result.Body, createWriteStream(path, { flags: 'wx', mode: 0o600 }), {
            signal,
          });
          const handle = await openLocal(path);
          try {
            await rm(path, { force: true });
          } catch (error) {
            await handle.close();
            throw error;
          }
          return handle;
        } finally {
          result.Body.destroy();
          await rm(path, { force: true });
          store.activeDownloads.delete(name);
        }
      } catch (error) {
        if (error.code === 'ENOENT' || missing(error))
          throw httpError(404, 'This file is no longer available.');
        if (signal?.aborted) throw error;
        throw httpError(503, 'File storage is unavailable. Please try again.');
      }
    },
    remove,
    async cleanup() {
      if (!client) return 0;
      let removed = 0,
        continuation;
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: s3.bucket,
            Prefix: prefix,
            ContinuationToken: continuation,
          }),
        );
        for (const object of page.Contents || []) {
          const id = object.Key.slice(prefix.length);
          if (!/^[A-Za-z0-9_-]{32}$/.test(id) || store.activeUploads.has(id)) continue;
          if (
            store.db
              .prepare('SELECT id FROM files WHERE storage_backend = ? AND storage_key = ?')
              .get('s3', object.Key)
          )
            continue;
          if (
            store.db
              .prepare(
                'SELECT id FROM upload_sessions WHERE storage_backend = ? AND storage_key = ?',
              )
              .get('s3', object.Key)
          )
            continue;
          await remove({
            storage_backend: 's3',
            storage_bucket: s3.bucket,
            storage_key: object.Key,
          });
          removed++;
        }
        continuation = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuation);
      let keyMarker, uploadIdMarker;
      do {
        const page = await client.send(
          new ListMultipartUploadsCommand({
            Bucket: s3.bucket,
            Prefix: prefix,
            KeyMarker: keyMarker,
            UploadIdMarker: uploadIdMarker,
          }),
        );
        for (const upload of page.Uploads || []) {
          const id = upload.Key.slice(prefix.length);
          if (
            !/^[A-Za-z0-9_-]{32}$/.test(id) ||
            store.activeUploads.has(id) ||
            upload.Initiated > new Date(Date.now() - 60 * 60_000)
          )
            continue;
          await client.send(
            new AbortMultipartUploadCommand({
              Bucket: s3.bucket,
              Key: upload.Key,
              UploadId: upload.UploadId,
            }),
          );
        }
        keyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
        uploadIdMarker = page.IsTruncated ? page.NextUploadIdMarker : undefined;
      } while (keyMarker);
      return removed;
    },
    close() {
      client?.destroy();
    },
  };
}
