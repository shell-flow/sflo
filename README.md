# SFLO (Shell-Flow)

> ALERT: This project is in beta. Many features are not yet implemented. When the official first release is done, this message will be removed. My commitment is to keep this always free and open source.

A highly performant, extensible terminal assistant designed to simplify your daily command-line workflow. 

SFLO acts as your central hub in the terminal. It transforms complex or repetitive CLI operations into fluid, easy-to-remember commands. Built as a single, self-contained binary, SFLO requires zero external dependencies to run—no Node.js, no Python, and no Git required on your machine.

## Key Features

* ⚡ **Blazing Fast:** Pre-compiled into a native binary. Startup times are nearly instantaneous.
* 🔌 **Zero-Dependency Plugin System:** Extend SFLO's capabilities by installing community plugins directly from GitHub. SFLO downloads and executes them natively without needing `git` or `npm` installed.
* 🔄 **Multiple Interfaces:** Use it as a standard CLI (`sflo [command]`) or drop into the continuous interactive REPL mode to stay in the flow without retyping the binary name.
* ⚙️ **Dynamic Configuration:** Define global defaults in `~/.sflo` or override them per-project using a local `.sflo/` folder.
* 🤖 **AI-Ready Architecture:** Built with future integrations in mind for MCP (Model Context Protocol) and local AI assistants.

## Installation

SFLO is distributed as a standalone binary. Choose your preferred package manager:

**macOS / Linux (Homebrew)**
```bash
brew tap brennon/sflo
brew install sflo
````

**Windows (Scoop)**

```bash
scoop bucket add sflo [https://github.com/brennon/scoop-sflo](https://github.com/brennon/scoop-sflo)
scoop install sflo
```

**Linux / Universal (Install Script)**

```bash
curl -fsSL [https://raw.githubusercontent.com/Brennon-Oliveira/shell-flow/main/install.sh](https://raw.githubusercontent.com/Brennon-Oliveira/shell-flow/main/install.sh) | bash
```

**NPM (Binary Wrapper)**
*(Downloads the pre-compiled native binary for your architecture. Does not require Node.js at runtime)*

```bash
npm install -g sflo
```

## Quick Start

Run SFLO to see the available commands and general help:

```bash
sflo --help
```

### REPL Mode

Drop into the interactive loop to execute multiple commands without leaving the SFLO environment:

```bash
sflo --repl
# or just:
sflo
```

### Managing Plugins

SFLO's true power comes from its community plugins. You can install any compatible SFLO plugin directly from a GitHub repository:

```bash
# Add a plugin
sflo plugin add <github-user>/<repository>

# Example:
sflo plugin add brennon/sflo-git-utils

# Update all installed plugins
sflo plugin update

# List installed plugins
sflo plugin list
```

## Configuration

SFLO relies entirely on configuration files, avoiding hard-coded behaviors.

1.  **Global:** `~/.sflo/config.json`
2.  **Local (Project-specific):** Create a `.sflo/config.json` folder in your current working directory. SFLO will automatically prioritize these settings, making it perfect for team standardization.

## Advanced & Technical Documentation

Are you interested in how SFLO is built, or do you want to create your own plugins?
SFLO is built on top of the Bun runtime and strictly typed with TypeScript.

Please refer to the technical documentation:

  * [Project Overview & Architecture](https://github.com/shell-flow/sflo/blob/main/docs/PROJECT.md)
  * [Architecture Decision Records (ADRs)](https://github.com/shell-flow/sflo/blob/main/docs/adrs)
  * [Create your own plugin](https://github.com/shell-flow/sflo/blob/main/docs/PLUGIN_CREATION.md)

## License

This project is Open Source and licensed under the [MIT License](https://github.com/shell-flow/sflo/blob/main/LICENSE).