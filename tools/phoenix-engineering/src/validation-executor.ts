import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { ValidationCommand, ValidationRunRecord } from "./model.js";
import { TaskStore } from "./store.js";

interface ActiveRun {
  child: ChildProcess;
  cancelled: boolean;
  timedOut: boolean;
}

function boundedAppend(current: Buffer, chunk: Buffer, limit: number): { value: Buffer; truncated: boolean } {
  if (current.length >= limit) return { value: current, truncated: chunk.length > 0 };
  const remaining = limit - current.length;
  return { value: Buffer.concat([current, chunk.subarray(0, remaining)]), truncated: chunk.length > remaining };
}

export class ValidationExecutor {
  private readonly active = new Map<string, ActiveRun>();

  constructor(
    private readonly store: TaskStore,
    private readonly repositoryRoot: string,
    private readonly now: () => Date = () => new Date(),
    private readonly killGraceMs = 250,
  ) {}

  async execute(taskId: string, command: ValidationCommand, requestedRunId: string = randomUUID()): Promise<ValidationRunRecord> {
    const startedAt = this.now().toISOString();
    const cwd = resolve(this.repositoryRoot, command.cwd ?? ".");
    const relation = relative(this.repositoryRoot, cwd);
    if (relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
      return this.persistUnavailable(taskId, command, requestedRunId, cwd, startedAt, "Validation working directory is outside the repository");
    }
    if (!command.executable || command.timeoutMs <= 0 || !Number.isInteger(command.timeoutMs)) {
      return this.persistUnavailable(taskId, command, requestedRunId, cwd, startedAt, "Validation command configuration is invalid");
    }

    const limit = command.maxOutputBytes ?? 64 * 1024;
    return new Promise((resolveRun) => {
      let stdout: Buffer = Buffer.alloc(0);
      let stderr: Buffer = Buffer.alloc(0);
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let finished = false;
      let forceKillTimer: NodeJS.Timeout | undefined;
      const child = spawn(command.executable, command.args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
      const active: ActiveRun = { child, cancelled: false, timedOut: false };
      this.active.set(requestedRunId, active);

      const terminate = () => {
        if (child.pid && process.platform !== "win32") {
          try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
        } else child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => {
          if (child.pid && process.platform !== "win32") {
            try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); }
          } else child.kill("SIGKILL");
        }, this.killGraceMs);
        forceKillTimer.unref();
      };

      const timeout = setTimeout(() => {
        active.timedOut = true;
        terminate();
      }, command.timeoutMs);
      timeout.unref();

      child.stdout?.on("data", (chunk: Buffer) => {
        const next = boundedAppend(stdout, chunk, limit);
        stdout = next.value;
        stdoutTruncated ||= next.truncated;
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        const next = boundedAppend(stderr, chunk, limit);
        stderr = next.value;
        stderrTruncated ||= next.truncated;
      });

      const finish = (exitCode: number | null, signal: NodeJS.Signals | null, unavailableReason?: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        this.active.delete(requestedRunId);
        const status = unavailableReason || active.timedOut || active.cancelled ? "UNAVAILABLE" : exitCode === 0 ? "PASS" : "FAIL";
        const run: ValidationRunRecord = {
          runId: requestedRunId, taskId, validationId: command.id, executable: command.executable,
          args: [...command.args], cwd, mandatory: command.mandatory, status,
          startedAt, finishedAt: this.now().toISOString(), exitCode, signal,
          stdout: stdout.toString("utf8"), stderr: stderr.toString("utf8"), stdoutTruncated, stderrTruncated,
          timedOut: active.timedOut, cancelled: active.cancelled,
          ...(unavailableReason ? { unavailableReason } : {}),
        };
        this.store.appendValidationRun(run);
        resolveRun(run);
      };

      child.once("error", (error: NodeJS.ErrnoException) => finish(null, null, error.code ? `${error.code}: ${error.message}` : error.message));
      child.once("close", (code, signal) => finish(code, signal));
    });
  }

  cancel(runId: string): boolean {
    const active = this.active.get(runId);
    if (!active) return false;
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
    return true;
  }

  private persistUnavailable(taskId: string, command: ValidationCommand, runId: string, cwd: string, startedAt: string, reason: string): ValidationRunRecord {
    const run: ValidationRunRecord = {
      runId, taskId, validationId: command.id, executable: command.executable, args: [...command.args], cwd,
      mandatory: command.mandatory, status: "UNAVAILABLE", startedAt, finishedAt: this.now().toISOString(),
      exitCode: null, signal: null, stdout: "", stderr: "", stdoutTruncated: false, stderrTruncated: false,
      timedOut: false, cancelled: false, unavailableReason: reason,
    };
    this.store.appendValidationRun(run);
    return run;
  }
}
