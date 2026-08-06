# Project Memory Index

This directory stores durable context, verified decisions, constraints, and discoveries needed for continuity. Include dates and sources where relevant; never store secrets or unnecessary personal data.

## Canonical Entries

| Entry | Scope | Status |
| --- | --- | --- |
| [`project-direction.md`](project-direction.md) | Product focus, scope constraints, metrics, and stakeholder ownership | Current |
| [`web-ui-milestone.md`](web-ui-milestone.md) | First web UI architecture and browser-session constraints | Current |
| [`knowledge-governance.md`](knowledge-governance.md) | Knowledge classification, placement, provenance, and memory admission rules | Current |
| [`initiative-operating-models.md`](initiative-operating-models.md) | Shared lifecycle and durable constraints for Padel, Phoenix, and China initiatives | Current |
| [`leads-workspace.md`](leads-workspace.md) | Functional Leads web workspace and its application boundaries | Current |
| [`commercial-offers-workspace.md`](commercial-offers-workspace.md) | Commercial Offers web workflow and client projection boundaries | Current |
| [`tasks-workspace.md`](tasks-workspace.md) | Follow-up task queue and task-lifecycle boundaries | Current |
| [`vertical-one-reporting.md`](vertical-one-reporting.md) | Aggregate workflow metrics, access boundary, and reporting scope | Current |

## Maintenance Rules

- Add every durable memory file to this index in the same change that creates it.
- Update an existing entry when facts or constraints change instead of creating a conflicting account.
- Mark superseded context in both the old and replacement entries; preserve the historical record.
- Link to canonical documentation or decision records instead of copying large sections into memory.
- Record verified facts and clearly labeled uncertainty, not credentials, transient task notes, or speculative ideas.
- Review affected entries whenever a milestone changes architecture, scope, operations, or decision rights.

Decision rationale belongs in `docs/decisions/`; memory should point to the accepted decision and retain only the context needed for continuity.
