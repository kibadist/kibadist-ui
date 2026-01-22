import path from "node:path";
import process from "node:process";
import { exists, readJson } from "./fs.js";

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

export interface PathAliasCheck {
  tsconfigExists: boolean;
  hasBaseUrl: boolean;
  hasPathAlias: boolean;
  suggestedAlias: string;
  suggestedPaths: string[];
}

/**
 * Check if tsconfig.json has the required path alias for the output directory.
 * Returns information about what's missing so we can provide helpful warnings.
 */
export function checkPathAlias(outDir: string): PathAliasCheck {
  const tsconfigPath = path.join(process.cwd(), "tsconfig.json");
  const suggestedAlias = `@/${outDir}/*`;
  const suggestedPaths = [`./${outDir}/*`];

  if (!exists(tsconfigPath)) {
    return {
      tsconfigExists: false,
      hasBaseUrl: false,
      hasPathAlias: false,
      suggestedAlias,
      suggestedPaths,
    };
  }

  let tsconfig: TsConfig;
  try {
    tsconfig = readJson<TsConfig>(tsconfigPath);
  } catch {
    // If we can't parse tsconfig, assume it's missing the alias
    return {
      tsconfigExists: true,
      hasBaseUrl: false,
      hasPathAlias: false,
      suggestedAlias,
      suggestedPaths,
    };
  }

  const hasBaseUrl = Boolean(tsconfig.compilerOptions?.baseUrl);
  const paths = tsconfig.compilerOptions?.paths ?? {};

  // Check for various common alias patterns that would work
  const aliasPatterns = [
    `@/${outDir}/*`,      // @/ui/*
    `@${outDir}/*`,       // @ui/*
    `~/${outDir}/*`,      // ~/ui/*
    `@/*`,                // @/* (catches all)
    `~/*`,                // ~/* (catches all)
  ];

  const hasPathAlias = aliasPatterns.some((pattern) => pattern in paths);

  return {
    tsconfigExists: true,
    hasBaseUrl,
    hasPathAlias,
    suggestedAlias,
    suggestedPaths,
  };
}
