import { resolve } from "node:path";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  DATABASE_PATH: z.string().trim().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  INITIAL_ADMIN_EMAIL: z.email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
  INITIAL_ADMIN_NAME: z.string().trim().min(1).max(200).optional(),
}).passthrough();

export interface BackendConfig {
  nodeEnv: "development" | "test" | "production";
  host: "0.0.0.0";
  port: number;
  databasePath: string;
  jwtSecret: string;
  initialAdmin: { email?: string; password?: string; displayName?: string };
}

export function loadBackendConfig(environment: NodeJS.ProcessEnv): BackendConfig {
  if (environment.RAILWAY_ENVIRONMENT && !environment.NODE_ENV) {
    throw new Error("NODE_ENV is required on Railway");
  }
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) throw new Error(`Invalid backend environment: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  const value = parsed.data;

  if (value.NODE_ENV === "production") {
    const required = ["PORT", "DATABASE_PATH", "INITIAL_ADMIN_EMAIL", "INITIAL_ADMIN_PASSWORD", "INITIAL_ADMIN_NAME"]
      .filter((name) => !environment[name]);
    if (required.length) throw new Error(`Missing required production environment variables: ${required.join(", ")}`);
    if (value.DATABASE_PATH !== "/data/phoenix-bos.sqlite") {
      throw new Error("Production DATABASE_PATH must be /data/phoenix-bos.sqlite");
    }
  }

  return {
    nodeEnv: value.NODE_ENV,
    host: "0.0.0.0",
    port: value.PORT ?? 3000,
    databasePath: resolve(value.DATABASE_PATH ?? "data/phoenix-bos.sqlite"),
    jwtSecret: value.JWT_SECRET,
    initialAdmin: {
      ...(value.INITIAL_ADMIN_EMAIL ? { email: value.INITIAL_ADMIN_EMAIL } : {}),
      ...(value.INITIAL_ADMIN_PASSWORD ? { password: value.INITIAL_ADMIN_PASSWORD } : {}),
      ...(value.INITIAL_ADMIN_NAME ? { displayName: value.INITIAL_ADMIN_NAME } : {}),
    },
  };
}
