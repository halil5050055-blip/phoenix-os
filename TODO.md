# Phoenix OS Roadmap

This roadmap captures initial priorities. Detailed work items should be created in `tasks/` and linked here when execution begins.

## Phase 1 — Foundation

- [x] Create the initial repository structure.
- [x] Define agent operating rules and project standards.
- [x] Add baseline documentation and ignore rules.
- [x] Define project vision, success metrics, and stakeholders ([vision](docs/project-vision.md), [task record](tasks/define-project-vision.md)).
- [x] Create a [decision-record template](templates/decision-record.md) and [memory index](memory/README.md) ([task record](tasks/create-decision-template-and-memory-index.md)).
- [x] Select the initial software stack and development toolchain ([backend setup](README.md#vertical-1-backend)).

## Phase 2 — Knowledge and Operations

- [x] Define a [taxonomy for business knowledge and project memory](docs/knowledge-taxonomy.md) ([task record](tasks/define-knowledge-taxonomy.md)).
- [x] Document operating models for [Padel](business/padel/operating-model.md), [Phoenix](business/phoenix/operating-model.md), and [China](business/china/operating-model.md) ([task record](tasks/document-initiative-operating-models.md)).
- [ ] Create legal, finance, marketing, and sales document templates.
- [ ] Establish data classification, retention, and access policies.
- [ ] Define agent roles, permissions, escalation paths, and handoff formats.

## Phase 3 — Platform

- [ ] Design the core Phoenix OS architecture and integration boundaries.
- [ ] Implement configuration, logging, validation, and error-handling foundations.
- [ ] Build a task and workflow orchestration layer.
  - [x] Add auditable [task ownership and reassignment](website/README.md) ([task record](tasks/add-task-ownership.md)).
  - [x] Add auditable [open-task rescheduling](website/README.md) ([task record](tasks/add-task-rescheduling.md)).
- [ ] Add persistent memory retrieval with source attribution.
- [x] Create a secure Telegram interface ([Telegram documentation](telegram/README.md)).
- [x] Build the first website dashboard ([web UI setup](README.md#web-ui)).
- [x] Build the functional [Leads web workspace](website/README.md) ([task record](tasks/build-leads-workspace.md)).
- [x] Build the functional [Commercial Offers web workspace](website/README.md) ([task record](tasks/build-commercial-offers-workspace.md)).
- [x] Build the functional [Tasks web workspace](website/README.md) ([task record](tasks/build-tasks-workspace.md)).
- [x] Implement controlled [commercial-offer approval decisions](website/README.md) ([task record](tasks/implement-offer-approval-decisions.md)).
- [x] Implement auditable [follow-up task completion](website/README.md) ([task record](tasks/implement-task-completion.md)).

## Phase 4 — Automation and Growth

- [ ] Automate recurring sales and marketing workflows.
- [ ] Add business reporting and financial dashboards.
  - [x] Add the aggregate [Vertical 1 workflow report](website/README.md) for operational pilot visibility ([task record](tasks/add-vertical-one-workflow-report.md)).
- [ ] Integrate approved CRM, analytics, and communication systems.
- [ ] Establish automated testing, security scanning, and deployment.
- [ ] Measure agent quality, workflow reliability, and business outcomes.

## Ongoing

- [ ] Review documentation and memory for accuracy.
- [ ] Audit security, privacy, dependencies, and access controls.
- [ ] Retire obsolete prompts, workflows, and integrations safely.
- [ ] Prioritize work based on measurable business value.
