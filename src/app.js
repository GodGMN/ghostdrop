import express from 'express';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { receiveUpload } from './upload.js';
import { httpError } from './security.js';
import { registerFileRoutes } from './files.js';
import { cleanup } from './lifecycle.js';
import { registerAdminAuth } from './admin-auth.js';
import { registerAdminRoutes } from './admin.js';
import { registerChunkRoutes, CHUNK_BYTES } from './chunks.js';
import { recoverSessions } from './upload-sessions.js';

export function createApp(config) {
  const store = openStore(config.dataDir);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/config', (req, res) =>
    res.json({ maxFileBytes: config.maxFileBytes, chunkSize: CHUNK_BYTES }),
  );
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        (req.headers.origin && req.headers.origin !== config.origin) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        return next(httpError(403, 'Cross-site requests are not allowed.'));
    }
    next();
  });
  app.post('/api/uploads', async (req, res) => {
    const file = await receiveUpload(req, store, config, res);
    res.status(201).json(file);
  });
  app.use(express.json({ limit: '8kb' }));
  registerChunkRoutes(app, store, config);
  registerFileRoutes(app, store, config);
  const requireAdmin = registerAdminAuth(app, config);
  let cleaning;
  const runCleanup = () =>
    (cleaning ||= cleanup(store).finally(() => {
      cleaning = undefined;
    }));
  const cleanupTimer = setInterval(
    () => runCleanup().catch((err) => console.error('Cleanup failed:', err.message)),
    config.cleanupIntervalMs,
  );
  cleanupTimer.unref();
  const ready = recoverSessions(store).then(() => runCleanup());
  ready.catch((err) => console.error('Startup cleanup failed:', err.message));
  registerAdminRoutes(app, store, requireAdmin, runCleanup);
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.get('/f/:id/preview', (req, res) =>
    res.redirect(302, `/f/${encodeURIComponent(req.params.id)}`),
  );
  app.get(['/f/:id', '/f/:id/direct', '/delete/:id', '/admin'], (req, res) =>
    res.sendFile(fileURLToPath(new URL('../public/index.html', import.meta.url))),
  );
  app.use((err, req, res, next) => {
    req.resume();
    if (res.destroyed) return;
    if (res.headersSent) return next(err);
    res
      .status(err.status || 500)
      .json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
  });
  return {
    app,
    store,
    ready,
    runCleanup,
    requireAdmin,
    close: async () => {
      clearInterval(cleanupTimer);
      for (const operation of store.uploadOperations.values()) operation.controller.abort();
      await Promise.allSettled(
        [...store.uploadOperations.values()].map((operation) => operation.promise),
      );
      await cleaning?.catch(() => {});
      store.db.close();
    },
  };
}
