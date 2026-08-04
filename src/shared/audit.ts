import { randomUUID } from "node:crypto";
import type { Database } from "./database.js";

export interface CommandContext {
  commandId: string;
  commandName: string;
  actorId: string | null;
  actorType: "SYSTEM" | "USER";
}

export function recordAuditEvent(
  database: Database,
  action: string,
  entityType: string,
  entityId: string,
  payload: unknown,
  context: CommandContext,
): void {
  database.prepare(`
    INSERT INTO audit_events
      (id, action, entity_type, entity_id, actor_type, payload_json, created_at, command_id, command_name, actor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), action, entityType, entityId, context.actorType, JSON.stringify(payload), new Date().toISOString(), context.commandId, context.commandName, context.actorId);
}

export function recordDomainEvent(
  database: Database,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: unknown,
  context: CommandContext,
): void {
  database.prepare(`
    INSERT INTO domain_events
      (id, event_type, aggregate_type, aggregate_id, command_id, payload_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), eventType, aggregateType, aggregateId, context.commandId, JSON.stringify(payload), new Date().toISOString());
}
