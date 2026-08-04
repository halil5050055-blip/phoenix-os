import express, { type Request, type Response, type NextFunction } from "express";
import type { ZodType } from "zod";
import type { Database } from "../shared/database.js";
import { AppError } from "../shared/errors.js";
import { CommandExecutor } from "../shared/idempotency.js";
import { LeadService } from "../modules/leads/lead-service.js";
import { OfferService } from "../modules/offers/offer-service.js";
import { convertLeadSchema, createLeadSchema, createOfferSchema, followUpSchema, qualifyLeadSchema } from "./schemas.js";

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

export function createApp(database: Database) {
  const app = express();
  const leads = new LeadService(database);
  const offers = new OfferService(database);
  const commands = new CommandExecutor(database);
  app.use(express.json({ limit: "100kb" }));

  app.post("/api/leads", (request, response) => {
    const body = validate(createLeadSchema, request.body) as Parameters<typeof leads.create>[0];
    const result = commands.execute("CREATE_LEAD", idempotencyKey(request), body, (context) => ({ body: leads.create(body, context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.get("/api/leads", (_request, response) => response.json({ data: leads.list() }));

  app.post("/api/leads/:id/qualify", (request, response) => {
    const body = validate(qualifyLeadSchema, request.body) as { notes?: string };
    const result = commands.execute("QUALIFY_LEAD", idempotencyKey(request), { id: request.params.id, ...body }, (context) => ({ body: leads.qualify(request.params.id!, body.notes, context), statusCode: 200 }));
    response.set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.post("/api/leads/:id/convert", (request, response) => {
    validate(convertLeadSchema, request.body);
    const payload = { id: request.params.id };
    const result = commands.execute("CONVERT_LEAD", idempotencyKey(request), payload, (context) => ({ body: leads.convert(request.params.id!, context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.post("/api/commercial-offers", (request, response) => {
    const body = validate(createOfferSchema, request.body) as Parameters<typeof offers.create>[0];
    const result = commands.execute("CREATE_COMMERCIAL_OFFER", idempotencyKey(request), body, (context) => ({ body: offers.create(body, context), statusCode: 201 }));
    response.status(result.statusCode).set("Idempotency-Replayed", String(result.replayed)).json(result.body);
  });

  app.get("/api/commercial-offers/:id", (request, response) => response.json(offers.get(request.params.id!)));

  app.post("/api/commercial-offers/:id/follow-up", (request, response) => {
    const body = validate(followUpSchema, request.body) as { dueAt: string; notes?: string };
    const payload = { id: request.params.id, ...body };
    const result = commands.execute("CREATE_FOLLOW_UP", idempotencyKey(request), payload, (context) => ({ body: offers.createFollowUp(request.params.id!, body.dueAt, body.notes, context), statusCode: 201 }));
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
