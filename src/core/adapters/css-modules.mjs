/**
 * CSS Modules style adapter
 * - emits Button.tsx + Button.module.css
 */
export function buttonCssModulesFiles(ir, outDir) {
  const hasLoading = ir.hasLoading;
  const v = ir.version;

  const cssBaseByVersion = {
    "1.0.0": `
.base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
}
`,
    "1.1.0": `
.base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  transition: transform 120ms ease, opacity 120ms ease;
}
.base:active { transform: scale(0.98); }
`
  };

  const css = `
${(cssBaseByVersion[v] ?? cssBaseByVersion["1.1.0"]).trim()}

.variant_solid { background: black; color: white; }
.variant_outline { background: transparent; border: 1px solid black; color: black; }
.variant_ghost { background: transparent; color: black; }

.size_sm { height: 2rem; padding: 0 0.75rem; font-size: 0.875rem; }
.size_md { height: 2.5rem; padding: 0 1rem; font-size: 0.875rem; }
.size_lg { height: 2.75rem; padding: 0 1.25rem; font-size: 1rem; }

.disabled { opacity: 0.5; pointer-events: none; }
.content { display: inline-flex; align-items: center; }

${hasLoading ? `.spinner { width: 1em; height: 1em; border-radius: 999px; border: 2px solid currentColor; border-top-color: transparent; display: inline-block; margin-right: 0.5rem; animation: cu_spin 0.8s linear infinite; }
@keyframes cu_spin { to { transform: rotate(360deg); } }` : ""}
`.trimStart() + "\n";

  const typeLines = [
    `variant?: "solid" | "outline" | "ghost";`,
    `size?: "sm" | "md" | "lg";`,
    hasLoading ? `loading?: boolean;` : null,
    `leftIcon?: React.ReactNode;`,
    `rightIcon?: React.ReactNode;`,
  ].filter(Boolean).join("\n  ");

  const destructure = [
    `variant = "${ir.defaults.variant}"`,
    `size = "${ir.defaults.size}"`,
    hasLoading ? `loading = ${ir.defaults.loading ? "true" : "false"}` : null,
    `disabled`,
    `type = "${ir.a11y.defaultType}"`,
    `leftIcon`,
    `rightIcon`,
    `className`,
    `children`,
    `...buttonProps`,
  ].filter(Boolean).join(",\n      ");

  const disabledLogic = hasLoading && ir.a11y.loadingDisables
    ? `const isDisabled = Boolean(disabled || loading);`
    : `const isDisabled = Boolean(disabled);`;

  const ariaBusyLine = hasLoading
    ? `${ir.a11y.busyAttribute}={loading || undefined}`
    : "";

  const leftSlot = hasLoading
    ? `{loading ? <span className={styles.spinner} aria-hidden="true" /> : leftIcon}`
    : `{leftIcon}`;

  const tsx = `import * as React from "react";
import styles from "./Button.module.css";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ${typeLines}
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      ${destructure}
    },
    ref
  ) => {
    ${disabledLogic}

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        ${ariaBusyLine}
        className={cn(
          styles.base,
          styles[\`variant_\${variant}\`],
          styles[\`size_\${size}\`],
          isDisabled ? styles.disabled : "",
          className
        )}
        {...buttonProps}
      >
        ${leftSlot}
        <span className={styles.content}>{children}</span>
        {rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";
`;

  return [
    { relPath: `${outDir}/button/Button.tsx`, content: tsx },
    { relPath: `${outDir}/button/Button.module.css`, content: css },
  ];
}
