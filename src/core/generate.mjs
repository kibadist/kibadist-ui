import { buttonTailwindFiles } from "./adapters/tailwind.mjs";
import { buttonCssModulesFiles } from "./adapters/css-modules.mjs";

export function generateButton({ ir, outDir, style }) {
  if (style === "css-modules") return buttonCssModulesFiles(ir, outDir);
  return buttonTailwindFiles(ir, outDir);
}
