# GitHub Packages Canary

The canary lane publishes a private/pre-release package to GitHub Packages and
then installs that exact version from a clean registry consumer. It is separate
from the public npm release workflow.

GitHub Packages canaries use versions like:

```text
0.1.0-canary.<github-run-number>.<short-sha>
```

## Dry Run

Run the workflow without publishing:

```bash
gh workflow run canary.yml -f publish=false
```

The dry run performs `npm run check`, rewrites the package version in the
runner workspace, builds, packs, and uploads the canary tarball artifact.

## Publish Canary

Run the workflow with publishing enabled:

```bash
gh workflow run canary.yml -f publish=true
```

The publish path:

1. Runs the full check suite.
2. Prepares a unique `0.1.0-canary.*` version.
3. Publishes to `https://npm.pkg.github.com` with the `canary` dist tag.
4. Installs that exact package version into a clean registry consumer.
5. Verifies root, CSS, DOM, Vega, Mermaid, D2, and React Flow public subpaths.

The workflow uses the repository `GITHUB_TOKEN` and `packages: write`. The
package remains linked to the repository through package metadata and GitHub
Packages access control.

## Verified Publish Evidence

The first verified canary publish is recorded in
`docs/canary-publish-report.md`:

- Workflow run: `27827132524`
- Published version: `0.1.0-canary.1.e754177`
- Publish step: `Publish GitHub Packages canary` succeeded.
- Registry smoke: `Smoke registry consumer` succeeded.
- Registry output: `Registry consumer smoke verified:
  @ponchia/annotations@0.1.0-canary.1.e754177 from
  https://npm.pkg.github.com.`

## Local Verification

```bash
npm run test:canary
```

This checks the workflow, canary version preparation script, registry consumer
smoke script, and documentation without publishing anything.

## Consumer Install Shape

The clean registry consumer writes an `.npmrc` that maps only the `@ponchia`
scope to GitHub Packages:

```text
@ponchia:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Other optional peers continue to resolve from the public npm registry.
