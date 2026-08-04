BEGIN IMMEDIATE;

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_id TEXT REFERENCES contacts(id),
  status TEXT NOT NULL CHECK (status IN ('NEW', 'QUALIFIED', 'CONVERTED')),
  qualification_notes TEXT,
  qualified_at TEXT,
  client_id TEXT REFERENCES clients(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  primary_contact_id TEXT REFERENCES contacts(id),
  source_lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id),
  created_at TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE price_policies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  discount_basis_points INTEGER NOT NULL DEFAULT 0
    CHECK (discount_basis_points BETWEEN 0 AND 10000),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE commercial_offers (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  price_policy_id TEXT REFERENCES price_policies(id),
  status TEXT NOT NULL CHECK (status IN ('DRAFT')),
  currency TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor INTEGER NOT NULL CHECK (discount_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE commercial_offer_items (
  id TEXT PRIMARY KEY,
  commercial_offer_id TEXT NOT NULL REFERENCES commercial_offers(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('FOLLOW_UP')),
  status TEXT NOT NULL CHECK (status IN ('OPEN')),
  related_entity_type TEXT NOT NULL,
  related_entity_id TEXT NOT NULL,
  due_at TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE idempotency_records (
  command_name TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (command_name, idempotency_key)
);

CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX offers_client_idx ON commercial_offers(client_id);
CREATE INDEX tasks_related_entity_idx ON tasks(related_entity_type, related_entity_id);
CREATE INDEX audit_entity_idx ON audit_events(entity_type, entity_id, created_at);

PRAGMA user_version = 1;

COMMIT;
