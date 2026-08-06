import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { RepositorySnapshot } from "./model.js";

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Git inspection failed: ${result.stderr.trim()}`);
  return result.stdout;
}

function digest(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function captureRepositorySnapshot(repositoryRoot: string): RepositorySnapshot {
  const paths = new Set(git(repositoryRoot, ["ls-files", "-co", "--exclude-standard", "-z"]).split("\0").filter(Boolean));
  const files: Record<string, string> = {};
  for (const path of [...paths].sort()) {
    const absolute = resolve(repositoryRoot, path);
    if (!existsSync(absolute)) {
      files[path] = digest("missing");
      continue;
    }
    const stat = lstatSync(absolute);
    files[path] = digest(stat.isSymbolicLink() ? `link:${readlinkSync(absolute)}` : readFileSync(absolute));
  }
  const head = git(repositoryRoot, ["rev-parse", "HEAD"]).trim();
  const status = git(repositoryRoot, ["status", "--porcelain=v2", "-z", "--untracked-files=all"]);
  const stagedDiff = git(repositoryRoot, ["diff", "--cached", "--binary"]);
  const fingerprint = digest(JSON.stringify({ head, status, stagedDiff, files }));
  return { head, status, stagedDiff, files, fingerprint };
}

export function changedPaths(before: RepositorySnapshot, after: RepositorySnapshot): string[] {
  const paths = new Set([...Object.keys(before.files), ...Object.keys(after.files)]);
  return [...paths].filter((path) => before.files[path] !== after.files[path]).sort();
}

export function snapshotChanged(before: RepositorySnapshot, after: RepositorySnapshot): boolean {
  return before.fingerprint !== after.fingerprint;
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

export function matchesPath(pattern: string, path: string): boolean {
  const expression = escapeRegex(pattern).replaceAll("**", "\0").replaceAll("*", "[^/]*").replaceAll("\0", ".*");
  return new RegExp(`^${expression}$`).test(path);
}

export function evaluateBuildScope(contract: { allowedChanges: PathRule[]; forbiddenChanges: PathRule[] }, paths: string[]) {
  const forbidden = paths.filter((path) => contract.forbiddenChanges.some((rule) => matchesPath(rule.pattern, path)));
  const outOfScope = paths.filter((path) => !contract.allowedChanges.some((rule) => matchesPath(rule.pattern, path)));
  return { valid: forbidden.length === 0 && outOfScope.length === 0, forbidden, outOfScope };
}

interface PathRule { pattern: string }
