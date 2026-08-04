BEGIN IMMEDIATE;

ALTER TABLE audit_events ADD COLUMN command_id TEXT;
ALTER TABLE audit_events ADD COLUMN command_name TEXT;

CREATE TABLE domain_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX domain_events_aggregate_idx
  ON domain_events(aggregate_type, aggregate_id, occurred_at);
CREATE INDEX audit_command_idx ON audit_events(command_id);

CREATE TRIGGER leads_state_invariant_insert
BEFORE INSERT ON leads
BEGIN
  SELECT CASE
    WHEN NEW.status = 'NEW' AND (NEW.qualified_at IS NOT NULL OR NEW.client_id IS NOT NULL)
      THEN RAISE(ABORT, 'NEW lead cannot have qualification or client data')
    WHEN NEW.status = 'QUALIFIED' AND (NEW.qualified_at IS NULL OR NEW.client_id IS NOT NULL)
      THEN RAISE(ABORT, 'QUALIFIED lead requires qualified_at and no client')
    WHEN NEW.status = 'CONVERTED' AND (NEW.qualified_at IS NULL OR NEW.client_id IS NULL)
      THEN RAISE(ABORT, 'CONVERTED lead requires qualification and client')
  END;
END;

CREATE TRIGGER leads_state_invariant_update
BEFORE UPDATE ON leads
BEGIN
  SELECT CASE
    WHEN NEW.status = 'NEW' AND (NEW.qualified_at IS NOT NULL OR NEW.client_id IS NOT NULL)
      THEN RAISE(ABORT, 'NEW lead cannot have qualification or client data')
    WHEN NEW.status = 'QUALIFIED' AND (NEW.qualified_at IS NULL OR NEW.client_id IS NOT NULL)
      THEN RAISE(ABORT, 'QUALIFIED lead requires qualified_at and no client')
    WHEN NEW.status = 'CONVERTED' AND (NEW.qualified_at IS NULL OR NEW.client_id IS NULL)
      THEN RAISE(ABORT, 'CONVERTED lead requires qualification and client')
    WHEN NEW.status = 'CONVERTED'
      AND NOT EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = NEW.client_id AND c.source_lead_id = NEW.id
      )
      THEN RAISE(ABORT, 'CONVERTED lead client must originate from that lead')
  END;
END;

CREATE TRIGGER commercial_offer_totals_insert
BEFORE INSERT ON commercial_offers
WHEN NEW.total_minor != NEW.subtotal_minor - NEW.discount_minor
  OR NEW.discount_minor > NEW.subtotal_minor
BEGIN
  SELECT RAISE(ABORT, 'commercial offer totals are inconsistent');
END;

CREATE TRIGGER commercial_offer_totals_update
BEFORE UPDATE OF subtotal_minor, discount_minor, total_minor ON commercial_offers
WHEN NEW.total_minor != NEW.subtotal_minor - NEW.discount_minor
  OR NEW.discount_minor > NEW.subtotal_minor
BEGIN
  SELECT RAISE(ABORT, 'commercial offer totals are inconsistent');
END;

CREATE TRIGGER commercial_offer_item_total_insert
BEFORE INSERT ON commercial_offer_items
WHEN NEW.line_total_minor != NEW.quantity * NEW.unit_price_minor
BEGIN
  SELECT RAISE(ABORT, 'commercial offer item total is inconsistent');
END;

CREATE TRIGGER commercial_offer_item_total_update
BEFORE UPDATE OF quantity, unit_price_minor, line_total_minor ON commercial_offer_items
WHEN NEW.line_total_minor != NEW.quantity * NEW.unit_price_minor
BEGIN
  SELECT RAISE(ABORT, 'commercial offer item total is inconsistent');
END;

PRAGMA user_version = 2;

COMMIT;
