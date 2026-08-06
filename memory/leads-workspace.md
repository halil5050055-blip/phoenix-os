# Leads Web Workspace

- **Status:** Current
- **Domain:** Phoenix
- **Knowledge type:** Memory
- **Owner:** Engineering maintainer role; individual assignment is pending
- **Last reviewed:** 2026-08-05
- **Sources:** [`website/README.md`](../website/README.md), [`src/http/app.ts`](../src/http/app.ts), [`website/public/leads.html`](../website/public/leads.html)

Phoenix BOS serves a functional Leads workspace at `/leads` from the existing Express deployment. Admin, Manager, and Sales users can list and create leads, qualify new leads with optional evidence notes, and convert qualified leads into clients.

Durable constraints:

- The web layer calls the canonical authenticated API and contains no duplicate business-transition logic.
- Mutations use unique idempotency keys and same-origin cookie authentication.
- Backend role authorization, validation, state invariants, domain events, and audit events remain authoritative.
- Commercial Offers and Tasks web workspaces remain deferred.
