BEGIN IMMEDIATE;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT NOT NULL
);

ALTER TABLE audit_events ADD COLUMN actor_id TEXT;

ALTER TABLE idempotency_records RENAME TO idempotency_records_v3;

CREATE TABLE idempotency_records (
  command_name TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (command_name, actor_id, idempotency_key)
);

INSERT INTO idempotency_records
  (command_name, actor_id, idempotency_key, request_hash, response_json, status_code, created_at)
SELECT command_name, 'SYSTEM', idempotency_key, request_hash, response_json, status_code, created_at
FROM idempotency_records_v3;

DROP TABLE idempotency_records_v3;

CREATE INDEX users_role_active_idx ON users(role, active);
CREATE INDEX revoked_tokens_expiry_idx ON revoked_tokens(expires_at);

PRAGMA user_version = 4;

COMMIT;
