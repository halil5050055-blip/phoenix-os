# Commercial Offers Web Workspace

- **Status:** Current
- **Domain:** Phoenix
- **Knowledge type:** Memory
- **Owner:** Engineering maintainer role; individual assignment is pending
- **Last reviewed:** 2026-08-05
- **Sources:** [`website/README.md`](../website/README.md), [`src/http/app.ts`](../src/http/app.ts), [`website/public/commercial-offers.html`](../website/public/commercial-offers.html)

Phoenix BOS serves the Commercial Offers workspace at `/commercial-offers`. Admin, Manager, and Sales users can create deterministic offer drafts for converted clients, submit drafts for approval, and schedule follow-up tasks. Admins and Accountants can approve or reject pending offers; Accountants otherwise retain read-only offer access.

Durable constraints:

- A minimal read-only `/api/clients` projection supplies converted-client identity without exposing contact details.
- Offer calculations, transition rules, approval intake and decisions, follow-up creation, audit events, and domain events remain backend-owned.
- An approval receives exactly one final decision. Rejections require a reason, and the reviewer identity and decision time remain on the immutable approval record.
- Monetary form inputs are explicit integer minor units to avoid client-side currency rounding assumptions.
- Mutation intent retains one idempotency key across ambiguous retries.
- PDF generation and offer delivery remain deferred.
