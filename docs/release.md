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

### Registry Propagation

A successful trusted `npm publish` may precede public registry visibility by
minutes. The release workflow checks uncached npm registry HTTP metadata, and
records the exact published version, dist-tag and integrity once they appear.
Its observation is advisory: metadata propagation delays do not undo a
successfully published, immutable npm version. **Metadata alone does not mean
clients can install the new release.** The registry may expose `latest`, the
new version and its SHA-512 integrity while the actual `.tgz` archive still
returns HTTP 404. The publishing workflow now performs a *separate*, bounded
real tarball download and SHA-512 byte check and records the result in the
release job summary. A pending archive is reported as a warning rather than
an unsafe instruction to republish an immutable version.

The archive verifier is offline: it consumes the confirmed metadata JSON from
`verify-published-registry.mjs` and a downloaded archive, verifies the exact
npm registry URL, checks for a nonempty gzip payload, bounds its size and
compares its SHA-512 against the public packument:

```bash
version=X.Y.Z
proof_dir="$(mktemp -d)"
curl --fail --silent --show-error \
  "https://registry.npmjs.org/@ponchia%2fannotations?verify=$version" \
  -o "$proof_dir/packument.json"
node scripts/verify-published-registry.mjs \
  "$proof_dir/packument.json" "$version" latest \
  > "$proof_dir/confirmed.json"
curl --fail --silent --show-error \
  "https://registry.npmjs.org/@ponchia/annotations/-/annotations-$version.tgz" \
  -o "$proof_dir/package.tgz"
node scripts/verify-published-tarball.mjs \
  "$proof_dir/confirmed.json" "$proof_dir/package.tgz"
```

For prereleases, use the `next` dist-tag instead of `latest`. This checks the
published bytes without an npm cache; a clean consumer install remains the
final compatibility check. If archive verification fails, inspect the exact
published URL and protected release logs before intervening. The release
workflow's archive observer deliberately does **not** retry `npm publish`.

If an immediate `npm view` reports the previous `latest` or a 404 for the new
version, verify with a **fresh npm cache** rather than publishing the same
version again:

```bash
npm --cache="$(mktemp -d)" view @ponchia/annotations version dist-tags --json
npm --cache="$(mktemp -d)" view @ponchia/annotations@X.Y.Z version dist.integrity --json
```

Check the exact version on `https://registry.npmjs.org/@ponchia%2fannotations`
and inspect the protected publish step before considering intervention.

## Post-Release

- Confirm clean install smoke in a new consumer:

  ```bash
  npm install @ponchia/annotations
  ```

- Root imports work without optional peers.
- Confirm adapter docs still point to the released version's APIs.
- For deeper proof, run `node scripts/smoke-registry-consumer.mjs --version
  X.Y.Z --registry https://registry.npmjs.org --scope @ponchia`.
