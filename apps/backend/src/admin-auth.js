import { token, equal, verifyPassword, rateLimiter, cookies, httpError } from './security.js';

export function registerAdminAuth(app, config) {
  const sessions = new Map();
  const limit = rateLimiter();
  function session(req) {
    const value = cookies(req).gd_admin;
    const result = sessions.get(value);
    if (result?.expires > Date.now()) return result;
    sessions.delete(value);
    return undefined;
  }
  function requireAdmin(req, res, next) {
    if (!config.adminPasswordHash)
      return next(
        httpError(
          503,
          'Admin access is disabled. Configure an admin password hash first.',
          'admin_disabled',
        ),
      );
    const current = session(req);
    if (!current) return next(httpError(401, 'Sign in to continue.', 'sign_in_required'));
    if (
      !['GET', 'HEAD'].includes(req.method) &&
      !equal(req.headers['x-csrf-token'] || '', current.csrf)
    )
      return next(
        httpError(
          403,
          'Your session could not authorize this request. Refresh and try again.',
          'session_invalid',
        ),
      );
    req.adminSession = current;
    next();
  }
  app.post('/api/admin/login', async (req, res) => {
    if (!config.adminPasswordHash)
      throw httpError(
        503,
        'Admin access is disabled. Configure an admin password hash first.',
        'admin_disabled',
      );
    limit(req.ip);
    if (
      typeof req.body?.password !== 'string' ||
      req.body.password.length > 256 ||
      !(await verifyPassword(req.body.password, config.adminPasswordHash))
    )
      throw httpError(401, 'That password is incorrect.', 'incorrect_password');
    for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
    if (sessions.size >= 1000) throw httpError(503, 'Please try again later.', 'try_again_later');
    const value = token(),
      csrf = token();
    sessions.set(value, { csrf, expires: Date.now() + 8 * 60 * 60_000 });
    res.cookie('gd_admin', value, {
      httpOnly: true,
      sameSite: 'strict',
      secure: config.cookieSecure,
      path: '/api/admin',
      maxAge: 8 * 60 * 60_000,
    });
    res.json({ csrf });
  });
  app.get('/api/admin/session', requireAdmin, (req, res) =>
    res.json({ csrf: req.adminSession.csrf }),
  );
  app.post('/api/admin/logout', requireAdmin, (req, res) => {
    sessions.delete(cookies(req).gd_admin);
    res.clearCookie('gd_admin', {
      path: '/api/admin',
      httpOnly: true,
      sameSite: 'strict',
      secure: config.cookieSecure,
    });
    res.json({ loggedOut: true });
  });
  return requireAdmin;
}
