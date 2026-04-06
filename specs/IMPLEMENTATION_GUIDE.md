# SFLO Implementation Quick Start Guide

## Overview

The specification document `specs/io-cli-repl-architecture.spec.md` contains **6 production-ready code modules** that can be directly integrated into the SFLO project.

---

## 📦 Modules to Implement

### Module 1: I/O Wrapper Context (`src/context.ts`)

**Purpose:** Define the unified I/O abstraction layer

**Key Exports:**
- `interface SfloContext` - Complete I/O API
- `interface ExecResult` - Process execution result
- `function createSfloContext(cli)` - Factory function

**Dependencies:**
- `@clack/prompts` (v1.2.0+)
- `picocolors` (for colors)
- Bun native APIs (`Bun.spawn()`)
- Node.js `fs` (already available in Bun)

**Integration:**
```typescript
import { createSfloContext } from './context';

const cli = cac('sflo');
const ctx = createSfloContext(cli);

// Now use throughout the app:
ctx.print('Hello, World!');
await ctx.exec('git', ['status']);
```

---

### Module 2: CLI Setup (`src/cli.ts`)

**Purpose:** Register built-in commands

**Key Exports:**
- `function setupBuiltinCommands(cli, ctx)` - Registers:
  - `sflo plugin list`
  - `sflo plugin add <repo>`
  - `sflo config [action]`

**Dependencies:**
- Exports from `src/context.ts`
- CAC instance

**Integration:**
```typescript
import { setupBuiltinCommands } from './cli';

setupBuiltinCommands(cli, ctx);
// Now users can run:
// $ sflo plugin list
// $ sflo plugin add brennon/sflo-git
// $ sflo config get verbose
```

---

### Module 3: Plugin Loader (`src/plugins.ts`)

**Purpose:** Dynamically load plugins from `~/.sflo/plugins/`

**Key Exports:**
- `async function loadPlugins(cli, ctx)` - Discovers and loads plugins

**Algorithm:**
1. Read `~/.sflo/plugins.json` (manifest with plugin metadata)
2. Iterate each plugin in manifest
3. Construct plugin path: `~/.sflo/plugins/github.com/<owner>/<repo>/index.ts`
4. Dynamically `await import(pluginPath)`
5. Execute plugin's default function with SfloContext
6. Plugin registers its own commands

**Error Handling:** Graceful recovery on individual plugin failures

**Integration:**
```typescript
import { loadPlugins } from './plugins';

// Load all installed plugins
await loadPlugins(cli, ctx);

// Plugins now registered with ctx.cli
// Example: $ sflo git status (if sflo-git plugin installed)
```

---

### Module 4: Input Tokenizer (`src/tokenizer.ts`)

**Purpose:** Parse shell-like user input for REPL

**Key Exports:**
- `function tokenizeInput(input: string): string[]`

**Features:**
- Respects single & double quotes
- Handles escape sequences (`\n`, `\t`, `\"`, `\'`)
- Validates quote closure
- Returns array of tokens

**Examples:**
```
Input:  git commit -m "Initial commit"
Output: ["git", "commit", "-m", "Initial commit"]

Input:  deploy --env=prod --verbose
Output: ["deploy", "--env=prod", "--verbose"]
```

**Integration:**
```typescript
import { tokenizeInput } from './tokenizer';

const userInput = 'git status --porcelain';
const tokens = tokenizeInput(userInput);
// tokens = ["git", "status", "--porcelain"]

// Pass to CAC parser:
await cli.parse(tokens);
```

---

### Module 5: REPL Loop (`src/repl.ts`)

**Purpose:** Continuous interactive shell session

**Key Exports:**
- `async function startREPL(options)` - Runs REPL main loop

**Flow:**
1. Print prompt `"sflo> "`
2. Wait for user input (async readline)
3. Tokenize input
4. Parse & execute with CAC
5. Catch errors (log but don't exit)
6. Loop back to step 1

**Error Recovery:** Any command error caught and logged; REPL continues

**Integration:**
```typescript
import { startREPL } from './repl';

if (isREPLMode) {
  await startREPL({ cli, ctx });
} else {
  // Single command execution
  await cli.runMatchedCommand();
}
```

---

### Module 6: Main Entry Point (`src/index.ts`)

**Purpose:** Orchestrate all systems from binary startup

**Key Function:** `async function main()`

**Execution Sequence:**
1. Create CAC parser
2. Create SfloContext
3. Register built-in commands
4. Load plugins dynamically
5. Detect CLI vs REPL mode
6. Execute accordingly
7. Handle errors globally
8. Exit with proper code

**Mode Detection:**
```typescript
const isREPL = 
  process.argv.includes('--repl') ||
  process.argv.length === 2;  // No args = REPL
```

**Integration:** This is your entry point file!

---

## 🚀 Implementation Steps

### Step 1: Create Files
```bash
touch src/context.ts
touch src/cli.ts
touch src/plugins.ts
touch src/tokenizer.ts
touch src/repl.ts
# Replace src/index.ts with provided version
```

### Step 2: Copy Code from Specification

Each module is fully implemented in **Section 6** of the specification:

- **6.1** → `src/context.ts`
- **6.2** → `src/cli.ts`
- **6.3** → `src/plugins.ts`
- **6.4** → `src/tokenizer.ts`
- **6.5** → (referenced in repl.ts)
- **6.5** → `src/repl.ts`
- **6.5** → `src/index.ts`

### Step 3: Update `package.json`

Ensure dependencies are present:

```json
{
  "dependencies": {
    "cac": "^7.0.0",
    "@clack/prompts": "^1.2.0",
    "picocolors": "latest"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

### Step 4: Create Type Definitions

Create `src/types.ts` using the **Appendix** from the specification:

```typescript
import type cac from 'cac';

export interface SfloContext {
  print(message: string): void;
  error(message: string): void;
  // ... (full interface in Appendix)
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type PluginSetup = (ctx: SfloContext) => void;
```

### Step 5: Test

```bash
# CLI mode
bun run src/index.ts --help
bun run src/index.ts plugin list

# REPL mode
bun run src/index.ts
> help
> plugin list
> exit
```

---

## 📋 Checklist

- [ ] Copy all 6 modules from specification Section 6
- [ ] Create `src/types.ts` from Appendix
- [ ] Update `package.json` with dependencies
- [ ] Verify TypeScript compilation
- [ ] Test CLI mode
- [ ] Test REPL mode
- [ ] Test error handling
- [ ] Test plugin loading
- [ ] Performance benchmark against Section 8 targets

---

## 🔍 Testing Checklist

### CLI Mode
```bash
# Help
bun run src/index.ts --help

# Version
bun run src/index.ts -v

# Plugin commands
bun run src/index.ts plugin list
bun run src/index.ts plugin add brennon/test-plugin --force
```

### REPL Mode
```bash
# Start REPL (no args or --repl flag)
bun run src/index.ts
> help
> plugin list
> config get
> exit
```

### Error Handling
```bash
# Invalid command (should not crash)
bun run src/index.ts invalid-command

# REPL with errors (should continue)
bun run src/index.ts --repl
> invalid-command
> help  # Should still work
```

---

## 📚 Reference

**For Complete Implementation Details:** See `specs/io-cli-repl-architecture.spec.md`

| Section | Focus |
|---------|-------|
| 1 | Overview & Scope |
| 2 | Technology justification |
| 3 | Architecture patterns |
| 4 | Boot lifecycle details |
| 5 | REPL strategy |
| 6 | **PRODUCTION CODE** ⭐ |
| 7 | Error handling patterns |
| 8 | Performance targets |
| 9 | Security guidelines |
| 10 | Future extensibility |

---

## 🎯 Performance Targets

Based on **Section 8** of the specification:

| Metric | Target | Notes |
|--------|--------|-------|
| Binary startup | <150ms | Includes plugin load |
| CLI parse | <5ms | CAC parser |
| REPL prompt | <100ms | readline + render |
| Plugin load (each) | <50ms | Dynamic import + execute |

---

## ⚙️ Configuration Files

The implementation uses two config locations:

1. **Global:** `~/.sflo/config.json` (user home)
2. **Local:** `.sflo/config.json` (project root, overrides global)

**Plugin Manifest:** `~/.sflo/plugins.json`

```json
{
  "brennon/sflo-git": {
    "owner": "brennon",
    "repo": "sflo-git",
    "version": "abc123def",
    "etag": "optional-cache-tag"
  }
}
```

---

**Created:** April 2026  
**Status:** Ready for Implementation
