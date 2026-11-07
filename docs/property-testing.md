# Run and replay property tests

[Documentation index](README.md) · [Verification](verification.md)

Use these tests to check geometry, adapter validation, layout, and SVG escaping
over generated inputs. They run in the existing `npm test`, `check:fast` and
`check` unit-test gates. The exact-pinned `fast-check` dependency is development
only. It adds no package runtime dependency or optional-peer root import.

## Run a bounded check

Install the locked dependencies with `npm ci`, then run:

```sh
npm run test:property
```

The six properties each run 500 cases with seed `20261107` (3,000 generated
cases). Test names print the seed and budget. Negative controls separately run
the same predicates against deliberately broken implementations and require a
failure plus successful replay of its minimized counterexample. They do not
modify production source.

- Route midpoint: L-shaped routes have unequal or zero segment lengths. The
  D2 and core points agree with an analytic half-length oracle.
- Translation: translating every point in paths of 1–16 points translates the
  midpoint by the same vector and preserves input values.
- Repeated segments: repeating each path vertex 2–5 times preserves the
  midpoint. Collapsed and empty paths retain their defined fallback.
- Numeric validation: a valid D2 route succeeds. Replacing any coordinate with
  NaN or either infinity produces an invalid diagnostic and strict preparation
  throws. Permissive extraction stays available.
- Bounded layout: scenes with 1–4 point, box, or path annotations and 0–3 valid
  obstacles produce deterministic, finite output, retain all annotation IDs,
  and leave deeply frozen input unchanged. Each note searches 80 candidates
  across all four placement sides.
- SVG escaping: XML-safe Unicode, including astral characters, plus markup
  delimiters and quotes round-trip through an XML parser in titles, accessible
  labels, IDs, and data values without injecting elements.

Coordinates range from −1,000 to 1,000; dimensions and route lengths are
bounded. Small bounds deliberately include crowded and impossible layouts.
The tests do not require collision-free output for those scenes. They do not
claim full floating-point-range coverage, arbitrary invalid-obstacle support,
changing-callback behavior, or filtering XML control characters. Existing
example tests and browser checks remain necessary.

## Replay a failure

fast-check prints a seed, shrink path, and minimized counterexample on failure.
Preserve the failing revision and lockfile because generator changes can change
the meaning of a replay path. Choose the exact property name without the
parenthesized seed/run suffix, and copy its reported seed and path:

```sh
FC_PROPERTY='path midpoint is translation invariant' \
FC_SEED=20261107 FC_PATH='0' \
npm test -- test/property/robustness.test.ts --maxWorkers=1
```

The values above select the first generated case as a command example; replace
them with the failure's values. `FC_PATH` requires `FC_PROPERTY` so a path cannot
silently apply to unrelated properties. Unknown property names, invalid seeds
and invalid run counts fail before testing. Shrinking is enabled by default.
Keep the original `FC_RUNS` if the failure came from a larger run.

| Variable | Default | Allowed value |
| --- | --- | --- |
| `FC_SEED` | `20261107` | Signed 32-bit integer |
| `FC_RUNS` | `500` | Integer from 1 to 10,000 per property |
| `FC_PROPERTY` | All six | Exact property name in `robustness.test.ts` |
| `FC_PATH` | Unset | fast-check counterexample path; requires one property |

For a larger local or manually scheduled exploration, choose a recorded seed:

```sh
FC_SEED=42 FC_RUNS=2000 npm run test:property
```

The repository's normal CI gate executes the default budget on Node 20 and
Node 22. The separate `Property tests` workflow runs nightly at 03:23 UTC and
supports manual dispatch with a seed and a case budget. It defaults to 5,000
cases per property (30,000 total), generates a fresh signed 32-bit seed when
none is supplied, and stops the job after 15 minutes.

Download the `property-tests-<run-id>-<attempt>` artifact within 30 days for
`configuration.json` (seed, budget, source revision and Node version) and the
Vitest `results.json`, including failure details. The artifact upload runs on
failure too; a missing result is not a passing campaign. Use the same revision,
lockfile and seed when replaying it locally.

When a property reveals a real defect, retain the shrunk input as an example
regression test and fix the contract violation. Do not filter out the
counterexample merely to make the property pass.
