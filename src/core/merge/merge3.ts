import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { resolveTailwindConstStringConflicts } from "./semantic-tailwind.js";
import type { MergeResult } from "../types.js";

function writeTmp(dir: string, name: string, content: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, content, "utf8");
  return p;
}

export interface Merge3Options {
  basePath: string;
  localPath: string;
  incomingContent: string;
  semantic?: "none" | "tailwind";
}

export function merge3({
  basePath,
  localPath,
  incomingContent,
  semantic = "none",
}: Merge3Options): MergeResult {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "contract-ui-"));
  const incomingPath = writeTmp(tmpDir, "incoming.tmp", incomingContent);

  const res = spawnSync("git", ["merge-file", "-p", localPath, basePath, incomingPath], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (res.error) {
    throw new Error(`Failed to run git merge-file (is git installed?): ${res.error.message}`);
  }
  if (res.status === 2) {
    throw new Error(`git merge-file failed:\n${res.stderr || res.stdout}`);
  }

  let merged = res.stdout;
  let hasConflicts = merged.includes("<<<<<<<");

  if (hasConflicts && semantic === "tailwind") {
    const r = resolveTailwindConstStringConflicts(merged);
    merged = r.text;
    hasConflicts = r.stillHasConflicts;
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }

  return { mergedText: merged, hasConflicts };
}
