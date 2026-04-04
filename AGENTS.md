# SFLO - AI Agent Instruction Manual (AGENTS.md)

## Context
This document provides strict architectural guidelines and rules for AI agents (LLMs, coding assistants) analyzing, refactoring, or generating code for the SFLO (Shell-Flow) project.

Read this entirely before proposing changes or writing code.

## 1. Absolute Constraints
* **Language:** 100% TypeScript (Strict Mode). Do NOT suggest Python, JavaScript, or any other language.
* **Runtime:** Bun. The project relies on Bun's native TS execution and compilation capabilities.
* **Dependencies:** Zero external dependencies for the end-user. Do not introduce packages that require Node.js, `npm`, or `git` to be installed on the host machine.
* **Language (Text):** All variables, comments, documentation, and CLI outputs MUST be in English.

## 2. Code Generation Guidelines
* **Native APIs:** Prioritize Bun's native APIs (`Bun.file()`, `Bun.spawn()`, `Bun.write()`) over Node.js built-ins (`fs`, `child_process`) whenever possible.
* **I/O Separation:** NEVER use `console.log`, `console.error`, or `process.exit()` directly in business logic. Always use the internal I/O wrapper layer (e.g., `ctx.print()`, `ctx.error()`) to ensure compatibility with CLI, TUI, and REPL modes.
* **CLI Routing:** Use `cac` for parsing arguments and registering commands.
* **UI Components:** Use `@clack/prompts` for interactive terminal prompts and `picocolors` for text formatting.
* **Configurations:** Never hardcode paths or preferences. Always fetch them from the global (`~/.sflo/config.json`) or local project context.

## 3. Plugin Architecture Rules
When asked to create or modify an SFLO plugin:
* **No Build Step:** Plugins are raw `.ts` files downloaded directly from GitHub. Do NOT generate a `package.json`, `esbuild` config, or transpilation step for plugins.
* **Entry Point:** The plugin must have an `index.ts` exporting a default function.
* **Dependency Injection:** The default function must accept an `SfloContext` object. All interactions with the system (UI, file system, command execution) MUST be done through this context.
* **Imports:** Use `@sflo/types` strictly as a `devDependency` for typings. Do not import external functional libraries if the SFLO Core already provides an equivalent utility.

### Plugin Boilerplate Target
```typescript
import type { SfloContext } from '@sflo/types';

export default function setup(ctx: SfloContext) {
  ctx.cli.command('example', 'Example command description')
    .action(async () => {
      ctx.print("Executing action...");
    });
}