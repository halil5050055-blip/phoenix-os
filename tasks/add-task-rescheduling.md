# Add Task Rescheduling

- **Status:** Complete
- **Priority:** Executable application functionality
- **Roadmap:** Bounded increment of the task and workflow orchestration layer
- **Outcome:** Let authorized operators correct follow-up timing without losing accountability or task history.

## Acceptance Criteria

- Existing task records migrate without data loss or changed public identifiers.
- Admin and Manager may reschedule any open task; Sales may reschedule only an open task currently assigned to them.
- A new due timestamp must be valid, strictly in the future, and different from the current timestamp.
- Completed tasks cannot be rescheduled.
- Every accepted reschedule records the actor, previous due timestamp, next due timestamp, update time, domain event, audit event, and idempotent response.
- The Tasks workspace exposes responsive rescheduling controls only when the authenticated user is authorized for that task.
- Existing task creation, assignment, completion, listing, RBAC, and browser-session contracts remain compatible.
- Relevant syntax, type, build, migration, service, UI-contract, and available local tests pass; environment-restricted checks are reported as unverified.

## Deferred

Automated reminders, recurring tasks, due-date history views, and additional task types remain separate milestones.

## Implemented Scope

- Added migration 008 with reschedule metadata while preserving existing identifiers, task state, ownership, and completion data.
- Added an idempotent reschedule command and additive task projection fields.
- Enforced future, changed timestamps and role/ownership authorization in the service and SQLite triggers.
- Added role-aware rescheduling controls and validation to the Tasks workspace.

## Verification Checkpoint

- Verified populated migration and foreign-key integrity.
- Verified manager and assigned-owner access, unauthorized Sales rejection, invalid and unchanged dates, completed-task rejection, event history, and direct database bypass protection.
- Verified UI contracts, syntax, typecheck, build, listener-free regressions, and diff whitespace.
