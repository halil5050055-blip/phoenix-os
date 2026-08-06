# Business Knowledge and Project Memory Taxonomy

## Purpose

This taxonomy gives Phoenix OS contributors one consistent way to identify, place, describe, and maintain business knowledge. It covers knowledge structure and provenance; data sensitivity, retention periods, and access controls belong to the separate data-governance milestone.

## Classification Axes

Classify durable content by knowledge type, business domain, lifecycle status, and evidence state. These axes are independent: for example, a current sales process may be verified, while a proposed sales plan may be based partly on assumptions.

### Knowledge Type

| Type | Purpose | Canonical location |
| --- | --- | --- |
| Governance | Repository-wide rules, responsibilities, and operating standards | Root governance files or `docs/` |
| Decision | Rationale for a material choice, alternatives, consequences, and validation | `docs/decisions/` |
| Reference | Stable explanatory or technical material used across tasks | `docs/`, the relevant `business/<domain>/`, or the owning component directory such as `website/` or `telegram/` |
| Process | Repeatable operating steps, controls, and failure handling | Relevant `business/<domain>/`, `automation/`, or owning component/integration directory |
| Plan | Intended future work, strategy, or milestone scope | `business/<domain>/`, `TODO.md`, or `tasks/` |
| Task record | Bounded execution outcome, acceptance criteria, status, and verification | `tasks/` |
| Memory | Concise continuity context, constraints, and pointers to canonical sources | `memory/` |
| Template | Reusable structure containing placeholders rather than case data | `templates/` |
| Prompt | Versioned AI instruction with inputs, outputs, constraints, and evaluation notes | `prompts/` |
| Agent contract | Agent role, permissions, boundaries, workflow, and handoff format | `agents/` |
| Implementation | Executable source, schema, migration, test, or deployable asset | Stack-specific source directories |

Do not use memory as a substitute for a decision record, task log, or full reference document. Memory summarizes what a future contributor must retain and links to the canonical detail.

### Business Domain

| Domain | Scope | Location |
| --- | --- | --- |
| Shared | Cross-project standards and reusable material | Root, `docs/`, `templates/`, `prompts/`, or `memory/` |
| Phoenix | Phoenix OS product, company, customers, and operating model | `business/phoenix/` |
| Padel | Padel strategy, research, partnerships, and operations | `business/padel/` |
| China | China market, partner, localization, and operational context | `business/china/` |
| Legal | Legal workflows, approved material, research, and compliance context | `business/legal/` |
| Finance | Budgets, forecasts, reporting definitions, processes, and analysis | `business/finance/` |
| Marketing | Positioning, audiences, campaigns, content, channels, and measurement | `business/marketing/` |
| Sales | Pipeline, qualification, outreach, enablement, and reporting | `business/sales/` |

Place a document in the domain that owns its meaning. Link to it from other domains instead of making copies. Cross-domain material belongs in `docs/` only when no single business domain owns it.

### Lifecycle Status

Use one of these labels when a document's status is not already defined by a more specific template:

- **Draft:** incomplete or awaiting accountable review.
- **Current:** approved or actively authoritative for its stated scope.
- **Superseded:** retained for history and linked to its replacement.
- **Archived:** no longer operationally active and without a direct replacement.

Never silently overwrite historical rationale or leave two documents claiming current authority for the same scope.

### Evidence State

- **Verified fact:** supported by a repository source, system output, or identified authoritative source.
- **Reported fact:** attributed to an identified stakeholder or source but not independently verified.
- **Inference:** a reasoned conclusion from stated evidence.
- **Assumption:** an unverified premise used temporarily and labeled with an owner or validation need.
- **Proposal:** a future option or recommendation that has not been accepted.
- **Unknown:** a material gap that must not be filled by invention.

Place citations or source links next to the claims they support. For stakeholder-reported information, record the stakeholder role and date without adding unnecessary personal data.

## Minimum Metadata

New durable reference, process, plan, and memory documents should state:

- title;
- lifecycle status;
- owning role or team, using `Unassigned` when unknown;
- domain and knowledge type;
- created or last-reviewed date in `YYYY-MM-DD` format;
- source links classified as repository, stakeholder, or external sources, or `Sources: None` when genuinely source-free;
- replacement link when superseded.

Specialized templates may provide additional required fields. Existing documents should adopt this metadata when they receive a material update; this milestone does not require mechanical rewrites.

## Placement Workflow

1. Identify the knowledge type and accountable business domain.
2. Check whether a canonical document already covers the same scope; update it instead of creating a duplicate.
3. Place the full content in its canonical location.
4. Add source attribution and label uncertainty at the claim level.
5. Add only continuity-critical context to `memory/` and link back to the canonical source.
6. Add bounded execution details to `tasks/`, not to memory or evergreen reference documents.
7. Update indexes, related documentation, and supersession links in the same change.

## Memory Admission Test

Content belongs in project memory only when all of the following are true:

- a future contributor needs it to continue work safely or consistently;
- it is durable beyond the current task;
- it is verified, explicitly uncertain, or an accepted constraint;
- it does not contain a secret or unnecessary personal data;
- it links to the canonical detail when one exists.

Transient progress, command output, speculative ideas, copied reference material, and credentials do not belong in memory.

## Authority and Conflict Resolution

When sources conflict, do not merge them into an invented compromise. Resolve authority in this order:

1. applicable platform constraints and repository governance;
2. explicit user direction that is consistent with those constraints and governance;
3. accepted decision records and canonical current documentation;
4. current domain-owned processes and references;
5. active task records and plans;
6. memory summaries, which must point back to canonical sources;
7. external or stakeholder-reported material according to its evidence state.

Record unresolved conflicts as unknowns with the conflicting sources and accountable owner. Correct the memory index when a canonical source changes.

## Naming and Linking

- Use lowercase kebab-case filenames.
- Prefix dated records with `YYYY-MM-DD-` when chronology matters.
- Use descriptive names based on subject and purpose, not author names or temporary labels.
- Prefer relative repository links so references work locally and on Git hosting.
- Link to one canonical source rather than duplicating its contents.

## Examples

| Content | Classification | Destination |
| --- | --- | --- |
| Accepted choice to retain the modular monolith | Decision / Shared / Accepted | `docs/decisions/YYYY-MM-DD-modular-monolith.md` |
| Repeatable lead-qualification procedure | Process / Sales / Current | `business/sales/lead-qualification.md` |
| Evidence-backed China partner research | Reference / China / Draft or Current | `business/china/partner-research.md` |
| Constraints a later agent must remember about the active product focus | Memory / Shared / Current | `memory/project-direction.md` |
| Execution and verification of one bounded milestone | Task record / Shared / Complete | `tasks/<milestone-name>.md` |

## Deferred Governance

This taxonomy does not define confidentiality levels, personal-data handling rules, retention schedules, deletion procedures, or role-based document access. Those controls require the separate roadmap milestone for data classification, retention, and access policies.
