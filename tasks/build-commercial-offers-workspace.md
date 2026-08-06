# Build the Commercial Offers Web Workspace

- **Status:** Complete
- **Completed:** 2026-08-05
- **Roadmap:** Executable application milestone under the Implementation Priority Policy
- **Outcome:** Continue the Vertical 1 web workflow from converted client through offer approval intake and follow-up.
- **Owner:** Engineering maintainer role; individual assignment is pending.

## Acceptance Criteria

- `/commercial-offers` requires authentication and permits all roles that may read offers.
- Accountants receive a read-only workspace; Admin, Manager, and Sales receive mutation controls.
- Converted clients are available through a minimal role-protected read projection.
- Authorized operators can list offers and create deterministic drafts with one or more line items.
- Drafts can be submitted for approval with an optional reason.
- Follow-up tasks can be scheduled with a valid ISO timestamp and optional notes.
- Monetary values use integer minor units and totals are displayed by currency without cross-currency summation.
- Each mutation retains its idempotency key across ambiguous retries.
- Existing backend rules, migrations, authorization roles, and deployment topology are preserved.

## Result

Implemented in the existing Express service with dependency-free browser assets and a small read-only client service. No new database state or business transition was introduced.

## Verification

- TypeScript typecheck, production build, JavaScript syntax, and repository diff check.
- Direct non-network route tests for unauthenticated access and Accountant read-only page delivery.
- Direct ClientService projection test and static UI/API contract test.
- Full listener-dependent Supertest coverage remains environment-unverified where local socket binding is prohibited.

## Deferred Roadmap Item

The Phase 2 document-template milestone remains unfinished. Executable Vertical 1 functionality took priority under `PROJECT_RULES.md`.
