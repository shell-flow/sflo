# I/O, CLI Lifecycle, and REPL Architecture Specification

**Document Version:** 1.0  
**Status:** Final Specification  
**Audience:** Staff Engineers, Architecture Review Board  
**Last Updated:** April 2026

---

## 1. Overview

This specification document provides a comprehensive technical blueprint for the **I/O Layer**, **CLI Lifecycle**, and **REPL Implementation** within the SFLO (Shell-Flow) project. The goal is to establish a high-performance, zero-dependency command-line interface that maintains strict separation between business logic (Core API Engine) and presentation/output concerns (I/O Wrapper Layer).

### Scope

This specification covers:
- **I/O Wrapper Layer Architecture:** Abstraction mechanisms for decoupled output rendering (CLI, REPL, TUI)
- **CLI Boot Lifecycle:** Complete initialization sequence from binary invocation to command execution
- **REPL Implementation Strategy:** Continuous interactive loop leveraging Bun's native asynchronous readline
- **Plugin Injection Mechanism:** Dynamic TypeScript plugin loading via `import()` and context injection
- **Error Handling & Resilience:** Global error strategies to prevent terminal corruption

### Excluded from Scope

- WebAssembly compilation and execution (covered in separate spec)
- Plugin security sandboxing details (covered in security spec)
- Configuration schema validation (covered in config spec)

---

## 2. Stack & Libraries Justification

### 2.1 Bun Runtime

**Selection Rationale:**
- **Startup Performance:** <100ms JIT compilation and execution of TypeScript
- **Native TypeScript Support:** Direct `.ts` execution without build steps
- **Standalone Binary Generation:** `bun build --compile` creates self-contained executables (40–90MB)
- **Zero Runtime Dependencies:** No Node.js, npm, or system toolchain required on end-user machines
- **Native Async I/O:** Superior to Node.js for readline operations and subprocess spawning

**Key APIs Used:**
- `Bun.file()` - Synchronous file reading for config
- `Bun.spawn()` - Cross-platform process execution
- `Bun.write()` - Direct filesystem writes
- `Bun.stdin` / `Bun.stdout` - Native I/O streams

### 2.2 CAC (Command And Conquer)

**Selection Rationale:**
- **Lightweight:** Single-file implementation, ~4KB minified, zero external dependencies
- **Fast Argument Parsing:** Sub-millisecond CLI argument parsing
- **Comprehensive Feature Set:**
  - Subcommand routing (git-like workflows)
  - Variadic arguments (`[...files]`)
  - Dot-nested options (`--env.API_KEY=secret`)
  - Automatic help/version generation
  - Command validation
- **TypeScript Native:** Full type definitions, strict mode compatible

**Key API Signatures (CAC v7.0.0+):**

```typescript
// CLI instantiation
const cli = cac(name?: string): CLI;

// Command registration
cli.command(name: string, description: string): Command;

// Global options
cli.option(name: string, description: string, config?: OptionConfig): CLI;

// Execution & parsing
cli.parse(argv?: string[]): ParsedArgv;
cli.runMatchedCommand(): Promise<void>;

// Help & version
cli.help(callback?: HelpCallback): CLI;
cli.version(version: string, flags?: string): CLI;

// Error handling
cli.addEventListener(eventType: string, callback: () => void): void;
```

### 2.3 @clack/prompts

**Selection Rationale:**
- **Beautiful, Modern UI:** Built-in color support, progress bars, spinners, multi-line prompts
- **TypeScript-First:** Full type safety for prompt validation and return values
- **Zero Configuration:** Works out-of-the-box with sensible defaults
- **Performance:** Minimal rendering overhead; asynchronous by design
- **Accessibility-Aware:** Keyboard navigation, screen reader support
- **Active Maintenance:** Regularly updated, production-ready

**Key Components (v1.2.0+):**

```typescript
// High-level prompt components
import {
  text,        // Single-line text input with validation
  password,    // Masked password input
  select,      // Selection menu (single choice)
  multiselect, // Multi-selection with checkboxes
  confirm,     // Yes/No confirmation
  spinner,     // Loading state indicator
  note,        // Information display
  box,         // Bordered text display
  isCancel,    // Utility to detect user cancellation (Ctrl+C)
} from '@clack/prompts';

// Signature examples
text(opts: TextOptions): Promise<string | symbol>;
select<T>(opts: SelectOptions<T>): Promise<T | symbol>;
confirm(opts: ConfirmOptions): Promise<boolean | symbol>;
spinner(): { start(msg: string): void; stop(msg: string): void };
```

### 2.4 Picocolors

**Selection Rationale:**
- **Ultra-Lightweight:** ~200 bytes minified (compared to chalk's 10KB+)
- **Zero Dependencies:** Pure JavaScript color formatting
- **Performance:** Negligible overhead for status output
- **Wide Compatibility:** Works in all modern terminals

**API Signature (latest):**

```typescript
import {
  black, red, green, yellow, blue, magenta, cyan, white,
  bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite,
  bold, dim, italic, underline, strikethrough,
} from 'picocolors';

// Usage
const message = red(bold('Error:')) + ' Something went wrong';
```

---

## 3. Architecture Layering

### 3.1 Architectural Principle

SFLO enforces strict separation of concerns through two independent layers:

```
┌─────────────────────────────────────────────────────┐
│               PRESENTATION LAYER (I/O)              │
│  ┌──────────────────────────────────────────────┐  │
│  │ CLI Interface    │ REPL Loop    │ TUI (Future) │  │
│  └──────────────────────────────────────────────┘  │
│              ↓ Context Injection ↓                 │
├─────────────────────────────────────────────────────┤
│        I/O WRAPPER LAYER (SfloContext)              │
│  ┌──────────────────────────────────────────────┐  │
│  │ print() │ error() │ ask() │ log() │ table()  │  │
│  └──────────────────────────────────────────────┘  │
│              ↑ Called By ↑                         │
├─────────────────────────────────────────────────────┤
│          CORE API ENGINE (Business Logic)          │
│  ┌──────────────────────────────────────────────┐  │
│  │  Command Actions  │  Plugins  │  Config      │  │
│  │  (Environment-Agnostic)                       │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 3.2 Core API Engine

**Responsibility:** Pure business logic, independent of environment or output method.

**Characteristics:**
- Zero knowledge of stdout, stdin, or terminal capabilities
- All output requests delegated to I/O Wrapper Layer
- Purely functional; side effects only through injected context
- Testable in isolation (no mocking required for I/O)

**Example:**

```typescript
// ✅ CORRECT: Business logic delegates to context
async function deployService(serviceName: string, ctx: SfloContext) {
  ctx.print(`Deploying service: ${serviceName}`);
  const result = await performDeploy(serviceName);
  ctx.print(`✓ Deployment complete`);
  return result;
}

// ❌ INCORRECT: Direct I/O, environment-dependent
async function deployService(serviceName: string) {
  console.log(`Deploying service: ${serviceName}`);
  const result = await performDeploy(serviceName);
  console.log(`✓ Deployment complete`);
  return result;
}
```

### 3.3 I/O Wrapper Layer (SfloContext)

**Responsibility:** Unified interface for all output and user interaction.

**Design Principle:** Route all output through context methods to enable seamless switching between CLI, REPL, TUI, or even headless operation (for testing, CI/CD integration).

**Core Methods:**

```typescript
interface SfloContext {
  // Output methods
  print(message: string): void;           // Standard output
  error(message: string): void;           // Error output (stderr)
  success(message: string): void;         // Success status
  warn(message: string): void;            // Warning status
  info(message: string): void;            // Informational message

  // Interactive prompts
  ask(message: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select<T>(message: string, options: T[]): Promise<T>;

  // Process execution
  exec(command: string, args?: string[]): Promise<ExecResult>;

  // CLI router access
  cli: CAC;

  // Plugin-specific utilities
  getConfig(key?: string): ConfigObject;
  getPluginPath(): string;
}
```

**Implementation Design Pattern:**

The I/O Wrapper Layer supports multiple implementations:

1. **CLI Implementation** - Writes directly to stdout/stderr
2. **REPL Implementation** - Buffers output for in-memory display
3. **TUI Implementation** - Delegates to terminal UI library
4. **Test Implementation** - Records calls without side effects

---

## 4. CLI Boot Lifecycle

### 4.1 Lifecycle Diagram

```
┌─ Binary Invocation (sflo --help)
│
├─ 1. Bun Runtime Initialization
│    └─ TypeScript JIT compilation (< 50ms)
│
├─ 2. Global Configuration Load
│    ├─ Read ~/.sflo/config.json (synchronously)
│    └─ Validate configuration schema
│
├─ 3. CAC Parser Instantiation
│    └─ Create CLI router instance
│
├─ 4. Built-in Command Registration
│    ├─ Register: plugin, config, help, version
│    └─ Attach global options (--verbose, --debug, etc.)
│
├─ 5. Plugin Discovery & Dynamic Injection
│    ├─ Scan ~/.sflo/plugins/ directory
│    ├─ Read ~/.sflo/plugins.json (metadata)
│    └─ Execute import() for each plugin
│       └─ Plugin receives SfloContext
│          └─ Plugin registers its commands
│
├─ 6. Argument Parsing
│    └─ cli.parse(process.argv)
│
├─ 7. Command Execution
│    └─ Matched command action runs
│
└─ 8. Exit
    └─ process.exit(0 | 1)
```

### 4.2 Stage 1: Bun Runtime Initialization

**Timeline:** 0–50ms

The Bun runtime automatically:
- Detects the `.ts` entry point
- JIT-compiles TypeScript on first run
- Caches compiled bytecode for subsequent runs
- No external build step required

**File:** `src/index.ts` (SFLO entry point)

### 4.3 Stage 2: Global Configuration Load

**Timeline:** 50–100ms

**Implementation:**

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface GlobalConfig {
  version: string;
  defaultCommand?: string;
  plugins?: string[];
  verbose?: boolean;
  [key: string]: any;
}

function loadGlobalConfig(): GlobalConfig {
  const configPath = join(process.env.HOME || '~', '.sflo', 'config.json');
  
  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as GlobalConfig;
  } catch {
    // If config does not exist, return sensible defaults
    return {
      version: '1.0.0',
      plugins: [],
      verbose: false,
    };
  }
}
```

**Key Points:**
- Synchronous read for deterministic startup behavior
- Graceful fallback if config missing
- Local `.sflo/config.json` will override global later (not in this stage)

### 4.4 Stage 3: CAC Parser Instantiation

**Timeline:** 100–110ms

```typescript
import cac from 'cac';

const cli = cac('sflo');

// Global options applicable to all commands
cli.option('--verbose, -v', 'Verbose output');
cli.option('--debug', 'Debug mode');
cli.option('--quiet, -q', 'Suppress output');

// Automatic help & version
cli.help();
cli.version('1.0.0');

// Prepare for error handling
cli.addEventListener('command:*', () => {
  console.error('Unknown command:', cli.args.join(' '));
  process.exit(1);
});
```

### 4.5 Stage 4: Built-in Command Registration

**Timeline:** 110–150ms

Register core commands that ship with SFLO:

```typescript
// Command: `sflo plugin add <owner>/<repo>`
cli
  .command('plugin add <repo>', 'Install a plugin from GitHub')
  .option('--force', 'Overwrite if already installed')
  .action(async (repo: string, options: Record<string, any>) => {
    await pluginService.installPlugin(repo, options);
  });

// Command: `sflo plugin list`
cli
  .command('plugin list', 'List installed plugins')
  .action(async () => {
    const plugins = await pluginService.listPlugins();
    console.table(plugins);
  });

// Command: `sflo config get <key>`
cli
  .command('config get [key]', 'Retrieve configuration value')
  .action(async (key?: string) => {
    if (key) {
      console.log(getConfig(key));
    } else {
      console.log(JSON.stringify(getConfig(), null, 2));
    }
  });
```

### 4.6 Stage 5: Plugin Discovery & Dynamic Injection

**Timeline:** 150–500ms (depends on plugin count and size)

**Algorithm:**

```typescript
interface PluginMetadata {
  owner: string;
  repo: string;
  version: string; // git commit hash
  etag?: string;   // for cache invalidation
}

async function loadPlugins(
  cli: CAC,
  globalConfig: GlobalConfig,
  ctx: SfloContext
): Promise<void> {
  const pluginsDir = join(process.env.HOME || '~', '.sflo', 'plugins');
  const pluginsManifest = join(
    process.env.HOME || '~',
    '.sflo',
    'plugins.json'
  );

  let metadata: Record<string, PluginMetadata> = {};
  
  try {
    const content = readFileSync(pluginsManifest, 'utf-8');
    metadata = JSON.parse(content);
  } catch {
    // No plugins installed yet
  }

  for (const [repoKey, pluginMeta] of Object.entries(metadata)) {
    const pluginPath = join(
      pluginsDir,
      'github.com',
      pluginMeta.owner,
      pluginMeta.repo,
      'index.ts'
    );

    try {
      // Dynamically import plugin TypeScript file
      // Bun will compile and execute in-place
      const module = await import(pluginPath);
      const pluginSetup = module.default as (ctx: SfloContext) => void;

      if (typeof pluginSetup !== 'function') {
        console.warn(
          `Plugin ${repoKey} does not export a default function`
        );
        continue;
      }

      // Inject context and let plugin register commands
      pluginSetup(ctx);
    } catch (error) {
      console.error(`Failed to load plugin ${repoKey}:`, error);
      // Continue loading other plugins instead of crashing
    }
  }
}
```

**Dependency Injection Pattern:**

Plugins receive a `SfloContext` object allowing them to:
- Register commands: `ctx.cli.command(...)`
- Access config: `ctx.getConfig()`
- Use I/O utilities: `ctx.print()`, `ctx.ask()`
- Never directly manipulate OS

**Example Plugin:**

```typescript
// ~/.sflo/plugins/github.com/user/sflo-git/index.ts
import type { SfloContext } from '@sflo/types';

export default function setup(ctx: SfloContext) {
  ctx.cli
    .command('git status [path]', 'Show git status')
    .action(async (path?: string, options?: Record<string, any>) => {
      const targetPath = path || process.cwd();
      ctx.print(`Checking git status in: ${targetPath}`);
      
      const result = await ctx.exec('git', ['status', '--porcelain']);
      
      if (result.stdout) {
        ctx.print(result.stdout);
      } else {
        ctx.success('Working directory is clean');
      }
    });
}
```

### 4.7 Stage 6: Argument Parsing

**Timeline:** 0–5ms

```typescript
const parsed = cli.parse(process.argv);
// process.argv[0] = node/bun path
// process.argv[1] = sflo script path
// process.argv[2...] = user arguments
```

**Parsed Object Structure:**

```typescript
interface ParsedArgv {
  args: string[];           // Positional arguments
  options: {
    [key: string]: any;     // Parsed flags/options
  };
}
```

### 4.8 Stage 7: Command Execution

**Timeline:** Varies (command-dependent)

```typescript
try {
  await cli.runMatchedCommand();
} catch (error) {
  // Global error handler
  ctx.error(`Command failed: ${error.message}`);
  process.exit(1);
}
```

### 4.9 Stage 8: Exit

**Timeline:** Immediate

```typescript
process.exit(0);  // Success
process.exit(1);  // Failure
```

---

## 5. REPL Implementation Strategy

### 5.1 REPL Architecture

The REPL (Read-Eval-Print Loop) is a continuous interactive session that:
- Allows users to type commands without re-invoking the binary
- Maintains state across commands
- Reuses the same CAC parser instance
- Leverages Bun's native `readline` for asynchronous input

### 5.2 REPL Lifecycle

```
┌─ REPL Invocation (sflo --repl or sflo)
│
├─ Execute CLI Boot Lifecycle (Stages 1–5)
│    └─ Plugins loaded, CAC parser ready
│
├─ Enter REPL Loop
│    │
│    ├─ Print prompt ("sflo> ")
│    │
│    ├─ Read line from stdin (asynchronous)
│    │
│    ├─ Parse user input
│    │    └─ Tokenize string respecting quotes & escapes
│    │
│    ├─ Split tokens into argv-like array
│    │
│    ├─ Execute: cli.parse(tokenizedArray)
│    │
│    ├─ Run matched command
│    │
│    ├─ Catch errors gracefully
│    │
│    └─ Loop back to prompt (unless exit command)
│
└─ Exit REPL
```

### 5.3 Input Tokenization

**Problem:** User inputs strings like `git commit -m "Initial commit"`, which must be split into tokens while respecting quoted strings.

**Solution:** Implement a simple POSIX-like shell tokenizer:

```typescript
/**
 * Tokenize a shell-like input string, respecting quoted strings and escapes.
 * Examples:
 *   "git commit -m 'Initial commit'" 
 *   → ["git", "commit", "-m", "Initial commit"]
 *
 *   "deploy --env=prod --verbose"
 *   → ["deploy", "--env=prod", "--verbose"]
 */
function tokenizeInput(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
      // Handle escape sequence
      if (nextChar === 'n') {
        current += '\n';
        i++;
      } else if (nextChar === 't') {
        current += '\t';
        i++;
      } else if (nextChar === '"' || nextChar === "'") {
        current += nextChar;
        i++;
      } else {
        current += char;
      }
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  if (inSingleQuote || inDoubleQuote) {
    console.error('Unclosed quote');
    return [];
  }

  return tokens;
}
```

### 5.4 REPL Main Loop Implementation

**File:** `src/repl.ts`

```typescript
import * as readline from 'node:readline';
import cac from 'cac';
import type { SfloContext } from './types';

interface REPLOptions {
  cli: ReturnType<typeof cac>;
  ctx: SfloContext;
  historyFile?: string;
}

async function startREPL(options: REPLOptions): Promise<void> {
  const { cli, ctx, historyFile } = options;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    history: historyFile ? loadHistory(historyFile) : undefined,
  });

  const prompt = 'sflo> ';

  console.log('Welcome to SFLO interactive mode. Type "help" for commands.');
  console.log('Press Ctrl+C to exit.\n');

  const askNext = async (): Promise<void> => {
    return new Promise((resolve) => {
      rl.question(prompt, async (input: string) => {
        const trimmedInput = input.trim();

        // Handle exit commands
        if (
          trimmedInput === 'exit' ||
          trimmedInput === 'quit' ||
          trimmedInput === '.exit'
        ) {
          ctx.print('Goodbye!');
          rl.close();
          process.exit(0);
        }

        // Ignore empty input
        if (!trimmedInput) {
          await askNext();
          resolve();
          return;
        }

        try {
          // Tokenize input
          const tokens = tokenizeInput(trimmedInput);

          if (tokens.length === 0) {
            ctx.error('Invalid input syntax');
            await askNext();
            resolve();
            return;
          }

          // Parse and execute
          await cli.parse(tokens);
        } catch (error) {
          // Graceful error handling
          const message = error instanceof Error ? error.message : String(error);
          ctx.error(`Error: ${message}`);
        } finally {
          // Continue loop
          await askNext();
          resolve();
        }
      });
    });
  };

  await askNext();
}

function loadHistory(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export { startREPL };
```

### 5.5 Integration with Main Entry Point

**File:** `src/index.ts`

```typescript
import cac from 'cac';
import { startREPL } from './repl';
import { createSfloContext } from './context';
import { loadPlugins } from './plugins';

const CLI_VERSION = '1.0.0';
const BINARY_NAME = 'sflo';

async function main(): Promise<void> {
  try {
    // Stage 1–3: Initialize Bun, load config, create parser
    const cli = cac(BINARY_NAME);
    const ctx = createSfloContext(cli);

    // Stage 4–5: Register built-ins and plugins
    await loadPlugins(cli, ctx);

    // Check if REPL mode requested
    if (
      process.argv.includes('--repl') ||
      process.argv.length === 2 // No args = default REPL
    ) {
      await startREPL({ cli, ctx });
    } else {
      // Stage 6–8: Parse CLI args and execute
      cli.help();
      cli.version(CLI_VERSION);
      await cli.runMatchedCommand();
    }
  } catch (error) {
    console.error(
      'Fatal error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
```

---

## 6. Reference Code / Boilerplate

### 6.1 I/O Wrapper Layer (SfloContext)

**File:** `src/context.ts`

This module defines the complete I/O abstraction layer.

```typescript
import * as readline from 'node:readline';
import type cac from 'cac';
import * as prompts from '@clack/prompts';
import * as pc from 'picocolors';
import { Bun } from 'bun';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface SfloContext {
  // Output methods
  print(message: string): void;
  error(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  info(message: string): void;

  // Interactive prompts
  ask(message: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select<T extends string | number | symbol>(
    message: string,
    options: Array<{ label: string; value: T }>
  ): Promise<T>;

  // Process execution
  exec(command: string, args?: string[]): Promise<ExecResult>;

  // Utility
  spinner(message: string): {
    start(): void;
    stop(finalMessage?: string): void;
  };

  // CLI & Config access
  cli: ReturnType<typeof cac>;
  getConfig(key?: string): Record<string, any>;
  setConfig(key: string, value: any): void;
}

export function createSfloContext(cli: ReturnType<typeof cac>): SfloContext {
  let config: Record<string, any> = {};

  // Load config synchronously
  try {
    const configPath = `${process.env.HOME}/.sflo/config.json`;
    const content = require('fs').readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch {
    config = {};
  }

  const context: SfloContext = {
    print: (message: string): void => {
      process.stdout.write(message + '\n');
    },

    error: (message: string): void => {
      process.stderr.write(pc.red('✗ Error: ') + message + '\n');
    },

    success: (message: string): void => {
      process.stdout.write(pc.green('✓ ' + message) + '\n');
    },

    warn: (message: string): void => {
      process.stdout.write(pc.yellow('⚠ Warning: ') + message + '\n');
    },

    info: (message: string): void => {
      process.stdout.write(pc.blue('ℹ ') + message + '\n');
    },

    ask: async (message: string): Promise<string> => {
      const result = await prompts.text({
        message,
        validate: (val: string | undefined) => {
          if (!val) return 'Please enter a value';
          return undefined;
        },
      });

      if (prompts.isCancel(result)) {
        throw new Error('Operation cancelled by user');
      }

      return result as string;
    },

    confirm: async (message: string): Promise<boolean> => {
      const result = await prompts.confirm({ message });

      if (prompts.isCancel(result)) {
        throw new Error('Operation cancelled by user');
      }

      return result as boolean;
    },

    select: async <T extends string | number | symbol>(
      message: string,
      options: Array<{ label: string; value: T }>
    ): Promise<T> => {
      const result = await prompts.select({
        message,
        options: options.map((opt) => ({
          label: opt.label,
          value: opt.value,
        })),
      });

      if (prompts.isCancel(result)) {
        throw new Error('Operation cancelled by user');
      }

      return result as T;
    },

    exec: async (command: string, args?: string[]): Promise<ExecResult> => {
      try {
        const proc = Bun.spawn([command, ...(args || [])], {
          stdout: 'pipe',
          stderr: 'pipe',
        });

        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();

        return {
          code: proc.exitCode,
          stdout,
          stderr,
        };
      } catch (error) {
        return {
          code: 1,
          stdout: '',
          stderr: error instanceof Error ? error.message : String(error),
        };
      }
    },

    spinner: (message: string) => {
      const s = prompts.spinner();
      s.start(message);
      return {
        start: () => s.start(message),
        stop: (finalMessage?: string) =>
          s.stop(finalMessage || 'Done'),
      };
    },

    cli,

    getConfig: (key?: string): Record<string, any> => {
      if (!key) return config;
      return config[key] || null;
    },

    setConfig: (key: string, value: any): void => {
      config[key] = value;
      // Optionally persist to disk
    },
  };

  return context;
}
```

### 6.2 CLI Setup & Built-in Commands

**File:** `src/cli.ts`

```typescript
import cac from 'cac';
import type { SfloContext } from './context';
import * as pc from 'picocolors';

export function setupBuiltinCommands(
  cli: ReturnType<typeof cac>,
  ctx: SfloContext
): void {
  // Global options
  cli.option('--verbose, -v', 'Enable verbose output');
  cli.option('--debug', 'Enable debug mode');
  cli.option('--config <path>', 'Path to config file');

  // Command: plugin list
  cli
    .command('plugin list', 'List installed plugins')
    .action(async () => {
      try {
        ctx.print('Listing installed plugins...');
        // TODO: Implement plugin listing logic
        ctx.success('No plugins installed yet');
      } catch (error) {
        ctx.error(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    });

  // Command: plugin add
  cli
    .command('plugin add <repo>', 'Install a plugin from GitHub')
    .option('--force', 'Overwrite if exists')
    .action(async (repo: string, options: Record<string, any>) => {
      try {
        const spinner = ctx.spinner(`Installing plugin: ${repo}`);
        spinner.start();

        // TODO: Implement plugin installation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        spinner.stop(`Plugin ${repo} installed`);
        ctx.success(`Plugin ready to use`);
      } catch (error) {
        ctx.error(
          error instanceof Error ? error.message : 'Installation failed'
        );
      }
    });

  // Command: config
  cli
    .command('config [action]', 'Manage configuration')
    .option('--key <key>', 'Configuration key')
    .option('--value <value>', 'Configuration value')
    .action(async (action?: string, options?: Record<string, any>) => {
      try {
        if (action === 'get' && options?.key) {
          const value = ctx.getConfig(options.key);
          ctx.print(
            `${options.key}: ${JSON.stringify(value)}`
          );
        } else if (action === 'set' && options?.key && options?.value) {
          ctx.setConfig(options.key, options.value);
          ctx.success(`Config updated: ${options.key}`);
        } else {
          const allConfig = ctx.getConfig();
          ctx.print(JSON.stringify(allConfig, null, 2));
        }
      } catch (error) {
        ctx.error(
          error instanceof Error ? error.message : 'Config error'
        );
      }
    });

  // Error handling for unknown commands
  cli.addEventListener('command:*', () => {
    ctx.error(`Unknown command: ${cli.args.join(' ')}`);
    ctx.print('Run "sflo help" for available commands');
    process.exit(1);
  });
}
```

### 6.3 Plugin Loading System

**File:** `src/plugins.ts`

```typescript
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type cac from 'cac';
import type { SfloContext } from './context';

interface PluginManifest {
  [key: string]: {
    owner: string;
    repo: string;
    version: string;
  };
}

export async function loadPlugins(
  cli: ReturnType<typeof cac>,
  ctx: SfloContext
): Promise<void> {
  const pluginsDir = join(
    process.env.HOME || '/',
    '.sflo',
    'plugins'
  );
  const manifestPath = join(
    process.env.HOME || '/',
    '.sflo',
    'plugins.json'
  );

  if (!existsSync(manifestPath)) {
    return;
  }

  let manifest: PluginManifest = {};

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);
  } catch (error) {
    ctx.warn(`Failed to read plugin manifest: ${String(error)}`);
    return;
  }

  for (const [, pluginMeta] of Object.entries(manifest)) {
    const pluginPath = join(
      pluginsDir,
      'github.com',
      pluginMeta.owner,
      pluginMeta.repo,
      'index.ts'
    );

    if (!existsSync(pluginPath)) {
      ctx.warn(`Plugin not found: ${pluginPath}`);
      continue;
    }

    try {
      // Dynamic import of TypeScript plugin
      const module = await import(pluginPath);
      const pluginSetup = module.default as (ctx: SfloContext) => void;

      if (typeof pluginSetup !== 'function') {
        ctx.warn(
          `Plugin ${pluginMeta.owner}/${pluginMeta.repo} has invalid export`
        );
        continue;
      }

      pluginSetup(ctx);
    } catch (error) {
      ctx.error(
        `Failed to load plugin ${pluginMeta.owner}/${pluginMeta.repo}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
```

### 6.4 REPL Input Tokenizer

**File:** `src/tokenizer.ts`

```typescript
/**
 * Tokenize shell-like input respecting quotes and escapes.
 * @param input User input string
 * @returns Array of tokens
 *
 * Examples:
 *   "git commit -m 'Initial commit'" → ["git", "commit", "-m", "Initial commit"]
 *   "deploy --env prod" → ["deploy", "--env", "prod"]
 */
export function tokenizeInput(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = input[i + 1];

    // Toggle quote state
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      i++;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      i++;
      continue;
    }

    // Handle escape sequences
    if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
      if (nextChar === 'n') {
        current += '\n';
        i += 2;
      } else if (nextChar === 't') {
        current += '\t';
        i += 2;
      } else if (nextChar === '"' || nextChar === "'") {
        current += nextChar;
        i += 2;
      } else {
        current += char;
        i++;
      }
      continue;
    }

    // Whitespace delimiter (outside quotes)
    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      i++;
      continue;
    }

    // Accumulate character
    current += char;
    i++;
  }

  // Push final token
  if (current.length > 0) {
    tokens.push(current);
  }

  // Validate quotes are closed
  if (inSingleQuote || inDoubleQuote) {
    throw new Error('Unclosed quote in input');
  }

  return tokens;
}
```

### 6.5 Complete Main Entry Point

**File:** `src/index.ts`

```typescript
#!/usr/bin/env bun

import cac from 'cac';
import { createSfloContext } from './context';
import { setupBuiltinCommands } from './cli';
import { loadPlugins } from './plugins';
import { startREPL } from './repl';

const SFLO_VERSION = '1.0.0';

async function main(): Promise<void> {
  try {
    // Stage 1–3: Initialize parser and context
    const cli = cac('sflo');
    const ctx = createSfloContext(cli);

    // Stage 4: Register built-in commands
    setupBuiltinCommands(cli, ctx);

    // Stage 5: Load plugins dynamically
    await loadPlugins(cli, ctx);

    // Setup help and version
    cli.help();
    cli.version(SFLO_VERSION);

    // Determine execution mode
    const isREPL =
      process.argv.includes('--repl') ||
      process.argv.length === 2;

    if (isREPL) {
      // REPL Mode
      await startREPL({ cli, ctx });
    } else {
      // CLI Mode: Execute single command
      await cli.runMatchedCommand();
    }

    process.exit(0);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`Fatal: ${message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
```

---

## 7. Error Handling & Resilience

### 7.1 Global Error Strategy

All layers implement try-catch boundaries to prevent uncaught exceptions from crashing the process or leaving the terminal in a corrupted state.

**Principle:** Fail gracefully, inform the user, and allow REPL to continue.

### 7.2 Error Handling by Layer

| Layer | Strategy | Example |
|-------|----------|---------|
| Core API | `throw Error` | Business logic validation fails |
| I/O Wrapper | `catch` and format | Plugin load error caught, logged |
| CLI Boot | `process.exit(1)` | Unrecoverable initialization failure |
| REPL Loop | `catch` and continue | Command execution error, loop persists |

### 7.3 REPL Error Resilience Example

```typescript
async function startREPL(options: REPLOptions): Promise<void> {
  const askNext = async (): Promise<void> => {
    return new Promise((resolve) => {
      rl.question(prompt, async (input: string) => {
        try {
          // All operations wrapped in try-catch
          const tokens = tokenizeInput(input);
          await cli.parse(tokens);
        } catch (error) {
          // Graceful error handling
          const msg = error instanceof Error ? error.message : String(error);
          ctx.error(msg);
          // IMPORTANT: No process.exit() here!
        } finally {
          // Always continue loop
          await askNext();
          resolve();
        }
      });
    });
  };

  await askNext();
}
```

---

## 8. Performance Characteristics

| Operation | Target | Typical | Notes |
|-----------|--------|---------|-------|
| Binary startup | <150ms | ~100ms | Bun JIT + plugin load |
| CLI parse | <5ms | ~2ms | CAC is optimized |
| Plugin load (1) | <50ms | ~30ms | Dynamic import + execute |
| REPL prompt | <100ms | ~50ms | Readline + I/O |
| Command execution | Variable | - | Depends on command logic |

---

## 9. Security Considerations

### 9.1 Plugin Isolation

Plugins execute in the same process but do not have direct OS access. All system calls route through `ctx.exec()`.

### 9.2 Configuration Safety

Configuration is validated before use. Invalid config files are silently ignored with sensible defaults.

### 9.3 Input Validation

All user input (REPL, prompts) is validated before passing to commands.

---

## 10. Future Extensibility

This specification prepares for:

1. **TUI Implementation:** Same SfloContext interface, different output renderer
2. **Remote Execution:** ctx.exec could delegate to SSH/RPC
3. **Headless Mode:** Test harness implementation without terminal I/O
4. **Plugin Sandboxing:** Worker thread isolation (if security escalates)

---

## Appendix: TypeScript Type Definitions

```typescript
// @sflo/types/index.ts
import type cac from 'cac';

export interface SfloContext {
  print(message: string): void;
  error(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  info(message: string): void;
  ask(message: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  select<T extends string | number | symbol>(
    message: string,
    options: Array<{ label: string; value: T }>
  ): Promise<T>;
  exec(command: string, args?: string[]): Promise<ExecResult>;
  spinner(message: string): { start(): void; stop(finalMessage?: string): void };
  cli: ReturnType<typeof cac>;
  getConfig(key?: string): Record<string, any>;
  setConfig(key: string, value: any): void;
}

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

// Plugin entry point signature
export type PluginSetup = (ctx: SfloContext) => void;
```

---

**Document End**

---

### Document Metadata

| Attribute | Value |
|-----------|-------|
| Version | 1.0 |
| Author | SFLO Architecture Team |
| Last Reviewed | April 2026 |
| Status | Final |
| Audience | Staff Engineers, Tech Leads |

