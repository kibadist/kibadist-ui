import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ButtonContract } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_ROOT = path.join(__dirname, "..", "contracts");

function validateButtonContract(c: unknown): ButtonContract {
  const contract = c as Record<string, unknown>;
  const required = ["name", "version", "element", "props", "slots", "a11y"];
  for (const k of required) {
    if (!(k in contract)) throw new Error(`Invalid contract: missing '${k}'`);
  }
  if (contract.name !== "Button") throw new Error(`Invalid contract: expected name 'Button'`);
  if (contract.element !== "button") throw new Error(`Invalid contract: expected element 'button'`);
  return contract as unknown as ButtonContract;
}

export function listButtonVersions(): string[] {
  const dir = path.join(CONTRACTS_ROOT, "button");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}

export function loadButtonContract(version: string): ButtonContract {
  const p = path.join(CONTRACTS_ROOT, "button", `${version}.json`);
  const raw = fs.readFileSync(p, "utf8");
  return validateButtonContract(JSON.parse(raw));
}
