import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { OfferService } from "../src/modules/offers/offer-service.js";

describe("database migrations", () => {
  let database: DatabaseSync | undefined;

  afterEach(() => database?.close());

  it("preserves populated approval and task data through workflow migrations", () => {
    database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON");
    for (const filename of ["001_initial.sql", "002_hardening.sql", "003_offer_approval_intake.sql", "004_authentication.sql"]) {
      database.exec(readFileSync(resolve("migrations", filename), "utf8"));
    }
    const now = "2026-01-01T00:00:00.000Z";
    database.prepare(`INSERT INTO leads (id, company_name, status, created_at, updated_at) VALUES ('lead-1', 'Migrated Client', 'NEW', ?, ?)`)
      .run(now, now);
    database.prepare(`INSERT INTO clients (id, name, source_lead_id, created_at) VALUES ('client-1', 'Migrated Client', 'lead-1', ?)`)
      .run(now);
    database.prepare(`UPDATE leads SET status = 'CONVERTED', qualified_at = ?, client_id = 'client-1', updated_at = ? WHERE id = 'lead-1'`)
      .run(now, now);
    database.prepare(`
      INSERT INTO commercial_offers (id, client_id, status, currency, subtotal_minor, discount_minor, total_minor, created_at, updated_at)
      VALUES ('offer-1', 'client-1', 'DRAFT', 'EUR', 5000, 0, 5000, ?, ?)
    `).run(now, now);
    database.prepare(`
      INSERT INTO commercial_offer_items (id, commercial_offer_id, description, quantity, unit_price_minor, line_total_minor)
      VALUES ('item-1', 'offer-1', 'Existing offer', 1, 5000, 5000)
    `).run();
    database.prepare(`
      INSERT INTO offer_approvals (id, commercial_offer_id, status, request_reason, requested_at)
      VALUES ('approval-1', 'offer-1', 'PENDING', 'Existing review', ?)
    `).run(now);

    database.exec(readFileSync(resolve("migrations/005_offer_approval_decisions.sql"), "utf8"));
    database.prepare(`
      INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, notes, created_at)
      VALUES ('task-1', 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', 'offer-1', '2027-01-01T00:00:00.000Z', 'Existing task', ?)
    `).run(now);
    database.exec(readFileSync(resolve("migrations/006_task_completion.sql"), "utf8"));
    database.exec(readFileSync(resolve("migrations/007_task_assignment.sql"), "utf8"));
    database.exec(readFileSync(resolve("migrations/008_task_rescheduling.sql"), "utf8"));

    expect(database.prepare("PRAGMA user_version").get()).toEqual({ user_version: 8 });
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(new OfferService(database).get("offer-1")).toMatchObject({
      status: "PENDING_APPROVAL",
      approval: { status: "PENDING", requestReason: "Existing review", decidedAt: null, decidedBy: null },
    });
    expect(database.prepare("SELECT status, notes, assignee_id, due_updated_at, completed_at FROM tasks WHERE id = 'task-1'").get())
      .toEqual({ status: "OPEN", notes: "Existing task", assignee_id: null, due_updated_at: null, completed_at: null });
  });
});
