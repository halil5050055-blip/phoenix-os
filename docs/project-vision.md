# Phoenix OS Project Vision

## Vision

Phoenix OS is the auditable operating system through which a small business team and its approved automation coordinate commercial and operational work without losing context, ownership, or decision history.

The product succeeds when an operator can move a real business workflow from intake to follow-up in one trusted workspace, understand who or what performed each action, and continue the work without reconstructing context from separate tools or conversations.

## Near-Term Product Outcome

The current product focus is Vertical 1: a dependable commercial workflow covering lead intake, qualification, client conversion, commercial offers, approval intake, and follow-up tasks. The existing API, Telegram interface, authentication boundary, and dashboard shell are foundations for that outcome.

The next product increments should deepen this workflow before broadening Phoenix OS into unrelated domains. A capability belongs in Vertical 1 only when it directly improves execution, control, or visibility for the commercial workflow.

## Product Principles

1. **One canonical business record.** Interfaces use the backend's business rules and data rather than creating parallel state.
2. **Human accountability.** Material actions have an identified actor, authorization boundary, and audit trail.
3. **Safe automation.** Automation operates with explicit permissions, deterministic commands, and recoverable failure behavior.
4. **Operational continuity.** Decisions, tasks, and context remain understandable to the next authorized operator.
5. **Incremental delivery.** Each milestone provides a usable, verifiable improvement without premature services or abstractions.

## Scope Boundaries

### In scope now

- Vertical 1 commercial operations.
- Authenticated role-based access for administrators, managers, sales, and accounting users.
- One backend authority for business rules and SQLite state.
- Web and Telegram interfaces that consume the same authenticated API.
- Auditability, idempotency, deployment reliability, and durable project documentation.

### Deferred until separately prioritized

- Additional CRM workspaces beyond the selected Vertical 1 milestone.
- Autonomous AI agents and unsupervised business decisions.
- Microservices or independent frontend deployments.
- Broad legal, finance, marketing, or multi-venture automation.
- External integrations without an identified owner, access model, and measurable business outcome.

## Success Metrics

Metrics are evaluated at the indicated checkpoint. Production metrics begin only after the required monitoring exists; until then, deterministic tests and documented pilot evidence are the source of truth.

| Outcome | Metric and target | Evidence | Checkpoint |
| --- | --- | --- | --- |
| Usable commercial workflow | A designated operator completes at least 10 lead-to-follow-up workflows over two consecutive weeks without direct database edits. | Pilot record and operator review | Before declaring Vertical 1 validated |
| Workflow reliability | At least 95% of valid pilot workflow attempts complete without engineering intervention. | Pilot outcomes grouped by command | Biweekly during pilot |
| State integrity | Zero duplicate state changes from replayed idempotent commands and 100% passing database-invariant tests. | Automated test results and incident review | Every release |
| Auditability | 100% of accepted state-changing business commands have correlated command, domain-event, and audit records where the workflow requires them. | Automated tests or database audit query | Every release |
| Access control | 100% of protected-route authentication and role-boundary tests pass; zero known committed secrets. | Automated tests and repository review | Every release |
| Service readiness | `/health` succeeds for at least 99.5% of measured production checks in a calendar month once uptime monitoring is configured. | External uptime monitor | Monthly after monitoring is enabled |
| Operator efficiency | Median duplicate-entry count per pilot workflow is zero outside Phoenix BOS, excluding customer communication and approved accounting systems. | Operator workflow review | End of pilot |
| Continuity | Every completed milestone updates its task record, relevant documentation, and durable memory with no unresolved contradiction. | Completion review | Every milestone |

Targets may be revised only from measured evidence, with the reason and decision recorded. Unknown baselines must be measured rather than estimated after the fact.

## Stakeholders and Decision Rights

Individual assignments are not currently documented. The roles below define required ownership without inventing names.

| Stakeholder role | Primary interest | Decision rights and responsibilities |
| --- | --- | --- |
| Executive sponsor / product owner | Business value, funding, and priority | Owns product outcomes, milestone priority, scope acceptance, and target changes. |
| Commercial operations owner | Fit of the end-to-end workflow | Defines operating rules, validates pilot workflows, and accepts operational usability. |
| Sales operators | Fast, accurate lead and offer execution | Provide workflow feedback, follow approved processes, and report missing context or unsafe friction. |
| Finance / accounting reviewer | Commercial accuracy and approval control | Defines financial review needs and validates access to offer information without unnecessary write authority. |
| Phoenix BOS administrator | Identity, roles, and service continuity | Manages users and configuration, protects credentials, and coordinates operational incident response. |
| Engineering maintainer | Technical integrity and delivery | Owns implementation quality, migrations, tests, deployment compatibility, and technical documentation. |
| Integration operator | Safe Telegram and future integration behavior | Uses dedicated least-privilege identities and validates integration failure and audit behavior. |
| Customers and contacts | Accurate and appropriately handled business data | Are affected stakeholders whose data must be minimized, protected, and corrected through approved processes. |

Before a production pilot begins, the product owner must record the assigned person or accountable team for the executive sponsor / product owner, commercial operations owner, sales operators, finance / accounting reviewer, Phoenix BOS administrator, and engineering maintainer roles. One person may hold multiple roles, but decision rights must remain explicit.

## Milestone Selection Rule

Choose the smallest unfinished milestone that most directly improves a success metric or removes a verified blocker to measuring it. Finish and verify that milestone before starting another. New domains, integrations, and architectural layers require an accountable stakeholder and a measurable outcome.
