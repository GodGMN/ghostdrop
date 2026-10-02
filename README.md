# Ghostdrop

Simple, temporary file sharing. A spiritual successor to Jirafeau, written from scratch.

## Development

Requires Node.js 24 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. `npm run dev` restarts the server after code changes. Use `npm start` without the watcher.

```sh
npm test
npm run check
```

`npm run format` formats the source. Node 24 currently prints an experimental warning for its built-in SQLite module.

## Sharing files

Select or drop one file. Selection and settings stay in the browser until you click **Upload file**. Set an optional access password, a one-time download rule, and an expiration of one hour, one day, one week, or 30 days. The default is 30 days.

After upload, copy the download page, direct download, or preview link. Preview is available for PNG, JPEG, GIF, WebP, and text files up to 1 MiB. Uploaded HTML and SVG are downloadable attachments, never application pages. Text previews show literal text.

Keep the separate deletion link private. Opening it shows a confirmation; clicking **Delete this file** removes the file and its sharing links. The deletion token is in the URL fragment and is not sent with the page request.

Passwords control access to the bytes, without encrypting them. They are stored as salted scrypt hashes. Successful verification grants the current browser 30 minutes of access to that file; direct links still require verification in another browser. File contents remain accessible to the server administrator.

One-time files are claimed atomically when a download is accepted. The stored file is unlinked before streaming from the open descriptor. Only the first concurrent request succeeds, and an interrupted accepted transfer still consumes the file. Metadata requests do not consume it; previews, HEAD downloads, and ranges are disabled. Range/resume downloads are currently unsupported for all files.

## Storage

SQLite metadata and uploaded files live in `DATA_DIR` (default `./data`), outside the public directory. Preserve this directory across restarts. The default upload limit is 100 MiB. Configure `MAX_FILE_BYTES` to change it.

Runewire tracks the MVP tasks. See [AGENTS.md](AGENTS.md) for the workflow. Personal MCP credentials and `.env` are gitignored.

Expiry blocks new access immediately. A cleanup loop physically removes expired files at startup and every minute, retries pending deletions, removes orphaned completed uploads, and removes inactive partial uploads older than one hour. An already-open download can finish after expiry. The process must be running for background cleanup to run.

Run a single application process against each data directory. In-memory upload tracking and sessions are intentionally scoped to that process. Admin and file-access sessions are invalidated on restart; uploaded files and password hashes persist. Back up metadata and file bytes together while the application is stopped. File deletion also removes the SQLite record, but does not erase copies in external backups or guarantee secure erasure on the underlying disk.

## Admin

Admin is disabled until a password hash is configured. Generate a hash with a hidden prompt:

```sh
node scripts/hash-password.js
```

Set the result as `ADMIN_PASSWORD_HASH` in `.env`, then restart and open `/admin`. Do not put the plaintext password in the configuration.

The panel lists files with size, content type, hash, creation and expiration dates, and access restrictions. Search by filename, full SHA-256, or share ID/link. It also shows disk usage, supports downloads and confirmed deletion, and runs cleanup for expired files and inactive partial uploads. Admin downloads bypass the file password but still consume one-time files. Uploader IP addresses are not stored.

## Configuration

| Variable              | Default                 | Purpose                                                |
| --------------------- | ----------------------- | ------------------------------------------------------ |
| `PORT`                | `3000`                  | HTTP port                                              |
| `HOST`                | `127.0.0.1`             | Listen address; use `0.0.0.0` for LAN/container access |
| `PUBLIC_ORIGIN`       | `http://localhost:3000` | Exact browser origin allowed for mutating requests     |
| `DATA_DIR`            | `./data`                | Private database and upload storage                    |
| `MAX_FILE_BYTES`      | `104857600`             | Maximum size of a single file, in bytes                |
| `ADMIN_PASSWORD_HASH` | Empty                   | Generated scrypt hash; empty disables admin            |
| `COOKIE_SECURE`       | `false`                 | Set `true` when serving through HTTPS                  |
| `CLEANUP_INTERVAL_MS` | `60000`                 | Background cleanup interval                            |

For deployment, run `npm ci --omit=dev` and `npm start`, mount persistent private storage, and put the service behind an HTTPS reverse proxy. Set `PUBLIC_ORIGIN` to the external HTTPS origin and `COOKIE_SECURE=true`. The proxy must allow the intended upload size and transfer duration. A mismatched origin is rejected. Do not serve `DATA_DIR` as static content.

Password attempt limits use the direct peer IP. Behind a reverse proxy, clients currently share the proxy's rate-limit bucket because forwarded IP headers are not trusted. Limit upload concurrency and total storage at the deployment boundary; this MVP has a per-file limit but no global disk quota. Uploads are public and are not scanned for malware.

## Manual verification

1. Select or drop a file and change settings. Confirm the browser Network panel has no upload request until **Upload file** is clicked.
2. Upload a text file. Copy each link, preview its literal contents, and download the original. Repeat with a supported image and an HTML file. HTML must download instead of executing.
3. Throttle the network, start an upload, cancel it, and retry. The selection should remain and interrupted partial bytes should be removed. Exceed the configured size limit and confirm a useful error.
4. Upload a password-protected file. Open every sharing link in a clean browser. File bytes must require the password; incorrect passwords must fail. A successful unlock in one browser must not unlock another.
5. Upload a one-time file and request the download twice concurrently. Exactly one succeeds. Confirm its bytes and database record are removed. Interrupt the accepted download and confirm it remains consumed.
6. Open a private deletion link. Confirm merely opening it does not delete the file. Confirm deletion, then check all sharing links become unavailable.
7. Set an expiration in the test database to the past. Confirm new access fails immediately, and background/admin cleanup removes physical bytes. Restart with a pending deletion and confirm recovery removes it.
8. Enable admin, log in, search by filename/hash/link, and verify storage totals. Delete a file with confirmation, run cleanup, and sign out. Unauthorized requests and mutations without CSRF tokens must fail.
9. Check the landing, settings, receipt, download, and admin pages on desktop and a narrow mobile viewport. Use keyboard navigation for file selection and controls.

The automated suite exercises storage persistence, upload validation/cleanup, password enforcement, one-time concurrency, physical deletion, expiry, safe previews, and admin authorization/search/cleanup using temporary data directories.
