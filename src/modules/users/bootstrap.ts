import { randomUUID } from "node:crypto";
import type { Database } from "../../shared/database.js";
import { type CommandContext, recordAuditEvent, recordDomainEvent } from "../../shared/audit.js";
import { hashPassword } from "../auth/password.js";
import { UserService } from "./user-service.js";

export interface InitialAdminConfig {
  email?: string;
  password?: string;
  displayName?: string;
}

export async function bootstrapInitialAdmin(database: Database, config: InitialAdminConfig): Promise<void> {
  const count = database.prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number };
  if (count.count > 0) return;
  if (!config.email || !config.password) {
    throw new Error("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required when no users exist");
  }
  if (config.password.length < 12) throw new Error("INITIAL_ADMIN_PASSWORD must contain at least 12 characters");
  const context: CommandContext = { commandId: randomUUID(), commandName: "BOOTSTRAP_INITIAL_ADMIN", actorId: null, actorType: "SYSTEM" };
  const users = new UserService(database);
  const passwordHash = await hashPassword(config.password);
  database.exec("BEGIN IMMEDIATE");
  try {
    const user = users.create({
      email: config.email,
      displayName: config.displayName?.trim() || "Phoenix Administrator",
      role: "ADMIN",
      passwordHash,
    }, context);
    recordDomainEvent(database, "INITIAL_ADMIN_BOOTSTRAPPED", "USER", user.id, {}, context);
    recordAuditEvent(database, "INITIAL_ADMIN_BOOTSTRAPPED", "USER", user.id, {}, context);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
