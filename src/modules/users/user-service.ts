import { randomUUID } from "node:crypto";
import type { Database } from "../../shared/database.js";
import { recordAuditEvent, recordDomainEvent, type CommandContext } from "../../shared/audit.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";

export const ROLES = ["ADMIN", "MANAGER", "SALES", "ACCOUNTANT"] as const;
export type Role = typeof ROLES[number];

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  role: Role;
  passwordHash: string;
}

export interface UpdateUserInput {
  email?: string;
  displayName?: string;
  role?: Role;
  active?: boolean;
  passwordHash?: string;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserService {
  constructor(private readonly database: Database) {}

  list(): User[] {
    return (this.database.prepare(`
      SELECT id, email, display_name, role, active, created_at, updated_at FROM users ORDER BY created_at
    `).all() as unknown as UserRow[]).map(mapUser);
  }

  get(id: string): User {
    const row = this.database.prepare(`
      SELECT id, email, display_name, role, active, created_at, updated_at FROM users WHERE id = ?
    `).get(id) as unknown as UserRow | undefined;
    if (!row) throw new NotFoundError("User");
    return mapUser(row);
  }

  create(input: CreateUserInput, context: CommandContext): User {
    const email = input.email.trim().toLowerCase();
    if (this.database.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
      throw new ConflictError("EMAIL_ALREADY_EXISTS", "A user with this email already exists");
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO users (id, email, display_name, password_hash, role, active, auth_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
    `).run(id, email, input.displayName, input.passwordHash, input.role, now, now);
    const payload = { email, displayName: input.displayName, role: input.role, active: true };
    recordDomainEvent(this.database, "USER_CREATED", "USER", id, payload, context);
    recordAuditEvent(this.database, "USER_CREATED", "USER", id, payload, context);
    return this.get(id);
  }

  update(id: string, input: UpdateUserInput, context: CommandContext): User {
    const current = this.get(id);
    const email = input.email?.trim().toLowerCase() ?? current.email;
    if (email !== current.email && this.database.prepare("SELECT 1 FROM users WHERE email = ? AND id != ?").get(email, id)) {
      throw new ConflictError("EMAIL_ALREADY_EXISTS", "A user with this email already exists");
    }
    const nextRole = input.role ?? current.role;
    const nextActive = input.active ?? current.active;
    this.ensureAdminContinuity(current, nextRole, nextActive);
    const securityChanged = input.passwordHash !== undefined || nextActive !== current.active || nextRole !== current.role;
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE users
      SET email = ?, display_name = ?, role = ?, active = ?,
          password_hash = COALESCE(?, password_hash),
          auth_version = auth_version + ?, updated_at = ?
      WHERE id = ?
    `).run(email, input.displayName ?? current.displayName, nextRole, nextActive ? 1 : 0, input.passwordHash ?? null, securityChanged ? 1 : 0, now, id);
    const payload = { email, displayName: input.displayName ?? current.displayName, role: nextRole, active: nextActive, passwordChanged: input.passwordHash !== undefined };
    recordDomainEvent(this.database, "USER_UPDATED", "USER", id, payload, context);
    recordAuditEvent(this.database, "USER_UPDATED", "USER", id, payload, context);
    return this.get(id);
  }

  deactivate(id: string, actorId: string, context: CommandContext): User {
    if (id === actorId) throw new ForbiddenError("Administrators cannot deactivate their own account");
    const current = this.get(id);
    if (!current.active) return current;
    this.ensureAdminContinuity(current, current.role, false);
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE users SET active = 0, auth_version = auth_version + 1, updated_at = ? WHERE id = ?
    `).run(now, id);
    recordDomainEvent(this.database, "USER_DEACTIVATED", "USER", id, {}, context);
    recordAuditEvent(this.database, "USER_DEACTIVATED", "USER", id, {}, context);
    return this.get(id);
  }

  private ensureAdminContinuity(current: User, nextRole: Role, nextActive: boolean): void {
    if (current.role === "ADMIN" && current.active && (nextRole !== "ADMIN" || !nextActive)) {
      const count = this.database.prepare(`SELECT COUNT(*) AS count FROM users WHERE role = 'ADMIN' AND active = 1`).get() as { count: number };
      if (count.count <= 1) throw new ConflictError("LAST_ADMIN_REQUIRED", "The last active administrator cannot be removed or demoted");
    }
  }
}
