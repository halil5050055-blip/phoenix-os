import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AcceptanceResult, ExecutionResult, MilestoneContract, RepositorySnapshot, ValidationCommand } from "../src/model.js";
import { Runner } from "../src/runner.js";
import { TaskStore } from "../src/store.js";
import { ValidationExecutor } from "../src/validation-executor.js";

const resources: TaskStore[] = [];
const success: ExecutionResult = { provider: "test", exitCode: 0, stdout: "", stderr: "", timedOut: false, cancelled: false };

function contract(): MilestoneContract {
  return {
    version: 1, objective: "Validation executor", scope: ["Runner validation"],
    allowedChanges: [{ pattern: "tools/phoenix-engineering/**" }], forbiddenChanges: [{ pattern: "src/**" }],
    invariants: ["Only process evidence can pass"],
    acceptanceCriteria: [{ id: "validated", description: "Validation evidence passed", mandatory: true }],
    requiredTests: ["validation"], verificationCommands: ["node"], risks: ["Process portability"],
  };
}

function snapshot(files: Record<string, string> = {}, fingerprint = "same"): RepositorySnapshot {
  return { head: "head", status: "", stagedDiff: "", files, fingerprint };
}

function setup(maxReworks = 2) {
  const root = mkdtempSync(join(tmpdir(), "phoenix-validation-root-"));
  const store = new TaskStore(join(root, "runner.sqlite"));
  resources.push(store);
  const runner = new Runner(store);
  const task = runner.createTask({ ownerRequest: "Validate Runner", repositoryRoot: root, contract: contract(), maxReworks });
  const executor = new ValidationExecutor(store, root, () => new Date(), 25);
  return { root, store, runner, task, executor };
}

function command(args: string[], overrides: Partial<ValidationCommand> = {}): ValidationCommand {
  return { id: "validation", executable: process.execPath, args, mandatory: true, timeoutMs: 1_000, maxOutputBytes: 1_024, ...overrides };
}

function reachValidate(runner: Runner, id: string) {
  runner.beginSpec(id);
  runner.finishSpec(id, snapshot(), snapshot(), success);
  runner.approve(id, runner.get(id).contractHash);
  runner.finishBuild(id, snapshot({}, "before"), snapshot({ "tools/phoenix-engineering/change.ts": "1" }, "after"), success);
}

afterEach(() => {
  while (resources.length) resources.pop()!.close();
});

describe("ValidationExecutor", () => {
  it("classifies an actual zero exit as PASS and captures stdout and stderr", async () => {
    const { task, executor } = setup();
    const run = await executor.execute(task.id, command(["-e", "console.log('out'); console.error('err')"]));
    expect(run).toMatchObject({ status: "PASS", exitCode: 0, timedOut: false, cancelled: false });
    expect(run.stdout).toContain("out");
    expect(run.stderr).toContain("err");
  });

  it("classifies a non-zero exit as FAIL", async () => {
    const { task, executor } = setup();
    const run = await executor.execute(task.id, command(["-e", "process.exit(7)"]));
    expect(run).toMatchObject({ status: "FAIL", exitCode: 7 });
  });

  it("classifies an unavailable executable as UNAVAILABLE", async () => {
    const { task, executor } = setup();
    const run = await executor.execute(task.id, command([], { executable: "phoenix-command-that-does-not-exist" }));
    expect(run.status).toBe("UNAVAILABLE");
    expect(run.exitCode).toBeNull();
    expect(run.unavailableReason).toContain("ENOENT");
  });

  it("classifies timeout as UNAVAILABLE", async () => {
    const { task, executor } = setup();
    const run = await executor.execute(task.id, command(["-e", "setTimeout(() => {}, 1000)"], { timeoutMs: 25 }));
    expect(run).toMatchObject({ status: "UNAVAILABLE", timedOut: true });
  });

  it("supports cancellation without inferring success", async () => {
    const { task, executor } = setup();
    const pending = executor.execute(task.id, command(["-e", "setTimeout(() => {}, 1000)"]), "cancel-run");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(executor.cancel("cancel-run")).toBe(true);
    expect(await pending).toMatchObject({ status: "UNAVAILABLE", cancelled: true });
  });

  it("bounds stdout and stderr independently", async () => {
    const { task, executor } = setup();
    const script = "process.stdout.write('a'.repeat(100)); process.stderr.write('b'.repeat(100))";
    const run = await executor.execute(task.id, command(["-e", script], { maxOutputBytes: 16 }));
    expect(Buffer.byteLength(run.stdout)).toBe(16);
    expect(Buffer.byteLength(run.stderr)).toBe(16);
    expect(run).toMatchObject({ stdoutTruncated: true, stderrTruncated: true, status: "PASS" });
  });

  it("persists validation runs append-only", async () => {
    const { task, store, executor } = setup();
    await executor.execute(task.id, command(["-e", "process.exit(0)"], { id: "first" }));
    await executor.execute(task.id, command(["-e", "process.exit(2)"], { id: "second" }));
    expect(store.listValidationRuns(task.id).map((run) => [run.validationId, run.status])).toEqual([["first", "PASS"], ["second", "FAIL"]]);
  });

  it("uses persisted process evidence for mandatory workflow gating", async () => {
    const passing = setup();
    reachValidate(passing.runner, passing.task.id);
    expect((await passing.runner.executeValidations(passing.task.id, [command(["-e", "process.exit(0)"])], passing.executor)).state).toBe("REVIEW");

    const failing = setup();
    reachValidate(failing.runner, failing.task.id);
    expect((await failing.runner.executeValidations(failing.task.id, [command(["-e", "process.exit(3)"])], failing.executor)).state).toBe("REWORK");

    const unavailable = setup();
    reachValidate(unavailable.runner, unavailable.task.id);
    const missing = command([], { executable: "phoenix-command-that-does-not-exist" });
    expect((await unavailable.runner.executeValidations(unavailable.task.id, [missing], unavailable.executor)).state).toBe("BLOCKED");
  });

  it("cannot reach COMPLETED from text claims or failed mandatory evidence", async () => {
    const { runner, task, executor } = setup(0);
    reachValidate(runner, task.id);
    const result = await runner.executeValidations(task.id, [command(["-e", "console.log('PASS'); process.exit(1)"])], executor);
    expect(result.state).toBe("BLOCKED");
    expect(result.completionReport).toBeNull();
    expect(() => runner.finishReview(task.id, [{ criterionId: "validated", status: "PASS", evidence: "claimed" }] satisfies AcceptanceResult[], success)).toThrow("Invalid transition");
  });
});
