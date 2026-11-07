## Summary

Describe the problem and the change. Link an issue when relevant.

## Verification

- [ ] `npm run check` passed locally or in CI on this exact revision.

List the commands or CI run, relevant results, and anything not tested. Include
before/after evidence and viewport details for visual changes.

## Compatibility and documentation

Describe any public API or compatibility impact and the guide/tests updated.
Automated checks and reviews are evidence, not independent human approval.
See [contribution guidance](https://github.com/Ponchia/bronto-annotations/blob/main/CONTRIBUTING.md)
and [governance](https://github.com/Ponchia/bronto-annotations/blob/main/GOVERNANCE.md).

## Product Boundary

- [ ] No private project names, internal URLs, local absolute paths, credentials, or consumer-specific details.
- [ ] Root import remains free of optional React, Vega, Mermaid, D2, React Flow, and Bronto UI runtime dependencies.
- [ ] Adapter changes keep the package out of chart rendering, diagram rendering, graph layout, persistence, routing, and app-state ownership.
