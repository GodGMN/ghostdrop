import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const token = () => randomBytes(24).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function equal(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
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
export function httpError(status, message) { return Object.assign(new Error(message), { status }); }
