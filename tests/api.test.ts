import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";
import { createApp } from "../src/http/app.js";
import { bootstrapInitialAdmin } from "../src/modules/users/bootstrap.js";

const JWT_SECRET = "test-secret-that-is-at-least-thirty-two-bytes-long";
const ADMIN_EMAIL = "admin@phoenix.test";
const ADMIN_PASSWORD = "CorrectHorseBatteryStaple!";

describe("Phoenix BOS Vertical 1 API", () => {
  let database: Database;
  let app: Express;
  let accessToken: string;

  beforeEach(async () => {
    database = createDatabase(":memory:");
    await bootstrapInitialAdmin(database, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: "Test Admin" });
    app = createApp(database, { jwtSecret: JWT_SECRET });
    const login = await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    accessToken = login.body.accessToken;
  });

  afterEach(() => database.close());

  const post = (path: string, token = accessToken) => request(app).post(path).set("Authorization", `Bearer ${token}`);
  const get = (path: string, token = accessToken) => request(app).get(path).set("Authorization", `Bearer ${token}`);
  const patch = (path: string, token = accessToken) => request(app).patch(path).set("Authorization", `Bearer ${token}`);
  const remove = (path: string, token = accessToken) => request(app).delete(path).set("Authorization", `Bearer ${token}`);

  it("creates, lists, qualifies, and converts a lead with audit history", async () => {
    const created = await post("/api/leads").set("Idempotency-Key", "lead-1").send({
      companyName: "Acme Padel",
      contact: { firstName: "Ada", email: "ada@example.com" },
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("NEW");

    const replay = await post("/api/leads").set("Idempotency-Key", "lead-1").send({
      companyName: "Acme Padel",
      contact: { firstName: "Ada", email: "ada@example.com" },
    });
    expect(replay.status).toBe(201);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body.id).toBe(created.body.id);

    const listed = await get("/api/leads");
    expect(listed.body.data).toHaveLength(1);

    const qualified = await post(`/api/leads/${created.body.id}/qualify`).set("Idempotency-Key", "qualify-1").send({ notes: "Budget confirmed" });
    expect(qualified.status).toBe(200);
    expect(qualified.body.status).toBe("QUALIFIED");

    const converted = await post(`/api/leads/${created.body.id}/convert`).set("Idempotency-Key", "convert-1").send({});
    expect(converted.status).toBe(201);
    expect(converted.body.lead.status).toBe("CONVERTED");
    expect(converted.body.client.sourceLeadId).toBe(created.body.id);

    const auditCount = database.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number };
    expect(auditCount.count).toBe(7);
    const domainEventCount = database.prepare("SELECT COUNT(*) AS count FROM domain_events").get() as { count: number };
    expect(domainEventCount.count).toBe(6);
    const uncorrelatedAuditCount = database.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE command_id IS NULL").get() as { count: number };
    expect(uncorrelatedAuditCount.count).toBe(0);
  });

  it("creates a deterministic commercial offer and follow-up task", async () => {
    const lead = await post("/api/leads").set("Idempotency-Key", "lead-2").send({ companyName: "Phoenix Client" });
    await post(`/api/leads/${lead.body.id}/qualify`).set("Idempotency-Key", "qualify-2").send({});
    const conversion = await post(`/api/leads/${lead.body.id}/convert`).set("Idempotency-Key", "convert-2").send({});

    const offer = await post("/api/commercial-offers").set("Idempotency-Key", "offer-1").send({
      clientId: conversion.body.client.id,
      currency: "EUR",
      items: [
        { description: "Discovery", quantity: 2, unitPriceMinor: 12_500 },
        { description: "Implementation", quantity: 1, unitPriceMinor: 50_000 },
      ],
    });
    expect(offer.status).toBe(201);
    expect(offer.body).toMatchObject({ status: "DRAFT", subtotalMinor: 75_000, discountMinor: 0, totalMinor: 75_000 });

    const fetched = await get(`/api/commercial-offers/${offer.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.items).toHaveLength(2);

    const followUp = await post(`/api/commercial-offers/${offer.body.id}/follow-up`).set("Idempotency-Key", "follow-up-1").send({ dueAt: "2030-01-01T10:00:00.000Z" });
    expect(followUp.status).toBe(201);
    expect(followUp.body).toMatchObject({ type: "FOLLOW_UP", status: "OPEN", relatedEntityId: offer.body.id });
  });

  it("submits a draft offer for approval exactly once", async () => {
    const lead = await post("/api/leads").set("Idempotency-Key", "approval-lead").send({ companyName: "Approval Client" });
    await post(`/api/leads/${lead.body.id}/qualify`).set("Idempotency-Key", "approval-qualify").send({});
    const conversion = await post(`/api/leads/${lead.body.id}/convert`).set("Idempotency-Key", "approval-convert").send({});
    const offer = await post("/api/commercial-offers").set("Idempotency-Key", "approval-offer").send({
      clientId: conversion.body.client.id,
      currency: "EUR",
      items: [{ description: "Implementation", quantity: 1, unitPriceMinor: 75_000 }],
    });

    const submitted = await post(`/api/commercial-offers/${offer.body.id}/submit-for-approval`)
      .set("Idempotency-Key", "approval-submit")
      .send({ reason: "Commercial review required" });
    expect(submitted.status).toBe(201);
    expect(submitted.body).toMatchObject({
      status: "PENDING_APPROVAL",
      approval: { status: "PENDING", requestReason: "Commercial review required" },
    });

    const replay = await post(`/api/commercial-offers/${offer.body.id}/submit-for-approval`)
      .set("Idempotency-Key", "approval-submit")
      .send({ reason: "Commercial review required" });
    expect(replay.status).toBe(201);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body.approval.id).toBe(submitted.body.approval.id);

    const duplicate = await post(`/api/commercial-offers/${offer.body.id}/submit-for-approval`)
      .set("Idempotency-Key", "approval-submit-again")
      .send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("INVALID_OFFER_STATE");

    const approvalCount = database.prepare("SELECT COUNT(*) AS count FROM offer_approvals").get() as { count: number };
    expect(approvalCount.count).toBe(1);
    expect(() => database.prepare("DELETE FROM offer_approvals WHERE commercial_offer_id = ?").run(offer.body.id)).toThrow();
    expect(() => database.prepare("UPDATE commercial_offers SET status = 'DRAFT' WHERE id = ?").run(offer.body.id)).toThrow();
    const approvalEvents = database.prepare(`
      SELECT COUNT(*) AS count FROM domain_events
      WHERE command_id = (SELECT command_id FROM domain_events WHERE event_type = 'OFFER_APPROVAL_REQUESTED')
    `).get() as { count: number };
    expect(approvalEvents.count).toBe(2);
  });

  it("rejects invalid transitions and idempotency key reuse", async () => {
    const lead = await post("/api/leads").set("Idempotency-Key", "lead-3").send({ companyName: "One" });
    const invalidConversion = await post(`/api/leads/${lead.body.id}/convert`).set("Idempotency-Key", "convert-invalid").send({});
    expect(invalidConversion.status).toBe(409);
    expect(invalidConversion.body.error.code).toBe("INVALID_LEAD_STATE");
    const rejected = database.prepare("SELECT action, command_name FROM audit_events WHERE action = 'COMMAND_REJECTED'").get() as { action: string; command_name: string };
    expect(rejected).toEqual({ action: "COMMAND_REJECTED", command_name: "CONVERT_LEAD" });

    const reused = await post("/api/leads").set("Idempotency-Key", "lead-3").send({ companyName: "Different" });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("validates inputs and requires idempotency keys", async () => {
    expect((await post("/api/leads").send({ companyName: "Acme" })).status).toBe(400);
    expect((await post("/api/leads").set("Idempotency-Key", "bad").send({ companyName: "" })).status).toBe(400);
  });

  it("returns a client error for malformed JSON", async () => {
    const response = await post("/api/leads")
      .set("Content-Type", "application/json")
      .set("Idempotency-Key", "malformed")
      .send('{"companyName":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("MALFORMED_JSON");
  });

  it("requires authentication and rejects invalid credentials", async () => {
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");

    const unauthenticated = await request(app).get("/api/leads");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe("UNAUTHORIZED");

    const invalidLogin = await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: "wrong-password" });
    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body.error.message).toBe("Invalid email or password");
  });

  it("enforces admin-only user CRUD and invalidates stale role tokens", async () => {
    const created = await post("/api/users")
      .set("Idempotency-Key", "create-sales-user")
      .send({ email: "sales@phoenix.test", displayName: "Sales User", password: "SalesPassword123!", role: "SALES" });
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty("passwordHash");

    const changedPasswordReuse = await post("/api/users")
      .set("Idempotency-Key", "create-sales-user")
      .send({ email: "sales@phoenix.test", displayName: "Sales User", password: "DifferentPassword123!", role: "SALES" });
    expect(changedPasswordReuse.status).toBe(409);
    expect(changedPasswordReuse.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");

    const salesLogin = await request(app).post("/api/auth/login").send({ email: "sales@phoenix.test", password: "SalesPassword123!" });
    const salesToken = salesLogin.body.accessToken as string;
    expect((await get("/api/leads", salesToken)).status).toBe(200);
    expect((await get("/api/users", salesToken)).status).toBe(403);

    const adminLead = await post("/api/leads").set("Idempotency-Key", "actor-scoped-key").send({ companyName: "Scoped Lead" });
    const salesLead = await post("/api/leads", salesToken).set("Idempotency-Key", "actor-scoped-key").send({ companyName: "Scoped Lead" });
    expect(adminLead.status).toBe(201);
    expect(salesLead.status).toBe(201);
    expect(salesLead.body.id).not.toBe(adminLead.body.id);

    const updated = await patch(`/api/users/${created.body.id}`)
      .set("Idempotency-Key", "update-sales-role")
      .send({ role: "ACCOUNTANT" });
    expect(updated.status).toBe(200);
    expect(updated.body.role).toBe("ACCOUNTANT");
    expect((await get("/api/leads", salesToken)).status).toBe(401);

    const accountantLogin = await request(app).post("/api/auth/login").send({ email: "sales@phoenix.test", password: "SalesPassword123!" });
    expect(accountantLogin.body.user.role).toBe("ACCOUNTANT");
    const accountantToken = accountantLogin.body.accessToken as string;
    expect((await get("/api/leads", accountantToken)).status).toBe(403);
    expect((await get("/api/commercial-offers/unknown", accountantToken)).status).toBe(404);

    const manager = await post("/api/users")
      .set("Idempotency-Key", "create-manager-user")
      .send({ email: "manager@phoenix.test", displayName: "Manager User", password: "ManagerPassword123!", role: "MANAGER" });
    expect(manager.status).toBe(201);
    const managerLogin = await request(app).post("/api/auth/login").send({ email: "manager@phoenix.test", password: "ManagerPassword123!" });
    const managerLead = await post("/api/leads", managerLogin.body.accessToken).set("Idempotency-Key", "manager-lead").send({ companyName: "Manager Lead" });
    expect(managerLead.status).toBe(201);

    const deactivated = await remove(`/api/users/${created.body.id}`).set("Idempotency-Key", "deactivate-accountant");
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.active).toBe(false);
    expect((await request(app).post("/api/auth/login").send({ email: "sales@phoenix.test", password: "SalesPassword123!" })).status).toBe(401);
  });

  it("revokes the current JWT on logout", async () => {
    const logout = await post("/api/auth/logout");
    expect(logout.status).toBe(204);
    expect((await get("/api/leads")).status).toBe(401);
  });

  it("protects the final active administrator", async () => {
    const users = await get("/api/users");
    const adminId = users.body.data[0].id as string;
    const response = await remove(`/api/users/${adminId}`).set("Idempotency-Key", "self-deactivate");
    expect(response.status).toBe(403);
  });

  it("lists canonical offer/task data and audits Telegram commands", async () => {
    const lead = await post("/api/leads").set("Idempotency-Key", "telegram-read-lead").send({ companyName: "Telegram Client" });
    await post(`/api/leads/${lead.body.id}/qualify`).set("Idempotency-Key", "telegram-read-qualify").send({});
    const conversion = await post(`/api/leads/${lead.body.id}/convert`).set("Idempotency-Key", "telegram-read-convert").send({});
    const offer = await post("/api/commercial-offers").set("Idempotency-Key", "telegram-read-offer").send({
      clientId: conversion.body.client.id,
      currency: "EUR",
      items: [{ description: "Service", quantity: 1, unitPriceMinor: 10_000 }],
    });
    await post(`/api/commercial-offers/${offer.body.id}/follow-up`).set("Idempotency-Key", "telegram-read-task").send({ dueAt: "2030-01-01T10:00:00.000Z" });

    expect((await get("/api/commercial-offers")).body.data).toHaveLength(1);
    expect((await get("/api/tasks")).body.data).toHaveLength(1);

    const audit = await post("/api/integrations/telegram/audit")
      .set("Idempotency-Key", "telegram-42-status")
      .send({ updateId: 42, telegramUserId: "123456789", command: "/status", allowed: true });
    expect(audit.status).toBe(201);
    const recorded = database.prepare(`
      SELECT action, entity_type, entity_id, actor_id FROM audit_events
      WHERE action = 'TELEGRAM_COMMAND_RECEIVED'
    `).get() as { action: string; entity_type: string; entity_id: string; actor_id: string };
    expect(recorded).toMatchObject({ action: "TELEGRAM_COMMAND_RECEIVED", entity_type: "TELEGRAM_USER", entity_id: "123456789" });
    expect(recorded.actor_id).toBeTruthy();
  });

  it("enforces state and monetary invariants in SQLite", () => {
    const now = new Date().toISOString();
    expect(() => database.prepare(`
      INSERT INTO leads (id, company_name, status, created_at, updated_at)
      VALUES ('invalid-lead', 'Invalid', 'QUALIFIED', ?, ?)
    `).run(now, now)).toThrow();

    database.prepare(`
      INSERT INTO leads (id, company_name, status, created_at, updated_at)
      VALUES ('lead', 'Client', 'NEW', ?, ?)
    `).run(now, now);
    database.prepare(`
      INSERT INTO clients (id, name, source_lead_id, created_at)
      VALUES ('client', 'Client', 'lead', ?)
    `).run(now);
    expect(() => database.prepare(`
      INSERT INTO commercial_offers
        (id, client_id, status, currency, subtotal_minor, discount_minor, total_minor, created_at, updated_at)
      VALUES ('offer', 'client', 'DRAFT', 'EUR', 100, 10, 100, ?, ?)
    `).run(now, now)).toThrow();
  });
});
