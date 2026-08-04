PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;

DROP TRIGGER commercial_offer_totals_insert;
DROP TRIGGER commercial_offer_totals_update;
DROP TRIGGER commercial_offer_item_total_insert;
DROP TRIGGER commercial_offer_item_total_update;
DROP INDEX offers_client_idx;

ALTER TABLE commercial_offer_items RENAME TO commercial_offer_items_v2;
ALTER TABLE commercial_offers RENAME TO commercial_offers_v2;

CREATE TABLE commercial_offers (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  price_policy_id TEXT REFERENCES price_policies(id),
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL')),
  currency TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor INTEGER NOT NULL CHECK (discount_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO commercial_offers
  (id, client_id, price_policy_id, status, currency, subtotal_minor, discount_minor, total_minor, created_at, updated_at)
SELECT id, client_id, price_policy_id, status, currency, subtotal_minor, discount_minor, total_minor, created_at, updated_at
FROM commercial_offers_v2;

CREATE TABLE commercial_offer_items (
  id TEXT PRIMARY KEY,
  commercial_offer_id TEXT NOT NULL REFERENCES commercial_offers(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0)
);

INSERT INTO commercial_offer_items
  (id, commercial_offer_id, product_id, description, quantity, unit_price_minor, line_total_minor)
SELECT id, commercial_offer_id, product_id, description, quantity, unit_price_minor, line_total_minor
FROM commercial_offer_items_v2;

DROP TABLE commercial_offer_items_v2;
DROP TABLE commercial_offers_v2;

CREATE TABLE offer_approvals (
  id TEXT PRIMARY KEY,
  commercial_offer_id TEXT NOT NULL UNIQUE REFERENCES commercial_offers(id),
  status TEXT NOT NULL CHECK (status IN ('PENDING')),
  request_reason TEXT,
  requested_at TEXT NOT NULL
);

CREATE INDEX offers_client_idx ON commercial_offers(client_id);

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

CREATE TRIGGER offer_approval_requires_draft
BEFORE INSERT ON offer_approvals
WHEN NOT EXISTS (
  SELECT 1 FROM commercial_offers
  WHERE id = NEW.commercial_offer_id AND status = 'DRAFT'
)
BEGIN
  SELECT RAISE(ABORT, 'approval can only be requested for a draft offer');
END;

CREATE TRIGGER pending_offer_requires_approval
BEFORE UPDATE OF status ON commercial_offers
WHEN NEW.status = 'PENDING_APPROVAL'
  AND NOT EXISTS (
    SELECT 1 FROM offer_approvals
    WHERE commercial_offer_id = NEW.id AND status = 'PENDING'
  )
BEGIN
  SELECT RAISE(ABORT, 'pending offer requires a pending approval');
END;

CREATE TRIGGER draft_offer_cannot_have_approval
BEFORE UPDATE OF status ON commercial_offers
WHEN NEW.status = 'DRAFT'
  AND EXISTS (
    SELECT 1 FROM offer_approvals
    WHERE commercial_offer_id = NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'offer with an approval cannot return to draft');
END;

CREATE TRIGGER set_offer_pending_after_approval
AFTER INSERT ON offer_approvals
BEGIN
  UPDATE commercial_offers
  SET status = 'PENDING_APPROVAL', updated_at = NEW.requested_at
  WHERE id = NEW.commercial_offer_id;
END;

CREATE TRIGGER offer_approval_cannot_be_deleted
BEFORE DELETE ON offer_approvals
BEGIN
  SELECT RAISE(ABORT, 'offer approval records are immutable');
END;

PRAGMA user_version = 3;

COMMIT;
PRAGMA foreign_keys = ON;
