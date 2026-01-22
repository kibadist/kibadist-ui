import path from "node:path";
import process from "node:process";
import { exists, ensureDir, readJson, writeJson } from "./fs.mjs";

export const CONFIG_PATH = path.join(process.cwd(), "contract-ui.config.json");
export const STATE_PATH = path.join(process.cwd(), ".contract-ui", "state.json");
export const BASE_DIR = path.join(process.cwd(), ".contract-ui", "base");

export function loadConfig() {
  if (!exists(CONFIG_PATH)) return { outDir: "ui", style: "tailwind" };
  const c = readJson(CONFIG_PATH);
  return {
    outDir: c.outDir ?? "ui",
    style: c.style ?? "tailwind",
  };
}

export function ensureInitFiles() {
  if (!exists(CONFIG_PATH)) {
    writeJson(CONFIG_PATH, { outDir: "ui", style: "tailwind" });
  }
  ensureDir(path.join(process.cwd(), ".contract-ui"));
  if (!exists(STATE_PATH)) {
    writeJson(STATE_PATH, { installed: {} });
  }
}

export function loadState() {
  if (!exists(STATE_PATH)) return { installed: {} };
  return readJson(STATE_PATH);
}

export function saveState(state) {
  ensureDir(path.dirname(STATE_PATH));
  writeJson(STATE_PATH, state);
}
