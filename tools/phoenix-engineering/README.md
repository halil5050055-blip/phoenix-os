# Phoenix Engineering Runner

This isolated v0.1 core owns deterministic engineering-workflow state. Execution providers return evidence but cannot select workflow states or mark work complete.

The implemented workflow is `TASK → SPEC → WAITING_APPROVAL → BUILD → VALIDATE → REVIEW → COMPLETED`, with deterministic `REWORK` and `BLOCKED` outcomes. SPEC compares repository snapshots, BUILD checks actual changed paths against the approved contract, unavailable mandatory validation blocks completion, and approval binds to the canonical contract hash.

The replaceable provider boundary includes `ManualProvider` for deterministic tests and `CodexProvider` for local non-interactive execution. It does not integrate Telegram, MCP, Phoenix BOS business logic, or other external interfaces.

The validation executor starts explicit executable/argument arrays without a shell, confines working directories to the repository, captures bounded stdout and stderr, records exit codes and signals, and classifies actual process evidence as `PASS`, `FAIL`, or `UNAVAILABLE`. Timeouts, cancellation, missing executables, and invalid command configuration can never pass. Every validation execution is appended to SQLite before Runner applies the mandatory workflow gate.

`CodexProvider` invokes the local `codex exec` CLI non-interactively with stdin prompt delivery, explicit repository root, ephemeral sessions, JSONL output, no interactive approvals, and phase-specific sandboxing. `WorkflowExecutor` independently snapshots repository state, persists provider evidence, enforces approval and scope gates, and leaves validation to `ValidationExecutor`. Codex output remains advisory and cannot set Runner state.

Run isolated checks from the repository root:

```bash
npx tsc -p tools/phoenix-engineering/tsconfig.json --noEmit
npx vitest run tools/phoenix-engineering/tests
```

Minimal CLI commands are `task`, `status`, `approve`, `report`, and `stop`. Set `PHOENIX_RUNNER_STATE_PATH` to a SQLite path outside the repository. A harmless contract is available at `demo/harmless-task.json`.

The real CLI demonstration in `demo/codex-e2e.ts` creates a temporary Git repository and drives one harmless task through SPEC, approval, BUILD, independent validation, REVIEW, and COMPLETED without copying prompts between phases. It requires a working local Codex authentication/network environment and never targets Phoenix BOS product files.
