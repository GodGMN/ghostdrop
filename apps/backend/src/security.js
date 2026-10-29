import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(24).toString('base64url');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export function equal(a, b) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash || !/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(stored)) return false;
  return equal((await scrypt(password, salt, 64)).toString('hex'), hash);
}
// `code` is a stable machine-readable identifier so clients can localize errors
// without depending on the English message. See apps/frontend/public/i18n.js.
export function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

export function rateLimiter(limit = 8, windowMs = 15 * 60_000) {
  const buckets = new Map();
  return (key) => {
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 5000)
        throw httpError(429, 'Too many requests. Please try again later.', 'rate_limited');
      bucket = { count: 0, until: now + windowMs };
      buckets.set(key, bucket);
    }
    if (++bucket.count > limit)
      throw httpError(
        429,
        'Too many attempts. Please try again in 15 minutes.',
        'too_many_attempts',
      );
  };
}
export function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '').split(';').map((part) => {
      const index = part.indexOf('=');
      return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }),
  );
}
