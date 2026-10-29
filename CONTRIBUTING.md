# Contributing to Ghostdrop

Thanks for helping. Ghostdrop is maintained by one person in their spare time, so small, focused contributions are the ones most likely to be merged.

## Before you start

- **Bugs**: open an issue with steps to reproduce, what you expected, and the version or commit you ran.
- **Features or larger changes**: open an issue first and wait for agreement before writing code. Ghostdrop aims to stay simple; a well-made feature can still be declined if it adds configuration, dependencies or maintenance the project does not want.
- **Security vulnerabilities**: do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Setting up

Requires Node.js 24 or newer.

```sh
npm install
cp .env.example .env
npm run dev
```

See [Development](README.md#development) for ports and running each app separately.

## Checks

Run both before opening a pull request:

```sh
npm test
npm run check
```

`npm test` runs the Node test suite, which uses temporary data directories and needs no external services. `npm run check` validates JavaScript syntax and Prettier formatting; `npm run format` fixes formatting. CI runs both, and builds the Docker images, on every pull request. Changes to S3 storage should also pass the [S3 integration suite](README.md#s3-and-minio) against a disposable MinIO instance.

## What a pull request needs

A pull request is ready for review when:

1. It does one thing. Unrelated fixes, refactors and formatting changes go in separate pull requests.
2. `npm test` and `npm run check` pass.
3. New behavior and bug fixes come with tests. Security-relevant code (access control, one-time claims, deletion, uploads) is not merged without them.
4. User-facing behavior and configuration changes are reflected in the README and get an entry under **Unreleased** in [CHANGELOG.md](CHANGELOG.md). New UI copy has a key in every catalog in `apps/frontend/public/i18n.js`; `npm test` enforces this.
5. The description explains why the change is needed, links the issue it addresses, and lists how you verified it manually. The [manual verification](README.md#manual-verification) steps are a good starting point.
6. No secrets, personal configuration or generated data are committed.

## Code conventions

- Plain JavaScript ES modules, no build step and no TypeScript. The frontend is static files served as-is.
- Prefer the Node standard library. New runtime dependencies need a strong reason and should be discussed in an issue first.
- Formatting is Prettier with the repository's `.prettierrc.json` (single quotes, 100 columns).
- Follow the style of the surrounding code: small functions, descriptive names, and comments only where the reason for a choice is not obvious.
- Commit messages use the imperative mood and describe the change, for example `Reject uploads above the storage cap`.

## AI-assisted contributions

Ghostdrop itself is developed with AI coding assistants, so using them is fine. What matters is that a person stands behind every change.

- **Disclose it.** Say in the pull request description whether, and roughly how, AI tools were used.
- **You are the author.** You must understand every line you submit, be able to explain it and answer review questions yourself, and have run the checks and tested the change manually. "The AI wrote it" is not an answer to a review comment.
- **Keep it small and reviewable.** Large pull requests that rewrite or reformat many files, or that mix unrelated changes, will be closed without review, whoever or whatever wrote them.
- **No unattended agents.** Pull requests, issues or comments generated and submitted automatically, without a human reviewing them first, will be closed, and repeat submitters may be blocked.
- **Verify claims.** Bug reports and security reports must be reproduced by you. Do not submit unverified findings from automated scanners or AI tools.

## Releases

Maintainers cut releases from `main`:

1. Move the **Unreleased** entries in `CHANGELOG.md` under a new version heading with today's date, and update the comparison links at the bottom.
2. Set the same version in `package.json` with `npm version <version> --no-git-tag-version`, so `package-lock.json` follows.
3. Merge that change, then tag the merge commit and push the tag: `git tag v<version> && git push origin v<version>`.

The release workflow checks that the tag matches `package.json` and has a changelog entry, runs CI, publishes the images to GHCR and creates the GitHub release with the deployment bundle. A tag with a suffix such as `v0.2.0-rc.1` creates a pre-release and does not move `latest`.

## License

Ghostdrop is licensed under the [GNU Affero General Public License v3.0 or later](LICENSE). By submitting a contribution, you agree that it is licensed under the same terms and that you have the right to submit it.
