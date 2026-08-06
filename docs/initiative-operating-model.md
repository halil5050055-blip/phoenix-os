# Shared Initiative Operating Model

- **Status:** Current
- **Owner:** Executive sponsor / product owner role; individual assignment is pending
- **Domain:** Shared
- **Knowledge type:** Process
- **Last reviewed:** 2026-08-05
- **Sources:** [`project-vision.md`](project-vision.md), [`knowledge-taxonomy.md`](knowledge-taxonomy.md), [`AGENTS.md`](../AGENTS.md)

## Purpose

Padel, Phoenix, and China initiatives use this control loop so work enters with evidence, receives explicit ownership, progresses through bounded stages, and closes with an auditable outcome. Domain models extend this process without weakening its safety or evidence requirements.

## Operating Roles

| Role | Accountability |
| --- | --- |
| Executive sponsor / product owner | Sets priority, assigns an initiative owner, approves material scope changes, and makes advance/stop decisions at investment gates. |
| Initiative owner | Maintains the initiative brief, coordinates execution, reports evidence, and escalates blockers. |
| Domain reviewer | Validates domain assumptions and acceptance criteria; the required expertise depends on the initiative. |
| Engineering maintainer | Reviews software, data, automation, and integration implications when relevant. |
| Operator | Performs approved work and records outcomes against the current plan. |

Individual assignments are currently unknown. No initiative may leave assessment without an accountable sponsor and initiative owner recorded in its brief. One person may hold multiple roles, but approval and review responsibilities must remain explicit.

## Lifecycle and Gates

| Stage | Required work | Exit evidence | Decision owner |
| --- | --- | --- | --- |
| Intake | Record the problem or opportunity, source, affected domain, urgency, and known constraints. | Traceable intake with an evidence-state label. | Initiative owner or intake coordinator |
| Assessment | Validate the need, identify stakeholders, alternatives, dependencies, risks, and a measurable outcome. | Initiative brief with owner, baseline or measurement plan, and recommendation. | Initiative owner |
| Authorization | Bound scope, resources, acceptance criteria, review cadence, and stop conditions. | Approved task or plan; material decisions have decision records. | Executive sponsor / product owner |
| Execution | Deliver the smallest authorized increment and record evidence, decisions, costs, risks, and blockers. | Acceptance evidence and updated canonical documents. | Initiative owner |
| Review | Compare results with the target and examine operational, financial, legal, security, and customer effects that apply. | Written continue, change, pause, scale, or close recommendation. | Sponsor with required domain reviewers |
| Closure or scale | Preserve outcomes and lessons, close obligations, assign ongoing ownership, or authorize the next bounded increment. | Closed task, updated memory/indexes, and explicit remaining obligations. | Executive sponsor / product owner |

Skipping a stage requires a recorded reason and does not waive safety, legal, financial, security, or external-communication controls.

## Required Initiative Brief

Every active initiative must record:

- problem or opportunity and its source;
- lifecycle stage and status;
- sponsor, initiative owner, operators, and required reviewers;
- stakeholders affected;
- verified facts, reported facts, assumptions, unknowns, and validation plan;
- scope, exclusions, dependencies, and constraints;
- measurable outcome, baseline or baseline plan, target, and evidence source;
- approved resources and any external commitments;
- risks, stop conditions, next review trigger, and decision needed;
- links to tasks, decisions, canonical domain documents, and relevant memory.

## Work Rhythm

Cadence is set per initiative because no common team capacity or market schedule is documented. At minimum:

- review on entry to every lifecycle stage;
- review immediately when a stop condition, material risk, or invalidated assumption appears;
- review before spending, contracting, publishing, sharing protected data, or making an external commitment;
- close inactive work explicitly rather than allowing an ambiguous backlog state.

## Evidence and Status Reporting

Status reports answer four questions:

1. What changed since the prior review, with evidence?
2. How does the result compare with the target or validation plan?
3. Which assumptions, risks, obligations, or decisions changed?
4. What exact decision or next action is required, from whom, and by when or which milestone?

Use `On track`, `At risk`, `Blocked`, `Paused`, or `Closed` only with a short evidence-based explanation. A missing accountable decision is `Blocked`, not `On track`.

## Control Boundaries

- Do not fabricate market, customer, financial, legal, or partner facts.
- Do not make financial commitments, legal submissions, production changes, or outbound communications without the authority required by repository rules and the initiative brief.
- Store canonical knowledge in the owning domain and use task records for execution history.
- Record durable cross-task constraints in memory and index them.
- Use accepted decision records for material choices and supersede them explicitly.
- Apply least privilege and minimize personal or confidential data.

## Handoff and Closure

A handoff identifies the current stage, accountable owner, latest verified evidence, open decisions, risks, obligations, next action, and canonical links. Closure additionally records the outcome against the target, why work stopped or scaled, unresolved obligations, and what should be retained or superseded.
