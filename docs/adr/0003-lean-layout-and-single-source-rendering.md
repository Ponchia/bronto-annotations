# ADR 0003: Lean layouts and single-source rendering

Status: accepted for the 0.7 development line; supersedes the no-public-change
constraint of ADR 0002 for this targeted migration.

## Problem

A complete candidate graph was part of every resolved annotation. The
`maxCandidates` placement preference mixed debugging output size with the
refinement frontier. Controlled React also required a resolved layout and a
second copy of its input, creating contradictory states and custom comparison
logic. The root entry point re-exported a substantial migration-only subsystem.

## Decision

Keep the existing annotation model, geometry and solver. Make the ordinary
resolved result lean. Request separate candidate diagnostics explicitly, and
retain private refinement candidates independently of diagnostic output.
Post-hoc refinement of a render snapshot is no longer a public operation.

The React component accepts either input data or a complete layout. Each mode
has one owner of geometry. Invalid combinations fail in types and at runtime.
D3 authoring compatibility moves to an explicit `/d3` entry point. These changes
belong to 0.7, not a patch release. The development version must not imply that
npm already contains the new contract.

## Consequences

The default solve can use exact best-candidate pruning and retain much less
memory without host tuning. Debugging cannot accidentally lower layout quality.
Worker and React consumers receive a useful render snapshot rather than a
mandatory search trace. Existing host annotation state, edit events, framework
adapters and migration behavior remain useful.

This deliberately breaks the old public shape instead of adding parallel legacy
wrappers. Migrations must be demonstrated with declared/packed imports, invalid
input tests, source geometry parity, quality fixtures and actual browser runs.
It does not add a scheduler, persistent document format, asynchronous runtime,
or arbitrary revision protocol. Incremental reference-correctness remains
conservative; changing that contract is a separate design decision.
