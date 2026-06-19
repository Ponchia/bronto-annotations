# Release Runbook

This repository publishes npm releases from pushed `v*` tags, using the same
deliberate release shape as the public Ponchia package lane: local prep, merge
to `main`, tag from `main`, CI gates, protected environment approval, npm
publish with provenance, then GitHub Release notes from `CHANGELOG.md`.

`0.1.0` was bootstrapped manually before this tag-driven lane existed. Do not
push a fresh `v0.1.0` tag to publish it again; use this runbook for `0.1.1` or
later.

## Preconditions

- `main` is clean and pushed.
- `npm run check` passes locally or in CI.
- `CHANGELOG.md` has an entry for the target version.
- `package.json` and `package-lock.json` versions match.
- `README.md`, `docs/api-reference.md`, examples, readiness matrix, and
  completion audit reflect any public API change.
- `docs/public-release-decisions.md` still matches package metadata, npm
  access, README positioning, examples hosting, and release ownership.
- NPM Trusted Publishing is configured for `Ponchia/bronto-annotations`,
  workflow `release.yml`, environment `npm-publish`, and action `npm publish`.

## Local Prep

```bash
npm ci
npm run release:prep -- X.Y.Z
npm run check
npm pack --dry-run
```

Inspect the tarball list. It should include `dist`, `README.md`, `LICENSE`, and
`docs`, and should not include source, examples, tests, temporary files,
screenshots, or local caches.

Commit the version, lockfile, changelog, and template updates from
`release:prep`, open a PR, merge it to `main`, and tag only a commit reachable
from `origin/main`.

## Canary / Private Registry

Use the GitHub Packages canary workflow before publishing `0.1.0` publicly:

```bash
gh workflow run canary.yml -f publish=true
```

The workflow publishes a unique `0.1.0-canary.*` version to GitHub Packages
with the `canary` tag, then installs that exact version from a clean registry
consumer. See `docs/canary-release.md` for the full runbook and
`docs/canary-publish-report.md` for the latest verified publish evidence.

## Public Release Decisions

`docs/public-release-decisions.md` is the source of truth for the package name,
ownership, repository visibility policy, npm access, README positioning, and
examples hosting decision for the `0.1.x` lane.

## Tag-Driven Public Release

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

The Release workflow:

1. Verifies the tag commit is reachable from `origin/main`.
2. Verifies `vX.Y.Z` matches `package.json`.
3. Runs `npm run check`.
4. Builds `dist` and records an `npm pack --dry-run` manifest.
5. Pauses at the protected `npm-publish` GitHub Environment for approval.
6. Publishes with npm provenance via
   `npm publish --ignore-scripts --provenance --access public`.
7. Routes stable versions to `latest` and prereleases to `next`.
8. Records npm registry state and creates GitHub Release notes from
   `CHANGELOG.md`.

Do not create the GitHub Release by hand before the workflow publishes. The
workflow creates the GitHub Release only after npm accepts the package.

## Post-Release

- Confirm clean install smoke in a new consumer:

  ```bash
  npm install @ponchia/annotations
  ```

- Root imports work without optional peers.
- Confirm adapter docs still point to the released version's APIs.
- For deeper proof, run `node scripts/smoke-registry-consumer.mjs --version
  X.Y.Z --registry https://registry.npmjs.org --scope @ponchia`.
