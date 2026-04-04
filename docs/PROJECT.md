# SFLO (Shell-Flow) - Technical Project Documentation

## 1. System Overview
SFLO (Shell-Flow) is a highly performant, extensible terminal assistant designed to simplify command-line workflows. It acts as an abstraction layer, transforming complex, disparate CLI operations into a unified, fluid, and ergonomic experience. 

Architecturally, SFLO is built as a self-contained, cross-platform binary executable powered by the **Bun** runtime and **TypeScript**, requiring zero external dependencies (no Node.js, npm, or Git required on the host machine).

## 2. Core Architecture & Stack
* **Runtime & Compiler:** Bun. Chosen for its millisecond-level startup times and native ability to execute and compile TypeScript.
* **Primary Language:** TypeScript (Strict mode). Ensures robust internal APIs and provides excellent DX (Developer Experience) for plugin creators via type definitions.
* **Packaging:** The application is cross-compiled into native executables using `bun build --compile --target=<os-arch>`.

## 3. Interface Layer (I/O)
The system decouples the business logic from the presentation layer to support multiple interaction paradigms:

* **CLI (Command Line Interface):** The primary entry point. Powered by `cac` for lightweight, fast argument parsing and sub-command routing.
* **REPL (Read-Eval-Print Loop):** An interactive, continuous terminal session utilizing Bun's native asynchronous `readline`. It captures input and passes it back to the in-memory `cac` parser, eliminating the need to repeatedly type the `sflo` binary name.
* **Visuals & Prompts:** Utilizes `@clack/prompts` for modern, step-by-step terminal UI interactions and `picocolors` for high-performance standard output coloring.
* **TUI (Terminal User Interface):** Architecturally planned as a future input/output method, separated from the core execution engine.

## 4. Plugin System Architecture (No-Git Strategy)
SFLO achieves maximum extensibility through a dynamic, decentralized plugin system that does not rely on Git or local compilation steps.

* **Fetching:** Plugins are downloaded via raw HTTP REST requests directly from GitHub repositories as compressed archives (e.g., `main.zip`).
* **Extraction & Storage:** The archive is extracted directly to `~/.sflo/plugins/github.com/<owner>/<repo>/`. State and versions (commit hashes/ETags) are tracked in `~/.sflo/plugins.json`.
* **Execution:** During the CLI boot lifecycle, SFLO dynamically loads the plugin's raw `.ts` entry point using `await import(pluginPath)`. Bun executes this code in real-time.
* **Inversion of Control (IoC):** Plugins must export a default function that accepts an `SfloContext` object. The core engine injects this context (containing the CLI router, I/O wrappers, and utilities) into the plugin. This ensures plugins do not need to install local dependencies (`node_modules`) or directly manipulate the host OS.

## 5. Configuration Strategy
SFLO adheres to a dynamic, strict "no hard-coded values" policy.
* **Global Scope:** Reads defaults and global user preferences from `~/.sflo/config.json`.
* **Local Scope (Project-Level):** Prioritizes configurations found in a local `.sflo/` directory within the current working directory, allowing teams to standardize CLI behaviors per project.

## 6. Distribution & CI/CD
Deployment is entirely automated via GitHub Actions, establishing GitHub Releases as the single source of truth.
* **Build Matrix:** Actions cross-compile binaries for Linux (x64/arm64), Windows (x64), and macOS (x64/arm64) on every versioned tag push.
* **Package Managers:** The pre-compiled binaries are mapped to various package managers (Scoop for Windows, Homebrew for macOS/Linux, and installation scripts for native Linux distros).
* **NPM Fallback:** For users preferring npm, SFLO utilizes an architecture-specific package strategy (e.g., `@sflo/linux-x64`) mapped via `optionalDependencies` in a root package, allowing `npm i -g sflo` to pull only the pre-compiled binary without requiring Node.js at runtime.

## 7. Documentation Index
For deep-dive implementation details, refer to the accompanying specifications and decisions:
* `docs/adr/`: Architecture Decision Records (e.g., runtime choices).
* `specs/`: Detailed technical specifications for components like the REPL, I/O, Plugin System, and CI/CD pipelines.