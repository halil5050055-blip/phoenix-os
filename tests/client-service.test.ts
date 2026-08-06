import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";
import { LeadService } from "../src/modules/leads/lead-service.js";
import { ClientService } from "../src/modules/clients/client-service.js";

describe("ClientService", () => {
  let database: Database;

  beforeEach(() => {
    database = createDatabase(":memory:");
  });

  afterEach(() => database.close());

  it("lists the canonical client projection created from a converted lead", () => {
    const leads = new LeadService(database);
    const context = () => ({ commandId: randomUUID(), commandName: "TEST", actorId: null, actorType: "SYSTEM" as const });
    const lead = leads.create({ companyName: "Client Company", contact: { firstName: "Ada" } }, context());
    leads.qualify(lead.id, "Need verified", context());
    const conversion = leads.convert(lead.id, context());

    expect(new ClientService(database).list()).toEqual([{
      id: conversion.client.id,
      name: "Client Company",
      primaryContactId: conversion.client.primaryContactId,
      sourceLeadId: lead.id,
      createdAt: conversion.client.createdAt,
    }]);
  });
});
