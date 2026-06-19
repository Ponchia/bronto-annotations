# Release Runbook

This repository is private, but the package is shaped for public npm release.

## Preconditions

- `main` is clean and pushed.
- `npm run check` passes locally or in CI.
- `CHANGELOG.md` has an entry for the target version.
- `package.json` and `package-lock.json` versions match.
- `README.md`, `docs/api-reference.md`, examples, readiness matrix, and
  completion audit reflect any public API change.
- `docs/public-release-decisions.md` still matches package metadata, npm
  access, README positioning, examples hosting, and release ownership.
- NPM publishing is configured with either trusted publishing or `NPM_TOKEN`.

## Local Dry Run

```bash
npm ci
npm run check
npm pack --dry-run
```

Inspect the tarball list. It should include `dist`, `README.md`, `LICENSE`, and
`docs`, and should not include source, examples, tests, temporary files,
screenshots, or local caches.

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

## Publish

1. Create a GitHub release for the version tag, for example `v0.1.0`.
2. Let the Release workflow run `npm run check`, create the tarball artifact,
   and publish with npm provenance.
3. Verify the package page includes the expected version, README, public
   subpaths, declarations, and provenance.

The manual `workflow_dispatch` path requires the `publish` input to be `true`.
Use it only when a release event did not run or needs to be replayed.

## Post-Release

- Confirm clean install smoke in a new consumer:

  ```bash
  npm install @ponchia/annotations
  ```

- Root imports work without optional peers.
- Confirm adapter docs still point to the released version's APIs.
