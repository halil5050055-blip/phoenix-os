import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";
import { createApp } from "../src/http/app.js";

describe("Phoenix BOS Vertical 1 API", () => {
  let database: Database;
  let app: Express;

  beforeEach(() => {
    database = createDatabase(":memory:");
    app = createApp(database);
  });

  afterEach(() => database.close());

  it("creates, lists, qualifies, and converts a lead with audit history", async () => {
    const created = await request(app).post("/api/leads").set("Idempotency-Key", "lead-1").send({
      companyName: "Acme Padel",
      contact: { firstName: "Ada", email: "ada@example.com" },
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("NEW");

    const replay = await request(app).post("/api/leads").set("Idempotency-Key", "lead-1").send({
      companyName: "Acme Padel",
      contact: { firstName: "Ada", email: "ada@example.com" },
    });
    expect(replay.status).toBe(201);
    expect(replay.headers["idempotency-replayed"]).toBe("true");
    expect(replay.body.id).toBe(created.body.id);

    const listed = await request(app).get("/api/leads");
    expect(listed.body.data).toHaveLength(1);

    const qualified = await request(app).post(`/api/leads/${created.body.id}/qualify`).set("Idempotency-Key", "qualify-1").send({ notes: "Budget confirmed" });
    expect(qualified.status).toBe(200);
    expect(qualified.body.status).toBe("QUALIFIED");

    const converted = await request(app).post(`/api/leads/${created.body.id}/convert`).set("Idempotency-Key", "convert-1").send({});
    expect(converted.status).toBe(201);
    expect(converted.body.lead.status).toBe("CONVERTED");
    expect(converted.body.client.sourceLeadId).toBe(created.body.id);

    const auditCount = database.prepare("SELECT COUNT(*) AS count FROM audit_events").get() as { count: number };
    expect(auditCount.count).toBe(4);
  });

  it("creates a deterministic commercial offer and follow-up task", async () => {
    const lead = await request(app).post("/api/leads").set("Idempotency-Key", "lead-2").send({ companyName: "Phoenix Client" });
    await request(app).post(`/api/leads/${lead.body.id}/qualify`).set("Idempotency-Key", "qualify-2").send({});
    const conversion = await request(app).post(`/api/leads/${lead.body.id}/convert`).set("Idempotency-Key", "convert-2").send({});

    const offer = await request(app).post("/api/commercial-offers").set("Idempotency-Key", "offer-1").send({
      clientId: conversion.body.client.id,
      currency: "EUR",
      items: [
        { description: "Discovery", quantity: 2, unitPriceMinor: 12_500 },
        { description: "Implementation", quantity: 1, unitPriceMinor: 50_000 },
      ],
    });
    expect(offer.status).toBe(201);
    expect(offer.body).toMatchObject({ status: "DRAFT", subtotalMinor: 75_000, discountMinor: 0, totalMinor: 75_000 });

    const fetched = await request(app).get(`/api/commercial-offers/${offer.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.items).toHaveLength(2);

    const followUp = await request(app).post(`/api/commercial-offers/${offer.body.id}/follow-up`).set("Idempotency-Key", "follow-up-1").send({ dueAt: "2030-01-01T10:00:00.000Z" });
    expect(followUp.status).toBe(201);
    expect(followUp.body).toMatchObject({ type: "FOLLOW_UP", status: "OPEN", relatedEntityId: offer.body.id });
  });

  it("rejects invalid transitions and idempotency key reuse", async () => {
    const lead = await request(app).post("/api/leads").set("Idempotency-Key", "lead-3").send({ companyName: "One" });
    const invalidConversion = await request(app).post(`/api/leads/${lead.body.id}/convert`).set("Idempotency-Key", "convert-invalid").send({});
    expect(invalidConversion.status).toBe(409);
    expect(invalidConversion.body.error.code).toBe("INVALID_LEAD_STATE");

    const reused = await request(app).post("/api/leads").set("Idempotency-Key", "lead-3").send({ companyName: "Different" });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("validates inputs and requires idempotency keys", async () => {
    expect((await request(app).post("/api/leads").send({ companyName: "Acme" })).status).toBe(400);
    expect((await request(app).post("/api/leads").set("Idempotency-Key", "bad").send({ companyName: "" })).status).toBe(400);
  });
});
