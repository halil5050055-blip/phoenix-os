# Create a Decision-Record Template and Memory Index

- **Status:** Complete
- **Completed:** 2026-08-05
- **Roadmap:** Phase 1 — Foundation
- **Outcome:** Make material decisions consistent and durable project memory discoverable.
- **Owner:** Engineering maintainer role; individual assignment is pending.

## Acceptance Criteria

- A reusable decision-record template captures context, drivers, alternatives, decision, consequences, validation, follow-up, and references.
- Decision status and supersession metadata are explicit.
- Decision-record location and naming conventions are documented.
- The memory index lists every current durable memory entry and defines maintenance rules.
- Documentation distinguishes decision rationale from continuity memory.
- The roadmap links to the completed milestone artifacts.

## Result

- Added [`templates/decision-record.md`](../templates/decision-record.md).
- Converted [`memory/README.md`](../memory/README.md) into the canonical memory index.
- Added decision and memory maintenance guidance to the relevant directory documentation.

## Verification

- Confirmed each required decision-record section and lifecycle field is present.
- Confirmed all current `memory/*.md` entries appear in the index.
- Confirmed new relative links resolve to repository files.
- Reviewed the milestone diff for whitespace errors and unrelated application changes.
