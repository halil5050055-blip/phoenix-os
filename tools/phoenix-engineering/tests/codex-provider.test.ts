import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexProvider } from "../src/codex-provider.js";
import type { AcceptanceResult, MilestoneContract, ValidationCommand } from "../src/model.js";
import type { ExecutionRequest } from "../src/provider.js";
import { captureRepositorySnapshot } from "../src/repository.js";
import { Runner } from "../src/runner.js";
import { TaskStore } from "../src/store.js";
import { ValidationExecutor } from "../src/validation-executor.js";
import { WorkflowExecutor } from "../src/workflow-executor.js";

const stores: TaskStore[] = [];

function contract(allowed = "sample.txt"): MilestoneContract {
  return {
    version: 1, objective: "Create a harmless sample file", scope: ["Isolated sample only"],
    allowedChanges: [{ pattern: allowed }], forbiddenChanges: [{ pattern: ".git/**" }, { pattern: "src/**" }],
    invariants: ["Runner controls state"],
    acceptanceCriteria: [{ id: "sample", description: "sample.txt contains hello", mandatory: true }],
    requiredTests: ["sample-validation"], verificationCommands: ["node sample validation"], risks: ["Demo only"],
  };
}

function repository() {
  const root = mkdtempSync(join(tmpdir(), "phoenix-codex-repo-"));
  writeFileSync(join(root, "README.md"), "fixture\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "runner@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Runner Test"], { cwd: root });
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  return root;
}

function setup(allowed = "sample.txt") {
  const root = repository();
  const stateRoot = mkdtempSync(join(tmpdir(), "phoenix-codex-state-"));
  const store = new TaskStore(join(stateRoot, "runner.sqlite"));
  stores.push(store);
  const runner = new Runner(store);
  const task = runner.createTask({ ownerRequest: "Create sample.txt", repositoryRoot: root, contract: contract(allowed) });
  return { root, store, runner, task, workflow: new WorkflowExecutor(runner, store) };
}

function request(root: string): ExecutionRequest {
  return { taskId: "task", phase: "SPEC", repositoryRoot: root, contract: contract(), instructions: "safe prompt", readOnly: true };
}

function fakeProvider(script: string, options: { timeoutMs?: number; maxOutputBytes?: number } = {}) {
  return new CodexProvider({
    executable: process.execPath, prefixArgs: ["-e", script, "--"], timeoutMs: options.timeoutMs ?? 1_000,
    maxOutputBytes: options.maxOutputBytes ?? 4_096, killGraceMs: 25,
  });
}

const passScript = "process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({type:'result',status:'ok'})))";

afterEach(() => {
  while (stores.length) stores.pop()!.close();
});

describe("CodexProvider", () => {
  it("executes non-interactively with controlled prompt, cwd, output, and zero exit", async () => {
    const root = repository();
    const script = "let input=''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => { console.error(process.cwd()); console.log(JSON.stringify({input,args:process.argv.slice(1)})); })";
    const result = await fakeProvider(script).execute(request(root));
    expect(result).toMatchObject({ provider: "codex", exitCode: 0, timedOut: false, cancelled: false });
    expect(result.stderr).toContain(root);
    expect(result.stdout).toContain("safe prompt");
    expect(result.stdout).toContain("read-only");
    expect(result.structuredResult).toBeTruthy();
  });

  it("captures non-zero exit without claiming success", async () => {
    const root = repository();
    expect(await fakeProvider("process.stdin.resume(); process.stdin.on('end', () => process.exit(9))").execute(request(root))).toMatchObject({ exitCode: 9, timedOut: false });
  });

  it("reports an unavailable Codex executable", async () => {
    const root = repository();
    const result = await new CodexProvider({ executable: "codex-that-does-not-exist", timeoutMs: 100 }).execute(request(root));
    expect(result.exitCode).toBeNull();
    expect(result.environmentError).toContain("ENOENT");
  });

  it("times out and supports cancellation", async () => {
    const root = repository();
    const timeoutProvider = fakeProvider("process.stdin.resume(); setTimeout(() => {}, 1000)", { timeoutMs: 25 });
    expect(await timeoutProvider.execute(request(root))).toMatchObject({ exitCode: null, timedOut: true });

    const cancelProvider = fakeProvider("process.stdin.resume(); setTimeout(() => {}, 1000)", { timeoutMs: 2_000 });
    const pending = cancelProvider.execute(request(root));
    await new Promise((resolve) => setTimeout(resolve, 20));
    await cancelProvider.cancel("task");
    expect(await pending).toMatchObject({ exitCode: null, cancelled: true });
  });

  it("captures and independently bounds stdout and stderr", async () => {
    const root = repository();
    const script = "process.stdin.resume(); process.stdin.on('end', () => { process.stdout.write('a'.repeat(100)); process.stderr.write('b'.repeat(100)); })";
    const result = await fakeProvider(script, { maxOutputBytes: 16 }).execute(request(root));
    expect(Buffer.byteLength(result.stdout)).toBe(16);
    expect(Buffer.byteLength(result.stderr)).toBe(16);
    expect(result).toMatchObject({ stdoutTruncated: true, stderrTruncated: true, exitCode: 0 });
  });

  it("blocks SPEC mutation and persists repository execution evidence", async () => {
    const { root, store, runner, task, workflow } = setup();
    const script = "const fs=require('fs'); const path=require('path'); const i=process.argv.indexOf('-C'); fs.writeFileSync(path.join(process.argv[i+1], 'spec-mutation.txt'), 'bad'); process.stdin.resume()";
    expect((await workflow.runSpec(task.id, fakeProvider(script))).state).toBe("BLOCKED");
    const records = store.listProviderRuns(task.id);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ phase: "SPEC", provider: "codex", changedPaths: ["spec-mutation.txt"] });
    expect(runner.get(task.id).state).toBe("BLOCKED");
    expect(captureRepositorySnapshot(root).files).toHaveProperty("spec-mutation.txt");
  });

  it("detects BUILD scope violation after contract-bound approval", async () => {
    const { store, runner, task, workflow } = setup("sample.txt");
    expect((await workflow.runSpec(task.id, fakeProvider(passScript))).state).toBe("WAITING_APPROVAL");
    runner.approve(task.id, runner.get(task.id).contractHash);
    const script = "const fs=require('fs'); const path=require('path'); const i=process.argv.indexOf('-C'); fs.writeFileSync(path.join(process.argv[i+1], 'outside.txt'), 'bad'); process.stdin.resume()";
    expect((await workflow.runBuild(task.id, fakeProvider(script))).state).toBe("REWORK");
    expect(store.listProviderRuns(task.id).at(-1)).toMatchObject({ phase: "BUILD", changedPaths: ["outside.txt"] });
  });

  it("cannot mutate authoritative state by provider execution alone", async () => {
    const { root, runner, task } = setup();
    await fakeProvider(passScript).execute(request(root));
    expect(runner.get(task.id).state).toBe("TASK");
  });

  it("runs a harmless complete workflow without prompt copy/paste", async () => {
    const { root, store, runner, task, workflow } = setup();
    expect((await workflow.runSpec(task.id, fakeProvider(passScript))).state).toBe("WAITING_APPROVAL");
    runner.approve(task.id, runner.get(task.id).contractHash);

    const buildScript = "const fs=require('fs'); const path=require('path'); const i=process.argv.indexOf('-C'); fs.writeFileSync(path.join(process.argv[i+1], 'sample.txt'), 'hello\\n'); process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({implemented:true})))";
    expect((await workflow.runBuild(task.id, fakeProvider(buildScript))).state).toBe("VALIDATE");

    const validation: ValidationCommand = {
      id: "sample-validation", executable: process.execPath,
      args: ["-e", "const fs=require('fs'); process.exit(fs.readFileSync('sample.txt','utf8') === 'hello\\n' ? 0 : 1)"],
      mandatory: true, timeoutMs: 1_000,
    };
    const validationExecutor = new ValidationExecutor(store, root);
    expect((await runner.executeValidations(task.id, [validation], validationExecutor)).state).toBe("REVIEW");

    const acceptance: AcceptanceResult[] = [{
      criterionId: "sample", status: readFileSync(join(root, "sample.txt"), "utf8") === "hello\n" ? "PASS" : "FAIL",
      evidence: "sample.txt content checked directly",
    }];
    const completed = await workflow.runReview(task.id, fakeProvider(passScript), acceptance);
    expect(completed.state).toBe("COMPLETED");
    expect(completed.completionReport).not.toBeNull();
    expect(store.listProviderRuns(task.id).map((run) => run.phase)).toEqual(["SPEC", "BUILD", "REVIEW"]);
    expect(store.listValidationRuns(task.id)).toHaveLength(1);
  });
});
