# Tasks Workspace

## Current state

Phoenix BOS serves an authenticated Tasks workspace at `/tasks` for Admin, Manager, and Sales users. It presents open follow-ups first, with overdue, due-today, and upcoming summaries and filters, retains completed history in a separate filter, and displays the current owner.

## Durable boundaries

- Task creation remains part of the Commercial Offers workflow and is backend-owned.
- Authorized operators may transition a task exactly once from `OPEN` to `COMPLETED`; the backend retains the actor, timestamp, and optional completion note and emits correlated domain and audit events.
- New user-created follow-ups default to their creator. Existing tasks remain unassigned after migration.
- Admin and Manager may assign or unassign open tasks to active Admin, Manager, or Sales users. Every change records the previous owner, next owner, actor, time, domain event, and audit event.
- Completed tasks cannot be reassigned. A later user deactivation or role change does not erase historical ownership.
- Admin and Manager may reschedule any open task; Sales may reschedule only an open task currently assigned to them. New dates must be different and in the future.
- Rescheduling retains the previous and next due timestamps, actor, update time, domain event, and audit event. Completed-task timing remains immutable.
- The browser receives the canonical task projection and derives only time-relative presentation categories.
- Additional task types, recurring schedules, and automated reminders remain deferred.
- Accountants retain Commercial Offers read access but do not receive task access.
