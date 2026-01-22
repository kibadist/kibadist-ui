import { buttonTailwindFiles } from "./adapters/tailwind.js";
import { buttonCssModulesFiles } from "./adapters/css-modules.js";
import type { ButtonIR, GeneratedFile } from "./types.js";

export interface GenerateButtonOptions {
  ir: ButtonIR;
  outDir: string;
  style: "tailwind" | "css-modules";
}

export function generateButton({ ir, outDir, style }: GenerateButtonOptions): GeneratedFile[] {
  if (style === "css-modules") return buttonCssModulesFiles(ir, outDir);
  return buttonTailwindFiles(ir, outDir);
}
