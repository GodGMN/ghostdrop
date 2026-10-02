import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openStore(dataDir) {
  for (const dir of [dataDir, join(dataDir, 'files'), join(dataDir, 'partial')]) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
  }
  const db = new DatabaseSync(join(dataDir, 'metadata.sqlite'), { timeout: 5000 });
  chmodSync(join(dataDir, 'metadata.sqlite'), 0o600);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      password_hash TEXT,
      delete_hash TEXT NOT NULL,
      one_time INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'available'
    ) STRICT;
    CREATE INDEX IF NOT EXISTS files_expiry ON files(expires_at);
    CREATE INDEX IF NOT EXISTS files_hash ON files(sha256);
  `);
  return { db, dataDir, filesDir: join(dataDir, 'files'), partialDir: join(dataDir, 'partial') };
}
