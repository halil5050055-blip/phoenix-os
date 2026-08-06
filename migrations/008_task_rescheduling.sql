PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

DROP TRIGGER task_must_start_open;
DROP TRIGGER task_initial_assignee_must_be_eligible;
DROP TRIGGER task_core_fields_are_immutable;
DROP TRIGGER validate_task_completion;
DROP TRIGGER validate_task_assignment;
DROP INDEX tasks_related_entity_idx;
DROP INDEX tasks_status_due_idx;
DROP INDEX tasks_assignee_status_idx;
ALTER TABLE tasks RENAME TO tasks_v7;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('FOLLOW_UP')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'COMPLETED')),
  related_entity_type TEXT NOT NULL,
  related_entity_id TEXT NOT NULL,
  due_at TEXT NOT NULL,
  due_updated_at TEXT,
  due_updated_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TEXT NOT NULL,
  assignee_id TEXT REFERENCES users(id),
  assignment_updated_at TEXT,
  assignment_updated_by TEXT REFERENCES users(id),
  completion_note TEXT,
  completed_at TEXT,
  completed_by TEXT REFERENCES users(id),
  CHECK ((due_updated_at IS NULL) = (due_updated_by IS NULL)),
  CHECK ((assignment_updated_at IS NULL) = (assignment_updated_by IS NULL)),
  CHECK (
    (status = 'OPEN' AND completion_note IS NULL AND completed_at IS NULL AND completed_by IS NULL)
    OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_by IS NOT NULL)
  )
);

INSERT INTO tasks (
  id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at,
  assignee_id, assignment_updated_at, assignment_updated_by,
  completion_note, completed_at, completed_by
)
SELECT id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at,
       assignee_id, assignment_updated_at, assignment_updated_by,
       completion_note, completed_at, completed_by
FROM tasks_v7;

DROP TABLE tasks_v7;

CREATE INDEX tasks_related_entity_idx ON tasks(related_entity_type, related_entity_id);
CREATE INDEX tasks_status_due_idx ON tasks(status, due_at);
CREATE INDEX tasks_assignee_status_idx ON tasks(assignee_id, status, due_at);

CREATE TRIGGER task_must_start_open
BEFORE INSERT ON tasks
WHEN NEW.status != 'OPEN'
BEGIN
  SELECT RAISE(ABORT, 'task must start open');
END;

CREATE TRIGGER task_initial_assignee_must_be_eligible
BEFORE INSERT ON tasks
WHEN NEW.assignee_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM users WHERE id = NEW.assignee_id AND active = 1 AND role IN ('ADMIN', 'MANAGER', 'SALES')
)
BEGIN
  SELECT RAISE(ABORT, 'task assignee must be an active operational user');
END;

CREATE TRIGGER task_core_fields_are_immutable
BEFORE UPDATE OF id, type, related_entity_type, related_entity_id, notes, created_at ON tasks
BEGIN
  SELECT RAISE(ABORT, 'task core fields are immutable');
END;

CREATE TRIGGER validate_task_completion
BEFORE UPDATE OF status, completion_note, completed_at, completed_by ON tasks
WHEN OLD.status != 'OPEN'
  OR NEW.status != 'COMPLETED'
  OR NEW.due_at IS NOT OLD.due_at
  OR NEW.due_updated_at IS NOT OLD.due_updated_at
  OR NEW.due_updated_by IS NOT OLD.due_updated_by
  OR NEW.assignee_id IS NOT OLD.assignee_id
  OR NEW.assignment_updated_at IS NOT OLD.assignment_updated_at
  OR NEW.assignment_updated_by IS NOT OLD.assignment_updated_by
BEGIN
  SELECT RAISE(ABORT, 'task permits exactly one completion transition');
END;

CREATE TRIGGER validate_task_assignment
BEFORE UPDATE OF assignee_id, assignment_updated_at, assignment_updated_by ON tasks
WHEN OLD.status != 'OPEN'
  OR NEW.status != 'OPEN'
  OR NEW.assignee_id IS OLD.assignee_id
  OR NEW.assignment_updated_at IS NULL
  OR NEW.assignment_updated_by IS NULL
  OR (NEW.assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.assignee_id AND active = 1 AND role IN ('ADMIN', 'MANAGER', 'SALES')
  ))
  OR NEW.due_at IS NOT OLD.due_at
  OR NEW.due_updated_at IS NOT OLD.due_updated_at
  OR NEW.due_updated_by IS NOT OLD.due_updated_by
  OR NEW.completion_note IS NOT OLD.completion_note
  OR NEW.completed_at IS NOT OLD.completed_at
  OR NEW.completed_by IS NOT OLD.completed_by
BEGIN
  SELECT RAISE(ABORT, 'only an open task can receive a new assignment');
END;

CREATE TRIGGER validate_task_reschedule
BEFORE UPDATE OF due_at, due_updated_at, due_updated_by ON tasks
WHEN OLD.status != 'OPEN'
  OR NEW.status != 'OPEN'
  OR NEW.due_at IS OLD.due_at
  OR julianday(NEW.due_at) IS NULL
  OR julianday(NEW.due_at) <= julianday('now')
  OR NEW.due_updated_at IS NULL
  OR NEW.due_updated_by IS NULL
  OR (
    OLD.assignee_id IS NOT NEW.due_updated_by
    AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.due_updated_by AND active = 1 AND role IN ('ADMIN', 'MANAGER'))
  )
  OR NEW.assignee_id IS NOT OLD.assignee_id
  OR NEW.assignment_updated_at IS NOT OLD.assignment_updated_at
  OR NEW.assignment_updated_by IS NOT OLD.assignment_updated_by
  OR NEW.completion_note IS NOT OLD.completion_note
  OR NEW.completed_at IS NOT OLD.completed_at
  OR NEW.completed_by IS NOT OLD.completed_by
BEGIN
  SELECT RAISE(ABORT, 'task reschedule is invalid or unauthorized');
END;

PRAGMA user_version = 8;

COMMIT;
PRAGMA foreign_keys = ON;
