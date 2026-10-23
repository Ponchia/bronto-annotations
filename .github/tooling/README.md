# npm workflow tooling

`npm/package.json` and `npm/package-lock.json` are a private project for the
npm CLI used by publishing, signed release-notes recovery and Dependency Audit.
They are separate from the root development graph and are excluded from the
published package. The root package and its complete Node 20 test lane keep
their existing support contract.

## Reviewed CLI

The selected CLI is npm 11.21.1, matching the reviewed
[npm/cli release commit](https://github.com/npm/cli/commit/8834421d14085fdf6e871e6f3a20f6ae1b3de599).
The lock records its registry tarball URL and SHA-512 integrity. npm's bundled
dependencies inherit that tarball's integrity; do not override or repack them.
The bootstrap uses the runner's npm only for this locked installation:

```bash
npm ci --prefix .github/tooling/npm --ignore-scripts --no-audit --no-fund
```

The workflow selects the installed bin directory, verifies its resolved npm
CLI path and exact version, and makes that selection available to later steps.
No npm cache is restored or saved in these four bootstrap jobs. Protected npm
publishing retains the `npm-publish` environment approval, OIDC provenance and
disabled publish lifecycle scripts.

## Canary artifact boundary

The read-only canary build uploads exactly `package.json` and
`package-lock.json` from this directory in an artifact named with the workflow
run ID and prepared canary version. The publisher downloads that artifact from
the same run into a fresh temporary directory. It checks an exact two-file
allowlist, rejects symlinks and directories, and verifies both SHA-256 hashes
against literals committed in `canary.yml` before installing the CLI. It has
no source checkout and does not execute a script supplied by the build.
The package archive and read-only registry smoke keep their separate jobs.

## Updates and local verification

Dependabot checks this directory separately. Review the intended npm release,
Node engine range, tarball URL and integrity before updating the exact version:

```bash
npm install --prefix .github/tooling/npm --package-lock-only --ignore-scripts --save-exact npm@VERSION
npm ci --prefix .github/tooling/npm --ignore-scripts --no-audit --no-fund
node .github/tooling/npm/node_modules/npm/bin/npm-cli.js --version
sha256sum .github/tooling/npm/package.json .github/tooling/npm/package-lock.json
```

Update both SHA-256 literals in the canary publisher, the exact CLI assertions
in workflows and existing guards, and these notes with the reviewed change.
`npm run test:canary` recomputes the manifest hashes;
`npm run test:security-automation` checks the isolated lock and bootstrap
contracts. Run the normal `npm run check` gate before merging.

## Complete advisory checks

The scheduled Dependency Audit retains separate reports for both complete
lockfiles, including development and bundled CLI dependencies. Reproduce with
the reviewed CLI:

```bash
node .github/tooling/npm/node_modules/npm/bin/npm-cli.js audit --package-lock-only --ignore-scripts --include=dev --audit-level=high --json
node .github/tooling/npm/node_modules/npm/bin/npm-cli.js audit --prefix .github/tooling/npm --package-lock-only --ignore-scripts --include=dev --audit-level=high --json
```

The job fails on high or critical findings, CLI errors, malformed JSON or audit
service errors. Moderate findings remain visible in the retained report.
The reused npm 11.21.1 bundle contains `ip-address@10.7.2`;
[GHSA-rxp7-6hxx-x8q5](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5)
names 10.7.4 as patched. The remaining moderate upstream bundle finding is
tracked in [bronto-ui #234](https://github.com/Ponchia/bronto-ui/issues/234).
Integrity locking does not remediate that advisory, and this CLI is not a
runtime dependency of `@ponchia/annotations`.

Signed notes recovery still installs the requested immutable registry version
in its isolated consumer, disables lifecycle scripts, verifies npm signatures
and attestations, and checks the signed repository, tag and source commit.
That dynamic verification has a different purpose from the locked CLI
bootstrap and remains visible to security scanning.
