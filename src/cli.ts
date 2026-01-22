#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { exists, readJson, writeFile } from "./core/fs.js";
import { listButtonVersions, loadButtonContract } from "./core/contracts.js";
import { contractToButtonIR } from "./core/ir.js";
import { generateButton } from "./core/generate.js";
import { merge3 } from "./core/merge/merge3.js";
import { ensureInitFiles, loadConfig, loadState, saveState, BASE_DIR } from "./core/state.js";
import type { ParsedArgs } from "./core/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = readJson<{ version: string }>(pkgPath);
  return pkg.version;
}

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[k] = v;
    } else {
      out._.push(a);
    }
  }
  return out;
}

function help(): void {
  console.log(
    `
kibadist-ui (Button-only v1)

Commands:
  init
  add button [--style tailwind|css-modules] [--version 1.0.0]
  upgrade button --to 1.1.0

Examples:
  kibadist-ui init
  kibadist-ui add button --style tailwind --version 1.0.0
  kibadist-ui upgrade button --to 1.1.0
`.trim(),
  );
}

function init(): void {
  ensureInitFiles();
  console.log("Initialized.");
  console.log("Available Button versions:", listButtonVersions().join(", "));
}

function addButton(args: ParsedArgs): void {
  ensureInitFiles();
  const cfg = loadConfig();
  const state = loadState();

  const outDir = cfg.outDir;
  const style = (args.style === true ? undefined : (args.style as string)) ?? cfg.style;
  const version = (args.version === true ? undefined : (args.version as string)) ?? "1.0.0";

  const contract = loadButtonContract(version);
  const ir = contractToButtonIR(contract);

  const files = generateButton({ ir, outDir, style: style as "tailwind" | "css-modules" });

  for (const f of files) {
    const abs = path.join(process.cwd(), f.relPath);
    writeFile(abs, f.content);
    console.log("Wrote", f.relPath);

    // store base snapshot
    const baseAbs = path.join(BASE_DIR, "button", ir.version, path.basename(f.relPath));
    writeFile(baseAbs, f.content);
  }

  state.installed.button = {
    version: ir.version,
    style: style as "tailwind" | "css-modules",
    outDir,
  };
  saveState(state);

  console.log(`Added Button ${ir.version} (${style})`);
}

function upgradeButton(args: ParsedArgs): void {
  ensureInitFiles();
  const state = loadState();
  const inst = state.installed?.button;
  if (!inst) die("Button not installed. Run: add button");

  const to = args.to === true ? undefined : (args.to as string);
  if (!to) die("Missing --to <version>");

  const from = inst.version;
  if (to === from) {
    console.log("Nothing to do; already at", to);
    return;
  }

  const outDir = inst.outDir;
  const style = inst.style;

  const contract = loadButtonContract(to);
  const ir = contractToButtonIR(contract);

  const incomingFiles = generateButton({ ir, outDir, style });

  let anyConflicts = false;

  for (const f of incomingFiles) {
    const localAbs = path.join(process.cwd(), f.relPath);
    const baseAbs = path.join(BASE_DIR, "button", from, path.basename(f.relPath));

    if (!exists(localAbs)) die(`Missing local file: ${f.relPath}`);
    if (!exists(baseAbs)) die(`Missing base snapshot: ${path.relative(process.cwd(), baseAbs)}`);

    const semantic = style === "tailwind" && f.relPath.endsWith(".tsx") ? "tailwind" : "none";

    const res = merge3({
      basePath: baseAbs,
      localPath: localAbs,
      incomingContent: f.content,
      semantic,
    });

    writeFile(localAbs, res.mergedText);
    console.log(res.hasConflicts ? "Merged (conflicts)" : "Merged", f.relPath);

    if (res.hasConflicts) anyConflicts = true;
  }

  if (anyConflicts) {
    console.log("\nConflicts remain (look for <<<<<<< markers). Resolve manually.");
    console.log("State was NOT advanced.");
    return;
  }

  // Upgrade successful: store new base snapshots, update state.
  for (const f of incomingFiles) {
    const baseAbsNew = path.join(BASE_DIR, "button", to, path.basename(f.relPath));
    writeFile(baseAbsNew, f.content);
  }

  inst.version = to;
  state.installed.button = inst;
  saveState(state);

  console.log(`\nUpgraded Button ${from} -> ${to}`);
}

const args = parseArgs(process.argv.slice(2));
const [cmd, subcmd] = args._;

if ((args.version === true || args.v === true || cmd === "version") && !subcmd) {
  console.log(getVersion());
  process.exit(0);
}

if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
  help();
  process.exit(0);
}

if (cmd === "init") {
  init();
  process.exit(0);
}

if (cmd === "add" && subcmd === "button") {
  addButton(args);
  process.exit(0);
}

if (cmd === "upgrade" && subcmd === "button") {
  upgradeButton(args);
  process.exit(0);
}

die("Unknown command. Run: kibadist-ui help");
