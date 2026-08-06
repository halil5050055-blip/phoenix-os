# Vertical 1 Reporting

## Current state

Phoenix BOS exposes an aggregate Vertical 1 report at `GET /api/reports/vertical-1` for Admin and Manager roles. The dashboard displays lead conversion, approved-offer count, task completion, and the combined attention queue of overdue tasks and pending approvals.

## Durable boundaries

- Reporting is a read-only projection over canonical leads, offers, approvals, and tasks; it introduces no parallel state.
- Metrics contain aggregate counts and percentages only, without customer or contact details.
- Conversion rate is converted leads divided by all leads. Task completion rate is completed tasks divided by all tasks. Empty denominators produce zero.
- Overdue tasks are open tasks with a due timestamp before report generation time.
- The report is operational pilot visibility, not a financial statement or production uptime monitor.
- Sales and Accountant roles do not receive the cross-workflow aggregate because their existing data access does not cover every contributing record type.
