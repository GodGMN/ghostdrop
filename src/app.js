import express from 'express';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.js';
import { receiveUpload } from './upload.js';
import { httpError } from './security.js';

export function createApp(config) {
  const store = openStore(config.dataDir);
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    next();
  });
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.get('/api/config', (req, res) => res.json({ maxFileBytes: config.maxFileBytes }));
  app.use('/api', (req, res, next) => {
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if ((req.headers.origin && req.headers.origin !== config.origin) || req.headers['sec-fetch-site'] === 'cross-site') return next(httpError(403, 'Cross-site requests are not allowed.'));
    }
    next();
  });
  app.post('/api/uploads', async (req, res) => {
    const file = await receiveUpload(req, store, config);
    res.status(201).json(file);
  });
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
  });
  return { app, store, close: () => store.db.close() };
}
