import { createHash, randomUUID } from "node:crypto";
import type { Database } from "./database.js";
import { recordAuditEvent, type CommandContext } from "./audit.js";
import { AppError, ConflictError } from "./errors.js";

export interface CommandResult<T> {
  body: T;
  statusCode: number;
  replayed: boolean;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class CommandExecutor {
  constructor(private readonly database: Database) {}

  execute<T>(commandName: string, key: string, payload: unknown, handler: (context: CommandContext) => { body: T; statusCode: number }): CommandResult<T> {
    const requestHash = createHash("sha256").update(stableStringify(payload)).digest("hex");
    const context = { commandId: randomUUID(), commandName };
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const existing = this.database.prepare(`
        SELECT request_hash, response_json, status_code
        FROM idempotency_records WHERE command_name = ? AND idempotency_key = ?
      `).get(commandName, key) as { request_hash: string; response_json: string; status_code: number } | undefined;

      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw new ConflictError("IDEMPOTENCY_KEY_REUSED", "The idempotency key was already used with a different request");
        }
        this.database.exec("COMMIT");
        return { body: JSON.parse(existing.response_json) as T, statusCode: existing.status_code, replayed: true };
      }

      const result = handler(context);
      this.database.prepare(`
        INSERT INTO idempotency_records
          (command_name, idempotency_key, request_hash, response_json, status_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(commandName, key, requestHash, JSON.stringify(result.body), result.statusCode, new Date().toISOString());

      this.database.exec("COMMIT");
      return { ...result, replayed: false };
    } catch (error) {
      this.database.exec("ROLLBACK");
      if (error instanceof AppError) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
          recordAuditEvent(this.database, "COMMAND_REJECTED", "COMMAND", context.commandId, {
            errorCode: error.code,
            requestHash,
          }, context);
          this.database.exec("COMMIT");
        } catch (auditError) {
          this.database.exec("ROLLBACK");
          throw new AggregateError([error, auditError], "Command failed and its rejection could not be audited");
        }
      }
      throw error;
    }
  }
}
