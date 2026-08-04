import { createHash, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { Database } from "../../shared/database.js";
import { recordAuditEvent, type CommandContext } from "../../shared/audit.js";
import { UnauthorizedError } from "../../shared/errors.js";
import { verifyPassword } from "./password.js";
import type { Role } from "../users/user-service.js";

const ISSUER = "phoenix-bos";
const AUDIENCE = "phoenix-bos-api";
const DUMMY_PASSWORD_HASH = `scrypt$${Buffer.alloc(16).toString("base64url")}$${Buffer.alloc(64).toString("base64url")}`;

interface AuthUserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: Role;
  active: number;
  auth_version: number;
}

export interface AuthPrincipal {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  jti: string;
  expiresAt: number;
}

export class AuthService {
  private readonly secret: Uint8Array;

  constructor(private readonly database: Database, jwtSecret: string, private readonly tokenTtlSeconds = 3600) {
    const secret = new TextEncoder().encode(jwtSecret);
    if (secret.byteLength < 32) throw new Error("JWT_SECRET must contain at least 32 UTF-8 bytes");
    if (!Number.isInteger(tokenTtlSeconds) || tokenTtlSeconds < 60) throw new Error("JWT token lifetime must be at least 60 seconds");
    this.secret = secret;
  }

  async login(email: string, password: string): Promise<{ accessToken: string; tokenType: "Bearer"; expiresIn: number; user: Omit<AuthPrincipal, "jti" | "expiresAt"> }> {
    const normalizedEmail = email.trim().toLowerCase();
    const row = this.database.prepare(`
      SELECT id, email, display_name, password_hash, role, active, auth_version
      FROM users WHERE email = ?
    `).get(normalizedEmail) as unknown as AuthUserRow | undefined;
    const passwordValid = await verifyPassword(password, row?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!row || !row.active || !passwordValid) {
      const context: CommandContext = { commandId: randomUUID(), commandName: "LOGIN", actorId: null, actorType: "SYSTEM" };
      recordAuditEvent(this.database, "LOGIN_FAILED", "AUTH_IDENTITY", createHash("sha256").update(normalizedEmail).digest("hex"), {}, context);
      throw new UnauthorizedError("Invalid email or password");
    }

    const jti = randomUUID();
    const accessToken = await new SignJWT({ role: row.role, ver: row.auth_version })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(row.id)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${this.tokenTtlSeconds}s`)
      .sign(this.secret);
    const context: CommandContext = { commandId: randomUUID(), commandName: "LOGIN", actorId: row.id, actorType: "USER" };
    recordAuditEvent(this.database, "USER_LOGGED_IN", "USER", row.id, {}, context);
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.tokenTtlSeconds,
      user: { userId: row.id, email: row.email, displayName: row.display_name, role: row.role },
    };
  }

  async authenticate(token: string): Promise<AuthPrincipal> {
    try {
      const verified = await jwtVerify(token, this.secret, { algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE });
      const { sub, jti, exp, role, ver } = verified.payload;
      if (!sub || !jti || !exp || typeof role !== "string" || typeof ver !== "number") throw new Error("Missing claims");
      if (this.database.prepare("SELECT 1 FROM revoked_tokens WHERE jti = ?").get(jti)) throw new Error("Revoked token");
      const row = this.database.prepare(`
        SELECT id, email, display_name, role, active, auth_version FROM users WHERE id = ?
      `).get(sub) as unknown as Omit<AuthUserRow, "password_hash"> | undefined;
      if (!row || !row.active || row.auth_version !== ver || row.role !== role) throw new Error("Inactive or stale identity");
      return { userId: row.id, email: row.email, displayName: row.display_name, role: row.role, jti, expiresAt: exp };
    } catch {
      throw new UnauthorizedError("Access token is invalid, expired, or revoked");
    }
  }

  logout(principal: AuthPrincipal): void {
    const now = new Date().toISOString();
    const context: CommandContext = { commandId: randomUUID(), commandName: "LOGOUT", actorId: principal.userId, actorType: "USER" };
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = this.database.prepare(`
        INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at, revoked_at) VALUES (?, ?, ?, ?)
      `).run(principal.jti, principal.userId, new Date(principal.expiresAt * 1000).toISOString(), now);
      if (result.changes > 0) recordAuditEvent(this.database, "USER_LOGGED_OUT", "USER", principal.userId, {}, context);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
