import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import type { ExecutionProvider, ExecutionRequest } from "./provider.js";
import type { ExecutionResult } from "./model.js";

interface ActiveExecution {
  child: ChildProcess;
  cancelled: boolean;
  timedOut: boolean;
}

export interface CodexProviderConfig {
  executable?: string;
  prefixArgs?: string[];
  timeoutMs?: number;
  maxOutputBytes?: number;
  killGraceMs?: number;
  now?: () => Date;
}

function appendBounded(current: Buffer, chunk: Buffer, limit: number): { output: Buffer; truncated: boolean } {
  if (current.length >= limit) return { output: current, truncated: chunk.length > 0 };
  const remaining = limit - current.length;
  return { output: Buffer.concat([current, chunk.subarray(0, remaining)]), truncated: chunk.length > remaining };
}

function lastJsonLine(output: string): unknown | undefined {
  let parsed: unknown;
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    try { parsed = JSON.parse(line); } catch { /* bounded raw evidence remains authoritative */ }
  }
  return parsed;
}

export class CodexProvider implements ExecutionProvider {
  readonly name = "codex";
  private readonly active = new Map<string, ActiveExecution>();
  private readonly executable: string;
  private readonly prefixArgs: string[];
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly killGraceMs: number;
  private readonly now: () => Date;

  constructor(config: CodexProviderConfig = {}) {
    this.executable = config.executable ?? "codex";
    this.prefixArgs = config.prefixArgs ?? [];
    this.timeoutMs = config.timeoutMs ?? 10 * 60_000;
    this.maxOutputBytes = config.maxOutputBytes ?? 256 * 1024;
    this.killGraceMs = config.killGraceMs ?? 500;
    this.now = config.now ?? (() => new Date());
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const runId = randomUUID();
    const startedAt = this.now().toISOString();
    const sandbox = request.phase === "SPEC" || request.readOnly ? "read-only" : "workspace-write";
    const args = [
      ...this.prefixArgs, "-a", "never", "exec", "--ephemeral", "--json", "--color", "never",
      "--sandbox", sandbox, "-C", request.repositoryRoot, "-",
    ];
    return new Promise((resolveResult) => {
      let stdout: Buffer = Buffer.alloc(0);
      let stderr: Buffer = Buffer.alloc(0);
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let finished = false;
      let forceKillTimer: NodeJS.Timeout | undefined;
      const child = spawn(this.executable, args, {
        cwd: request.repositoryRoot, shell: false, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32",
      });
      const active: ActiveExecution = { child, cancelled: false, timedOut: false };
      this.active.set(request.taskId, active);

      const terminate = (signal: NodeJS.Signals) => {
        if (child.pid && process.platform !== "win32") {
          try { process.kill(-child.pid, signal); } catch { child.kill(signal); }
        } else child.kill(signal);
      };
      const stop = () => {
        terminate("SIGTERM");
        forceKillTimer = setTimeout(() => terminate("SIGKILL"), this.killGraceMs);
        forceKillTimer.unref();
      };
      const timeout = setTimeout(() => { active.timedOut = true; stop(); }, this.timeoutMs);
      timeout.unref();

      const finish = (exitCode: number | null, environmentError?: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        this.active.delete(request.taskId);
        const rawStdout = stdout.toString("utf8");
        resolveResult({
          provider: this.name, exitCode, stdout: rawStdout, stderr: stderr.toString("utf8"),
          timedOut: active.timedOut, cancelled: active.cancelled, runId, startedAt, finishedAt: this.now().toISOString(),
          stdoutTruncated, stderrTruncated,
          ...(lastJsonLine(rawStdout) !== undefined ? { structuredResult: lastJsonLine(rawStdout) } : {}),
          ...(environmentError ? { environmentError } : {}),
        });
      };

      child.stdout?.on("data", (chunk: Buffer) => {
        const next = appendBounded(stdout, chunk, this.maxOutputBytes);
        stdout = next.output;
        stdoutTruncated ||= next.truncated;
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        const next = appendBounded(stderr, chunk, this.maxOutputBytes);
        stderr = next.output;
        stderrTruncated ||= next.truncated;
      });
      child.stdin?.on("error", () => undefined);
      child.once("error", (error: NodeJS.ErrnoException) => finish(null, error.code ? `${error.code}: ${error.message}` : error.message));
      child.once("close", (code) => finish(code));
      child.stdin?.end(request.instructions);
    });
  }

  async cancel(taskId: string): Promise<void> {
    const active = this.active.get(taskId);
    if (!active) return;
    active.cancelled = true;
    if (active.child.pid && process.platform !== "win32") {
      try { process.kill(-active.child.pid, "SIGTERM"); } catch { active.child.kill("SIGTERM"); }
    } else active.child.kill("SIGTERM");
    const forceKill = setTimeout(() => {
      if (active.child.exitCode !== null || active.child.signalCode !== null) return;
      if (active.child.pid && process.platform !== "win32") {
        try { process.kill(-active.child.pid, "SIGKILL"); } catch { active.child.kill("SIGKILL"); }
      } else active.child.kill("SIGKILL");
    }, this.killGraceMs);
    forceKill.unref();
  }
}
