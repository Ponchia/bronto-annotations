# Release Runbook

This repository publishes npm releases from pushed `v*` tags, using the same
deliberate release shape as the public Ponchia package lane: local prep, merge
to `main`, tag from `main`, CI gates, protected environment approval, npm
publish with provenance, then GitHub Release notes from `CHANGELOG.md`.

This is the current maintainer runbook. Package consumers should start with
[the first-annotation guide](getting-started.md). Older launch decisions and
canary records are retained below as historical evidence, not current release
prerequisites.

## Preconditions

- The read-only publishing-tooling preflight passes before any publish or
  signed notes-recovery job can start. A failed or unavailable audit blocks it.
- `main` is clean and pushed.
- `npm run check` passes locally or in CI.
- `CHANGELOG.md` has an entry for the target version.
- `package.json` and `package-lock.json` versions match.
- `README.md`, `docs/api-reference.md`, examples, readiness matrix, and
  completion audit reflect any public API change.
- Current package metadata, [governance](../GOVERNANCE.md), compatibility
  guidance and the checked-in release workflow agree on the release contract.
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

## Tag-Driven Public Release

Publishing uses npm built from its unchanged upstream source, with a
separately locked and patched dependency graph, because the registry npm
bundle still ships a high-severity `undici` advisory. Every publishing job
prepares and audits that publisher before it runs. Check it before tagging
with `npm run publisher:readiness`. A failed audit blocks publication: do not
approve around it. See [the security guide](security-automation.md#publishing-tooling-preflight)
for the design, the update procedure and the separate library support policy.

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
6. Prepares and audits the source-locked publisher, then publishes with
   npm provenance via its
   `npm-cli.js publish --ignore-scripts --provenance --access public`.
7. Routes stable versions to `latest` and prereleases to `next`.
8. Records npm registry state and creates GitHub Release notes from
   `CHANGELOG.md`.
9. Pauses again at `npm-publish` for the `sync-dist-tags` job, which applies the
   [dist-tag policy](#dist-tags). It never publishes.

### Dist-tags

The maintainer decided on 6 November 2026 that the release workflow owns the
dist-tags, so nobody moves them by hand. After publication, the separately
approved `sync-dist-tags` job runs `scripts/sync-dist-tags.mjs` with the same
audited publisher, authenticated by the trusted publisher's
**Allow npm dist-tag** permission (`release.yml`, environment `npm-publish`).
This permission is separate from direct publication and is
[disabled by default](https://docs.npmjs.com/trusted-publishers/#managing-dist-tags-with-trusted-publishing).
A configured publishing identity does not prove that channel cleanup is enabled.
The repository's recorded permission denial is tracked in
[issue #231](https://github.com/Ponchia/bronto-annotations/issues/231). An `E403`
requires a maintainer permission decision, not repeated retries, another
credential or weaker protection. Successful package publication remains valid
when only this separate cleanup is denied.

When legitimately enabled, the job applies one policy:

- A prerelease channel tag (`next`, `beta`, `rc`, `alpha`, `canary`) that points
  below `latest` is removed, so a stable release clears a `next` left on an
  older release candidate. Other tags are never touched.
- `latest` never moves backwards, and never to a prerelease once a stable
  version exists. Publishing a stable version sets `latest` itself.

The job waits until the registry includes the released version, refuses older
registry state and confirms the resulting tags before it succeeds. Rerun it
alone to reapply the policy; with nothing to change it is a no-op. `--dry-run`
prints the plan without changing anything.

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

### Recover missing GitHub Release notes without republishing npm

If the protected tag-driven npm publish succeeded but a later GitHub Release
step failed, **do not rerun the original tag workflow**: a second `npm publish`
for the same immutable version will fail. A separate, maintainer-initiated
notes-only workflow is available:

```bash
gh workflow run recover-release-notes.yml \
  --repo Ponchia/bronto-annotations --ref main \
  -f release_tag=vX.Y.Z
```

The recovery verifies the existing tag points to a commit reachable from
protected main and matches its immutable `package.json` version. It then
checks the exact version on npm, downloads its real tarball and validates its
SHA-512, runs npm's cryptographic signature/provenance audit, and verifies the
signed source repository, release workflow, tag and **source commit SHA**.
Only after those checks does it create the missing GitHub Release notes from
the *tagged* changelog. If the release already exists, it leaves it untouched.

This workflow is manual-only, uses `contents: write` solely for the GitHub
release, has no npm publish command or npm token, and does not mutate tags.
It cannot recover a failed npm upload or publish a missing package. Its audit
requires signed attestations from the original protected release; if those are
missing or differ from the immutable tag, recovery fails closed.

### Failed publication versus failed follow-through

First identify the failed step. A failed overall workflow does not establish
that npm rejected the package.

- **Before upload:** a provenance-generation failure can occur before the
  registry write. Confirm that boundary using the job logs and the exact audited
  publisher implementation, and check fresh registry state. Only then consider
  a bounded retry of the failed publish job through the same protected workflow.
- **After acceptance:** delayed metadata or archive reads are observation
  failures. Do not republish an immutable version. Verify the actual archive and
  signatures before updating install guidance.
- **After publication:** release-note, download-mirror and channel-cleanup jobs
  have their own recovery paths. Recover only the failed follow-through; do not
  rerun the npm publication step.

A missing registry read alone is not proof that upload never occurred. Preserve
provenance, the audited publisher, tag identity and protected reviews throughout.
[Issue #78](https://github.com/Ponchia/bronto-annotations/issues/78) retains the
observed pre-upload and post-acceptance cases; general automatic publish retries
remain outside the verified contract.

## Publication status on the website

`site/release-status.json` records only confirmed immutable registry versions.
`package.json` supplies the source version separately. Update `stableVersion`
only after a stable release is actually installable; update `previewVersion`
only after the exact prerelease tarball and registry metadata are verified.
A release-preparation PR must not predeclare a successful publication. Every
compiled HTML entry receives the same accessible, version-matched notice,
including examples reached without visiting the homepage.

The tag-validation job extracts **exact-version** changelog notes before npm
approval. A missing, empty or ambiguous section fails before publication;
`0.6.1` cannot accidentally select `0.6.10`. Prereleases prefer an exact named
section, with an explicit unreleased-base fallback only for development notes.

## Post-Release

- Confirm clean install smoke in a new consumer:

  ```bash
  npm install @ponchia/annotations
  ```

- Root imports work without optional peers.
- Confirm adapter docs still point to the released version's APIs.
- For deeper proof, run `node scripts/smoke-registry-consumer.mjs --version
  X.Y.Z --registry https://registry.npmjs.org --scope @ponchia`.

### Mirror the verified package as GitHub release downloads

The [verified release download guide](release-assets.md) describes the separate
maintainer-dispatched mirror. It downloads and verifies an existing npm package,
retains its original Sigstore provenance, and adds only missing matching assets
to the existing GitHub Release. It never rebuilds, republishes, re-signs, changes
a tag, or overwrites a conflicting asset. Use verification-only mode before
approving an upload; the existing protected review and publisher audit apply.

## Canary / Private Registry

**Historical bootstrap path.** GitHub Packages canaries originally qualified the
package before its first public release. [The canary runbook](canary-release.md)
(`docs/canary-release.md`) and [its publication report](canary-publish-report.md)
(`docs/canary-publish-report.md`) preserve those inputs and results. They are not
a requirement to republish old canaries before a current stable patch.

Current public prereleases follow the tag-driven workflow above and use `next`;
stable releases use `latest`. The manually bootstrapped `0.1.0` package and its
published history must not be recreated or overwritten.

## Public Release Decisions

**Historical launch record.** `docs/public-release-decisions.md` preserves the
original `0.1.x` naming, ownership and hosting decisions. Its initial README and
example-hosting choices describe that launch, not the current site. Use current
`package.json`, [governance](../GOVERNANCE.md), [API stability](api-stability.md)
and this runbook for present-day maintenance. Keep the original record intact.
