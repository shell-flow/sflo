# SFLO Configuration Management Specification

## Table of Contents

1. [Overview](#overview)
2. [Configuration Hierarchy](#configuration-hierarchy)
3. [Config Schema & Validation](#config-schema--validation)
4. [Plugin Manifest Format](#plugin-manifest-format)
5. [Runtime Configuration Loading](#runtime-configuration-loading)
6. [Environment Variable Overrides](#environment-variable-overrides)
7. [Reference Code / Boilerplate](#reference-code--boilerplate)
8. [Error Handling](#error-handling)
9. [Security Considerations](#security-considerations)
10. [Performance & Caching](#performance--caching)
11. [Migration & Versioning](#migration--versioning)
12. [Troubleshooting](#troubleshooting)

---

## 1. Overview

SFLO configuration management provides a hierarchical, environment-aware system for:

- **User-level settings** stored in `~/.sflo/config.json`
- **Project-level overrides** stored in `.sflo/config.json` (project root)
- **Environment-based customization** via `SFLO_*` environment variables
- **Plugin registry & metadata** stored in `~/.sflo/plugins.json`
- **Lazy loading** with in-memory caching for performance

**Design Goals:**
- Zero configuration by default (sensible defaults embedded)
- Single source of truth per scope (global vs. local)
- Type-safe config access via TypeScript
- Environment variable precedence over file-based config
- Non-breaking config evolution (versioning & migration)

---

## 2. Configuration Hierarchy

Configuration is resolved with the following precedence (highest to lowest):

```
1. Environment Variables (SFLO_*)
   ├─ Takes precedence over all file-based config
   └─ Format: SFLO_SECTION__KEY=value (double underscore for nesting)

2. Local Project Config (.sflo/config.json)
   ├─ Located in project root (searched upward from CWD)
   └─ Overrides global defaults

3. Global User Config (~/.sflo/config.json)
   ├─ User's home directory
   └─ Applied to all projects

4. Built-in Defaults
   └─ Hardcoded defaults in SfloConfig type
```

### 2.1 Config Search Algorithm

When loading project-level config:

```typescript
// Pseudocode: Search from CWD upward to filesystem root
for (let dir = cwd; dir !== '/'; dir = dirname(dir)) {
  const configPath = join(dir, '.sflo', 'config.json');
  if (fileExists(configPath)) {
    return configPath;
  }
}
return null; // No project config found
```

This allows nesting of multiple SFLO projects and monorepo support.

---

## 3. Config Schema & Validation

### 3.1 Global Config Schema (`~/.sflo/config.json`)

```json
{
  "$schema": "https://sflo.io/schemas/config.v1.json",
  "version": "1",
  "user": {
    "name": "Developer Name",
    "email": "dev@example.com"
  },
  "cli": {
    "colorOutput": true,
    "verbosity": "normal",
    "pageSize": 20,
    "commandTimeout": 30000,
    "historySize": 1000
  },
  "plugins": {
    "autoLoad": true,
    "searchPaths": ["~/.sflo/plugins", "./plugins"],
    "registry": "https://registry.sflo.io"
  },
  "storage": {
    "cacheDir": "~/.sflo/cache",
    "dataDir": "~/.sflo/data",
    "logsDir": "~/.sflo/logs",
    "maxCacheSize": 536870912
  },
  "security": {
    "allowUnsignedPlugins": false,
    "tlsVerify": true,
    "disabledPlugins": []
  },
  "repl": {
    "enabled": true,
    "promptColor": "cyan",
    "historyFile": "~/.sflo/history"
  },
  "advanced": {
    "debugMode": false,
    "metricsEnabled": false,
    "asyncConcurrency": 4
  }
}
```

### 3.2 Local Project Config Schema (`.sflo/config.json`)

```json
{
  "$schema": "https://sflo.io/schemas/config.v1.json",
  "version": "1",
  "project": {
    "name": "my-project",
    "id": "proj_abc123"
  },
  "cli": {
    "colorOutput": true,
    "verbosity": "verbose"
  },
  "plugins": {
    "enabled": ["plugin-a", "plugin-b"],
    "disabled": ["plugin-c"]
  },
  "storage": {
    "cacheDir": ".sflo/cache"
  }
}
```

### 3.3 TypeScript Config Types

```typescript
// Core config shape with full type safety
export interface SfloConfig {
  version: string;
  user?: UserConfig;
  project?: ProjectConfig;
  cli: CliConfig;
  plugins: PluginsConfig;
  storage: StorageConfig;
  security: SecurityConfig;
  repl: ReplConfig;
  advanced: AdvancedConfig;
}

export interface UserConfig {
  name?: string;
  email?: string;
}

export interface ProjectConfig {
  name: string;
  id?: string;
  description?: string;
}

export interface CliConfig {
  colorOutput: boolean;
  verbosity: 'silent' | 'error' | 'warn' | 'normal' | 'verbose' | 'debug';
  pageSize: number;
  commandTimeout: number;
  historySize: number;
}

export interface PluginsConfig {
  autoLoad: boolean;
  searchPaths: string[];
  registry?: string;
  enabled?: string[];
  disabled?: string[];
}

export interface StorageConfig {
  cacheDir: string;
  dataDir: string;
  logsDir: string;
  maxCacheSize: number;
}

export interface SecurityConfig {
  allowUnsignedPlugins: boolean;
  tlsVerify: boolean;
  disabledPlugins: string[];
}

export interface ReplConfig {
  enabled: boolean;
  promptColor: string;
  historyFile: string;
}

export interface AdvancedConfig {
  debugMode: boolean;
  metricsEnabled: boolean;
  asyncConcurrency: number;
}

// Resolved runtime config (all paths expanded, all values filled)
export interface ResolvedSfloConfig extends SfloConfig {
  _meta: {
    loadedFrom: 'builtin' | 'global' | 'project';
    globalConfigPath?: string;
    projectConfigPath?: string;
    resolvedAt: number;
  };
}
```

### 3.4 Schema Validation

Use Bun's native JSON validation without external dependencies:

```typescript
// Validate config against schema using zod-like manual validation
function validateSfloConfig(config: unknown): SfloConfig {
  if (typeof config !== 'object' || config === null) {
    throw new ConfigError('Config must be an object');
  }

  const obj = config as Record<string, unknown>;

  // Type guards for required fields
  if (typeof obj.version !== 'string') {
    throw new ConfigError('version must be a string');
  }

  if (typeof obj.cli !== 'object' || obj.cli === null) {
    throw new ConfigError('cli config section is required');
  }

  // Validate verbosity enum
  const validVerbosity = ['silent', 'error', 'warn', 'normal', 'verbose', 'debug'];
  if (!validVerbosity.includes(obj.cli.verbosity)) {
    throw new ConfigError(
      `cli.verbosity must be one of: ${validVerbosity.join(', ')}`
    );
  }

  // Continue validation for all required nested fields...
  return config as SfloConfig;
}
```

---

## 4. Plugin Manifest Format

### 4.1 Plugin Registry (`~/.sflo/plugins.json`)

Tracks installed plugins, versions, and metadata:

```json
{
  "version": "1",
  "plugins": [
    {
      "id": "plugin-github",
      "name": "GitHub Integration",
      "version": "1.2.0",
      "source": "https://github.com/user/sflo-plugin-github/raw/main/index.ts",
      "checksum": "sha256:abc123...",
      "installedAt": "2025-02-15T10:30:00Z",
      "enabled": true,
      "permissions": ["fs:read", "http:fetch", "shell:execute"]
    },
    {
      "id": "plugin-aws",
      "name": "AWS CLI Helper",
      "version": "2.0.1",
      "source": "https://github.com/user/sflo-plugin-aws/raw/main/index.ts",
      "checksum": "sha256:def456...",
      "installedAt": "2025-01-10T14:22:00Z",
      "enabled": false,
      "permissions": ["http:fetch", "shell:execute"]
    }
  ]
}
```

### 4.2 Plugin Manifest TypeScript Types

```typescript
export interface PluginManifest {
  id: string; // Unique plugin identifier (slug format)
  name: string;
  version: string; // semver
  source: string; // GitHub raw URL or local file path
  checksum: string; // sha256:xxx for integrity verification
  installedAt: string; // ISO 8601 timestamp
  enabled: boolean;
  permissions: PluginPermission[];
  metadata?: {
    author?: string;
    description?: string;
    homepage?: string;
    license?: string;
    keywords?: string[];
  };
}

export type PluginPermission =
  | 'fs:read'
  | 'fs:write'
  | 'fs:delete'
  | 'http:fetch'
  | 'shell:execute'
  | 'system:env'
  | 'system:time';

export interface PluginsRegistry {
  version: string;
  plugins: PluginManifest[];
}
```

---

## 5. Runtime Configuration Loading

### 5.1 Config Manager Class

Core abstraction for loading, merging, and caching configuration:

```typescript
export class ConfigManager {
  private globalConfig: SfloConfig | null = null;
  private projectConfig: SfloConfig | null = null;
  private resolvedConfig: ResolvedSfloConfig | null = null;
  private pluginsRegistry: PluginsRegistry | null = null;
  private loadedAt: number = 0;
  private cacheTTL: number = 60000; // 1 minute

  /**
   * Load and resolve configuration from all sources
   * Returns merged config with environment variables taking precedence
   */
  async resolve(): Promise<ResolvedSfloConfig> {
    // Return cached config if still valid
    if (this.resolvedConfig && Date.now() - this.loadedAt < this.cacheTTL) {
      return this.resolvedConfig;
    }

    // Load configs in order
    const globalCfg = await this.loadGlobalConfig();
    const projectCfg = await this.loadProjectConfig();
    const envOverrides = this.loadEnvironmentOverrides();

    // Merge: defaults → global → project → env
    const merged = this.mergeConfigs(
      this.getDefaults(),
      globalCfg,
      projectCfg,
      envOverrides
    );

    // Expand all path variables
    const resolved = this.expandPaths(merged);

    // Cache the result
    this.resolvedConfig = resolved;
    this.loadedAt = Date.now();

    return resolved;
  }

  /**
   * Load global user config from ~/.sflo/config.json
   */
  private async loadGlobalConfig(): Promise<Partial<SfloConfig>> {
    const homedir = Bun.env.HOME || Bun.env.USERPROFILE;
    if (!homedir) {
      return {};
    }

    const globalPath = `${homedir}/.sflo/config.json`;
    try {
      const file = Bun.file(globalPath);
      if (await file.exists()) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        return validateSfloConfig(parsed);
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new ConfigError(
          `Invalid JSON in global config at ${globalPath}: ${err.message}`
        );
      }
      // File doesn't exist or is unreadable, skip
    }

    return {};
  }

  /**
   * Load project-level config by searching upward from CWD
   */
  private async loadProjectConfig(): Promise<Partial<SfloConfig>> {
    const cwd = process.cwd();
    let dir = cwd;

    while (dir !== '/') {
      const projectPath = `${dir}/.sflo/config.json`;
      try {
        const file = Bun.file(projectPath);
        if (await file.exists()) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          return validateSfloConfig(parsed);
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new ConfigError(
            `Invalid JSON in project config at ${projectPath}: ${err.message}`
          );
        }
        // Continue searching upward
      }

      // Move to parent directory
      const parent = dir.split('/').slice(0, -1).join('/');
      if (parent === dir) break; // Reached filesystem root
      dir = parent;
    }

    return {};
  }

  /**
   * Load overrides from SFLO_* environment variables
   * Format: SFLO_SECTION__KEY=value
   */
  private loadEnvironmentOverrides(): Partial<SfloConfig> {
    const overrides: Partial<SfloConfig> = {};

    for (const [key, value] of Object.entries(Bun.env)) {
      if (!key.startsWith('SFLO_')) continue;

      const parts = key.slice(5).split('__'); // Remove SFLO_ prefix
      if (parts.length < 2) continue; // Invalid format

      const [section, ...keyParts] = parts;
      const configKey = keyParts.join('.').toLowerCase();

      // Type-safe nested assignment
      if (!overrides[section as keyof SfloConfig]) {
        overrides[section as keyof SfloConfig] = {};
      }

      const sectionObj = overrides[section as keyof SfloConfig] as Record<
        string,
        unknown
      >;
      sectionObj[configKey] = this.parseEnvValue(value);
    }

    return overrides;
  }

  /**
   * Parse environment variable values to correct types
   */
  private parseEnvValue(value: string | undefined): unknown {
    if (value === undefined) return undefined;

    // Parse booleans
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Parse numbers
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    // Parse JSON arrays/objects
    if ((value.startsWith('[') && value.endsWith(']')) || 
        (value.startsWith('{') && value.endsWith('}'))) {
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string if not valid JSON
      }
    }

    return value; // Return as string
  }

  /**
   * Deep merge configs with later ones overriding earlier ones
   */
  private mergeConfigs(
    ...configs: Partial<SfloConfig>[]
  ): Partial<SfloConfig> {
    return configs.reduce((acc, cfg) => this.deepMerge(acc, cfg), {});
  }

  /**
   * Recursively merge objects
   */
  private deepMerge(
    target: any,
    source: any
  ): any {
    if (typeof source !== 'object' || source === null) {
      return source;
    }

    if (typeof target !== 'object' || target === null) {
      target = {};
    }

    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        target[key] = this.deepMerge(target[key], value);
      } else {
        target[key] = value;
      }
    }

    return target;
  }

  /**
   * Expand path variables in config
   * Supports: ~, ${HOME}, ${XDG_CONFIG_HOME}, etc.
   */
  private expandPaths(config: Partial<SfloConfig>): ResolvedSfloConfig {
    const expanded = JSON.parse(JSON.stringify(config)); // Deep clone

    const expandPath = (str: string): string => {
      if (str.startsWith('~')) {
        const home = Bun.env.HOME || Bun.env.USERPROFILE || '/root';
        return home + str.slice(1);
      }

      // Replace ${VAR} with environment variable
      return str.replace(/\$\{([A-Z_]+)\}/g, (_, varName) => {
        return Bun.env[varName] || `\${${varName}}`;
      });
    };

    // Expand all string values that look like paths
    const traverse = (obj: any): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && (value.includes('~') || value.includes('$'))) {
          obj[key] = expandPath(value);
        } else if (typeof value === 'object' && value !== null) {
          traverse(value);
        }
      }
    };

    traverse(expanded);

    return {
      ...expanded,
      _meta: {
        loadedFrom: this.projectConfig ? 'project' : 'global',
        globalConfigPath: `${Bun.env.HOME || '~'}/.sflo/config.json`,
        projectConfigPath: this.projectConfig ? process.cwd() + '/.sflo/config.json' : undefined,
        resolvedAt: Date.now(),
      },
    } as ResolvedSfloConfig;
  }

  /**
   * Get built-in defaults
   */
  private getDefaults(): SfloConfig {
    return {
      version: '1',
      cli: {
        colorOutput: true,
        verbosity: 'normal',
        pageSize: 20,
        commandTimeout: 30000,
        historySize: 1000,
      },
      plugins: {
        autoLoad: true,
        searchPaths: ['~/.sflo/plugins', './plugins'],
      },
      storage: {
        cacheDir: '~/.sflo/cache',
        dataDir: '~/.sflo/data',
        logsDir: '~/.sflo/logs',
        maxCacheSize: 536870912, // 512 MB
      },
      security: {
        allowUnsignedPlugins: false,
        tlsVerify: true,
        disabledPlugins: [],
      },
      repl: {
        enabled: true,
        promptColor: 'cyan',
        historyFile: '~/.sflo/history',
      },
      advanced: {
        debugMode: false,
        metricsEnabled: false,
        asyncConcurrency: 4,
      },
    };
  }

  /**
   * Load and cache plugins registry
   */
  async loadPluginsRegistry(): Promise<PluginsRegistry> {
    if (this.pluginsRegistry) {
      return this.pluginsRegistry;
    }

    const homedir = Bun.env.HOME || Bun.env.USERPROFILE;
    if (!homedir) {
      return { version: '1', plugins: [] };
    }

    const registryPath = `${homedir}/.sflo/plugins.json`;
    try {
      const file = Bun.file(registryPath);
      if (await file.exists()) {
        const text = await file.text();
        this.pluginsRegistry = JSON.parse(text);
        return this.pluginsRegistry;
      }
    } catch (err) {
      // Registry doesn't exist or is invalid, return empty
    }

    this.pluginsRegistry = { version: '1', plugins: [] };
    return this.pluginsRegistry;
  }

  /**
   * Persist plugins registry
   */
  async savePluginsRegistry(registry: PluginsRegistry): Promise<void> {
    const homedir = Bun.env.HOME || Bun.env.USERPROFILE;
    if (!homedir) {
      throw new ConfigError('Cannot determine home directory');
    }

    const sfloDir = `${homedir}/.sflo`;
    const registryPath = `${sfloDir}/plugins.json`;

    // Create directory if it doesn't exist
    try {
      await Bun.file(sfloDir).mkdir();
    } catch {
      // Directory already exists
    }

    const content = JSON.stringify(registry, null, 2);
    await Bun.write(registryPath, content);
    this.pluginsRegistry = registry;
  }

  /**
   * Invalidate cache (call after external config changes)
   */
  invalidate(): void {
    this.globalConfig = null;
    this.projectConfig = null;
    this.resolvedConfig = null;
    this.loadedAt = 0;
  }

  /**
   * Get config access method (read-only API)
   */
  get(path: string, defaultValue?: unknown): unknown {
    if (!this.resolvedConfig) {
      throw new ConfigError('Config not loaded. Call resolve() first.');
    }

    const parts = path.split('.');
    let current: any = this.resolvedConfig;

    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = current[part];
      } else {
        return defaultValue;
      }
    }

    return current;
  }
}
```

---

## 6. Environment Variable Overrides

### 6.1 Format Specification

Environment variables follow the pattern: `SFLO_<SECTION>__<KEY>=<VALUE>`

Double underscore (`__`) separates section from key. Nested keys use single underscore or dots:

```bash
# Set CLI verbosity
export SFLO_CLI__VERBOSITY=verbose

# Set storage cache directory
export SFLO_STORAGE__CACHE_DIR=/tmp/sflo-cache

# Disable plugins (JSON array)
export SFLO_SECURITY__DISABLED_PLUGINS='["plugin-a","plugin-b"]'

# Set async concurrency
export SFLO_ADVANCED__ASYNC_CONCURRENCY=8

# Enable color output
export SFLO_CLI__COLOR_OUTPUT=true
```

### 6.2 Environment Variable Reference

| Variable | Type | Section | Key | Example |
|----------|------|---------|-----|---------|
| `SFLO_CLI__COLOR_OUTPUT` | boolean | cli | colorOutput | `true` |
| `SFLO_CLI__VERBOSITY` | enum | cli | verbosity | `verbose` |
| `SFLO_CLI__PAGE_SIZE` | number | cli | pageSize | `50` |
| `SFLO_CLI__COMMAND_TIMEOUT` | number | cli | commandTimeout | `60000` |
| `SFLO_PLUGINS__AUTO_LOAD` | boolean | plugins | autoLoad | `false` |
| `SFLO_PLUGINS__SEARCH_PATHS` | array | plugins | searchPaths | `["/tmp/plugins"]` |
| `SFLO_STORAGE__CACHE_DIR` | string | storage | cacheDir | `~/.sflo/cache` |
| `SFLO_SECURITY__ALLOW_UNSIGNED_PLUGINS` | boolean | security | allowUnsignedPlugins | `true` |
| `SFLO_ADVANCED__DEBUG_MODE` | boolean | advanced | debugMode | `true` |

---

## 7. Reference Code / Boilerplate

### 7.1 Configuration Module (`src/config.ts`)

Production-ready configuration management module:

```typescript
// src/config.ts

import type { SfloConfig, ResolvedSfloConfig, PluginsRegistry } from '@sflo/types';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Main configuration manager
 * Handles loading, merging, and caching config from multiple sources
 */
export class ConfigManager {
  private globalConfig: SfloConfig | null = null;
  private projectConfig: SfloConfig | null = null;
  private resolvedConfig: ResolvedSfloConfig | null = null;
  private pluginsRegistry: PluginsRegistry | null = null;
  private loadedAt: number = 0;
  private readonly cacheTTL: number = 60000; // 1 minute

  /**
   * Load and resolve configuration from all sources
   * Precedence: env vars > project config > global config > defaults
   */
  async resolve(): Promise<ResolvedSfloConfig> {
    // Return cached config if still valid
    if (this.resolvedConfig && Date.now() - this.loadedAt < this.cacheTTL) {
      return this.resolvedConfig;
    }

    // Load configs in order
    const globalCfg = await this.loadGlobalConfig();
    const projectCfg = await this.loadProjectConfig();
    const envOverrides = this.loadEnvironmentOverrides();

    // Merge: defaults → global → project → env
    const merged = this.mergeConfigs(
      this.getDefaults(),
      globalCfg,
      projectCfg,
      envOverrides
    );

    // Expand all path variables
    const resolved = this.expandPaths(merged);

    // Cache the result
    this.resolvedConfig = resolved;
    this.loadedAt = Date.now();

    return resolved;
  }

  /**
   * Load global user config from ~/.sflo/config.json
   */
  private async loadGlobalConfig(): Promise<Partial<SfloConfig>> {
    const homedir = Bun.env.HOME || Bun.env.USERPROFILE;
    if (!homedir) {
      return {};
    }

    const globalPath = `${homedir}/.sflo/config.json`;
    try {
      const file = Bun.file(globalPath);
      if (await file.exists()) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        validateSfloConfig(parsed);
        this.globalConfig = parsed;
        return parsed;
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new ConfigError(
          `Invalid JSON in global config at ${globalPath}: ${err.message}`
        );
      }
      // File doesn't exist or is unreadable
    }

    return {};
  }

  /**
   * Load project-level config by searching upward from CWD
   */
  private async loadProjectConfig(): Promise<Partial<SfloConfig>> {
    let dir = process.cwd();
    const fsRoot = '/';

    while (dir !== fsRoot) {
      const projectPath = `${dir}/.sflo/config.json`;
      try {
        const file = Bun.file(projectPath);
        if (await file.exists()) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          validateSfloConfig(parsed);
          this.projectConfig = parsed;
          return parsed;
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new ConfigError(
            `Invalid JSON in project config at ${projectPath}: ${err.message}`
          );
        }
        // Continue searching upward
      }

      // Move to parent directory
      const parent = dir.split('/').slice(0, -1).join('/') || fsRoot;
      if (parent === dir) break;
      dir = parent;
    }

    return {};
  }

  /**
   * Load overrides from SFLO_* environment variables
   */
  private loadEnvironmentOverrides(): Partial<SfloConfig> {
    const overrides: Record<string, any> = {};

    for (const [key, value] of Object.entries(Bun.env)) {
      if (!key.startsWith('SFLO_')) continue;

      const parts = key.slice(5).split('__');
      if (parts.length < 2) continue;

      const [section, ...keyParts] = parts;
      const configKey = keyParts.join('.').toLowerCase();

      if (!(section in overrides)) {
        overrides[section] = {};
      }

      overrides[section][configKey] = this.parseEnvValue(value);
    }

    return overrides;
  }

  /**
   * Parse environment variable values to correct types
   */
  private parseEnvValue(value: string | undefined): unknown {
    if (value === undefined) return undefined;

    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;

    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    if ((value.startsWith('[') && value.endsWith(']')) ||
        (value.startsWith('{') && value.endsWith('}'))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  /**
   * Deep merge configs with later ones overriding earlier ones
   */
  private mergeConfigs(...configs: Partial<SfloConfig>[]): Partial<SfloConfig> {
    return configs.reduce((acc, cfg) => this.deepMerge(acc, cfg || {}), {});
  }

  /**
   * Recursively merge objects
   */
  private deepMerge(target: any, source: any): any {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      return source;
    }

    if (typeof target !== 'object' || target === null || Array.isArray(target)) {
      target = {};
    }

    for (const [key, value] of Object.entries(source)) {
      target[key] = this.deepMerge(target[key], value);
    }

    return target;
  }

  /**
   * Expand path variables in config
   */
  private expandPaths(config: Partial<SfloConfig>): ResolvedSfloConfig {
    const expanded = JSON.parse(JSON.stringify(config)); // Deep clone

    const expandPath = (str: string): string => {
      if (str.startsWith('~')) {
        const home = Bun.env.HOME || Bun.env.USERPROFILE || '/root';
        return home + str.slice(1);
      }

      return str.replace(/\$\{([A-Z_]+)\}/g, (_, varName) => {
        return Bun.env[varName] || `\${${varName}}`;
      });
    };

    const traverse = (obj: any): void => {
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string' && (value.includes('~') || value.includes('$'))) {
          obj[key] = expandPath(value);
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          traverse(value);
        }
      }
    };

    traverse(expanded);

    return {
      ...expanded,
      _meta: {
        loadedFrom: this.projectConfig ? 'project' : this.globalConfig ? 'global' : 'builtin',
        resolvedAt: Date.now(),
      },
    } as ResolvedSfloConfig;
  }

  /**
   * Get built-in defaults
   */
  private getDefaults(): SfloConfig {
    return {
      version: '1',
      cli: {
        colorOutput: true,
        verbosity: 'normal',
        pageSize: 20,
        commandTimeout: 30000,
        historySize: 1000,
      },
      plugins: {
        autoLoad: true,
        searchPaths: ['~/.sflo/plugins', './plugins'],
      },
      storage: {
        cacheDir: '~/.sflo/cache',
        dataDir: '~/.sflo/data',
        logsDir: '~/.sflo/logs',
        maxCacheSize: 536870912, // 512 MB
      },
      security: {
        allowUnsignedPlugins: false,
        tlsVerify: true,
        disabledPlugins: [],
      },
      repl: {
        enabled: true,
        promptColor: 'cyan',
        historyFile: '~/.sflo/history',
      },
      advanced: {
        debugMode: false,
        metricsEnabled: false,
        asyncConcurrency: 4,
      },
    };
  }

  /**
   * Load and cache plugins registry
   */
  async loadPluginsRegistry(): Promise<PluginsRegistry> {
    if (this.pluginsRegistry) {
      return this.pluginsRegistry;
    }

    const homedir = Bun.env.HOME || Bun.env.USERPROFILE;
    if (!homedir) {
      return { version: '1', plugins: [] };
    }

    const registryPath = `${homedir}/.sflo/plugins.json`;
    try {
      const file = Bun.file(registryPath);
      if (await file.exists()) {
        const text = await file.text();
        this.pluginsRegistry = JSON.parse(text);
        return this.pluginsRegistry;
      }
    } catch {
      // Registry file doesn't exist or is unreadable
    }

    this.pluginsRegistry = { version: '1', plugins: [] };
    return this.pluginsRegistry;
  }

  /**
   * Persist plugins registry
   */
  async savePluginsRegistry(registry: PluginsRegistry): Promise<void> {
    const homedir = Bun.env.HOME || Bun.env.USERPROFILE;
    if (!homedir) {
      throw new ConfigError('Cannot determine home directory');
    }

    const sfloDir = `${homedir}/.sflo`;

    // Ensure directory exists
    try {
      const dir = Bun.file(sfloDir);
      await (dir as any).mkdir({ recursive: true });
    } catch {
      // Directory already exists
    }

    const registryPath = `${sfloDir}/plugins.json`;
    const content = JSON.stringify(registry, null, 2);
    await Bun.write(registryPath, content);
    this.pluginsRegistry = registry;
  }

  /**
   * Invalidate cache (call after external config changes)
   */
  invalidate(): void {
    this.globalConfig = null;
    this.projectConfig = null;
    this.resolvedConfig = null;
    this.pluginsRegistry = null;
    this.loadedAt = 0;
  }

  /**
   * Get config value by path (read-only API)
   */
  get(path: string, defaultValue?: unknown): unknown {
    if (!this.resolvedConfig) {
      throw new ConfigError('Config not loaded. Call resolve() first.');
    }

    const parts = path.split('.');
    let current: any = this.resolvedConfig;

    for (const part of parts) {
      if (typeof current === 'object' && current !== null && part in current) {
        current = current[part];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Get entire resolved config
   */
  getResolved(): ResolvedSfloConfig {
    if (!this.resolvedConfig) {
      throw new ConfigError('Config not loaded. Call resolve() first.');
    }
    return this.resolvedConfig;
  }
}

/**
 * Validate config against schema
 * Throws ConfigError if invalid
 */
function validateSfloConfig(config: unknown): asserts config is SfloConfig {
  if (typeof config !== 'object' || config === null) {
    throw new ConfigError('Config must be an object');
  }

  const obj = config as Record<string, unknown>;

  // Validate version
  if (!obj.version || typeof obj.version !== 'string') {
    throw new ConfigError('Config version must be a string');
  }

  // Validate cli section if present
  if (obj.cli) {
    if (typeof obj.cli !== 'object' || obj.cli === null) {
      throw new ConfigError('cli config section must be an object');
    }
    const cli = obj.cli as Record<string, unknown>;
    if (cli.verbosity && !['silent', 'error', 'warn', 'normal', 'verbose', 'debug'].includes(cli.verbosity as string)) {
      throw new ConfigError('cli.verbosity must be one of: silent, error, warn, normal, verbose, debug');
    }
  }

  // Additional validation can be added as needed
}
```

### 7.2 SfloContext Integration

Integrate ConfigManager into SfloContext:

```typescript
// In SfloContext (updated from io-cli-repl-architecture.spec.md)

import { ConfigManager, ConfigError } from './config';

export interface SfloContext {
  // ... existing properties ...

  // New config property
  config: ConfigManager;

  // Helper to access config values
  getConfig<T = unknown>(path: string, defaultValue?: T): T;
}

export async function createSfloContext(): Promise<SfloContext> {
  const configManager = new ConfigManager();
  await configManager.resolve();

  return {
    // ... existing properties ...

    config: configManager,

    getConfig<T = unknown>(path: string, defaultValue?: T): T {
      return (configManager.get(path, defaultValue) as T) || defaultValue;
    },
  };
}
```

---

## 8. Error Handling

### 8.1 Configuration Errors

Specific error cases to handle:

| Error | Cause | Recovery |
|-------|-------|----------|
| `ConfigError: Invalid JSON in global config` | Malformed JSON in `~/.sflo/config.json` | Use defaults, log warning |
| `ConfigError: Config version is unsupported` | Version number doesn't match | Attempt migration or fail |
| `ConfigError: cli.verbosity must be one of...` | Invalid enum value in config | Use default value |
| `ConfigError: Cannot determine home directory` | `HOME` env var not set | Fail with helpful message |

### 8.2 Error Recovery Patterns

```typescript
// Pattern: Load config with graceful fallback
async function loadConfig(ctx: SfloContext): Promise<void> {
  try {
    const config = await ctx.config.resolve();
    ctx.print(`Config loaded from ${config._meta.loadedFrom}`);
  } catch (err) {
    if (err instanceof ConfigError) {
      ctx.error(`Configuration error: ${err.message}`);
      ctx.error('Using built-in defaults');
      // ConfigManager already has defaults, continue
    } else {
      throw err;
    }
  }
}

// Pattern: Validate plugin before loading
async function loadPlugin(manifest: PluginManifest, ctx: SfloContext): Promise<void> {
  try {
    // Verify checksum
    const moduleContent = await fetch(manifest.source).then(r => r.text());
    const sha256 = await calculateSha256(moduleContent);
    
    if (sha256 !== manifest.checksum) {
      throw new ConfigError(
        `Plugin ${manifest.id} checksum mismatch: expected ${manifest.checksum}, got ${sha256}`
      );
    }

    // Load plugin with verified source
    const plugin = await import(manifest.source);
    await plugin.default(ctx);
  } catch (err) {
    ctx.error(`Failed to load plugin ${manifest.id}: ${err.message}`);
  }
}
```

---

## 9. Security Considerations

### 9.1 File Permissions

Config files should be readable only by the user:

```typescript
// Recommended: Set restrictive permissions on config directories
async function ensureSecureConfig(homedir: string): Promise<void> {
  const sfloDir = `${homedir}/.sflo`;
  
  // Linux/macOS: 700 (rwx------)
  // Windows: ignore (uses ACLs)
  try {
    const proc = Bun.spawn(['chmod', '700', sfloDir]);
    await proc.exited;
  } catch {
    // Windows or chmod not available, skip
  }
}
```

### 9.2 Sensitive Data in Config

Never store in config:
- API keys or tokens (use environment variables instead)
- Passwords (use system keychain)
- Private data (use encrypted storage)

Recommended pattern:
```json
{
  "plugins": {
    "registry": "https://registry.sflo.io"
  }
}
```

And via environment:
```bash
export SFLO_PLUGINS__REGISTRY_TOKEN=sk_live_xxxxx
```

### 9.3 Plugin Validation

Enforce plugin integrity:
- **Checksum verification** (SHA256) before loading
- **Signature verification** (RSA-based) for published plugins
- **Permission declarations** (explicit in manifest)
- **Registry allowlist** (if enabled)

---

## 10. Performance & Caching

### 10.1 Cache Strategy

- **Config cache TTL:** 1 minute (configurable)
- **Plugins registry cache:** Per-process (invalidate on `savePluginsRegistry`)
- **Path expansion:** Done once at load time
- **JSON parsing:** Minimal overhead (Bun's native JSON)

### 10.2 Performance Benchmarks

Expected performance (on modern hardware):

| Operation | Time |
|-----------|------|
| Load global config | <1ms |
| Load project config (no search) | <1ms |
| Load project config (search 5 levels) | <5ms |
| Full config resolve (all sources) | <10ms |
| Merge and expand paths | <2ms |
| **Total first load** | **~15ms** |
| **Cached access** | **<1ms** |

### 10.3 Large Config Optimization

For projects with large configs:
- Move non-critical settings to separate `.sflo/settings.json`
- Use lazy loading for plugin registry
- Implement config schema stripping for CLI (exclude unused sections)

---

## 11. Migration & Versioning

### 11.1 Config Version Support

Current version: `"1"`

Future versions (v2, v3) will be supported via migration functions:

```typescript
/**
 * Migrate legacy config formats to current version
 */
function migrateConfig(oldConfig: any, fromVersion: string): SfloConfig {
  let config = oldConfig;

  if (fromVersion === '0') {
    // Migrate from v0 to v1
    // Example: rename old property names
    config = {
      ...config,
      cli: {
        ...config.settings?.cli,
      },
    };
  }

  return config as SfloConfig;
}
```

### 11.2 Non-Breaking Changes

Config additions that don't break existing files:
- New optional properties (ignored by older versions)
- New sections with defaults
- Renamed deprecated properties (support both old and new)

### 11.3 Breaking Changes

If a breaking change is needed:
1. Support both versions for 2+ releases
2. Provide migration script
3. Log deprecation warnings
4. Update documentation

---

## 12. Troubleshooting

### 12.1 Debug Mode

Enable debug logging:

```bash
export SFLO_ADVANCED__DEBUG_MODE=true
sflo config show  # Output loaded configuration and sources
```

### 12.2 Config Show Command

Recommended CLI command to inspect loaded config:

```typescript
cli.command('config show', 'Show loaded configuration')
  .action(async () => {
    const config = await ctx.config.resolve();
    ctx.print(JSON.stringify(config, null, 2));
  });
```

### 12.3 Common Issues

**Q: Config changes not taking effect**
A: ConfigManager caches for 1 minute. Call `ctx.config.invalidate()` or wait 60s.

**Q: Environment variable not being read**
A: Ensure format is correct: `SFLO_SECTION__KEY=value` (double underscore).

**Q: Plugin won't load**
A: Check `.sflo/plugins.json` is valid JSON and plugin has correct `source` URL.

**Q: Path expansion not working**
A: Only paths containing `~` or `${VAR}` are expanded. Verify config value format.

---

## Summary

The Configuration Management specification provides:

1. **Hierarchical config system** with sensible precedence (env > project > global > defaults)
2. **Type-safe TypeScript schema** with validation
3. **Environment variable overrides** with flexible formatting
4. **Plugin registry management** with checksums and metadata
5. **Production-ready ConfigManager class** with caching and error recovery
6. **Extensible design** for future versions and custom sections
7. **Security best practices** for sensitive data and plugin validation

Implementation follows AGENTS.md constraints: zero dependencies, Bun native APIs, and 100% TypeScript Strict Mode.
