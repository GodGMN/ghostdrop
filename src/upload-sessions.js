import { open, rm, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const SESSION_IDLE_MS = 60 * 60_000;
export const uploadSession = (store, id) =>
  store.db.prepare('SELECT * FROM upload_sessions WHERE id = ?').get(id);
export async function discardSession(store, id) {
  store.db.prepare("UPDATE upload_sessions SET state = 'cancelled' WHERE id = ?").run(id);
  store.db.prepare("UPDATE files SET state = 'deleting' WHERE id = ?").run(id);
  const record =
    store.db.prepare('SELECT * FROM files WHERE id = ?').get(id) || uploadSession(store, id);
  if (record) await store.storage.remove(record);
  await Promise.all([
    rm(join(store.partialDir, id), { force: true }),
    rm(join(store.filesDir, id), { force: true }),
  ]);
  store.db.prepare('DELETE FROM files WHERE id = ?').run(id);
  store.db.prepare('DELETE FROM upload_sessions WHERE id = ?').run(id);
}
export async function recoverSession(store, session) {
  const partial = join(store.partialDir, session.id),
    final = join(store.filesDir, session.id);
  const exists = async (path) =>
    stat(path).catch((err) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });
  if (session.storage_backend === 's3') {
    if (session.state === 'finalizing') await store.storage.remove(session);
  } else if (!(await exists(partial)) && (await exists(final))) await rename(final, partial);
  const handle = await open(partial, (await exists(partial)) ? 'r+' : 'wx', 0o600);
  try {
    const size = (await handle.stat()).size;
    const offset = Math.min(size, session.offset);
    if (size !== offset) {
      await handle.truncate(offset);
      await handle.sync();
    }
    store.db
      .prepare("UPDATE upload_sessions SET offset = ?, state = 'uploading' WHERE id = ?")
      .run(offset, session.id);
  } finally {
    await handle.close();
  }
}
export async function recoverSessions(store) {
  for (const session of store.db
    .prepare("SELECT id FROM upload_sessions WHERE state = 'complete'")
    .all())
    await rm(join(store.partialDir, session.id), { force: true });
  for (const session of store.db
    .prepare("SELECT * FROM upload_sessions WHERE state IN ('uploading','finalizing')")
    .all())
    await recoverSession(store, session);
}
export async function cleanupSessions(store) {
  let partials = 0;
  for (const session of store.db
    .prepare("SELECT * FROM upload_sessions WHERE updated_at <= ? OR state = 'cancelled'")
    .all(Date.now() - SESSION_IDLE_MS)) {
    if (store.activeUploads.has(session.id)) continue;
    if (session.state === 'complete') {
      await rm(join(store.partialDir, session.id), { force: true });
      store.db.prepare('DELETE FROM upload_sessions WHERE id = ?').run(session.id);
    } else {
      await discardSession(store, session.id);
      partials++;
    }
  }
  return partials;
}
