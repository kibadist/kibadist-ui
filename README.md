# kibadist-ui

Contract-driven UI component generator with intelligent upgrade support.

## Overview

kibadist-ui generates React UI components from JSON contracts. When upstream contracts are updated, it performs a 3-way merge that preserves your local customizations while incorporating new features.

## Features

- **Contract-driven generation** - Components are defined by JSON contracts specifying props, slots, and accessibility requirements
- **Multiple styling options** - Supports Tailwind CSS and CSS Modules
- **Smart upgrades** - 3-way merge preserves your customizations when upgrading to new contract versions
- **Semantic conflict resolution** - Automatically resolves Tailwind class conflicts by unioning tokens
- **Zero runtime dependencies** - Generated components have no external dependencies

## Installation

```bash
npm install -g kibadist-ui
```

Or use directly with npx:

```bash
npx kibadist-ui init
```

## Quick Start

```bash
# Initialize project configuration
kibadist-ui init

# Add a Button component (interactive prompts for style/version)
kibadist-ui add button

# Or specify options directly
kibadist-ui add button --style tailwind --version 1.0.0

# Preview changes before upgrading
kibadist-ui diff button --to 1.1.0

# Upgrade to a new version
kibadist-ui upgrade button --to 1.1.0

# Check what's installed
kibadist-ui status
```

## Commands

### `init`

Initializes the project with configuration files.

```bash
kibadist-ui init
```

Creates:
- `kibadist-ui.config.json` - Project configuration
- `.kibadist-ui/` - Internal state directory

### `list`

Lists available components and their versions.

```bash
kibadist-ui list
```

### `add button`

Generates a Button component.

```bash
kibadist-ui add button [--style <style>] [--version <version>] [--dry-run] [--force]
```

Options:
- `--style` - `tailwind` (default) or `css-modules`
- `--version` - Contract version (default: latest)
- `--dry-run` - Preview what files would be created without writing them
- `--force` - Overwrite existing component without prompting

### `diff button`

Shows the diff between contract versions.

```bash
kibadist-ui diff button [--from <version>] [--to <version>]
```

Options:
- `--from` - Source version (default: installed version)
- `--to` - Target version (default: latest)

### `upgrade button`

Upgrades the Button component to a new contract version.

```bash
kibadist-ui upgrade button --to <version> [--dry-run]
```

Options:
- `--to` - Target version to upgrade to
- `--dry-run` - Preview what would change without applying

The upgrade performs a 3-way merge:
1. **Base** - Original generated code from the installed version
2. **Local** - Your current code with customizations
3. **Incoming** - New generated code from the target version

If conflicts occur, they're marked with standard git conflict markers for manual resolution.

### `status`

Shows installed components, available upgrades, and configuration.

```bash
kibadist-ui status
```

## Interactive Mode

When running in an interactive terminal, kibadist-ui will prompt for missing options:

- **Style selection** - Choose between Tailwind CSS and CSS Modules
- **Version selection** - Pick from available contract versions
- **Overwrite handling** - When a component already exists, choose to upgrade, reinstall, or cancel

Non-interactive environments (CI/CD, scripts) use sensible defaults or require explicit flags.

## Configuration

`kibadist-ui.config.json`:

```json
{
  "outDir": "ui",
  "style": "tailwind"
}
```

- `outDir` - Output directory for generated components
- `style` - Default styling approach

## Generated Components

### Button (Tailwind)

```
ui/
  button/
    Button.tsx
```

### Button (CSS Modules)

```
ui/
  button/
    Button.tsx
    Button.module.css
```

## Button Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"solid" \| "outline" \| "ghost"` | `"solid"` | Visual variant |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |
| `disabled` | `boolean` | `false` | Disabled state |
| `loading` | `boolean` | `false` | Loading state (v1.1.0+) |
| `leftIcon` | `ReactNode` | - | Icon before content |
| `rightIcon` | `ReactNode` | - | Icon after content |

## Contract Versions

### Button v1.0.0
- Basic button with variant, size, and disabled props
- Icon slots (left/right)

### Button v1.1.0
- Adds `loading` prop with spinner
- `aria-busy` attribute for accessibility
- Loading state disables the button
- Transition animations

## How Upgrades Work

1. When you run `add button`, the generated code is saved as a "base snapshot"
2. You customize the component as needed
3. When you run `upgrade button --to X.Y.Z`:
   - New code is generated from the target contract
   - A 3-way merge combines base, local, and incoming
   - Tailwind class conflicts are auto-resolved by unioning tokens
   - Remaining conflicts are marked for manual resolution
4. On successful merge, the new version becomes the base snapshot

## License

MIT
