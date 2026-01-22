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
import { isInteractive, promptOverwrite, promptStyle, promptVersion } from "./core/prompt.js";
import { fmt, logSuccess, logWarning, logError, logStep, logHeader, logDim } from "./core/output.js";
import { checkPathAlias } from "./core/tsconfig.js";
import { diffLines, formatDiff, diffStats } from "./core/diff.js";
import type { ButtonContract, ParsedArgs } from "./core/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  const pkgPath = path.join(__dirname, "..", "package.json");
  const pkg = readJson<{ version: string }>(pkgPath);
  return pkg.version;
}

function die(msg: string): never {
  console.error(fmt.error(msg));
  process.exit(1);
}

interface ErrorContext {
  usage?: string;
  available?: string[];
  current?: string;
  example?: string;
}

function dieWithContext(error: string, ctx: ErrorContext): never {
  console.error();
  logError(error);
  console.error();

  if (ctx.usage) {
    console.error(`${fmt.dim("Usage:")} ${ctx.usage}`);
    console.error();
  }

  if (ctx.available) {
    console.error(`${fmt.dim("Available versions:")} ${ctx.available.join(", ")}`);
  }

  if (ctx.current) {
    console.error(`${fmt.dim("Currently installed:")} ${ctx.current}`);
  }

  if (ctx.available || ctx.current) {
    console.error();
  }

  if (ctx.example) {
    console.error(fmt.dim("Example:"));
    console.error(`  ${fmt.command(ctx.example)}`);
  }

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
  list
  add button [--style tailwind|css-modules] [--version 1.0.0] [--dry-run] [--force]
  diff button [--to 1.1.0] [--from 1.0.0]
  upgrade button --to 1.1.0 [--dry-run]
  status

Options:
  --dry-run    Preview changes without writing files
  --force      Overwrite existing component without prompting

Examples:
  kibadist-ui init
  kibadist-ui list
  kibadist-ui add button --style tailwind --version 1.0.0
  kibadist-ui add button --dry-run
  kibadist-ui add button --force
  kibadist-ui diff button --to 1.1.0
  kibadist-ui upgrade button --to 1.1.0
  kibadist-ui upgrade button --to 1.1.0 --dry-run
  kibadist-ui status
`.trim(),
  );
}

function init(): void {
  ensureInitFiles();
  logSuccess("Initialized");
  console.log();
  console.log(`${fmt.dim("Available Button versions:")} ${listButtonVersions().join(", ")}`);
}

function list(): void {
  const versions = listButtonVersions();
  const latest = versions[versions.length - 1];

  console.log();
  logHeader("Available components:");
  console.log();
  console.log(`  ${fmt.bold("button")}    ${fmt.dim("Accessible button with variants, sizes, and icon slots")}`);
  console.log(`            ${fmt.dim("Versions:")} ${versions.map((v) => (v === latest ? fmt.success(`${v} (latest)`) : v)).join(", ")}`);
  console.log(`            ${fmt.dim("Styles:")} tailwind, css-modules`);
  console.log();
  logHeader("Coming soon:");
  console.log(`  ${fmt.dim("input, select, checkbox, modal")}`);
  console.log();
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

async function addButton(args: ParsedArgs): Promise<void> {
  ensureInitFiles();
  const cfg = loadConfig();
  const state = loadState();
  const dryRun = args["dry-run"] === true;
  const force = args.force === true;
  const interactive = isInteractive();
  const versions = listButtonVersions();
  const latestVersion = versions[versions.length - 1];

  const outDir = cfg.outDir;

  // Check if button is already installed
  const installed = state.installed?.button;
  if (installed && !force && !dryRun) {
    console.log();
    logWarning(`Button already installed (${fmt.version("v" + installed.version)})`);

    if (!interactive) {
      console.log();
      logHeader("Options:");
      if (installed.version !== latestVersion) {
        logStep(`Upgrade to newer version: ${fmt.command(`kibadist-ui upgrade button --to ${latestVersion}`)}`);
      }
      logStep(`Reinstall (overwrites changes): ${fmt.command("kibadist-ui add button --force")}`);
      console.log();
      process.exit(1);
    }

    console.log();
    const choice = await promptOverwrite("button", installed.version, latestVersion);

    if (choice === "cancel") {
      logDim("Cancelled.");
      return;
    }

    if (choice === "upgrade") {
      // Re-run as upgrade command
      args.to = latestVersion;
      await upgradeButton(args);
      return;
    }

    // choice === "reinstall" - continue with add
    console.log();
  }

  // Resolve style: flag > interactive > config default
  let style: "tailwind" | "css-modules";
  const styleArg = args.style === true ? undefined : (args.style as string);
  if (styleArg) {
    style = styleArg as "tailwind" | "css-modules";
  } else if (interactive) {
    style = await promptStyle(cfg.style);
  } else {
    style = cfg.style;
  }

  // Resolve version: flag > interactive > latest
  let version: string;
  const versionArg = args.version === true ? undefined : (args.version as string);
  if (versionArg) {
    version = versionArg;
  } else if (interactive) {
    version = await promptVersion(versions);
  } else {
    version = latestVersion;
  }

  console.log();
  logDim("Creating Button component...");

  const contract = loadButtonContract(version);
  const ir = contractToButtonIR(contract);

  const files = generateButton({ ir, outDir, style });

  if (dryRun) {
    console.log();
    logHeader("Would create:");
    for (const f of files) {
      const size = Buffer.byteLength(f.content, "utf-8");
      console.log(`  ${fmt.path(f.relPath)} ${fmt.dim(`(${formatBytes(size)})`)}`);
    }
    console.log();
    return;
  }

  console.log();
  for (const f of files) {
    const abs = path.join(process.cwd(), f.relPath);
    writeFile(abs, f.content);
    logSuccess(`${fmt.path(f.relPath)} created`);

    // store base snapshot
    const baseAbs = path.join(BASE_DIR, "button", ir.version, path.basename(f.relPath));
    writeFile(baseAbs, f.content);
  }
  logSuccess(`Button ${fmt.version(ir.version)} (${style}) installed`);

  state.installed.button = {
    version: ir.version,
    style,
    outDir,
  };
  saveState(state);

  // Check tsconfig for path alias
  const aliasCheck = checkPathAlias(outDir);

  if (!aliasCheck.hasPathAlias) {
    console.log();
    if (!aliasCheck.tsconfigExists) {
      logWarning(`No tsconfig.json found`);
    } else {
      logWarning(`tsconfig.json missing path alias for "${outDir}/"`);
    }
    console.log();
    console.log(`  Add this to your tsconfig.json compilerOptions.paths:`);
    console.log(`    ${fmt.cyan(`"${aliasCheck.suggestedAlias}": ["${aliasCheck.suggestedPaths[0]}"]`)}`);
    console.log();
    console.log(`  Or import using relative path:`);
    console.log(`    ${fmt.dim(`import { Button } from './${outDir}/button/Button'`)}`);
  } else {
    console.log();
    logHeader("Import the component:");
    console.log(`  ${fmt.cyan(`import { Button } from '@/${outDir}/button/Button'`)}`);
  }

  // Quick start example
  console.log();
  logHeader("Quick start:");
  console.log(`  ${fmt.dim("<Button")} variant="${ir.defaults.variant}" size="${ir.defaults.size}"${fmt.dim(">")}Click me${fmt.dim("</Button>")}`);

  // Available props
  const variants = contract.props.variant?.values ?? ["solid", "outline", "ghost"];
  const sizes = contract.props.size?.values ?? ["sm", "md", "lg"];
  const hasLoading = ir.hasLoading;

  console.log();
  logHeader("Available props:");
  console.log(`  ${fmt.dim("variant:")} ${variants.map((v) => `"${v}"`).join(" | ")}`);
  console.log(`  ${fmt.dim("size:")} ${sizes.map((s) => `"${s}"`).join(" | ")}`);
  if (hasLoading) {
    console.log(`  ${fmt.dim("loading:")} boolean`);
  }
  console.log(`  ${fmt.dim("leftIcon, rightIcon:")} ReactNode`);
}

async function upgradeButton(args: ParsedArgs): Promise<void> {
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

  const versions = listButtonVersions();
  const interactive = isInteractive();

  // Resolve target version: flag > interactive > error
  let to: string;
  const toArg = args.to === true ? undefined : (args.to as string);
  if (toArg) {
    to = toArg;
  } else if (interactive) {
    // Filter to versions newer than current
    const upgradeVersions = versions.filter((v) => v !== inst.version);
    if (upgradeVersions.length === 0) {
      logSuccess(`Already at latest version ${fmt.version(inst.version)}`);
      return;
    }
    to = await promptVersion(upgradeVersions, inst.version);
  } else {
    dieWithContext("Missing required flag --to", {
      usage: "kibadist-ui upgrade button --to <version>",
      available: versions,
      current: inst.version,
      example: `kibadist-ui upgrade button --to ${versions[versions.length - 1]}`,
    });
  }

  const from = inst.version;
  if (to === from) {
    logDim(`Nothing to do; already at ${to}`);
    return;
  }

  console.log();
  logDim(`Upgrading Button ${fmt.version(from)} → ${fmt.version(to)}...`);

  const dryRun = args["dry-run"] === true;
  const outDir = inst.outDir;
  const style = inst.style;

  const fromContract = loadButtonContract(from);
  const toContract = loadButtonContract(to);
  const contract = toContract;
  const ir = contractToButtonIR(contract);

  const incomingFiles = generateButton({ ir, outDir, style });

  if (dryRun) {
    console.log();
    logHeader("Would modify:");
    const changes = getContractDiff(fromContract, toContract);
    for (const f of incomingFiles) {
      console.log(`  ${fmt.path(f.relPath)}`);
      for (const change of changes) {
        console.log(`    ${fmt.success(change)}`);
      }
    }
    console.log();
    return;
  }

  let anyConflicts = false;

  console.log();
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
    if (res.hasConflicts) {
      logWarning(`${fmt.path(f.relPath)} merged ${fmt.warning("(conflicts)")}`);
      anyConflicts = true;
    } else {
      logSuccess(`${fmt.path(f.relPath)} merged`);
    }
  }

  if (anyConflicts) {
    console.log();
    logWarning("Conflicts remain (look for <<<<<<< markers). Resolve manually.");
    logDim("State was NOT advanced.");
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

  console.log();
  logSuccess(`Button upgraded ${fmt.version(from)} → ${fmt.version(to)}`);
}

async function diffButton(args: ParsedArgs): Promise<void> {
  ensureInitFiles();
  const cfg = loadConfig();
  const state = loadState();
  const inst = state.installed?.button;
  const versions = listButtonVersions();
  const latestVersion = versions[versions.length - 1];
  const interactive = isInteractive();

  // Determine "from" version (installed or specified)
  let from: string;
  const fromArg = args.from === true ? undefined : (args.from as string);
  if (fromArg) {
    from = fromArg;
  } else if (inst) {
    from = inst.version;
  } else {
    dieWithContext("Button is not installed and no --from version specified", {
      usage: "kibadist-ui diff button --from <version> --to <version>",
      available: versions,
      example: "kibadist-ui diff button --from 1.0.0 --to 1.1.0",
    });
  }

  // Determine "to" version
  let to: string;
  const toArg = args.to === true ? undefined : (args.to as string);
  if (toArg) {
    to = toArg;
  } else if (interactive) {
    const upgradeVersions = versions.filter((v) => v !== from);
    if (upgradeVersions.length === 0) {
      logSuccess(`Already at latest version ${fmt.version(from)}`);
      return;
    }
    to = await promptVersion(upgradeVersions, from);
  } else {
    to = latestVersion;
  }

  if (from === to) {
    logDim("Same version; no diff to show.");
    return;
  }

  // Validate versions exist
  if (!versions.includes(from)) {
    dieWithContext(`Unknown version: ${from}`, {
      available: versions,
      example: `kibadist-ui diff button --from ${versions[0]} --to ${latestVersion}`,
    });
  }
  if (!versions.includes(to)) {
    dieWithContext(`Unknown version: ${to}`, {
      available: versions,
      example: `kibadist-ui diff button --from ${from} --to ${latestVersion}`,
    });
  }

  const style = inst?.style ?? cfg.style;
  const outDir = inst?.outDir ?? cfg.outDir;

  // Generate both versions
  const fromContract = loadButtonContract(from);
  const toContract = loadButtonContract(to);
  const fromIr = contractToButtonIR(fromContract);
  const toIr = contractToButtonIR(toContract);

  const fromFiles = generateButton({ ir: fromIr, outDir, style });
  const toFiles = generateButton({ ir: toIr, outDir, style });

  console.log();
  console.log(`${fmt.bold("Button")} changes (${fmt.version(from)} → ${fmt.version(to)}):`);
  console.log();

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const toFile of toFiles) {
    const fromFile = fromFiles.find((f) => f.relPath === toFile.relPath);
    const fromContent = fromFile?.content ?? "";

    const hunks = diffLines(fromContent, toFile.content, 3);
    const stats = diffStats(hunks);
    totalAdditions += stats.additions;
    totalDeletions += stats.deletions;

    if (hunks.length > 0) {
      const statsStr = `${fmt.success(`+${stats.additions}`)} ${fmt.error(`-${stats.deletions}`)}`;
      console.log(`${fmt.path(toFile.relPath)} ${statsStr}`);
      console.log();
      console.log(formatDiff(hunks, toFile.relPath));
      console.log();
    }
  }

  // Check for removed files
  for (const fromFile of fromFiles) {
    const toFile = toFiles.find((f) => f.relPath === fromFile.relPath);
    if (!toFile) {
      const lines = fromFile.content.split("\n").length;
      totalDeletions += lines;
      console.log(`${fmt.path(fromFile.relPath)} ${fmt.error("(removed)")}`);
      console.log();
    }
  }

  // Summary
  console.log(fmt.dim("─".repeat(40)));
  console.log(`${fmt.success(`+${totalAdditions}`)} additions, ${fmt.error(`-${totalDeletions}`)} deletions`);
  console.log();
  console.log(`Run ${fmt.command(`kibadist-ui upgrade button --to ${to}`)} to apply`);
}

function status(): void {
  ensureInitFiles();
  const cfg = loadConfig();
  const state = loadState();

  console.log();
  console.log(`${fmt.bold("kibadist-ui")} ${fmt.dim("v" + getVersion())}`);
  console.log();

  // Installed components
  logHeader("Installed components:");
  const buttonInst = state.installed?.button;
  if (buttonInst) {
    console.log(`  ${fmt.bold("Button")} ${fmt.version("v" + buttonInst.version)} ${fmt.dim(`(${buttonInst.style})`)} → ${fmt.path(buttonInst.outDir + "/button/")}`);
  } else {
    console.log(`  ${fmt.dim("(none)")}`);
  }

  // Available upgrades
  const versions = listButtonVersions();
  const latestVersion = versions[versions.length - 1];

  if (buttonInst && buttonInst.version !== latestVersion) {
    console.log();
    logHeader("Available upgrades:");
    console.log(`  ${fmt.bold("Button:")} ${fmt.version(buttonInst.version)} → ${fmt.success(latestVersion)}`);
  }

  // Config info
  console.log();
  logHeader("Config:");
  console.log(`  ${fmt.dim("path:")} ${fmt.path(CONFIG_PATH)}`);
  console.log(`  ${fmt.dim("outDir:")} ${cfg.outDir}`);
  console.log(`  ${fmt.dim("style:")} ${cfg.style}`);
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

if (cmd === "list") {
  list();
  process.exit(0);
}

if (cmd === "add" && subcmd === "button") {
  addButton(args).then(() => process.exit(0));
} else if (cmd === "diff" && subcmd === "button") {
  diffButton(args).then(() => process.exit(0));
} else if (cmd === "upgrade" && subcmd === "button") {
  upgradeButton(args).then(() => process.exit(0));
} else if (cmd === "status") {
  status();
  process.exit(0);
} else {
  dieWithContext(`Unknown command: ${cmd}`, {
    usage: "kibadist-ui <command>",
    example: "kibadist-ui help",
  });
}
