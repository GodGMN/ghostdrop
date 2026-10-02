# Ghostdrop

Simple, temporary file sharing. A spiritual successor to Jirafeau, written from scratch.

## Development

Requires Node.js 24 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. Run `npm test` for automated checks.

## Storage

SQLite metadata and uploaded files live in `DATA_DIR` (default `./data`), outside the public directory. Preserve this directory across restarts. The default upload limit is 100 MiB. Configure `MAX_FILE_BYTES` to change it.

Runewire tracks the MVP tasks. See [AGENTS.md](AGENTS.md) for the workflow. Personal MCP credentials and `.env` are gitignored.
