# Ghostdrop

Simple, temporary file sharing. A spiritual successor to Jirafeau, written from scratch.

## Development

Requires Node.js 24 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. `npm run dev` restarts the server after code changes. Use `npm start` without the watcher. For LAN access, set `HOST=0.0.0.0` and `PUBLIC_ORIGIN` to the exact URL you open in the browser.

```sh
npm test
npm run check
```

`npm run format` formats the source. Node 24 currently prints an experimental warning for its built-in SQLite module.

## Sharing files

Select or drop one file. Selection and settings stay in the browser until you click **Upload file**. Set an optional access password, a one-time download rule, and an expiration of one hour, one day, one week, or 30 days. The default is 30 days.

Images show a local thumbnail on selection. Other files show an icon for their type; unknown types show a page with a short extension label.

After upload, copy the sharing page or direct download link. The sharing page automatically previews PNG, JPEG, GIF, WebP, and text files up to 1 MiB. Password-protected and one-time files have no preview. Uploaded HTML and SVG are downloadable attachments, never application pages. Text previews show literal text. Old preview-page URLs redirect to the sharing page.

Keep the separate deletion link private. Opening it shows a confirmation; clicking **Delete this file** removes the file and its sharing links. The deletion token is in the URL fragment and is not sent with the page request.

Passwords control access to the bytes, without encrypting them. They are stored as salted scrypt hashes. Successful verification grants the current browser 30 minutes of access to that file; direct links still require verification in another browser. File contents remain accessible to the server administrator.

One-time files are claimed atomically when a download is accepted. The stored file is unlinked before streaming from the open descriptor. Only the first concurrent request succeeds, and an interrupted accepted transfer still consumes the file. Metadata requests do not consume it; previews, HEAD downloads, and ranges are disabled. Range/resume downloads are currently unsupported for all files.

## Storage

SQLite metadata and uploaded files live in `DATA_DIR` (default `./data`), outside the public directory. Preserve this directory across restarts. The default upload limit is 100 MiB. Configure `MAX_FILE_BYTES` to change it.

Runewire tracks the MVP tasks. See [AGENTS.md](AGENTS.md) for the workflow. Personal MCP credentials and `.env` are gitignored.

Expiry blocks new access immediately. A cleanup loop physically removes expired files at startup and every minute, retries pending deletions, removes orphaned completed uploads, and expires upload sessions after one hour without an acknowledged chunk. Expiring a completed session only removes its cached receipt; the shared file keeps its own expiration. An already-open download can finish after expiry. The process must be running for background cleanup to run.

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

For deployment, run `npm ci --omit=dev` and `npm start`, mount persistent private storage, and put the service behind an HTTPS reverse proxy. Set `PUBLIC_ORIGIN` to the external HTTPS origin and `COOKIE_SECURE=true`. Browser file requests are at most 512 KiB, so nginx's default 1 MiB request-body limit can stay unchanged even when `MAX_FILE_BYTES` is much larger. No nginx configuration is required when serving Node directly. A mismatched origin is rejected. Do not serve `DATA_DIR` as static content.

Password attempt limits use the direct peer IP. Behind a reverse proxy, clients currently share the proxy's rate-limit bucket because forwarded IP headers are not trusted. Limit upload concurrency and total storage at the deployment boundary; this MVP has a per-file limit but no global disk quota. Uploads are public and are not scanned for malware.

## Chunked uploads

The browser uses sequential 512 KiB raw-byte requests, with a shorter final chunk. Selecting a file still performs no upload or session initialization. Only clicking **Upload file** starts a session.

Each accepted chunk is written to the private partial file and synced before SQLite records its acknowledged offset. Repeating an already-acknowledged chunk verifies its bytes and returns the current offset without appending again. A conflicting or future offset is rejected. Incomplete requests do not advance the offset.

On a transient failure, the browser checks the server's offset and retries. After automatic retries are exhausted, clicking **Upload file** resumes the same file and settings from the acknowledged offset. The selected file and session credentials stay in the current page's memory. Resume survives a backend restart, but not a page reload or closing the tab. Changing the file or settings starts a new session and discards the previous attempt. Cancellation deletes the session and its bytes, including a completed file whose receipt has not reached the browser.

Finalization runs in the background and the browser polls its status with small requests. It reads the partial file through a bounded stream to calculate SHA-256, then renames the file and commits its metadata and receipt together. A lost finalization response is safe to retry. Startup recovery truncates bytes beyond the recorded offset and rolls an interrupted pre-commit rename back into a resumable partial file.

| Request                                   | Purpose                                                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/uploads/sessions`              | JSON `{name,size,password?,expiration?,oneTime?,id?,token?}`; returns credentials and offset. Supplying the same random ID/token makes initialization idempotent. |
| `GET /api/uploads/sessions/:id`           | Read offset/state; a completed response includes the receipt.                                                                                                     |
| `PUT /api/uploads/sessions/:id/chunks`    | Send at most 524288 bytes with `Content-Type: application/octet-stream` and `X-Upload-Offset`.                                                                    |
| `POST /api/uploads/sessions/:id/complete` | Start finalization; returns `202` while saving, or the completed receipt.                                                                                         |
| `DELETE /api/uploads/sessions/:id`        | Cancel and delete the upload.                                                                                                                                     |

All session requests after initialization require `X-Upload-Token`. IDs/tokens are independent random 192-bit values; only a hash of the token is stored. Passwords are hashed during initialization. The private deletion token is derived from the upload secret; cached receipts do not store that token in plaintext. Sessions are capped at 1000, and initialization attempts are rate-limited.

The old `POST /api/uploads` multipart endpoint remains available for compatibility. It sends a whole file in one request and requires a proxy body limit above that file's size. The browser never uses it.

Chunking avoids increasing nginx's request-body limit; it cannot bypass a proxy that rejects PUT requests, has a limit below 512 KiB, or cuts off a stalled individual request. Default proxy buffering only buffers a small chunk. The browser has a two-minute timeout per chunk. Uploads use one chunk request at a time, so high network latency reduces throughput. Final hashing adds one disk read of the completed file. This is a single-process implementation; file bytes use bounded buffers rather than growing server memory with the full file size.

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
10. Upload a file larger than 1 MiB through a proxy with a 1 MiB request-body cap. Confirm file requests never exceed 512 KiB and downloaded bytes match. Interrupt a chunk or lose an acknowledgement, then retry; confirm previously accepted bytes are not duplicated. Restart the backend mid-upload and resume from the stored offset.

The automated suite exercises storage persistence, upload validation/cleanup, password enforcement, one-time concurrency, physical deletion, expiry, safe previews, admin authorization/search/cleanup, idempotent chunking, cancellation, and restart recovery using temporary data directories. A proxy fixture enforces a 1 MiB body limit, rejects a whole-file upload, then accepts an 8 MiB file via 17 bounded chunks with identical stored bytes. Its timing diagnostic is a local correctness sanity check, not a production throughput benchmark.
