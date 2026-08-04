import { describe, expect, it } from "vitest";
import { loadBackendConfig } from "../src/config.js";
import { loadTelegramConfig } from "../src/telegram/config.js";

const SECRET = "a-production-secret-with-at-least-32-bytes";

describe("deployment configuration", () => {
  it("uses safe local backend defaults and binds all interfaces", () => {
    const config = loadBackendConfig({ JWT_SECRET: SECRET });
    expect(config).toMatchObject({ nodeEnv: "development", host: "0.0.0.0", port: 3000 });
    expect(config.databasePath).toMatch(/data\/phoenix-bos\.sqlite$/);
  });

  it("requires the Railway production contract", () => {
    expect(() => loadBackendConfig({ RAILWAY_ENVIRONMENT: "production", JWT_SECRET: SECRET })).toThrow(/NODE_ENV/);
    expect(() => loadBackendConfig({ NODE_ENV: "production", JWT_SECRET: SECRET })).toThrow(/Missing required production/);
    expect(() => loadBackendConfig({
      NODE_ENV: "production",
      PORT: "3000",
      DATABASE_PATH: "/tmp/wrong.sqlite",
      JWT_SECRET: SECRET,
      INITIAL_ADMIN_EMAIL: "admin@example.com",
      INITIAL_ADMIN_PASSWORD: "StrongPassword123!",
      INITIAL_ADMIN_NAME: "Admin",
    })).toThrow(/\/data\/phoenix-bos\.sqlite/);
  });

  it("parses Telegram allowlists and requires HTTPS in production", () => {
    const base = {
      TELEGRAM_BOT_TOKEN: "123456789:abcdefghijklmnopqrstuvwxyz_123456",
      TELEGRAM_ALLOWED_USER_IDS: "123, 456",
      PHOENIX_BOT_EMAIL: "bot@example.com",
      PHOENIX_BOT_PASSWORD: "StrongPassword123!",
    };
    expect(loadTelegramConfig({ ...base, PHOENIX_API_URL: "http://127.0.0.1:3000" }).allowedUserIds).toEqual(new Set(["123", "456"]));
    expect(() => loadTelegramConfig({ ...base, NODE_ENV: "production", PHOENIX_API_URL: "http://example.com" })).toThrow(/HTTPS/);
  });
});
