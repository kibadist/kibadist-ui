import fs from "node:fs";
import path from "node:path";

export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

export function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, "utf8");
}

export function readJson(p) {
  return JSON.parse(readFile(p));
}

export function writeJson(p, obj) {
  writeFile(p, JSON.stringify(obj, null, 2) + "\n");
}
