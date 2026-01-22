import path from "node:path";
import process from "node:process";
import { exists, ensureDir, readJson, writeJson } from "./fs.js";
import type { Config, State } from "./types.js";

export const CONFIG_PATH = path.join(process.cwd(), "kibadist-ui.config.json");
export const STATE_PATH = path.join(process.cwd(), ".kibadist-ui", "state.json");
export const BASE_DIR = path.join(process.cwd(), ".kibadist-ui", "base");

export function loadConfig(): Config {
  if (!exists(CONFIG_PATH)) return { outDir: "ui", style: "tailwind" };
  const c = readJson<Partial<Config>>(CONFIG_PATH);
  return {
    outDir: c.outDir ?? "ui",
    style: c.style ?? "tailwind",
  };
}

export function ensureInitFiles(): void {
  if (!exists(CONFIG_PATH)) {
    writeJson(CONFIG_PATH, { outDir: "ui", style: "tailwind" });
  }
  ensureDir(path.join(process.cwd(), ".kibadist-ui"));
  if (!exists(STATE_PATH)) {
    writeJson(STATE_PATH, { installed: {} });
  }
}

export function loadState(): State {
  if (!exists(STATE_PATH)) return { installed: {} };
  return readJson<State>(STATE_PATH);
}

export function saveState(state: State): void {
  ensureDir(path.dirname(STATE_PATH));
  writeJson(STATE_PATH, state);
}
