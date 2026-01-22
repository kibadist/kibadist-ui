import { select } from "@inquirer/prompts";

export interface SelectOption<T> {
  value: T;
  name: string;
  description?: string;
}

export async function promptSelect<T>(
  message: string,
  choices: SelectOption<T>[],
): Promise<T> {
  return select({
    message,
    choices,
  });
}

export async function promptStyle(defaultStyle: "tailwind" | "css-modules"): Promise<"tailwind" | "css-modules"> {
  const choices: SelectOption<"tailwind" | "css-modules">[] = [
    {
      value: "tailwind",
      name: defaultStyle === "tailwind" ? "tailwind (default)" : "tailwind",
      description: "Utility-first CSS with Tailwind classes",
    },
    {
      value: "css-modules",
      name: defaultStyle === "css-modules" ? "css-modules (default)" : "css-modules",
      description: "Scoped CSS with .module.css files",
    },
  ];

  // Put default first
  if (defaultStyle === "css-modules") {
    choices.reverse();
  }

  return promptSelect("Select style:", choices);
}

export async function promptVersion(
  versions: string[],
  currentVersion?: string,
): Promise<string> {
  const latest = versions[versions.length - 1];

  const choices: SelectOption<string>[] = versions.map((v) => {
    let name = v;
    const tags: string[] = [];

    if (v === latest) tags.push("latest");
    if (v === currentVersion) tags.push("current");

    if (tags.length > 0) {
      name = `${v} (${tags.join(", ")})`;
    }

    return { value: v, name };
  });

  // Put latest first
  choices.reverse();

  return promptSelect("Select version:", choices);
}

export function isInteractive(): boolean {
  return process.stdin.isTTY === true;
}
