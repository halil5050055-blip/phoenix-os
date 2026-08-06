import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeadService } from "../src/modules/leads/lead-service.js";
import { OfferService } from "../src/modules/offers/offer-service.js";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";

describe("OfferService", () => {
  let database: Database;

  beforeEach(() => {
    database = createDatabase(":memory:");
  });

  afterEach(() => database.close());

  it("rejects follow-up tasks that are not scheduled in the future", () => {
    const context = () => ({ commandId: randomUUID(), commandName: "TEST", actorId: null, actorType: "SYSTEM" as const });
    const leads = new LeadService(database);
    const lead = leads.create({ companyName: "Offer Client", contact: { firstName: "Ada" } }, context());
    leads.qualify(lead.id, "Need verified", context());
    const { client } = leads.convert(lead.id, context());
    const offers = new OfferService(database);
    const offer = offers.create({
      clientId: client.id,
      currency: "EUR",
      items: [{ description: "Consulting", quantity: 1, unitPriceMinor: 10_000 }],
    }, context());

    expect(() => offers.createFollowUp(offer.id, "2000-01-01T00:00:00.000Z", undefined, context()))
      .toThrowError(expect.objectContaining({ code: "INVALID_FOLLOW_UP_DUE_AT" }));
  });

  it("records exactly one final approval decision and updates the offer", () => {
    const reviewerId = randomUUID();
    const now = new Date().toISOString();
    database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, active, auth_version, created_at, updated_at)
      VALUES (?, 'reviewer@phoenix.test', 'Finance Reviewer', 'not-used', 'ADMIN', 1, 1, ?, ?)
    `).run(reviewerId, now, now);
    const context = () => ({ commandId: randomUUID(), commandName: "TEST", actorId: reviewerId, actorType: "USER" as const });
    const leads = new LeadService(database);
    const lead = leads.create({ companyName: "Approval Client" }, context());
    leads.qualify(lead.id, undefined, context());
    const { client } = leads.convert(lead.id, context());
    const offers = new OfferService(database);
    const draft = offers.create({
      clientId: client.id,
      currency: "EUR",
      items: [{ description: "Implementation", quantity: 1, unitPriceMinor: 75_000 }],
    }, context());
    expect(offers.createFollowUp(draft.id, "2100-01-01T00:00:00.000Z", undefined, context())).toMatchObject({
      assigneeId: reviewerId,
      assignmentUpdatedBy: reviewerId,
    });
    offers.submitForApproval(draft.id, "Finance review", context());

    expect(() => offers.decideApproval(draft.id, "REJECTED", undefined, reviewerId, context()))
      .toThrowError(expect.objectContaining({ code: "REJECTION_REASON_REQUIRED" }));

    const decisionContext = context();
    const approved = offers.decideApproval(draft.id, "APPROVED", "Within policy", reviewerId, decisionContext);

    expect(approved).toMatchObject({
      status: "APPROVED",
      approval: { status: "APPROVED", decisionReason: "Within policy", decidedBy: reviewerId },
    });
    expect(() => offers.decideApproval(draft.id, "REJECTED", "Changed decision", reviewerId, context()))
      .toThrowError(expect.objectContaining({ code: "INVALID_APPROVAL_STATE" }));
    expect(() => database.prepare("UPDATE commercial_offers SET status = 'REJECTED' WHERE id = ?").run(draft.id)).toThrow();
    expect(() => database.prepare("DELETE FROM offer_approvals WHERE commercial_offer_id = ?").run(draft.id)).toThrow();

    const events = database.prepare(`
      SELECT event_type FROM domain_events WHERE command_id = ? ORDER BY rowid
    `).all(decisionContext.commandId);
    expect(events).toEqual([
      { event_type: "OFFER_APPROVAL_DECIDED" },
      { event_type: "COMMERCIAL_OFFER_APPROVED" },
    ]);

    const rejectedDraft = offers.create({
      clientId: client.id,
      currency: "EUR",
      items: [{ description: "Alternative", quantity: 1, unitPriceMinor: 25_000 }],
    }, context());
    offers.submitForApproval(rejectedDraft.id, undefined, context());
    expect(offers.decideApproval(rejectedDraft.id, "REJECTED", "Outside budget", reviewerId, context())).toMatchObject({
      status: "REJECTED",
      approval: { status: "REJECTED", decisionReason: "Outside budget", decidedBy: reviewerId },
    });
  });
});
