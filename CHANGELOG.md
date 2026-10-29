# Changelog

All notable changes to Ghostdrop are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0, a minor version may include breaking changes; they are listed under **Changed** or **Removed** with upgrade steps.

## [Unreleased]

## [0.1.0] - 2026-10-29

First public release.

### Added

- Single-file uploads with expiring links (one hour, one day, one week or 30 days), optional one-time downloads claimed atomically, optional file passwords and a private deletion link.
- Resumable uploads in 512 KiB chunks that survive flaky connections and backend restarts and pass through proxies with small body limits.
- Safe previews for PNG, JPEG, GIF, WebP and plain text; every other type is only downloaded.
- Optional upload restrictions: an upload password, an IP allowlist, or both.
- Admin panel with search by name, hash or link, storage totals, deletion and cleanup.
- Local disk or S3-compatible storage, a global storage cap (`MAX_TOTAL_BYTES`) and SQLite metadata.
- English and Castilian Spanish interface, with browser detection and a language switch.
- Docker images for `linux/amd64` and `linux/arm64` on the GitHub Container Registry, and a Docker Compose bundle with Caddy and automatic HTTPS.

[Unreleased]: https://github.com/GodGMN/ghostdrop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/GodGMN/ghostdrop/releases/tag/v0.1.0
