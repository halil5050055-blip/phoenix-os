import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeadService } from "../src/modules/leads/lead-service.js";
import { OfferService } from "../src/modules/offers/offer-service.js";
import { VerticalOneReportService } from "../src/modules/reporting/vertical-one-report-service.js";
import { TaskService } from "../src/modules/tasks/task-service.js";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";

describe("VerticalOneReportService", () => {
  let database: Database;

  beforeEach(() => {
    database = createDatabase(":memory:");
  });

  afterEach(() => database.close());

  it("summarizes the canonical workflow without exposing record details", () => {
    const userId = randomUUID();
    const createdAt = "2026-01-01T00:00:00.000Z";
    database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, active, auth_version, created_at, updated_at)
      VALUES (?, 'admin-report@phoenix.test', 'Report Admin', 'not-used', 'ADMIN', 1, 1, ?, ?)
    `).run(userId, createdAt, createdAt);
    const context = () => ({ commandId: randomUUID(), commandName: "TEST", actorId: userId, actorType: "USER" as const });
    const leads = new LeadService(database);
    const convertedLead = leads.create({ companyName: "Converted Company" }, context());
    leads.qualify(convertedLead.id, undefined, context());
    const { client } = leads.convert(convertedLead.id, context());
    leads.create({ companyName: "New Company" }, context());

    const offers = new OfferService(database);
    const offer = offers.create({
      clientId: client.id,
      currency: "EUR",
      items: [{ description: "Implementation", quantity: 1, unitPriceMinor: 10_000 }],
    }, context());
    offers.submitForApproval(offer.id, undefined, context());
    offers.decideApproval(offer.id, "APPROVED", undefined, userId, context());
    const completedTask = offers.createFollowUp(offer.id, "2100-01-01T00:00:00.000Z", undefined, context());
    new TaskService(database).complete(completedTask.id, undefined, userId, context());
    database.prepare(`
      INSERT INTO tasks (id, type, status, related_entity_type, related_entity_id, due_at, created_at)
      VALUES ('overdue-task', 'FOLLOW_UP', 'OPEN', 'COMMERCIAL_OFFER', ?, '2026-01-01T00:00:00.000Z', ?)
    `).run(offer.id, createdAt);

    expect(new VerticalOneReportService(database).summary(new Date("2027-01-01T00:00:00.000Z"))).toEqual({
      generatedAt: "2027-01-01T00:00:00.000Z",
      leads: { total: 2, new: 1, qualified: 0, converted: 1, conversionRatePercent: 50 },
      offers: { total: 1, draft: 0, pendingApproval: 0, approved: 1, rejected: 0 },
      approvals: { pending: 0, approved: 1, rejected: 0 },
      tasks: { total: 2, open: 1, completed: 1, overdue: 1, completionRatePercent: 50 },
      attention: { total: 1, overdueTasks: 1, pendingApprovals: 0 },
    });
  });

  it("returns zero rates for an empty workspace", () => {
    expect(new VerticalOneReportService(database).summary(new Date("2027-01-01T00:00:00.000Z"))).toMatchObject({
      leads: { total: 0, conversionRatePercent: 0 },
      offers: { total: 0 },
      tasks: { total: 0, overdue: 0, completionRatePercent: 0 },
      attention: { total: 0, overdueTasks: 0, pendingApprovals: 0 },
    });
  });
});
