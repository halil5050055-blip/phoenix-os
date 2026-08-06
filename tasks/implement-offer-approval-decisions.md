# Implement Offer Approval Decisions

- **Status:** Complete
- **Priority:** Executable application functionality
- **Outcome:** Close the commercial-offer approval loop with an authorized, auditable final decision.

## Scope completed

- Added `APPROVED` and `REJECTED` offer and approval states through migration 005.
- Preserved existing draft and pending-approval data during migration.
- Added a single-use approval-decision command for Admin and Accountant roles.
- Required a reason for rejection and retained reviewer identity and decision time.
- Recorded correlated domain and audit events and an idempotent response.
- Added role-aware approve and reject controls to Commercial Offers.

## Verification checkpoint

- Verified migration of a populated pending approval and foreign-key integrity.
- Verified final-state invariants, immutable approval history, rejection validation, and domain events without a listener.
- Verified JavaScript syntax, TypeScript typecheck/build, UI contracts, and diff whitespace.

## Deferred

Offer PDF generation, delivery, task completion, and broader workflow orchestration remain separate milestones. Phase 2 document templates remain unfinished because executable Vertical 1 functionality has higher priority under `PROJECT_RULES.md`.
