# Ghostdrop

Simple, temporary file sharing. A spiritual successor to Jirafeau, written from scratch.

## Development

Requires Node.js 24 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. `npm run dev` starts both apps and restarts each after its code changes. The frontend listens on `FRONTEND_PORT`, falling back to `PORT` or 3000; the API listens on `BACKEND_PORT`, defaulting to the next port. Use `npm start` without watchers. For LAN access, set `HOST=0.0.0.0` and `PUBLIC_ORIGIN` to the exact frontend URL you open in the browser.

This is an npm workspace monorepo. `apps/frontend/public` contains the browser UI; `apps/frontend/server.js` is its development server. `apps/backend/src` contains the Node/Express API and storage logic. Production deploys each app independently with its own Dockerfile. The production frontend serves static assets; Coolify routes `/api/*` directly to the backend. Both apps share one browser origin. The local development frontend proxies API requests so `npm run dev` also uses one origin.

To run only one app from the repository root, use `npm run start:backend` or `npm run start:frontend`. Set `PORT` for the API and `FRONTEND_PORT` plus `BACKEND_URL` for the development frontend.

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

With `STORAGE_BACKEND=s3`, finalized file bytes go to S3-compatible storage instead. SQLite and resumable upload staging still live in `DATA_DIR`, which must remain persistent.

Runewire tracks the MVP tasks. See [AGENTS.md](AGENTS.md) for the workflow. Personal MCP credentials and `.env` are gitignored.

Expiry blocks new access immediately. A cleanup loop physically removes expired files at startup and every minute, retries pending deletions, removes orphaned completed uploads, and expires upload sessions after one hour without an acknowledged chunk. Expiring a completed session only removes its cached receipt; the shared file keeps its own expiration. An already-open download can finish after expiry. The process must be running for background cleanup to run.

Run a single application process against each data directory. In-memory upload tracking and sessions are intentionally scoped to that process. Admin and file-access sessions are invalidated on restart; uploaded files and password hashes persist. Back up metadata and file bytes together while the application is stopped. File deletion also removes the SQLite record, but does not erase copies in external backups or guarantee secure erasure on the underlying disk.

## Admin

Admin is disabled until a password hash is configured. Generate a hash with a hidden prompt:

```sh
npm run hash-password
```

Set the result as `ADMIN_PASSWORD_HASH` in `.env`, then restart and open `/admin`. Do not put the plaintext password in the configuration.

The panel lists files with size, content type, hash, creation and expiration dates, and access restrictions. Search by filename, full SHA-256, or share ID/link. It also shows disk usage, supports downloads and confirmed deletion, and runs cleanup for expired files and inactive partial uploads. Admin downloads bypass the file password but still consume one-time files. Uploader IP addresses are not stored.

## Configuration

| Variable               | Default                 | Purpose                                                |
| ---------------------- | ----------------------- | ------------------------------------------------------ |
| `PORT`                 | `3000`                  | HTTP port                                              |
| `HOST`                 | `127.0.0.1`             | Listen address; use `0.0.0.0` for LAN/container access |
| `PUBLIC_ORIGIN`        | `http://localhost:3000` | Exact browser origin allowed for mutating requests     |
| `DATA_DIR`             | `./data`                | Private database and upload storage                    |
| `MAX_FILE_BYTES`       | `104857600`             | Maximum size of a single file, in bytes                |
| `ADMIN_PASSWORD_HASH`  | Empty                   | Generated scrypt hash; empty disables admin            |
| `COOKIE_SECURE`        | `false`                 | Set `true` when serving through HTTPS                  |
| `CLEANUP_INTERVAL_MS`  | `60000`                 | Background cleanup interval                            |
| `STORAGE_BACKEND`      | `local`                 | Finalized file storage: `local` or `s3`                |
| `S3_ENDPOINT`          | AWS default             | S3 API origin, e.g. the MinIO endpoint                 |
| `S3_BUCKET`            | Required for S3         | Existing private bucket                                |
| `S3_REGION`            | `us-east-1`             | Bucket signing region                                  |
| `S3_PREFIX`            | `ghostdrop/`            | Reserved key prefix; must end with `/`                 |
| `S3_FORCE_PATH_STYLE`  | `true`                  | Path-style addressing for MinIO                        |
| `S3_ACCESS_KEY_ID`     | SDK credential chain    | Server-side access key ID                              |
| `S3_SECRET_ACCESS_KEY` | SDK credential chain    | Server-side secret access key                          |
| `S3_SESSION_TOKEN`     | Empty                   | Optional temporary AWS credential token                |

For production, build the two Docker images below, mount persistent private storage on the backend, and put the frontend behind an HTTPS reverse proxy. Set `PUBLIC_ORIGIN` to the external HTTPS origin and `COOKIE_SECURE=true`. Browser file requests are at most 512 KiB, so nginx's default 1 MiB request-body limit can stay unchanged even when `MAX_FILE_BYTES` is much larger. No nginx configuration is required when serving Node directly. A mismatched origin is rejected. Do not serve `DATA_DIR` as static content.

### Docker

Both Dockerfiles use the repository root as their build context:

```sh
docker build -f apps/backend/Dockerfile -t ghostdrop-backend .
docker build -f apps/frontend/Dockerfile -t ghostdrop-frontend .
```

The frontend listens on container port 80 and the backend on port 3000. Deploy behind a path-aware reverse proxy: route `/api/*` to the backend without stripping `/api`, and all other paths to the frontend. The Coolify settings below configure those routes. A raw frontend container serves only static files and returns 404 for API paths; it has no internal backend proxy or production environment variables.

The backend runs Node 24 as the unprivileged `node` user and installs only its production workspace dependencies. Its health check probes `/api/config`. The frontend uses the official nginx Alpine image with a static configuration and checks `/healthz`. The build context excludes personal MCP configurations, `.env`, Git history, local storage, tests and design mockups.

Keep the `ghostdrop-data` volume when replacing the backend. It contains SQLite metadata and local uploads/staging. A bind mount needs write permission for UID/GID 1000; a new named volume inherits the image directory's ownership. Back up metadata and file bytes consistently. Run one backend per data directory and S3 prefix.

To generate an admin password hash with the backend image:

```sh
docker run --rm -it --entrypoint node ghostdrop-backend apps/backend/scripts/hash-password.js
```

Set the resulting hash as `ADMIN_PASSWORD_HASH` on the backend. Admin access remains disabled without it.

### Coolify: two applications

Create two Dockerfile applications from the same private repository and branch `main`. Use these settings:

| Setting             | Frontend                    | Backend                                 |
| ------------------- | --------------------------- | --------------------------------------- |
| Base directory      | `/`                         | `/`                                     |
| Dockerfile location | `/apps/frontend/Dockerfile` | `/apps/backend/Dockerfile`              |
| Ports Exposes       | `80`                        | `3000`                                  |
| Port Mappings       | Empty                       | Empty                                   |
| Public domain       | `https://drop.example.com`  | `https://drop.example.com:3000/api`     |
| Persistent volume   | None                        | `ghostdrop-data` mounted at `/app/data` |
| Health check        | `/healthz`, port 80         | `/api/config`, port 3000                |

Leave build/start commands empty. Coolify's domain port selects the internal backend port; visitors still use normal HTTPS port 443. On the backend, disable **Strip Prefixes**, or choose **Keep paths as-is**, so `/api/uploads` reaches Express as `/api/uploads`. The more specific `/api` route takes priority over the frontend root route. See [Coolify path routing](https://coolify.io/docs/core/networking/domains).

Enable **Consistent Container Names** on the backend to stop the old instance before starting its replacement. Do not enable overlapping backend instances or share its data/S3 namespace with preview deployments. No specific backend hostname or frontend-to-backend network connection is required. Coolify's proxy must be able to reach both apps. Its [deployment settings](https://coolify.io/docs/applications/deployments/rolling-updates) describe stop-first behavior.

The frontend needs **no environment variables**. Remove `BACKEND_URL` from its Coolify configuration. That variable is only used by the local Node development frontend when running it separately.

The backend runtime variables for an S3 deployment are:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
PUBLIC_ORIGIN=https://your-ghostdrop.example.com
COOKIE_SECURE=true
DATA_DIR=/app/data
MAX_FILE_BYTES=104857600
CLEANUP_INTERVAL_MS=60000
STORAGE_BACKEND=s3
S3_ENDPOINT=https://your-minio-api.example.com
S3_BUCKET=ghostdrop-prod
S3_REGION=us-east-1
S3_PREFIX=ghostdrop/
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
ADMIN_PASSWORD_HASH=
```

`PUBLIC_ORIGIN` is the frontend's exact public HTTPS origin, with no internal port. Create the private production bucket before deployment, with versioning never enabled. Keep production storage separate from development. S3 credentials and the admin hash belong only on the backend. All application variables are runtime-only; disable Build Variable in Coolify. The production frontend has no environment variables or browser API URL. For storage configuration, see [Coolify persistent storage](https://coolify.io/docs/applications/configuration/persistent-storage).

Deploy the backend first, then the frontend. DNS for the public domain points to the Coolify server. Check `/api/config` through the frontend domain, upload a file and open its sharing/download links. Back up `/app/data` together with the bucket, and allow enough disk space for full-size upload staging and one-time downloads.

### S3 and MinIO

Create a private bucket dedicated to Ghostdrop, with versioning **never enabled** and no object retention. Ghostdrop checks the bucket at startup and rejects enabled or suspended versioning. Ordinary deletes in versioned buckets can retain object bytes as older versions, which conflicts with one-time and expiration deletion. See the [S3 DeleteObject documentation](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html).

Copy `.env.example` to a private environment file and set:

```dotenv
STORAGE_BACKEND=s3
S3_ENDPOINT=https://your-minio-api.example.com
S3_BUCKET=ghostdrop
S3_REGION=us-east-1
S3_PREFIX=ghostdrop/
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
PUBLIC_ORIGIN=https://your-ghostdrop.example.com
COOKIE_SECURE=true
```

Use the MinIO **S3 API** endpoint, usually port 9000, rather than the console on port 9001. Keep keys server-side; the public configuration endpoint and receipts never expose them. The app also accepts the SDK's default credential chain when the explicit S3 key pair is omitted, for example an AWS workload role.

For the backend Docker container, pass the private file with `--env-file /path/to/ghostdrop.env` and retain `-v ghostdrop-data:/app/data`. Omit `DATA_DIR` from that environment file or set it to `/app/data`. Credentials should permit these operations on the bucket and the reserved `ghostdrop/` object prefix, including its ownership marker:

- Bucket: `s3:ListBucket`, `s3:GetBucketVersioning`, `s3:ListBucketMultipartUploads`.
- Objects: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts`.

Browsers continue sending 512 KiB chunks to Ghostdrop. Chunks are acknowledged only after durable local staging. Finalization streams the assembled file into S3 using multipart uploads with one part in flight, then commits its metadata and removes the local staging copy. Ordinary downloads and previews stream through Ghostdrop, preserving the same-origin routes and access controls. No public bucket, browser S3 credentials, presigned URLs or S3 CORS configuration are needed.

For one-time files, Ghostdrop streams the object to a temporary private local file, opens and unlinks that file, atomically claims the record, deletes the S3 object, then serves the open descriptor. The download begins only after remote deletion succeeds. This adds a full-file read and local staging delay to one-time downloads. Failed deletion leaves an inaccessible record that cleanup retries. Password-protected and one-time objects never receive previews.

Startup recovers interrupted finalization and temporary downloads. Cleanup removes expired/deleting objects, unreferenced object keys in the reserved prefix and abandoned multipart uploads older than one hour. Failed uploads automatically abort multipart transfers where possible. Reserve the prefix for **one Ghostdrop deployment**, preserve its SQLite metadata, and keep the endpoint, bucket and prefix stable. An ownership marker ties the prefix to its SQLite data volume. Startup refuses a different or empty database against an owned prefix, so it cannot clean another instance's files as orphans. Do not delete or overwrite this marker. Back up the database and object storage consistently.

Enabling S3 changes where **new** files are stored. Existing local files keep their backend metadata and remain readable; no automatic migration or deletion takes place. Disabling S3 or changing the bucket while remote records exist causes startup to fail. `DATA_DIR` still needs enough space for concurrent full-size uploads and temporary one-time downloads. Admin storage totals include local and remote finalized files.

To run the optional integration suite against a disposable MinIO/S3 endpoint:

```sh
TEST_S3_ENDPOINT=http://127.0.0.1:9000 \
TEST_S3_ACCESS_KEY_ID=test-access-key \
TEST_S3_SECRET_ACCESS_KEY=test-secret-key \
node --test test/s3.integration.test.js
```

These tests create and delete temporary buckets and require bucket creation/deletion and versioning-management permissions. Use an isolated test instance. The normal suite skips these integration tests unless `TEST_S3_ENDPOINT` is set.

Password attempt limits use the direct peer IP. Behind a reverse proxy, clients currently share the proxy's rate-limit bucket because forwarded IP headers are not trusted. Limit upload concurrency and total storage at the deployment boundary; this MVP has a per-file limit but no global disk quota. Uploads are public and are not scanned for malware.

## Chunked uploads

The browser uses sequential 512 KiB raw-byte requests, with a shorter final chunk. Selecting a file still performs no upload or session initialization. Only clicking **Upload file** starts a session.

Each accepted chunk is written to the private partial file and synced before SQLite records its acknowledged offset. Repeating an already-acknowledged chunk verifies its bytes and returns the current offset without appending again. A conflicting or future offset is rejected. Incomplete requests do not advance the offset.

On a transient failure, the browser checks the server's offset and retries. After automatic retries are exhausted, clicking **Upload file** resumes the same file and settings from the acknowledged offset. The selected file and session credentials stay in the current page's memory. Resume survives a backend restart, but not a page reload or closing the tab. Changing the file or settings starts a new session and discards the previous attempt. Cancellation deletes the session and its bytes, including a completed file whose receipt has not reached the browser.

Finalization runs in the background and the browser polls its status with small requests. It reads the partial file through a bounded stream to calculate SHA-256, saves it to the configured backend, then commits its metadata and receipt together. Local storage uses a rename; S3 uses a streamed multipart upload. A lost finalization response is safe to retry. Startup recovery truncates bytes beyond the recorded offset and restores interrupted finalization to a resumable partial file.

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
