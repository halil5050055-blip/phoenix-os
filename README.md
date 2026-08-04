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

The first working backend slice is a Node.js 24 and TypeScript modular monolith using SQLite. It supports lead intake and qualification, conversion to a client, deterministic commercial-offer drafts, follow-up tasks, idempotent commands, and audit events.

```bash
npm install
npm test
npm start
```

The API listens only on `http://127.0.0.1:3000` by default and stores local data in `data/phoenix-bos.sqlite` with owner-only permissions. Set `PORT`, `HOST`, or `DATABASE_PATH` to override those defaults. Setting `HOST` to a non-loopback address exposes the unauthenticated API and is unsafe unless an access-controlled reverse proxy protects it. Every `POST` endpoint requires an `Idempotency-Key` header. Monetary amounts are integer minor units; for example, `12500` represents EUR 125.00. Percentage discounts use integer basis points and round down to the nearest minor unit.

Successful business commands atomically persist state changes, domain events, audit events, and idempotency responses. Rejected business commands are recorded in the audit log without retaining their request body.

Available endpoints:

- `POST /api/leads`
- `GET /api/leads`
- `POST /api/leads/:id/qualify`
- `POST /api/leads/:id/convert`
- `POST /api/commercial-offers`
- `GET /api/commercial-offers/:id`
- `POST /api/commercial-offers/:id/follow-up`

This milestone intentionally excludes authentication, Telegram, PDF generation, email delivery, frontend applications, AI integrations, and microservices.

## Status

Phoenix OS is in its foundation phase. The initial repository structure and governance documents are in place; domain workflows and software components will be added incrementally.

## License

No license has been selected yet. All rights are reserved until a license is added.
