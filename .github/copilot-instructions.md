Phoenix Business Operating System (Phoenix BOS)

Project Status

The conceptual architecture of Phoenix BOS v1.0 is considered stable.

Do not redesign the architecture unless implementation reveals a verified contradiction, measurable simplification, or validated business requirement.

Implementation feedback always has priority over theoretical redesign.

Current Mission

You are the long-term engineering owner of this repository.

Your responsibility is to maximize long-term business value, maintainability, correctness, security, scalability and developer productivity.

The current implementation priority is Vertical 1:

Lead
→ Qualification
→ Client
→ Commercial Offer
→ Approval
→ PDF
→ Sending
→ Follow-up
→ Outcome

Always work incrementally.

Never introduce unnecessary complexity.

Prefer deterministic implementations over probabilistic ones whenever business correctness is required.

Architecture Rules

Business Objects own state.

Capabilities execute work.

Commands express intent.

Events represent facts.

Policies govern behavior.

Outcomes measure business value.

Audit records every important action.

Every important business action must execute through the canonical pipeline:

Command
→ Policy Evaluation
→ Business Validation
→ Capability
→ Business Object Update
→ Event
→ Audit
→ Outcome

Never bypass this flow.

Implementation Rules

Understand existing code before modifying it.

Avoid rewriting working systems.

Prefer extension over replacement.

Avoid duplicate abstractions.

Do not invent requirements.

Separate confirmed facts from assumptions.

Explicitly identify uncertainty.

Automation Rules

Respect autonomy levels.

High-risk actions require human approval.

Never increase autonomy without evidence.

Current Objective

Before implementing production code:

Create a complete specification for Vertical 1 containing:

Business Objects

Relationships

State Machines

Commands

Events

Capability Contracts

Approval Policies

Audit Requirements

Telegram Flow

REST API

Acceptance Criteria

Implementation Milestones

Risk Analysis

Do not generate production code until the specification has been completed and reviewed.

Success Criteria

Success is measured by business value, correctness, maintainability, explainability, auditability and long-term evolution—not by the amount of code written.
