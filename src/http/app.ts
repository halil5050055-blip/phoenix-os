import express, { type Request, type Response, type NextFunction } from "express";
import { createHmac } from "node:crypto";
import type { ZodType } from "zod";
import type { Database } from "../shared/database.js";
import { AppError } from "../shared/errors.js";
import { CommandExecutor } from "../shared/idempotency.js";
import { LeadService } from "../modules/leads/lead-service.js";
import { OfferService } from "../modules/offers/offer-service.js";
import { AuthService } from "../modules/auth/auth-service.js";
import { authenticate, authorize } from "../modules/auth/middleware.js";
import { hashPassword } from "../modules/auth/password.js";
import { UserService } from "../modules/users/user-service.js";
import { convertLeadSchema, createLeadSchema, createOfferSchema, createUserSchema, followUpSchema, loginSchema, qualifyLeadSchema, submitForApprovalSchema, updateUserSchema } from "./schemas.js";

function validate(schema: ZodType, value: unknown): unknown {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", result.error.flatten());
  return result.data;
}

function idempotencyKey(request: Request): string {
  const key = request.header("Idempotency-Key")?.trim();
  if (!key || key.length > 200) throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  return key;
}

function resourceId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== "string" || !id) throw new AppError(400, "INVALID_RESOURCE_ID", "A valid resource identifier is required");
  return id;
}

function passwordFingerprint(password: string | undefined, secret: string): string | null {
  return password ? createHmac("sha256", secret).update(password).digest("base64url") : null;
}

function userActor(request: Request) {
  return { actorId: request.auth!.userId, actorType: "USER" as const };
}

export interface AppConfig {
  jwtSecret: string;
  tokenTtlSeconds?: number;
}

export function createApp(database: Database, config: AppConfig) {
  const app = express();
  const leads = new LeadService(database);
  const offers = new OfferService(database);
  const users = new UserService(database);
  const auth = new AuthService(database, config.jwtSecret, config.tokenTtlSeconds);
  const commands = new CommandExecutor(database);
  app.use(express.json({ limit: "100kb" }));

  app.post("/api/auth/login", async (request, response) => {
    const body = validate(loginSchema, request.body) as { email: string; password: string };
    response.json(await auth.login(body.email, body.password));
  });

  app.use("/api", authenticate(auth));

  app.post("/api/auth/logout", (request, response) => {
    auth.logout(request.auth!);
    response.status(204).send();
  });

  app.get("/api/users", authorize("ADMIN"), (_request, response) => response.json({ data: users.list() }));

  app.get("/api/users/:id", authorize("ADMIN"), (request, response) => response.json(users.get(resourceId(request))));

  app.post("/api/users", authorize("ADMIN"), async (request, response) => {
    const body = validate(createUserSchema, request.body) as { email: string; displayName: string; password: string; role: "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTANT" };
    const passwordHash = await hashPassword(body.password);
    const payload = { email: body.email, displayName: body.displayName, role: body.role, passwordFingerprint: passwordFingerprint(body.password, config.jwtSecret) };
    const result = commands.execute("CREATE_USER", idempotencyKey(request), payload, userActor(request), (context) => ({
      body: users.create({ email: body.email, displayName: body.displayName, role: body.role, passwordHash }, context),
      statusCode: 201,
    }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.patch("/api/users/:id", authorize("ADMIN"), async (request, response) => {
    const body = validate(updateUserSchema, request.body) as { email?: string; displayName?: string; password?: string; role?: "ADMIN" | "MANAGER" | "SALES" | "ACCOUNTANT"; active?: boolean };
    const passwordHash = body.password ? await hashPassword(body.password) : undefined;
    const { password: _password, ...safeBody } = body;
    const payload = { id: resourceId(request), ...safeBody, passwordFingerprint: passwordFingerprint(body.password, config.jwtSecret) };
    const result = commands.execute("UPDATE_USER", idempotencyKey(request), payload, userActor(request), (context) => ({
      body: users.update(resourceId(request), {
        ...(body.email ? { email: body.email } : {}),
        ...(body.displayName ? { displayName: body.displayName } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      }, context),
      statusCode: 200,
    }));
    response.set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.delete("/api/users/:id", authorize("ADMIN"), (request, response) => {
    const payload = { id: resourceId(request) };
    const result = commands.execute("DEACTIVATE_USER", idempotencyKey(request), payload, userActor(request), (context) => ({
      body: users.deactivate(resourceId(request), request.auth!.userId, context),
      statusCode: 200,
    }));
    response.set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.post("/api/leads", authorize("ADMIN", "MANAGER", "SALES"), (request, response) => {
    const body = validate(createLeadSchema, request.body) as Parameters<typeof leads.create>[0];
    const result = commands.execute("CREATE_LEAD", idempotencyKey(request), body, userActor(request), (context) => ({ body: leads.create(body, context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.get("/api/leads", authorize("ADMIN", "MANAGER", "SALES"), (_request, response) => response.json({ data: leads.list() }));

  app.post("/api/leads/:id/qualify", authorize("ADMIN", "MANAGER", "SALES"), (request, response) => {
    const body = validate(qualifyLeadSchema, request.body) as { notes?: string };
    const result = commands.execute("QUALIFY_LEAD", idempotencyKey(request), { id: resourceId(request), ...body }, userActor(request), (context) => ({ body: leads.qualify(resourceId(request), body.notes, context), statusCode: 200 }));
    response.set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.post("/api/leads/:id/convert", authorize("ADMIN", "MANAGER", "SALES"), (request, response) => {
    validate(convertLeadSchema, request.body);
    const payload = { id: resourceId(request) };
    const result = commands.execute("CONVERT_LEAD", idempotencyKey(request), payload, userActor(request), (context) => ({ body: leads.convert(resourceId(request), context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.post("/api/commercial-offers", authorize("ADMIN", "MANAGER", "SALES"), (request, response) => {
    const body = validate(createOfferSchema, request.body) as Parameters<typeof offers.create>[0];
    const result = commands.execute("CREATE_COMMERCIAL_OFFER", idempotencyKey(request), body, userActor(request), (context) => ({ body: offers.create(body, context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.get("/api/commercial-offers/:id", authorize("ADMIN", "MANAGER", "SALES", "ACCOUNTANT"), (request, response) => response.json(offers.get(resourceId(request))));

  app.post("/api/commercial-offers/:id/submit-for-approval", authorize("ADMIN", "MANAGER", "SALES"), (request, response) => {
    const body = validate(submitForApprovalSchema, request.body) as { reason?: string };
    const payload = { id: resourceId(request), ...body };
    const result = commands.execute("SUBMIT_COMMERCIAL_OFFER_FOR_APPROVAL", idempotencyKey(request), payload, userActor(request), (context) => ({
      body: offers.submitForApproval(resourceId(request), body.reason, context),
      statusCode: 201,
    }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.post("/api/commercial-offers/:id/follow-up", authorize("ADMIN", "MANAGER", "SALES"), (request, response) => {
    const body = validate(followUpSchema, request.body) as { dueAt: string; notes?: string };
    const payload = { id: resourceId(request), ...body };
    const result = commands.execute("CREATE_FOLLOW_UP", idempotencyKey(request), payload, userActor(request), (context) => ({ body: offers.createFollowUp(resourceId(request), body.dueAt, body.notes, context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.use((_request, response) => response.status(404).json({ error: { code: "ROUTE_NOT_FOUND", message: "Route was not found" } }));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
      return;
    }
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      response.status(400).json({ error: { code: "MALFORMED_JSON", message: "Request body contains malformed JSON" } });
      return;
    }
    if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") {
      response.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the maximum size" } });
      return;
    }
    console.error(error);
    response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
  });
  return app;
}
