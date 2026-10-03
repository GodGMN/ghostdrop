import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openStore(dataDir) {
  for (const dir of [
    dataDir,
    join(dataDir, 'files'),
    join(dataDir, 'partial'),
    join(dataDir, 'downloads'),
  ]) {
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
    CREATE TABLE IF NOT EXISTS upload_sessions (
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      offset INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT,
      expiration TEXT NOT NULL,
      one_time INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'uploading',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      receipt_json TEXT,
      error TEXT
    ) STRICT;
    CREATE INDEX IF NOT EXISTS uploads_updated ON upload_sessions(updated_at);
    CREATE TABLE IF NOT EXISTS storage_namespaces (
      scope TEXT PRIMARY KEY,
      owner TEXT NOT NULL
    ) STRICT;
  `);
  for (const table of ['files', 'upload_sessions']) {
    const columns = new Set(
      db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .map((c) => c.name),
    );
    for (const [name, definition] of [
      ['storage_backend', "TEXT NOT NULL DEFAULT 'local'"],
      ['storage_key', 'TEXT'],
      ['storage_bucket', 'TEXT'],
    ])
      if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
  return {
    db,
    dataDir,
    filesDir: join(dataDir, 'files'),
    partialDir: join(dataDir, 'partial'),
    downloadsDir: join(dataDir, 'downloads'),
    activeDownloads: new Set(),
    activeUploads: new Set(),
    uploadOperations: new Map(),
  };
}
