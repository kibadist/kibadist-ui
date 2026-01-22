import pc from "picocolors";

// Symbols
export const symbols = {
  success: pc.green("✓"),
  warning: pc.yellow("⚠"),
  error: pc.red("✗"),
  arrow: pc.cyan("→"),
  bullet: pc.dim("•"),
};

// Styled text helpers
export const fmt = {
  success: (text: string) => pc.green(text),
  warning: (text: string) => pc.yellow(text),
  error: (text: string) => pc.red(text),
  dim: (text: string) => pc.dim(text),
  bold: (text: string) => pc.bold(text),
  cyan: (text: string) => pc.cyan(text),
  path: (text: string) => pc.cyan(text),
  version: (text: string) => pc.yellow(text),
  command: (text: string) => pc.dim(text),
};

// Output helpers
export function logSuccess(message: string): void {
  console.log(`${symbols.success} ${message}`);
}

export function logWarning(message: string): void {
  console.log(`${symbols.warning} ${message}`);
}

export function logError(message: string): void {
  console.log(`${symbols.error} ${message}`);
}

export function logStep(message: string): void {
  console.log(`  ${symbols.arrow} ${message}`);
}

export function logBullet(message: string): void {
  console.log(`  ${symbols.bullet} ${message}`);
}

export function logHeader(message: string): void {
  console.log(pc.bold(message));
}

export function logDim(message: string): void {
  console.log(pc.dim(message));
}
