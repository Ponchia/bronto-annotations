# Contributing

Bug reproductions, clearer documentation, and small examples from real
integrations are welcome. You do not need to propose an API to describe a
problem. For usage help, start with [SUPPORT.md](SUPPORT.md); report suspected
vulnerabilities privately through [SECURITY.md](SECURITY.md).

Participation follows the [Code of Conduct](CODE_OF_CONDUCT.md).
[Governance](GOVERNANCE.md) explains maintenance, review, and release decisions.
Financial support is optional and separate from contribution in [FUNDING.md](FUNDING.md).

## Start a change

For a small fix, fork the repository and create a branch from current `main`.
For a new API, changed compatibility promise, or larger refactor, first open an
issue describing the problem, a small example, and the alternatives considered.
Keep each pull request focused on one reviewable change.

Use a Node version from the [compatibility matrix](docs/compatibility.md).
Run commands from your checkout's root:

```bash
npm ci
npm run check:fast
```

To explore an existing host:

```bash
npm run example -- examples/svg-basic
```

The browser suites also need `npx playwright install chromium`; Linux may need
`npx playwright install --with-deps chromium`. Ordinary examples do not need
that download. Before marking a pull request ready, run `npm run check` or
confirm its complete successful CI run for the exact proposed revision.

## Choose focused checks while iterating

| Change | Start with |
| --- | --- |
| Core, adapter, or renderer behavior | `npm test -- path/to/changed.test.ts` and `npm run check:fast` |
| First-use examples or documentation | `npm run test:docs-snippets` |
| Public pages, navigation, or demos | `npm run test:site` |
| Package exports or installation | `npm run test:exports` and `npm run test:pack` |

Focused checks shorten iteration; they do not replace the full merge gate.
The [verification guide](docs/verification.md) explains browser, compatibility,
performance and release checks. Keep useful failure output and report skipped
checks honestly. Never remove an assertion merely to get a green run.

## Find the owning code or guide

| Area | Start here |
| --- | --- |
| Installation and consumer documentation | [Documentation index](docs/README.md) |
| Runnable integrations and host ownership | [Example catalog](examples/README.md) |
| Models, anchors, placement and layout quality | `src/core/` |
| SVG, React and rendered DOM output | `src/svg/`, `src/react/`, `src/dom/` |
| Optional integrations | `src/adapters/` |
| Behavior, consumer and documentation regressions | `test/` |

## Implementation and tests

Follow the surrounding TypeScript style, use explicit public types, and keep
changes compatible with the supported Node and optional-peer versions. Public
exports, tests and the implementation are the contract; update the relevant
current guide and API reference when behavior changes.

Add a focused regression for a bug, ideally showing the failure before the fix.
New behavior needs automated tests for its contract and relevant boundaries.
Use deterministic fixtures or retain the seed and minimized counterexample of a
generated test. Check input immutability and invalid input where relevant. Avoid
new dependencies unless they solve a concrete problem the existing tools do not.

### Product Boundaries

The package owns annotation models, anchors, placement, collision handling,
connector geometry, render helpers, and adapter contracts. The host owns charts,
diagram parsing/layout, application state, persistence, routing, and design.
Root imports must remain DOM-free and free of optional peer runtime imports.
Bronto UI styling and host libraries remain optional.

### Adapter Changes

Use public host geometry or rendered SVG/DOM geometry. Keep anchor, annotation,
obstacle and validation helpers consistent with each other. Preserve manual
placements, target-alignment diagnostics and provenance in `annotation.data`.
Keep extraction and strict-validation semantics explicit; report a limitation
rather than silently broadening a contract.

## Documentation and examples

Keep the root README focused on first use. Put detailed options in the owning
current guide and route it from `docs/README.md`. First-use code blocks have
executable fixtures in `test/docs/`; update both together. Runnable examples have
setup and ownership information in their README and `examples/catalog.json`.

Retain useful historical evidence with its revision and scope; do not present a
past proposal as a current feature. Update readiness/completion manifests only
when their capability or verification claims change. Check links and named
anchors after moving documentation.

## Submit a pull request

Describe the problem, the change, and the evidence. Link the related issue when
one exists. Record the exact commands or CI run and explain anything not tested.
For a visual change, include the relevant viewport and before/after evidence;
for a public behavior change, include compatibility and migration impact.

Keep credentials, private project names, customer data, internal URLs and local
absolute paths out of public code, fixtures, screenshots and reports. Contributions
use the existing [MIT license](LICENSE); preserve third-party notices.

### Contribution attribution

Use the configured Git identity and retain genuine human co-author credit.
Do not add AI-tool or model trailers, generated-by footers, or session URLs to
commits or pull requests. `.claude/settings.json` disables automatic attribution;
it does not change identity or permissions. Start tool sessions from the root.
This affects new work; historical commits and published release tags stay intact.

### Verified build reuse

`npm run check` compiles once and reuses only byte-verified output. Its internal
`PONCHIA_ANNOTATIONS_REUSE_BUILD=1` mode requires matching source and output
fingerprints in ignored `.tmp`; changed or missing artifacts fail closed.
Standalone commands build freshly. To reset stale output, run `npm run build`
without that environment variable; `npm run test:build-reuse` checks the contract.

## Releases

Only the maintainer follows [docs/release.md](docs/release.md). A documentation or
test change does not by itself require publishing a new runtime package.
