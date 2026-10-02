import { resolve } from 'node:path';

function integer(value, fallback, name, minimum = 1) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < minimum) throw new Error(`Invalid ${name}`);
  return result;
}

export function loadConfig(env = process.env) {
  const storageBackend = env.STORAGE_BACKEND || 'local';
  if (!['local', 's3'].includes(storageBackend)) throw new Error('Invalid STORAGE_BACKEND');
  let s3;
  if (storageBackend === 's3') {
    if (!env.S3_BUCKET || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.S3_BUCKET))
      throw new Error('Set a valid S3_BUCKET');
    if (!!env.S3_ACCESS_KEY_ID !== !!env.S3_SECRET_ACCESS_KEY)
      throw new Error('Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
    if (env.S3_ENDPOINT) {
      const endpoint = new URL(env.S3_ENDPOINT);
      if (
        !['http:', 'https:'].includes(endpoint.protocol) ||
        endpoint.username ||
        endpoint.password ||
        endpoint.search ||
        endpoint.hash ||
        endpoint.pathname !== '/'
      )
        throw new Error('S3_ENDPOINT must be an HTTP(S) origin');
    }
    const prefix = env.S3_PREFIX || 'ghostdrop/';
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/$/.test(prefix))
      throw new Error('S3_PREFIX must be a nonempty path ending in /');
    if (env.S3_FORCE_PATH_STYLE && !['true', 'false'].includes(env.S3_FORCE_PATH_STYLE))
      throw new Error('Invalid S3_FORCE_PATH_STYLE');
    s3 = {
      bucket: env.S3_BUCKET,
      endpoint: env.S3_ENDPOINT || undefined,
      region: env.S3_REGION || 'us-east-1',
      prefix,
      forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            ...(env.S3_SESSION_TOKEN ? { sessionToken: env.S3_SESSION_TOKEN } : {}),
          }
        : undefined,
    };
  }
  if (
    env.ADMIN_PASSWORD_HASH &&
    !/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(env.ADMIN_PASSWORD_HASH)
  )
    throw new Error('Invalid ADMIN_PASSWORD_HASH. Generate it with scripts/hash-password.js');
  const origin = new URL(env.PUBLIC_ORIGIN || 'http://localhost:3000');
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin');
  }
  return {
    storageBackend,
    s3,
    port: integer(env.PORT, 3000, 'PORT', 0),
    host: env.HOST || '127.0.0.1',
    dataDir: resolve(env.DATA_DIR || './data'),
    maxFileBytes: integer(env.MAX_FILE_BYTES, 100 * 1024 * 1024, 'MAX_FILE_BYTES'),
    origin: origin.origin,
    adminPasswordHash: env.ADMIN_PASSWORD_HASH || '',
    cookieSecure: env.COOKIE_SECURE === 'true',
    cleanupIntervalMs: integer(env.CLEANUP_INTERVAL_MS, 60_000, 'CLEANUP_INTERVAL_MS'),
  };
}
