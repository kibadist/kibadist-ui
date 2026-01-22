// Contract types
export interface ButtonContract {
  name: "Button";
  version: string;
  element: "button";
  props: {
    variant?: { values?: string[]; default?: string };
    size?: { values?: string[]; default?: string };
    disabled?: { default?: boolean };
    loading?: { default?: boolean };
  };
  slots: string[];
  a11y: {
    defaultType?: string;
    busyAttribute?: string;
    loadingDisables?: boolean;
  };
}

// Intermediate Representation types
export interface ButtonIR {
  name: string;
  version: string;
  element: string;
  hasLoading: boolean;
  defaults: {
    variant: string;
    size: string;
    disabled: boolean;
    loading: boolean;
  };
  a11y: {
    defaultType: string;
    busyAttribute: string;
    loadingDisables: boolean;
  };
}

// Config and state types
export interface Config {
  outDir: string;
  style: "tailwind" | "css-modules";
}

export interface InstalledComponent {
  version: string;
  style: "tailwind" | "css-modules";
  outDir: string;
}

export interface State {
  installed: {
    button?: InstalledComponent;
  };
}

// Generated file type
export interface GeneratedFile {
  relPath: string;
  content: string;
}

// Merge result type
export interface MergeResult {
  mergedText: string;
  hasConflicts: boolean;
}

// CLI args type
export interface ParsedArgs {
  _: string[];
  [key: string]: string | boolean | string[];
}
