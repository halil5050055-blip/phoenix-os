# Build the Leads Web Workspace

- **Status:** Complete
- **Completed:** 2026-08-05
- **Roadmap:** Executable application milestone under the Implementation Priority Policy
- **Outcome:** Let authorized operators execute the first Vertical 1 workflow from the web UI.
- **Owner:** Engineering maintainer role; individual assignment is pending.

## Acceptance Criteria

- `/leads` requires an authenticated Admin, Manager, or Sales session.
- Authorized users can view lead counts and canonical lead data.
- Users can create a lead with an optional contact and see validation or API errors.
- New leads can be qualified with optional notes.
- Qualified leads can be converted into clients after explicit confirmation.
- Mutations use the existing API, same-origin session, and unique idempotency keys.
- Dashboard navigation opens the Leads workspace; other placeholder workspaces remain unchanged.
- Responsive layout, empty state, loading state, success feedback, and failure feedback are present.

## Result

Implemented as a same-service, dependency-free web workspace using the existing Express routes and Vertical 1 API. No backend business rules, migrations, deployment topology, or authorization roles were redesigned.

## Verification

- **Passed:** TypeScript typecheck, production build, JavaScript syntax, repository diff check, configuration tests, direct non-network route-handler tests, role-restriction tests, and static UI contract tests.
- **Reviewed:** safe DOM rendering, retained idempotency keys across ambiguous retries, session expiry, validation, accessibility feedback, and error states.
- **Environment limitation:** the full Supertest API/web suite could not open its ephemeral local listener (`EPERM` on `0.0.0.0`), so its new `/leads` assertions remain unverified in this execution environment. This is not treated as an application failure.

## Deferred Roadmap Item

The Phase 2 legal, finance, marketing, and sales document-template milestone remains unfinished. Executable lead workflow functionality took priority under `PROJECT_RULES.md`.
