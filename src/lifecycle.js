import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { httpError } from './security.js';
import { cleanupSessions } from './upload-sessions.js';

export async function deleteFile(store, id) {
  // The state blocks new access even if unlink fails. Cleanup retries later.
  store.db.prepare("UPDATE files SET state = 'deleting' WHERE id = ?").run(id);
  const record = store.db.prepare('SELECT * FROM files WHERE id = ?').get(id);
  if (record) await store.storage.remove(record);
  store.db.prepare('DELETE FROM files WHERE id = ?').run(id);
}
export async function availableFile(store, id) {
  const record = store.db.prepare('SELECT * FROM files WHERE id = ?').get(id);
  if (!record || record.state !== 'available')
    throw httpError(404, 'This file is no longer available.');
  if (record.expires_at <= Date.now()) {
    await deleteFile(store, id);
    throw httpError(410, 'This file has expired and has been deleted.');
  }
  return record;
}
export async function cleanup(store) {
  let files = 0,
    partials = await cleanupSessions(store);
  const records = store.db
    .prepare("SELECT id FROM files WHERE expires_at <= ? OR state != 'available'")
    .all(Date.now());
  for (const record of records) {
    await deleteFile(store, record.id);
    files++;
  }
  for (const id of await readdir(store.partialDir)) {
    if (store.activeUploads?.has(id)) continue;
    if (store.db.prepare('SELECT id FROM upload_sessions WHERE id = ?').get(id)) continue;
    const path = join(store.partialDir, id);
    try {
      if ((await stat(path)).mtimeMs < Date.now() - 60 * 60_000) {
        await rm(path, { force: true });
        partials++;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  // A crash after the rename but before the INSERT can leave a private orphan.
  for (const id of await readdir(store.filesDir)) {
    if (store.activeUploads?.has(id)) continue;
    if (!store.db.prepare('SELECT id FROM files WHERE id = ?').get(id)) {
      await rm(join(store.filesDir, id), { force: true });
      files++;
    }
  }
  files += await store.storage.cleanup();
  return { files, partials };
}
