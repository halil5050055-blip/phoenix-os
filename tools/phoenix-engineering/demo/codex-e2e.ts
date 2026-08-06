import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexProvider } from "../src/codex-provider.js";
import type { AcceptanceResult, MilestoneContract, ValidationCommand } from "../src/model.js";
import { Runner } from "../src/runner.js";
import { TaskStore } from "../src/store.js";
import { ValidationExecutor } from "../src/validation-executor.js";
import { WorkflowExecutor } from "../src/workflow-executor.js";

const repositoryRoot = mkdtempSync(join(tmpdir(), "phoenix-codex-e2e-repo-"));
const stateRoot = mkdtempSync(join(tmpdir(), "phoenix-codex-e2e-state-"));
writeFileSync(join(repositoryRoot, "README.md"), "Harmless Phoenix Engineering Runner CodexProvider demonstration.\n");
execFileSync("git", ["init", "-q"], { cwd: repositoryRoot });
execFileSync("git", ["config", "user.email", "runner@example.test"], { cwd: repositoryRoot });
execFileSync("git", ["config", "user.name", "Phoenix Runner"], { cwd: repositoryRoot });
execFileSync("git", ["add", "README.md"], { cwd: repositoryRoot });
execFileSync("git", ["commit", "-qm", "demo baseline"], { cwd: repositoryRoot });

const contract: MilestoneContract = {
  version: 1,
  objective: "Create sample.txt containing exactly: hello from Phoenix Runner",
  scope: ["Create one harmless text file in the isolated demonstration repository."],
  allowedChanges: [{ pattern: "sample.txt" }],
  forbiddenChanges: [{ pattern: ".git/**" }, { pattern: "README.md" }],
  invariants: ["Do not modify README.md or Git state.", "Do not run validation commands."],
  acceptanceCriteria: [{ id: "sample-content", description: "sample.txt contains the exact required line and newline.", mandatory: true }],
  requiredTests: ["sample-content-validation"],
  verificationCommands: ["Read sample.txt and compare its exact content."],
  risks: ["Codex authentication or network access may be unavailable."],
};

const store = new TaskStore(join(stateRoot, "runner.sqlite"));
try {
  const runner = new Runner(store);
  const workflow = new WorkflowExecutor(runner, store);
  const provider = new CodexProvider({ timeoutMs: 120_000, maxOutputBytes: 128 * 1024 });
  const task = runner.createTask({
    ownerRequest: "Create the harmless sample file specified by the approved contract.", repositoryRoot, contract,
  });

  const spec = await workflow.runSpec(task.id, provider);
  if (spec.state !== "WAITING_APPROVAL") {
    console.error(JSON.stringify({ state: spec.state, providerRuns: store.listProviderRuns(task.id) }, null, 2));
    throw new Error(`SPEC ended in ${spec.state}`);
  }
  runner.approve(task.id, spec.contractHash);

  const build = await workflow.runBuild(task.id, provider);
  if (build.state !== "VALIDATE") throw new Error(`BUILD ended in ${build.state}`);

  const validation: ValidationCommand = {
    id: "sample-content-validation", executable: process.execPath,
    args: ["-e", "const fs=require('fs'); process.exit(fs.readFileSync('sample.txt','utf8') === 'hello from Phoenix Runner\\n' ? 0 : 1)"],
    mandatory: true, timeoutMs: 5_000,
  };
  const validated = await runner.executeValidations(task.id, [validation], new ValidationExecutor(store, repositoryRoot));
  if (validated.state !== "REVIEW") throw new Error(`VALIDATE ended in ${validated.state}`);

  const acceptance: AcceptanceResult[] = [{
    criterionId: "sample-content",
    status: readFileSync(join(repositoryRoot, "sample.txt"), "utf8") === "hello from Phoenix Runner\n" ? "PASS" : "FAIL",
    evidence: "Runner compared the exact file content after deterministic validation.",
  }];
  const completed = await workflow.runReview(task.id, provider, acceptance);
  if (completed.state !== "COMPLETED") throw new Error(`REVIEW ended in ${completed.state}`);

  console.log(JSON.stringify({
    taskId: task.id,
    state: completed.state,
    providerPhases: store.listProviderRuns(task.id).map((run) => ({ phase: run.phase, exitCode: run.exitCode })),
    validations: store.listValidationRuns(task.id).map((run) => ({ id: run.validationId, status: run.status })),
    report: completed.completionReport,
    repositoryRoot,
  }, null, 2));
} finally {
  store.close();
}
