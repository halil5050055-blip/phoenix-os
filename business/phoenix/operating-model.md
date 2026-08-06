# Phoenix Initiative Operating Model

- **Status:** Current
- **Owner:** Phoenix OS product owner role; individual assignment is pending
- **Domain:** Phoenix
- **Knowledge type:** Process
- **Last reviewed:** 2026-08-05
- **Sources:** [`project vision`](../../docs/project-vision.md), [`shared initiative operating model`](../../docs/initiative-operating-model.md), [`business knowledge taxonomy`](../../docs/knowledge-taxonomy.md)

## Purpose and Current Evidence

This model governs Phoenix OS product and company initiatives. The verified near-term focus is Vertical 1 commercial operations. New Phoenix work must improve a defined project success metric or remove a verified blocker to measuring it.

## Domain Lifecycle

1. **Problem intake:** link the operator problem, affected Vertical 1 workflow, and evidence.
2. **Outcome assessment:** identify the success metric, baseline or measurement plan, affected roles, constraints, and smallest coherent milestone.
3. **Milestone authorization:** define acceptance criteria, exclusions, owner, risk controls, compatibility requirements, and verification plan.
4. **Incremental delivery:** implement one bounded change while preserving canonical backend rules, deployment shape, data integrity, and documentation.
5. **Verification:** run proportionate automated checks and direct workflow validation; distinguish local evidence from production evidence.
6. **Acceptance review:** compare the result with acceptance criteria and the targeted metric, then close, correct, or authorize a new milestone.
7. **Operational handoff:** update setup, deployment, task status, decisions, and durable memory; record unverified production steps separately.

## Priority Rules

- Deepen the active Vertical 1 workflow before adding unrelated domains.
- Prefer operator-visible workflow completion, integrity, auditability, access control, and continuity improvements.
- Do not add autonomous AI agents, microservices, separate deployments, or broad integrations without separate priority, ownership, and measurable outcomes.
- Treat roadmap status as evidence-backed: reconcile demonstrably stale items without claiming unverified completion.

## Required Review Questions

- Which documented operator problem or success metric does this change address?
- Can the outcome be achieved by extending the existing modular monolith and canonical API?
- Does it preserve authentication, role boundaries, idempotency, auditability, migrations, and deployment compatibility?
- What is explicitly excluded from the milestone?
- Which checks prove local completion, and which production checks remain external?
- What durable context will the next operator or maintainer need?

## Evidence and Metrics

Use the targets in [`docs/project-vision.md`](../../docs/project-vision.md). Each milestone identifies the metric it affects, acceptance evidence, and any unmeasured production outcome. Passing checks are evidence of implementation quality, not proof of operator adoption or production availability.

## Required Domain Artifacts

- scoped task record with acceptance criteria and exclusions;
- relevant design or decision record for material choices;
- implementation and deterministic tests when behavior changes;
- updated setup, architecture, API, or deployment documentation;
- verification record separating passed, failed, skipped, and externally pending checks;
- indexed durable memory when architecture, scope, or operations change.
