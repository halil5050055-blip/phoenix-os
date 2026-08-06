PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

DROP INDEX tasks_related_entity_idx;
ALTER TABLE tasks RENAME TO tasks_v5;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('FOLLOW_UP')),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'COMPLETED')),
  related_entity_type TEXT NOT NULL,
  related_entity_id TEXT NOT NULL,
  due_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  completion_note TEXT,
  completed_at TEXT,
  completed_by TEXT REFERENCES users(id),
  CHECK (
    (status = 'OPEN' AND completion_note IS NULL AND completed_at IS NULL AND completed_by IS NULL)
    OR (status = 'COMPLETED' AND completed_at IS NOT NULL AND completed_by IS NOT NULL)
  )
);

INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at)
SELECT id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at
FROM tasks_v5;

DROP TABLE tasks_v5;

CREATE INDEX tasks_related_entity_idx ON tasks(related_entity_type, related_entity_id);
CREATE INDEX tasks_status_due_idx ON tasks(status, due_at);

CREATE TRIGGER task_must_start_open
BEFORE INSERT ON tasks
WHEN NEW.status != 'OPEN'
BEGIN
  SELECT RAISE(ABORT, 'task must start open');
END;

CREATE TRIGGER validate_task_completion
BEFORE UPDATE ON tasks
WHEN OLD.status != 'OPEN'
  OR NEW.status != 'COMPLETED'
  OR NEW.id IS NOT OLD.id
  OR NEW.type IS NOT OLD.type
  OR NEW.related_entity_type IS NOT OLD.related_entity_type
  OR NEW.related_entity_id IS NOT OLD.related_entity_id
  OR NEW.due_at IS NOT OLD.due_at
  OR NEW.notes IS NOT OLD.notes
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'task permits exactly one completion transition');
END;

PRAGMA user_version = 6;

COMMIT;
PRAGMA foreign_keys = ON;
