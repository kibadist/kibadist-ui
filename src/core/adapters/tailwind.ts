import type { ButtonIR, GeneratedFile } from "../types.js";

/**
 * Tailwind style adapter
 * - emits Button.tsx
 * - uses a small recipe function returning Tailwind class strings
 *
 * v1.1.0 slightly changes upstream base classes to create a realistic merge point.
 */
export function buttonTailwindFiles(ir: ButtonIR, outDir: string): GeneratedFile[] {
  const hasLoading = ir.hasLoading;
  const v = ir.version;

  const upstreamBaseByVersion: Record<string, string> = {
    "1.0.0": "inline-flex items-center justify-center rounded-md",
    "1.1.0": "inline-flex items-center justify-center rounded-md transition-colors",
  };
  const upstreamBase = upstreamBaseByVersion[v] ?? upstreamBaseByVersion["1.1.0"];

  const typeLines = [
    `variant?: "solid" | "outline" | "ghost";`,
    `size?: "sm" | "md" | "lg";`,
    hasLoading ? `loading?: boolean;` : null,
    `leftIcon?: React.ReactNode;`,
    `rightIcon?: React.ReactNode;`,
  ]
    .filter(Boolean)
    .join("\n  ");

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
  ]
    .filter(Boolean)
    .join(",\n      ");

  const disabledLogic =
    hasLoading && ir.a11y.loadingDisables
      ? `const isDisabled = Boolean(disabled || loading);`
      : `const isDisabled = Boolean(disabled);`;

  const ariaBusyLine = hasLoading ? `${ir.a11y.busyAttribute}={loading || undefined}` : "";

  const leftSlot = hasLoading
    ? `{loading ? <span className="cu-spinner" aria-hidden="true" /> : leftIcon}`
    : `{leftIcon}`;

  const note = hasLoading
    ? `\n// NOTE: Spinner uses the "cu-spinner" class. Style it in your app as you like.`
    : "";

  const tsx = `import * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ${typeLines}
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function classes(opts: { variant: NonNullable<ButtonProps["variant"]>; size: NonNullable<ButtonProps["size"]>; disabled: boolean }) {
  // If both you and upstream change this line, upgrade will conflict —
  // and the semantic merge will auto-resolve by unioning Tailwind class tokens.
  const base = "${upstreamBase}";
  const variant =
    opts.variant === "outline"
      ? "border border-black bg-transparent text-black"
      : opts.variant === "ghost"
        ? "bg-transparent text-black"
        : "bg-black text-white";
  const size =
    opts.size === "sm"
      ? "h-8 px-3 text-sm"
      : opts.size === "lg"
        ? "h-11 px-5 text-base"
        : "h-10 px-4 text-sm";
  const disabled = opts.disabled ? "opacity-50 pointer-events-none" : "";
  return cn(base, variant, size, disabled);
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
        className={cn(classes({ variant, size, disabled: isDisabled }), className)}
        {...buttonProps}
      >
        ${leftSlot}
        <span>{children}</span>
        {rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";${note}
`;

  return [{ relPath: `${outDir}/button/Button.tsx`, content: tsx }];
}
