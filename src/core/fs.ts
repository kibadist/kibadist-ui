import fs from "node:fs";
import path from "node:path";

export function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function readFile(p: string): string {
  return fs.readFileSync(p, "utf8");
}

export function writeFile(p: string, content: string): void {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

export function readJson<T = unknown>(p: string): T {
  return JSON.parse(readFile(p)) as T;
}

export function writeJson(p: string, obj: unknown): void {
  writeFile(p, JSON.stringify(obj, null, 2) + "\n");
}
