import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Express, NextFunction, Request, Response } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/shared/database.js";
import { createDatabase } from "../src/shared/database.js";
import { createApp } from "../src/http/app.js";
import { AuthService } from "../src/modules/auth/auth-service.js";
import { hashPassword } from "../src/modules/auth/password.js";
import { bootstrapInitialAdmin } from "../src/modules/users/bootstrap.js";
import { UserService } from "../src/modules/users/user-service.js";

const JWT_SECRET = "test-secret-that-is-at-least-thirty-two-bytes-long";
const ADMIN_EMAIL = "admin@phoenix.test";
const ADMIN_PASSWORD = "CorrectHorseBatteryStaple!";

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (request: Request, response: Response, next: NextFunction) => unknown }>;
  };
}

function routeHandler(app: Express, path: string) {
  const router = (app as unknown as { router: { stack: RouteLayer[] } }).router;
  const layer = router.stack.find((candidate) => candidate.route?.path === path && candidate.route?.methods.get);
  if (!layer?.route) throw new Error(`GET ${path} is not registered`);
  const handler = layer.route.stack[0]?.handle;
  if (!handler) throw new Error(`GET ${path} has no handler`);
  return handler;
}

function mockRequest(cookie?: string): Request {
  return {
    header(name: string) {
      return name.toLowerCase() === "cookie" ? cookie : undefined;
    },
  } as Request;
}

function mockResponse() {
  const result: { clearedCookie?: string; redirect?: { status: number; path: string }; file?: string; cacheControl?: string } = {};
  const response = {
    clearCookie(name: string) {
      result.clearedCookie = name;
      return response;
    },
    redirect(status: number, path: string) {
      result.redirect = { status, path };
      return response;
    },
    set(name: string, value: string) {
      if (name === "Cache-Control") result.cacheControl = value;
      return response;
    },
    sendFile(filename: string) {
      result.file = filename;
      return response;
    },
  } as unknown as Response;
  return { response, result };
}

describe("Phoenix BOS web routes without a network listener", () => {
  let database: Database;
  let app: Express;

  beforeEach(async () => {
    database = createDatabase(":memory:");
    await bootstrapInitialAdmin(database, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, displayName: "Test Admin" });
    app = createApp(database, { jwtSecret: JWT_SECRET });
  });

  afterEach(() => database.close());

  it("redirects an unauthenticated Leads request to login", async () => {
    const { response, result } = mockResponse();

    await routeHandler(app, "/leads")(mockRequest(), response, () => undefined);

    expect(result.redirect).toEqual({ status: 302, path: "/login" });
    expect(result.clearedCookie).toBe("phoenix_session");
    expect(result.file).toBeUndefined();
  });

  it("redirects an unauthenticated Commercial Offers request to login", async () => {
    const { response, result } = mockResponse();

    await routeHandler(app, "/commercial-offers")(mockRequest(), response, () => undefined);

    expect(result.redirect).toEqual({ status: 302, path: "/login" });
    expect(result.file).toBeUndefined();
  });

  it("redirects an unauthenticated Tasks request to login", async () => {
    const { response, result } = mockResponse();

    await routeHandler(app, "/tasks")(mockRequest(), response, () => undefined);

    expect(result.redirect).toEqual({ status: 302, path: "/login" });
    expect(result.file).toBeUndefined();
  });

  it("serves the Leads application to an authenticated administrator", async () => {
    const login = await new AuthService(database, JWT_SECRET).login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { response, result } = mockResponse();

    await routeHandler(app, "/leads")(mockRequest(`phoenix_session=${login.accessToken}`), response, () => undefined);

    expect(result.redirect).toBeUndefined();
    expect(result.file).toBe("leads.html");
    expect(result.cacheControl).toBe("no-store");
  });

  it("redirects an authenticated accountant away from the Leads workspace", async () => {
    const password = "AccountantPassword123!";
    new UserService(database).create({
      email: "accountant@phoenix.test",
      displayName: "Test Accountant",
      role: "ACCOUNTANT",
      passwordHash: await hashPassword(password),
    }, { commandId: randomUUID(), commandName: "TEST_CREATE_USER", actorId: null, actorType: "SYSTEM" });
    const login = await new AuthService(database, JWT_SECRET).login("accountant@phoenix.test", password);
    const { response, result } = mockResponse();

    await routeHandler(app, "/leads")(mockRequest(`phoenix_session=${login.accessToken}`), response, () => undefined);

    expect(result.redirect).toEqual({ status: 302, path: "/dashboard" });
    expect(result.file).toBeUndefined();

    const offersResult = mockResponse();
    await routeHandler(app, "/commercial-offers")(mockRequest(`phoenix_session=${login.accessToken}`), offersResult.response, () => undefined);
    expect(offersResult.result.redirect).toBeUndefined();
    expect(offersResult.result.file).toBe("commercial-offers.html");

    const tasksResult = mockResponse();
    await routeHandler(app, "/tasks")(mockRequest(`phoenix_session=${login.accessToken}`), tasksResult.response, () => undefined);
    expect(tasksResult.result.redirect).toEqual({ status: 302, path: "/dashboard" });
    expect(tasksResult.result.file).toBeUndefined();
  });

  it("ships the Leads UI contract without exposing token storage", () => {
    const html = readFileSync(resolve("website/public/leads.html"), "utf8");
    const script = readFileSync(resolve("website/public/assets/app.js"), "utf8");

    expect(html).toContain('data-page="leads"');
    expect(html).toContain('id="lead-form"');
    expect(html).toContain('id="qualify-form"');
    expect(html).toContain('id="lead-list"');
    expect(script).toContain('fetch("/api/leads"');
    expect(script).toContain('"Idempotency-Key": idempotencyKey');
    expect(script).toContain("dataset.idempotencyKey ||=");
    expect(script).not.toContain("localStorage");
    expect(script).not.toContain("sessionStorage");
  });

  it("ships the Commercial Offers UI contract without exposing token storage", () => {
    const html = readFileSync(resolve("website/public/commercial-offers.html"), "utf8");
    const script = readFileSync(resolve("website/public/assets/offers.js"), "utf8");

    expect(html).toContain('data-page="commercial-offers"');
    expect(html).toContain('id="offer-form"');
    expect(html).toContain('id="approval-form"');
    expect(html).toContain('id="decision-form"');
    expect(html).toContain('id="follow-up-form"');
    expect(script).toContain('fetch("/api/commercial-offers"');
    expect(script).toContain('fetch("/api/clients"');
    expect(script).toContain("/approval-decision`");
    expect(script).toContain('"Idempotency-Key": idempotencyKey');
    expect(script).not.toContain("localStorage");
    expect(script).not.toContain("sessionStorage");
  });

  it("ships the Tasks UI contract without exposing token storage", () => {
    const html = readFileSync(resolve("website/public/tasks.html"), "utf8");
    const script = readFileSync(resolve("website/public/assets/tasks.js"), "utf8");

    expect(html).toContain('data-page="tasks"');
    expect(html).toContain('id="task-list"');
    expect(html).toContain('id="complete-task-form"');
    expect(html).toContain('id="assign-task-form"');
    expect(html).toContain('id="reschedule-task-form"');
    expect(html).toContain('data-task-filter="overdue"');
    expect(html).toContain('data-task-filter="completed"');
    expect(script).toContain('fetch("/api/tasks"');
    expect(script).toContain("/complete`");
    expect(script).toContain('fetch("/api/task-assignees"');
    expect(script).toContain("/assign`");
    expect(script).toContain("/reschedule`");
    expect(script).toContain('task.assigneeId === currentUser.userId');
    expect(script).toContain('href = "/commercial-offers"');
    expect(script).not.toContain("localStorage");
    expect(script).not.toContain("sessionStorage");
  });

  it("ships the role-aware Vertical 1 report contract on the dashboard", () => {
    const html = readFileSync(resolve("website/public/dashboard.html"), "utf8");
    const script = readFileSync(resolve("website/public/assets/app.js"), "utf8");

    expect(html).toContain('id="workflow-report"');
    expect(html).toContain('id="report-lead-conversion"');
    expect(html).toContain('id="report-task-completion"');
    expect(script).toContain('fetch("/api/reports/vertical-1"');
    expect(script).toContain('["ADMIN", "MANAGER"].includes(user.role)');
  });
});
