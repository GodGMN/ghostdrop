import { resolve } from 'node:path';

function integer(value, fallback, name, minimum = 1) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < minimum) throw new Error(`Invalid ${name}`);
  return result;
}

export function loadConfig(env = process.env) {
  const origin = new URL(env.PUBLIC_ORIGIN || 'http://localhost:3000');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
    throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin');
  }
  return {
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
