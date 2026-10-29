import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { publicFile, serveFile } from './files.js';
import { availableFile, deleteFile } from './lifecycle.js';
import { httpError } from './security.js';

function pagination(value, fallback, max) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > max)
    throw httpError(400, 'Invalid pagination.', 'invalid_pagination');
  return number;
}
export function registerAdminRoutes(app, store, requireAdmin, runCleanup) {
  app.get('/api/admin/files', requireAdmin, (req, res) => {
    const limit = pagination(req.query.limit, 25, 100);
    const offset = pagination(req.query.offset, 0, Number.MAX_SAFE_INTEGER);
    if (!limit) throw httpError(400, 'Invalid pagination.', 'invalid_pagination');
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 500) throw httpError(400, 'The search is too long.', 'search_too_long');
    const by = req.query.by || 'name';
    let where = '1 = 1',
      values = [];
    if (search) {
      if (by === 'name') {
        where = "name LIKE ? ESCAPE '\\'";
        values = [`%${search.replace(/[\\%_]/g, (c) => '\\' + c)}%`];
      } else if (by === 'hash') {
        if (!/^[a-f0-9]{64}$/i.test(search))
          throw httpError(400, 'Enter a complete SHA-256 hash.', 'invalid_hash');
        where = 'sha256 = ?';
        values = [search.toLowerCase()];
      } else if (by === 'link') {
        let id = search;
        try {
          const url = new URL(search);
          id = url.pathname.split('/')[2];
        } catch {}
        if (!/^[A-Za-z0-9_-]{32}$/.test(id))
          throw httpError(
            400,
            'Enter a share ID or a Ghostdrop file link.',
            'invalid_file_reference',
          );
        where = 'id = ?';
        values = [id];
      } else throw httpError(400, 'Choose a valid search type.', 'invalid_search_type');
    }
    const records = store.db
      .prepare(
        `SELECT * FROM files WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      )
      .all(...values, limit, offset);
    const total = store.db
      .prepare(`SELECT count(*) AS total FROM files WHERE ${where}`)
      .get(...values).total;
    res.json({
      items: records.map((record) => ({
        ...publicFile(record),
        sha256: record.sha256,
        createdAt: record.created_at,
        state: record.expires_at <= Date.now() ? 'expired' : record.state,
      })),
      total,
      offset,
      limit,
    });
  });
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const count = store.db.prepare('SELECT count(*) AS count FROM files').get().count;
    async function diskBytes(directory) {
      let bytes = 0;
      for (const name of await readdir(directory))
        try {
          bytes += (await stat(join(directory, name))).size;
        } catch (err) {
          if (err.code !== 'ENOENT') throw err;
        }
      return bytes;
    }
    res.json({
      count,
      storedBytes:
        (await diskBytes(store.filesDir)) +
        store.db
          .prepare("SELECT coalesce(sum(size), 0) AS bytes FROM files WHERE storage_backend = 's3'")
          .get().bytes,
      partialBytes: await diskBytes(store.partialDir),
    });
  });
  app.all('/api/admin/files/:id/download', requireAdmin, async (req, res) => {
    const file = await availableFile(store, req.params.id);
    await serveFile(req, res, file, store);
  });
  app.delete('/api/admin/files/:id', requireAdmin, async (req, res) => {
    if (!store.db.prepare('SELECT id FROM files WHERE id = ?').get(req.params.id))
      throw httpError(404, 'This file is no longer available.', 'file_unavailable');
    await deleteFile(store, req.params.id);
    res.json({ deleted: true });
  });
  app.post('/api/admin/cleanup', requireAdmin, async (req, res) => res.json(await runCleanup()));
}
