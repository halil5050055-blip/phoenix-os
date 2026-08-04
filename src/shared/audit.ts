import { randomUUID } from "node:crypto";
import type { Database } from "./database.js";

export function recordAuditEvent(
  database: Database,
  action: string,
  entityType: string,
  entityId: string,
  payload: unknown,
): void {
  database.prepare(`
    INSERT INTO audit_events (id, action, entity_type, entity_id, actor_type, payload_json, created_at)
    VALUES (?, ?, ?, ?, 'SYSTEM', ?, ?)
  `).run(randomUUID(), action, entityType, entityId, JSON.stringify(payload), new Date().toISOString());
}
