#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { exists, readJson, writeFile } from "./core/fs.js";
import { listButtonVersions, loadButtonContract } from "./core/contracts.js";
import { contractToButtonIR } from "./core/ir.js";
import { generateButton } from "./core/generate.js";
import { merge3 } from "./core/merge/merge3.js";
import { ensureInitFiles, loadConfig, loadState, saveState, BASE_DIR, CONFIG_PATH } from "./core/state.js";
import type { ButtonContract, ParsedArgs } from "./core/types.js";

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

interface ErrorContext {
  usage?: string;
  available?: string[];
  current?: string;
  example?: string;
}

function dieWithContext(error: string, ctx: ErrorContext): never {
  const lines = [`Error: ${error}`, ""];

  if (ctx.usage) {
    lines.push(`Usage: ${ctx.usage}`, "");
  }

  if (ctx.available) {
    lines.push(`Available versions: ${ctx.available.join(", ")}`);
  }

  if (ctx.current) {
    lines.push(`Currently installed: ${ctx.current}`);
  }

  if (ctx.available || ctx.current) {
    lines.push("");
  }

  if (ctx.example) {
    lines.push("Example:", `  ${ctx.example}`);
  }

  die(lines.join("\n"));
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
  add button [--style tailwind|css-modules] [--version 1.0.0] [--dry-run]
  upgrade button --to 1.1.0 [--dry-run]
  status

Options:
  --dry-run    Preview changes without writing files

Examples:
  kibadist-ui init
  kibadist-ui add button --style tailwind --version 1.0.0
  kibadist-ui add button --dry-run
  kibadist-ui upgrade button --to 1.1.0
  kibadist-ui upgrade button --to 1.1.0 --dry-run
  kibadist-ui status
`.trim(),
  );
}

function init(): void {
  ensureInitFiles();
  console.log("Initialized.");
  console.log("Available Button versions:", listButtonVersions().join(", "));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getContractDiff(from: ButtonContract, to: ButtonContract): string[] {
  const changes: string[] = [];

  // Check for new props
  const fromProps = Object.keys(from.props);
  const toProps = Object.keys(to.props);
  for (const prop of toProps) {
    if (!fromProps.includes(prop)) {
      changes.push(`+ ${prop} prop`);
    }
  }

  // Check for new slots (slots is typed as unknown, so we need to handle it carefully)
  const fromSlots = Array.isArray(from.slots) ? from.slots : [];
  const toSlots = Array.isArray(to.slots) ? to.slots : [];
  for (const slot of toSlots) {
    if (!fromSlots.includes(slot)) {
      changes.push(`+ ${slot} slot`);
    }
  }

  // Check for new a11y attributes
  if (to.a11y.busyAttribute && !from.a11y.busyAttribute) {
    changes.push(`+ ${to.a11y.busyAttribute} attribute`);
  }
  if (to.a11y.loadingDisables && !from.a11y.loadingDisables) {
    changes.push(`+ loadingDisables behavior`);
  }

  return changes;
}

function addButton(args: ParsedArgs): void {
  ensureInitFiles();
  const cfg = loadConfig();
  const state = loadState();
  const dryRun = args["dry-run"] === true;

  const outDir = cfg.outDir;
  const style = (args.style === true ? undefined : (args.style as string)) ?? cfg.style;
  const version = (args.version === true ? undefined : (args.version as string)) ?? "1.0.0";

  const contract = loadButtonContract(version);
  const ir = contractToButtonIR(contract);

  const files = generateButton({ ir, outDir, style: style as "tailwind" | "css-modules" });

  if (dryRun) {
    console.log("\nWould create:");
    for (const f of files) {
      const size = Buffer.byteLength(f.content, "utf-8");
      console.log(`  ${f.relPath} (${formatBytes(size)})`);
    }
    console.log();
    return;
  }

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
  if (!inst) {
    const versions = listButtonVersions();
    dieWithContext("Button is not installed", {
      usage: "kibadist-ui add button [--version <version>]",
      available: versions,
      example: "kibadist-ui add button",
    });
  }

  const to = args.to === true ? undefined : (args.to as string);
  if (!to) {
    const versions = listButtonVersions();
    dieWithContext("Missing required flag --to", {
      usage: "kibadist-ui upgrade button --to <version>",
      available: versions,
      current: inst.version,
      example: `kibadist-ui upgrade button --to ${versions[versions.length - 1]}`,
    });
  }

  const from = inst.version;
  if (to === from) {
    console.log("Nothing to do; already at", to);
    return;
  }

  const dryRun = args["dry-run"] === true;
  const outDir = inst.outDir;
  const style = inst.style;

  const fromContract = loadButtonContract(from);
  const toContract = loadButtonContract(to);
  const contract = toContract;
  const ir = contractToButtonIR(contract);

  const incomingFiles = generateButton({ ir, outDir, style });

  if (dryRun) {
    console.log("\nWould modify:");
    const changes = getContractDiff(fromContract, toContract);
    for (const f of incomingFiles) {
      console.log(`  ${f.relPath}`);
      for (const change of changes) {
        console.log(`    ${change}`);
      }
    }
    console.log();
    return;
  }

  let anyConflicts = false;

  for (const f of incomingFiles) {
    const localAbs = path.join(process.cwd(), f.relPath);
    const baseAbs = path.join(BASE_DIR, "button", from, path.basename(f.relPath));

    if (!exists(localAbs)) {
      dieWithContext(`Missing local file: ${f.relPath}`, {
        usage: "kibadist-ui add button",
        example: "kibadist-ui add button --version " + from,
      });
    }
    if (!exists(baseAbs)) {
      dieWithContext(`Missing base snapshot: ${path.relative(process.cwd(), baseAbs)}`, {
        usage: "kibadist-ui add button",
        example: "kibadist-ui add button --version " + from,
      });
    }

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

function status(): void {
  ensureInitFiles();
  const cfg = loadConfig();
  const state = loadState();

  console.log(`kibadist-ui v${getVersion()}\n`);

  // Installed components
  const buttonInst = state.installed?.button;
  if (buttonInst) {
    console.log("Installed components:");
    console.log(`  Button v${buttonInst.version} (${buttonInst.style}) → ${buttonInst.outDir}/button/`);
  } else {
    console.log("Installed components:");
    console.log("  (none)");
  }

  // Available upgrades
  const versions = listButtonVersions();
  const latestVersion = versions[versions.length - 1];

  if (buttonInst && buttonInst.version !== latestVersion) {
    console.log("\nAvailable upgrades:");
    console.log(`  Button: ${buttonInst.version} → ${latestVersion}`);
  }

  // Config info
  console.log(`\nConfig: ${CONFIG_PATH}`);
  console.log(`  outDir: ${cfg.outDir}`);
  console.log(`  style: ${cfg.style}`);
}

const args = parseArgs(process.argv.slice(2));
const [cmd, subcmd] = args._;

if (args.version === true || args.v === true || cmd === "version") {
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

if (cmd === "status") {
  status();
  process.exit(0);
}

dieWithContext(`Unknown command: ${cmd}`, {
  usage: "kibadist-ui <command>",
  example: "kibadist-ui help",
});
