// Local development server. Production uses nginx and its Dockerfile.
import express from 'express';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

export function createFrontend(backendUrl) {
  const backend = new URL(backendUrl);
  if (!['http:', 'https:'].includes(backend.protocol) || backend.pathname !== '/')
    throw new Error('BACKEND_URL must be an HTTP(S) origin');
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
  app.get('/healthz', (req, res) => res.type('text').send('ok\n'));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const transport = backend.protocol === 'https:' ? https : http;
    const upstream = transport.request(
      new URL(req.originalUrl, backend),
      { method: req.method, headers: { ...req.headers, connection: 'close' } },
      (response) => {
        res.status(response.statusCode);
        for (const [name, value] of Object.entries(response.headers))
          if (value !== undefined && !['connection', 'transfer-encoding'].includes(name))
            res.setHeader(name, value);
        response.on('error', () => res.destroy());
        response.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (res.headersSent) res.destroy();
      else
        res.status(502).json({
          error: 'Backend is unavailable. Please try again.',
          code: 'backend_unavailable',
        });
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  });
  app.get('/f/:id/preview', (req, res) =>
    res.redirect(302, `/f/${encodeURIComponent(req.params.id)}`),
  );
  app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));
  app.get(['/f/:id', '/f/:id/direct', '/delete/:id', '/admin'], (req, res) =>
    res.sendFile(fileURLToPath(new URL('./public/index.html', import.meta.url))),
  );
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.FRONTEND_PORT || process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const app = createFrontend(process.env.BACKEND_URL || 'http://127.0.0.1:3001');
  const server = app.listen(port, host, () => {
    console.log(`Ghostdrop frontend is listening on http://${host}:${port}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => server.close(() => process.exit(0)));
}
