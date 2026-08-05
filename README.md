# Phoenix OS

Phoenix OS is an AI operating system for running and growing modern businesses. It provides a structured workspace where people and AI agents can coordinate business operations, sales, legal work, finance, marketing, automation, and software development without losing context.

The project treats documentation and memory as first-class infrastructure. Decisions, processes, prompts, tasks, and reusable assets live in predictable locations so work remains auditable, modular, and easy to continue.

## Core Capabilities

- Business operations and venture-specific knowledge
- Sales pipelines, playbooks, and customer workflows
- Legal research, agreements, and compliance documentation
- Financial planning, reporting, and analysis
- Marketing strategy, campaigns, and content systems
- Workflow automation and external integrations
- Telegram tools and conversational interfaces
- Website and software product development
- Reusable prompts, templates, tasks, and agent instructions

## Repository Structure

| Path | Purpose |
| --- | --- |
| `docs/` | Architecture, decisions, processes, and general documentation |
| `agents/` | Agent roles, workflows, and operating instructions |
| `memory/` | Durable project context, decisions, and knowledge |
| `business/` | Shared and business-specific operating material |
| `automation/` | Automated workflows, integrations, and supporting code |
| `telegram/` | Telegram bots, interfaces, and channel workflows |
| `website/` | Web applications, sites, and related assets |
| `prompts/` | Versioned reusable AI prompts |
| `templates/` | Reusable document and project templates |
| `tasks/` | Active, planned, and completed work records |

## Working Principles

1. Facts must be traceable; uncertainty must be stated explicitly.
2. Important context and decisions belong in project memory.
3. Documentation changes alongside implementation.
4. Components should be small, modular, and reusable.
5. Agents act autonomously when context is sufficient and ask only when a necessary fact is unavailable.

## Getting Started

1. Read [`AGENTS.md`](AGENTS.md) for agent operating rules.
2. Read [`PROJECT_RULES.md`](PROJECT_RULES.md) before making changes.
3. Review [`TODO.md`](TODO.md) for current priorities.
4. Record durable decisions in `memory/` and technical documentation in `docs/`.

## Vertical 1 Backend

The Vertical 1 backend is a Node.js 24 and TypeScript modular monolith using SQLite. It supports lead intake and qualification, conversion to a client, deterministic commercial-offer drafts, approval intake, follow-up tasks, idempotent commands, domain events, and audit events.

```bash
npm ci
npm test
JWT_SECRET="replace-with-at-least-32-random-bytes" \
INITIAL_ADMIN_EMAIL="admin@example.com" \
INITIAL_ADMIN_PASSWORD="replace-with-a-strong-password" \
npm start
```

The API binds to `0.0.0.0` using `PORT`, with a local fallback of `3000`, and stores local development data in `data/phoenix-bos.sqlite`. `JWT_SECRET` is always required and must contain at least 32 UTF-8 bytes. On an empty database, `INITIAL_ADMIN_EMAIL` and an `INITIAL_ADMIN_PASSWORD` of at least 12 characters are required; they are ignored after the first user exists. Production requires every documented backend variable and enforces `DATABASE_PATH=/data/phoenix-bos.sqlite`.

### Web UI

After starting Phoenix BOS, open [http://localhost:3000](http://localhost:3000) or `/login` on the deployed Railway domain. Sign in with the address configured as `INITIAL_ADMIN_EMAIL` and its corresponding `INITIAL_ADMIN_PASSWORD`. The dashboard displays the authenticated user, backend status, Vertical 1 status, and placeholders for future Leads, Commercial Offers, and Tasks workspaces.

The browser session uses the existing JWT authentication in an HTTP-only, `SameSite=Strict` cookie; production cookies are also `Secure`. The application does not store credentials or expose its token to frontend JavaScript. Bearer tokens remain supported for API and Telegram clients.

Local development commands:

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run dev
```

Required Railway backend variables are `NODE_ENV`, `PORT`, `DATABASE_PATH`, `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and `INITIAL_ADMIN_NAME`. Production must use `DATABASE_PATH=/data/phoenix-bos.sqlite` with a persistent volume mounted at `/data`; see the Railway deployment guide linked below.

Protected API endpoints accept `Authorization: Bearer <token>` or the web UI's HTTP-only session cookie. Logout revokes the presented JWT immediately. Business commands and user mutations also require an `Idempotency-Key` header, scoped to the authenticated user. Monetary amounts are integer minor units; for example, `12500` represents EUR 125.00. Percentage discounts use integer basis points and round down to the nearest minor unit.

Successful business commands atomically persist state changes, domain events, audit events, and idempotency responses. Rejected business commands are recorded in the audit log without retaining their request body.

Available endpoints:

- `GET /` — Phoenix BOS login application
- `GET /login` — login application
- `GET /dashboard` — authenticated dashboard shell
- `GET /health` — public deployment readiness
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session` — current authenticated web/API identity
- `POST /api/users` — Admin
- `GET /api/users` — Admin
- `GET /api/users/:id` — Admin
- `PATCH /api/users/:id` — Admin
- `DELETE /api/users/:id` — Admin; deactivates rather than erases
- `POST /api/leads`
- `GET /api/leads`
- `POST /api/leads/:id/qualify`
- `POST /api/leads/:id/convert`
- `POST /api/commercial-offers`
- `GET /api/commercial-offers/:id`
- `GET /api/commercial-offers`
- `GET /api/tasks`
- `POST /api/integrations/telegram/audit`
- `POST /api/commercial-offers/:id/submit-for-approval`
- `POST /api/commercial-offers/:id/follow-up`

Approval intake moves a draft offer to `PENDING_APPROVAL` and creates one pending approval record. Approval decisions remain deferred to the next milestone, which can now enforce them through the authenticated identity boundary. CRM web pages, PDF generation, email delivery, AI integrations, and microservices remain outside the current milestone.

Roles are `ADMIN`, `MANAGER`, `SALES`, and `ACCOUNTANT`. Admin, Manager, and Sales may operate leads and offers. Accountants may read commercial offers. Only Admin may manage users. Role changes take effect immediately, deactivation invalidates existing tokens, and the last active administrator cannot be removed or demoted.

Railway and Telegram deployment instructions are in [`docs/deployment/railway.md`](docs/deployment/railway.md). Telegram commands and local startup are documented in [`telegram/README.md`](telegram/README.md).

## Status

Phoenix OS is in its foundation phase. The initial repository structure and governance documents are in place; domain workflows and software components will be added incrementally.

## License

No license has been selected yet. All rights are reserved until a license is added.
