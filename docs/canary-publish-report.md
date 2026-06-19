# Canary Publish Report

This report records the first registry-backed canary publish and clean
consumer install for `@ponchia/annotations`.

## Publish Evidence

- Date: 2026-06-19
- Workflow: `Canary`
- Workflow run: `27827132524`
- Workflow number: `1`
- Job: `GitHub Packages canary`
- Commit: `e754177867d00cc22152bf7239578e3206d21aec`
- Published version: `0.1.0-canary.1.e754177`
- Registry: `https://npm.pkg.github.com`
- Dist tag: `canary`

## Verified Steps

- `Check`: success
- `Prepare canary version`: success
- `Build canary package`: success
- `Pack canary package`: success
- `Publish GitHub Packages canary`: success
- `Smoke registry consumer`: success

## Registry Consumer Evidence

The canary workflow installed the exact published version from GitHub Packages
into a clean registry consumer and verified the public package surface:

```text
Registry consumer smoke verified: @ponchia/annotations@0.1.0-canary.1.e754177 from https://npm.pkg.github.com.
```

The smoke covers the root package, `bronto.css`, DOM helpers, Vega, Mermaid,
D2, React Flow, and prepared-layout resolution from the registry install.

## Outcome

The private/canary package goal is proven for `0.1.x` release readiness:
the package can publish to GitHub Packages, install into a clean consumer from
the registry, and exercise every public subpath without relying on a local
workspace or packed tarball.
