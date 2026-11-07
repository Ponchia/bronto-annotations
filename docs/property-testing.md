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

The repository's normal CI gate executes the default budget on Node 20 and 22.
When a property reveals a real defect, retain the shrunk input as an example
regression test and fix the contract violation. Do not filter out the
counterexample merely to make the property pass.

## Replay a scheduled campaign

The **Property tests** GitHub Actions workflow runs nightly and supports manual
runs. It installs locked dependencies on a GitHub-hosted Node 22 runner with
read-only repository permissions and a 15-minute job limit. Each campaign uses
a fresh signed 32-bit seed unless you supply one manually. The default budget
is 5,000 cases per property, or 30,000 cases across the six properties, plus
the negative controls. Manual runs accept 1–10,000 cases per property.

The run-count cap limits generated cases. Each generator separately bounds
path length, scene size, coordinates, and text size as described above.

Download the run's `property-tests-<run_id>-<run_attempt>` artifact within its
30-day retention period. `configuration.json` records the seed, per-property
budget, commit, and Node version. Vitest's `results.json` records test outcomes
and failure details, including available minimized counterexamples and replay
paths. An interrupted run can lack results; configuration alone is not a pass.
Check out the recorded commit, install its lockfile, and use the seed, budget,
property name, and failure path with the replay command above.
