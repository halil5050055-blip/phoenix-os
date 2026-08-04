import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/),
  TELEGRAM_ALLOWED_USER_IDS: z.string().min(1),
  PHOENIX_API_URL: z.url(),
  PHOENIX_BOT_EMAIL: z.email(),
  PHOENIX_BOT_PASSWORD: z.string().min(12).max(128),
  TELEGRAM_DRY_RUN: z.enum(["true", "false"]).default("false"),
}).passthrough();

export interface TelegramConfig {
  nodeEnv: "development" | "test" | "production";
  botToken: string;
  allowedUserIds: ReadonlySet<string>;
  apiUrl: string;
  apiEmail: string;
  apiPassword: string;
  dryRun: boolean;
}

export function loadTelegramConfig(environment: NodeJS.ProcessEnv): TelegramConfig {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) throw new Error(`Invalid Telegram environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  const value = parsed.data;
  const ids = value.TELEGRAM_ALLOWED_USER_IDS.split(",").map((id) => id.trim()).filter(Boolean);
  if (!ids.length || ids.some((id) => !/^\d+$/.test(id))) {
    throw new Error("TELEGRAM_ALLOWED_USER_IDS must be a comma-separated list of numeric IDs");
  }
  const apiUrl = value.PHOENIX_API_URL.replace(/\/$/, "");
  if (value.NODE_ENV === "production" && !apiUrl.startsWith("https://")) {
    throw new Error("PHOENIX_API_URL must use HTTPS in production");
  }
  return {
    nodeEnv: value.NODE_ENV,
    botToken: value.TELEGRAM_BOT_TOKEN,
    allowedUserIds: new Set(ids),
    apiUrl,
    apiEmail: value.PHOENIX_BOT_EMAIL.toLowerCase(),
    apiPassword: value.PHOENIX_BOT_PASSWORD,
    dryRun: value.TELEGRAM_DRY_RUN === "true",
  };
}
