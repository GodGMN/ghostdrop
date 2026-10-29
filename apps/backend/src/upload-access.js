import { BlockList, isIP } from 'node:net';
import { token, verifyPassword, rateLimiter, cookies, httpError } from './security.js';

const SESSION_MS = 12 * 60 * 60_000;
const cookieOptions = (config) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: config.cookieSecure,
  path: '/api/uploads',
});

export function createUploadAccess(config) {
  const allowed = new BlockList();
  for (const entry of config.uploadAllowedIps) {
    const [address, prefix] = entry.split('/');
    const type = isIP(address) === 4 ? 'ipv4' : 'ipv6';
    if (prefix === undefined) allowed.addAddress(address, type);
    else allowed.addSubnet(address, Number(prefix), type);
  }
  const sessions = new Map();
  const limit = rateLimiter();
  function ipAllowed(req) {
    if (!config.uploadAllowedIps.length) return true;
    // Dual-stack sockets report IPv4 clients as IPv4-mapped IPv6 addresses.
    const ip = (req.ip || '').replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, '');
    const type = isIP(ip) === 4 ? 'ipv4' : 'ipv6';
    return !!isIP(ip) && allowed.check(ip, type);
  }
  function unlocked(req) {
    if (!config.uploadPasswordHash) return true;
    const value = cookies(req).gd_upload;
    if (sessions.get(value) > Date.now()) return true;
    sessions.delete(value);
    return false;
  }
  const state = (req) => ({
    allowed: ipAllowed(req),
    passwordRequired: !!config.uploadPasswordHash,
    unlocked: unlocked(req),
  });
  function guard(req, res, next) {
    if (req.path === '/access') return next();
    if (!ipAllowed(req))
      return next(httpError(403, 'Uploads are restricted on this server.', 'uploads_restricted'));
    if (!unlocked(req))
      return next(
        httpError(401, 'Enter the upload password to continue.', 'upload_password_required'),
      );
    next();
  }
  function register(app) {
    app.get('/api/uploads/access', (req, res) => res.json(state(req)));
    app.post('/api/uploads/access', async (req, res) => {
      if (!ipAllowed(req))
        throw httpError(403, 'Uploads are restricted on this server.', 'uploads_restricted');
      if (!config.uploadPasswordHash) return res.json(state(req));
      limit(req.ip);
      if (
        typeof req.body?.password !== 'string' ||
        req.body.password.length > 256 ||
        !(await verifyPassword(req.body.password, config.uploadPasswordHash))
      )
        throw httpError(401, 'That password is incorrect.', 'incorrect_password');
      for (const [key, expires] of sessions) if (expires <= Date.now()) sessions.delete(key);
      if (sessions.size >= 5000) throw httpError(503, 'Please try again later.', 'try_again_later');
      const value = token();
      sessions.set(value, Date.now() + SESSION_MS);
      res.cookie('gd_upload', value, { ...cookieOptions(config), maxAge: SESSION_MS });
      res.json({ allowed: true, passwordRequired: true, unlocked: true });
    });
  }
  return { guard, register };
}
