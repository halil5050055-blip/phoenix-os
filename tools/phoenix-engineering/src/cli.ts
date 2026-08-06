#!/usr/bin/env node
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";
import { Runner } from "./runner.js";
import { TaskStore } from "./store.js";
import type { MilestoneContract } from "./model.js";

const [command, ...args] = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const statePath = process.env.PHOENIX_RUNNER_STATE_PATH ?? resolve(homedir(), ".local/state/phoenix-engineering/runner.sqlite");
mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });
const store = new TaskStore(statePath);
const runner = new Runner(store);

try {
  if (command === "task") {
    const contractPath = option("--contract");
    const request = option("--request");
    if (!contractPath || !request) throw new Error("Usage: phoenix task --request <text> --contract <json>");
    const contract = JSON.parse(readFileSync(resolve(contractPath), "utf8")) as MilestoneContract;
    console.log(JSON.stringify(runner.createTask({ ownerRequest: request, repositoryRoot: process.cwd(), contract }), null, 2));
  } else if (command === "status") {
    console.log(JSON.stringify(runner.get(args[0] ?? ""), null, 2));
  } else if (command === "approve") {
    console.log(JSON.stringify(runner.approve(args[0] ?? "", option("--contract-hash") ?? ""), null, 2));
  } else if (command === "report") {
    console.log(JSON.stringify(runner.get(args[0] ?? "").completionReport, null, 2));
  } else if (command === "stop") {
    console.log(JSON.stringify(runner.stop(args[0] ?? ""), null, 2));
  } else {
    throw new Error("Commands: phoenix task | status | approve | report | stop");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  store.close();
}
