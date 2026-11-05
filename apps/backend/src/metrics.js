import { digest, equal, httpError } from './security.js';

export function recordUsage(store, kind, bytes, now = Date.now()) {
  store.db
    .prepare(
      `
    INSERT INTO usage_daily(day, uploads, uploadedBytes, downloads, downloadedBytes, lastActivityAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET
      uploads = uploads + excluded.uploads,
      uploadedBytes = uploadedBytes + excluded.uploadedBytes,
      downloads = downloads + excluded.downloads,
      downloadedBytes = downloadedBytes + excluded.downloadedBytes,
      lastActivityAt = max(lastActivityAt, excluded.lastActivityAt)
  `,
    )
    .run(
      new Date(now).toISOString().slice(0, 10),
      kind === 'upload' ? 1 : 0,
      kind === 'upload' ? bytes : 0,
      kind === 'download' ? 1 : 0,
      kind === 'download' ? bytes : 0,
      now,
    );
}

export function registerMetricsRoutes(app, store, config) {
  app.get('/api/metrics', (req, res) => {
    if (!config.metricsToken) throw httpError(404, 'Metrics are disabled.', 'metrics_disabled');
    const authorization = req.headers.authorization || '';
    if (
      !authorization.startsWith('Bearer ') ||
      !equal(digest(authorization.slice(7)), digest(config.metricsToken))
    )
      throw httpError(401, 'A valid metrics token is required.', 'metrics_unauthorized');
    const days = req.query.days === undefined ? 30 : Number(req.query.days);
    if (
      (req.query.days !== undefined && typeof req.query.days !== 'string') ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 366
    )
      throw httpError(400, 'days must be an integer from 1 to 366.', 'invalid_days');
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const start = new Date(`${today}T00:00:00Z`).getTime() - (days - 1) * 86400000;
    const rows = new Map(
      store.db
        .prepare('SELECT * FROM usage_daily WHERE day >= ? ORDER BY day')
        .all(new Date(start).toISOString().slice(0, 10))
        .map((row) => [row.day, row]),
    );
    const daily = Array.from({ length: days }, (_, i) => {
      const day = new Date(start + i * 86400000).toISOString().slice(0, 10);
      return (
        rows.get(day) || {
          day,
          uploads: 0,
          uploadedBytes: 0,
          downloads: 0,
          downloadedBytes: 0,
          lastActivityAt: null,
        }
      );
    });
    res.json({
      trackedSince: store.db.prepare('SELECT started_at FROM usage_tracking').get().started_at,
      generatedAt: now,
      timezone: 'UTC',
      current: store.db
        .prepare(
          "SELECT count(*) AS activeFiles, coalesce(sum(size), 0) AS storedBytes FROM files WHERE state = 'available' AND expires_at > ?",
        )
        .get(now),
      totals: store.db
        .prepare(
          'SELECT coalesce(sum(uploads), 0) AS uploads, coalesce(sum(uploadedBytes), 0) AS uploadedBytes, coalesce(sum(downloads), 0) AS downloads, coalesce(sum(downloadedBytes), 0) AS downloadedBytes, max(lastActivityAt) AS lastActivityAt FROM usage_daily',
        )
        .get(),
      daily,
    });
  });
}
