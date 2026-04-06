# SFLO Testing Strategy Specification

## Table of Contents

1. [Overview](#overview)
2. [Test Architecture](#test-architecture)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Test Framework & Tooling](#test-framework--tooling)
7. [Test Organization & Conventions](#test-organization--conventions)
8. [Coverage Goals & Metrics](#coverage-goals--metrics)
9. [Reference Code / Boilerplate](#reference-code--boilerplate)
10. [CI/CD Integration](#cicd-integration)
11. [Performance Testing](#performance-testing)
12. [Debugging Failed Tests](#debugging-failed-tests)

---

## 1. Overview

SFLO uses a multi-tier testing strategy to ensure reliability, performance, and security:

**Testing Goals:**
1. Catch regressions before release (prevent bugs in production)
2. Verify plugin system works correctly (isolation, permissions)
3. Ensure CLI works across platforms (Linux, macOS, Windows)
4. Validate configuration system (loading, merging, validation)
5. Test REPL interactivity (input parsing, command execution)
6. Measure performance (startup time, memory usage)
7. Verify security (permissions, sandbox isolation)

**Testing Philosophy:**
- **Pyramid model**: Many unit tests, fewer integration tests, minimal E2E tests
- **Test the interface, not implementation**: Tests should verify behavior, not internal details
- **Deterministic tests**: No flaky tests; all tests must pass consistently
- **Fast feedback**: Unit tests should run in <100ms, full suite in <30s
- **Clear failure messages**: Failed assertions should immediately point to the issue

---

## 2. Test Architecture

### 2.1 Test Pyramid

```
                  ▲
                 ╱ ╲
                ╱   ╲        E2E Tests (5-10%)
               ╱     ╲       - Full CLI flow
              ╱───────╲      - Cross-platform
             ╱         ╲
            ╱───────────╲
           ╱             ╲    Integration Tests (20-30%)
          ╱               ╲   - Plugin loading
         ╱─────────────────╲  - Config merging
        ╱                   ╲ - CLI + REPL interaction
       ╱─────────────────────╲
      ╱                       ╲ Unit Tests (60-75%)
     ╱─────────────────────────╲ - Core functions
    ╱___________________________╲ - Utilities
   Core Modules
```

### 2.2 Test Scope Definitions

| Level | Scope | Time | Example |
|-------|-------|------|---------|
| **Unit** | Single function/class | <10ms | `validateSfloConfig()` |
| **Integration** | Module interaction | <100ms | Plugin loading + permissions |
| **E2E** | Full CLI flow | <1000ms | Run command from start to finish |

### 2.3 Test Lifecycle

```
1. Test Discovery
   └─ Find all *.test.ts, *.spec.ts files

2. Test Preparation
   ├─ Create fixtures (test files, configs, plugins)
   ├─ Mock external services (HTTP, shell)
   └─ Initialize test database/cache directories

3. Test Execution
   ├─ Unit tests (parallel)
   ├─ Integration tests (sequential, deterministic order)
   └─ E2E tests (sequential, with real binaries)

4. Test Cleanup
   ├─ Remove fixtures
   ├─ Clear temp directories
   └─ Close open file handles

5. Reporting
   ├─ Generate coverage report
   ├─ Log failures with stack traces
   └─ Output JUnit XML (for CI/CD)
```

---

## 3. Unit Testing

### 3.1 Unit Test Scope

Unit tests verify **single functions or classes** in isolation:

- ✅ `validateSfloConfig()` - config validation
- ✅ `ConfigManager.resolve()` - config resolution
- ✅ `PermissionEnforcer.check()` - permission checks
- ✅ `TokenizeInput()` - REPL input parsing
- ✅ `mergeConfigs()` - config merging logic
- ✗ CLI routing (too complex, use integration tests)
- ✗ Plugin execution (use integration tests)

### 3.2 Unit Test Examples

```typescript
// test/unit/config.test.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import { ConfigManager, ConfigError } from '../../src/config';

describe('ConfigManager', () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = new ConfigManager();
  });

  describe('validateSfloConfig', () => {
    it('should accept valid config', () => {
      const valid = {
        version: '1',
        cli: { colorOutput: true, verbosity: 'normal' as const },
        plugins: { autoLoad: true, searchPaths: [] },
        storage: { cacheDir: '~/.sflo/cache', dataDir: '~/.sflo/data', logsDir: '~/.sflo/logs', maxCacheSize: 512 },
        security: { allowUnsignedPlugins: false, tlsVerify: true, disabledPlugins: [] },
        repl: { enabled: true, promptColor: 'cyan', historyFile: '~/.sflo/history' },
        advanced: { debugMode: false, metricsEnabled: false, asyncConcurrency: 4 },
      };

      expect(() => manager['validateSfloConfig'](valid)).not.toThrow();
    });

    it('should reject config missing version', () => {
      const invalid = { cli: {} };
      expect(() => manager['validateSfloConfig'](invalid)).toThrow(ConfigError);
    });

    it('should reject invalid verbosity enum', () => {
      const invalid = {
        version: '1',
        cli: { verbosity: 'invalid' },
      };
      expect(() => manager['validateSfloConfig'](invalid)).toThrow(ConfigError);
    });
  });

  describe('deepMerge', () => {
    it('should merge nested objects', () => {
      const a = { cli: { colorOutput: true } };
      const b = { cli: { verbosity: 'verbose' as const } };
      const result = manager['deepMerge'](a, b);

      expect(result.cli.colorOutput).toBe(true);
      expect(result.cli.verbosity).toBe('verbose');
    });

    it('should override with source values', () => {
      const a = { value: 'old' };
      const b = { value: 'new' };
      const result = manager['deepMerge'](a, b);

      expect(result.value).toBe('new');
    });

    it('should handle null/undefined correctly', () => {
      const a = { value: 'a' };
      expect(manager['deepMerge'](a, null)).toBe(null);
      expect(manager['deepMerge'](null, a)).toBe(a);
    });
  });

  describe('parseEnvValue', () => {
    it('should parse boolean values', () => {
      expect(manager['parseEnvValue']('true')).toBe(true);
      expect(manager['parseEnvValue']('false')).toBe(false);
      expect(manager['parseEnvValue']('TRUE')).toBe(true);
    });

    it('should parse numbers', () => {
      expect(manager['parseEnvValue']('42')).toBe(42);
      expect(manager['parseEnvValue']('3.14')).toBe(3.14);
    });

    it('should parse JSON arrays', () => {
      const result = manager['parseEnvValue']('["a","b","c"]');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return strings as-is', () => {
      expect(manager['parseEnvValue']('hello')).toBe('hello');
    });
  });

  describe('expandPaths', () => {
    it('should expand ~ to home directory', () => {
      const config = { storage: { cacheDir: '~/.sflo/cache' } };
      const result = manager['expandPaths'](config);
      expect(result.storage.cacheDir).toMatch(/^\//); // Should start with /
      expect(result.storage.cacheDir).toContain('.sflo/cache');
    });

    it('should replace ${VAR} with environment variable', () => {
      Bun.env.TEST_VAR = 'test-value';
      const config = { storage: { cacheDir: '${TEST_VAR}/cache' } };
      const result = manager['expandPaths'](config);
      expect(result.storage.cacheDir).toContain('test-value');
    });
  });
});
```

### 3.3 Unit Test Best Practices

```typescript
// ✅ Good: Test behavior, use descriptive names
it('should reject config with invalid verbosity value', () => {
  const invalid = { verbosity: 'extremely-verbose' };
  expect(() => validate(invalid)).toThrow(ConfigError);
});

// ❌ Bad: Tests implementation details, vague name
it('should validate', () => {
  expect(validate({ verbosity: 'bad' })).toBeFalsy();
});

// ✅ Good: Arrange, Act, Assert pattern
it('should merge configs with precedence', () => {
  // Arrange
  const base = { cli: { colorOutput: false } };
  const override = { cli: { colorOutput: true } };

  // Act
  const result = merge(base, override);

  // Assert
  expect(result.cli.colorOutput).toBe(true);
});

// ✅ Good: Use beforeEach for setup, not in test body
beforeEach(() => {
  config = getDefaultConfig();
  tempDir = createTempDir();
});

it('should load config from file', () => {
  const result = loadConfig(tempDir);
  expect(result.version).toBe('1');
});
```

---

## 4. Integration Testing

### 4.1 Integration Test Scope

Integration tests verify **multiple modules working together**:

- ✅ ConfigManager loading global + project config
- ✅ PluginSecurityManager + PluginLoader together
- ✅ CLI parser + command handler execution
- ✅ REPL tokenizer + CLI integration
- ✅ SfloContext + restricted plugins
- ✓ Plugin loading from disk
- ✓ Config validation + loading

### 4.2 Integration Test Examples

```typescript
// test/integration/plugin-loading.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PluginLoader } from '../../src/plugin-loader';
import { PluginSecurityManager } from '../../src/plugin-security';
import { createSfloContext } from '../../src/context';
import { ConfigManager } from '../../src/config';
import type { PluginManifest } from '@sflo/types';
import { mkdirSync, writeFileSync, rmSync } from 'fs';

describe('Plugin Loading Integration', () => {
  let tempDir: string;
  let loader: PluginLoader;
  let context: Awaited<ReturnType<typeof createSfloContext>>;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = `/tmp/sflo-test-${Date.now()}`;
    mkdirSync(tempDir, { recursive: true });

    // Setup context
    context = await createSfloContext();
    loader = new PluginLoader();
  });

  afterEach(() => {
    // Cleanup
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should load plugin with valid manifest and permissions', async () => {
    // Create a test plugin file
    const pluginSource = `
      export default async function setup(ctx) {
        ctx.print('Plugin loaded successfully');
      }
    `;
    const pluginPath = `${tempDir}/plugin.ts`;
    writeFileSync(pluginPath, pluginSource);

    // Create manifest
    const manifest: PluginManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      source: pluginPath,
      checksum: 'sha256:test',
      installedAt: new Date().toISOString(),
      enabled: true,
      permissions: ['ui:prompt'],
    };

    // Load plugin
    await loader.load(manifest, context);

    // Verify plugin was loaded (would check internal state)
    expect(true).toBe(true); // Plugin loaded without error
  });

  it('should reject plugin with missing required permissions', async () => {
    const pluginSource = `
      export default async function setup(ctx) {
        // Try to use fs:read without permission
        await ctx.fs.read('/etc/passwd');
      }
    `;
    const pluginPath = `${tempDir}/bad-plugin.ts`;
    writeFileSync(pluginPath, pluginSource);

    const manifest: PluginManifest = {
      id: 'bad-plugin',
      name: 'Bad Plugin',
      version: '1.0.0',
      source: pluginPath,
      checksum: 'sha256:bad',
      installedAt: new Date().toISOString(),
      enabled: true,
      permissions: [], // No permissions granted
    };

    // Plugin should fail when trying to access fs:read
    try {
      await loader.load(manifest, context);
      // If execution reaches here without error, that's a test failure
      expect(true).toBe(false);
    } catch (err) {
      expect(err.message).toContain('PERMISSION_DENIED');
    }
  });

  it('should enforce permission boundaries', async () => {
    const pluginSource = `
      export default async function setup(ctx) {
        // Plugin granted only fs:read
        // Trying to delete should fail
        if (ctx.fs && ctx.fs.delete) {
          throw new Error('Plugin should not have delete permission');
        }
      }
    `;
    const pluginPath = `${tempDir}/limited-plugin.ts`;
    writeFileSync(pluginPath, pluginSource);

    const manifest: PluginManifest = {
      id: 'limited-plugin',
      name: 'Limited Plugin',
      version: '1.0.0',
      source: pluginPath,
      checksum: 'sha256:limited',
      installedAt: new Date().toISOString(),
      enabled: true,
      permissions: ['fs:read'], // Only read
    };

    // Load and verify permissions are enforced
    await loader.load(manifest, context);
    expect(true).toBe(true);
  });
});
```

```typescript
// test/integration/config-loading.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigManager } from '../../src/config';
import { writeFileSync, mkdirSync, rmSync } from 'fs';

describe('Configuration Loading Integration', () => {
  let tempDir: string;
  let manager: ConfigManager;
  const originalEnv = { ...Bun.env };

  beforeEach(() => {
    tempDir = `/tmp/sflo-config-test-${Date.now()}`;
    mkdirSync(tempDir, { recursive: true });
    manager = new ConfigManager();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    // Restore environment
    Object.assign(Bun.env, originalEnv);
  });

  it('should merge global and project configs', async () => {
    // Create global config
    const globalDir = `${tempDir}/home/.sflo`;
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(`${globalDir}/config.json`, JSON.stringify({
      version: '1',
      cli: { verbosity: 'normal' as const },
    }));

    // Create project config
    const projectDir = `${tempDir}/project`;
    mkdirSync(`${projectDir}/.sflo`, { recursive: true });
    writeFileSync(`${projectDir}/.sflo/config.json`, JSON.stringify({
      version: '1',
      cli: { verbosity: 'verbose' as const }, // Override
    }));

    // Change working directory and HOME
    const originalCwd = process.cwd();
    Bun.env.HOME = `${tempDir}/home`;
    process.chdir(projectDir);

    try {
      const config = await manager.resolve();
      expect(config.cli.verbosity).toBe('verbose'); // Project override wins
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('should handle environment variable overrides', async () => {
    Bun.env.SFLO_CLI__VERBOSITY = 'debug';
    Bun.env.SFLO_CLI__COLOR_OUTPUT = 'false';

    const config = await manager.resolve();
    expect(config.cli.verbosity).toBe('debug');
    expect(config.cli.colorOutput).toBe(false);
  });

  it('should prefer environment over file-based config', async () => {
    // Create config file
    const globalDir = `${tempDir}/home/.sflo`;
    mkdirSync(globalDir, { recursive: true });
    writeFileSync(`${globalDir}/config.json`, JSON.stringify({
      version: '1',
      cli: { verbosity: 'normal' as const },
    }));

    Bun.env.HOME = `${tempDir}/home`;
    Bun.env.SFLO_CLI__VERBOSITY = 'debug'; // Environment wins

    const config = await manager.resolve();
    expect(config.cli.verbosity).toBe('debug');
  });
});
```

### 4.3 Integration Test Best Practices

```typescript
// ✅ Good: Use fixtures and cleanup
beforeEach(() => {
  tempDir = mkdtemp('/tmp/sflo-test-');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true });
});

// ✅ Good: Test realistic scenarios
it('should load plugin installed via registry', async () => {
  const manifest = await registry.getPlugin('plugin-github');
  await loader.load(manifest, context);
  // Verify plugin is functional
});

// ❌ Bad: Rely on external services
it('should fetch from npm registry', async () => {
  const pkg = await fetch('https://registry.npmjs.org/lodash');
  // This will fail in offline environments
});

// ✅ Good: Mock external dependencies
const mockFetch = mock.fn((url) => {
  if (url.includes('registry.sflo.io')) {
    return Promise.resolve({ status: 200, json: () => manifest });
  }
});
```

---

## 5. End-to-End Testing

### 5.1 E2E Test Scope

E2E tests verify **complete workflows** using compiled binary:

- ✅ `sflo config show` - displays loaded configuration
- ✅ `sflo plugin list` - lists installed plugins
- ✅ REPL mode - interactive command execution
- ✅ Plugin execution - full plugin lifecycle
- ✓ Cross-platform binary execution (Linux, macOS, Windows)

### 5.2 E2E Test Examples

```typescript
// test/e2e/cli.e2e.ts

import { describe, it, expect } from 'bun:test';
import { spawn } from 'bun';
import { mkdirSync, rmSync, writeFileSync } from 'fs';

describe('E2E: CLI Commands', () => {
  const tempDir = `/tmp/sflo-e2e-${Date.now()}`;
  const sfloPath = './dist/sflo'; // Compiled binary

  beforeEach(() => {
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should display version', async () => {
    const proc = spawn([sfloPath, '--version']);
    const output = await proc.text();

    expect(output).toMatch(/v\d+\.\d+\.\d+/);
    expect(proc.exitCode).toBe(0);
  });

  it('should show help', async () => {
    const proc = spawn([sfloPath, '--help']);
    const output = await proc.text();

    expect(output).toContain('Usage:');
    expect(output).toContain('Options:');
    expect(proc.exitCode).toBe(0);
  });

  it('should execute plugin command', async () => {
    // Setup: Create a test plugin
    mkdirSync(`${tempDir}/.sflo/plugins`, { recursive: true });
    writeFileSync(`${tempDir}/.sflo/plugins/test-plugin.ts`, `
      export default function setup(ctx) {
        ctx.cli.command('test-cmd', 'Test command')
          .action(async () => {
            ctx.print('Test output');
          });
      }
    `);

    // Set SFLO_HOME to temp directory
    const env = { ...process.env, HOME: tempDir };

    // Execute: Run SFLO command
    const proc = spawn([sfloPath, 'test-cmd'], { env });
    const output = await proc.text();

    // Verify: Output contains expected text
    expect(output).toContain('Test output');
    expect(proc.exitCode).toBe(0);
  });
});

// test/e2e/repl.e2e.ts

describe('E2E: REPL Mode', () => {
  it('should accept interactive commands', async () => {
    const proc = spawn([sfloPath], { stdio: 'pipe' });

    // Send commands via stdin
    await proc.stdin?.write('help\n');
    await proc.stdin?.write('config show\n');
    await proc.stdin?.write('exit\n');

    const output = await proc.text();

    expect(output).toContain('Available commands');
    expect(output).toContain('config');
  });

  it('should handle errors gracefully', async () => {
    const proc = spawn([sfloPath], { stdio: 'pipe' });

    await proc.stdin?.write('invalid-command arg1 arg2\n');
    await proc.stdin?.write('exit\n');

    const output = await proc.text();

    expect(output).toContain('Unknown command');
    expect(proc.exitCode).toBe(0); // Should exit gracefully, not crash
  });
});
```

---

## 6. Test Framework & Tooling

### 6.1 Test Framework Choice: Bun's Native Test Runner

SFLO uses **Bun's native test runner** (`bun:test`):

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// No external test framework needed
// No configuration file required
// Tests run with Bun's TypeScript compiler
```

**Why Bun's test runner:**
- ✅ Zero dependencies (built-in)
- ✅ TypeScript support (native)
- ✅ Parallel execution (fast)
- ✅ Simple API (familiar)
- ✅ Compatible with CommonJS and ESM
- ✅ Watch mode for development (`bun test --watch`)

### 6.2 Assertion Library

Use Bun's built-in `expect()`:

```typescript
// Basic assertions
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toStrictEqual(expected);
expect(value).toMatch(regex);
expect(value).toContain(item);
expect(value).toThrow();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Array/Object assertions
expect(array).toHaveLength(5);
expect(obj).toHaveProperty('key');

// Negation
expect(value).not.toBe(unexpected);
```

### 6.3 Mocking & Spies

```typescript
// Mock function
const mockFn = Bun.mock(() => 'mocked value');
expect(mockFn()).toBe('mocked value');
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenCalledTimes(1);

// Mock module
const mocks = {
  'fs': { readFile: Bun.mock((path) => Promise.resolve('content')) },
};
```

### 6.4 Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test test/unit/config.test.ts

# Run tests matching pattern
bun test --test-name-pattern="config"

# Run with watch mode
bun test --watch

# Run with coverage
bun test --coverage

# Run with verbose output
bun test --verbose
```

---

## 7. Test Organization & Conventions

### 7.1 Directory Structure

```
sflo/
├── src/
│   ├── config.ts
│   ├── plugin-loader.ts
│   ├── plugin-security.ts
│   ├── cli.ts
│   └── repl.ts
│
└── test/
    ├── unit/
    │   ├── config.test.ts
    │   ├── plugin-security.test.ts
    │   └── cli.test.ts
    │
    ├── integration/
    │   ├── config-loading.test.ts
    │   ├── plugin-loading.test.ts
    │   └── cli-execution.test.ts
    │
    ├── e2e/
    │   ├── cli.e2e.ts
    │   ├── repl.e2e.ts
    │   └── plugin-integration.e2e.ts
    │
    ├── fixtures/
    │   ├── mock-plugin.ts
    │   ├── sample-config.json
    │   └── test-helpers.ts
    │
    └── setup.ts (global test setup)
```

### 7.2 Naming Conventions

```typescript
// ✅ Good: describe what it tests
describe('ConfigManager.resolve', () => {
  it('should merge global and project configs', () => {});
  it('should apply environment variable overrides', () => {});
  it('should throw error on invalid config', () => {});
});

// ❌ Bad: vague description
describe('Tests', () => {
  it('works', () => {});
  it('test config', () => {});
});

// ✅ Good: organize by concern
describe('Config', () => {
  describe('validation', () => {
    it('should reject invalid verbosity');
  });

  describe('merging', () => {
    it('should prefer project over global');
  });
});
```

### 7.3 Test File Naming

```
src/config.ts              → test/unit/config.test.ts
src/plugin-loader.ts       → test/unit/plugin-loader.test.ts
src/plugin-security.ts     → test/unit/plugin-security.test.ts

Integration tests:
test/integration/config-loading.test.ts
test/integration/plugin-loading.test.ts
test/integration/cli-execution.test.ts

E2E tests:
test/e2e/cli.e2e.ts
test/e2e/repl.e2e.ts
test/e2e/plugin-integration.e2e.ts
```

---

## 8. Coverage Goals & Metrics

### 8.1 Coverage Targets

Minimum coverage by module:

| Module | Target | Why |
|--------|--------|-----|
| config.ts | 95% | Critical: used by all modules |
| plugin-security.ts | 90% | High risk: security-sensitive |
| plugin-loader.ts | 85% | Important: plugin system core |
| cli.ts | 75% | Less critical: mostly glue code |
| repl.ts | 70% | Integration tested more than unit |

**Overall project target: 80% line coverage, 75% branch coverage**

### 8.2 Coverage Commands

```bash
# Generate coverage report
bun test --coverage --coverage-reporter=html

# View coverage
open coverage/index.html

# Check coverage thresholds
bun run coverage:check
```

### 8.3 Coverage Configuration (`bunfig.toml`)

```toml
[test]
coverage = ["src/**/*.ts"]
coverageThreshold = { line = 80, function = 80, branch = 75, statement = 80 }
```

---

## 9. Reference Code / Boilerplate

### 9.1 Test Helper Utilities (`test/helpers.ts`)

```typescript
// test/helpers.ts

import { mkdirSync, writeFileSync, rmSync } from 'fs';
import type { PluginManifest, SfloConfig } from '@sflo/types';

/**
 * Create temporary directory with cleanup
 */
export class TempDir {
  private path: string;

  constructor() {
    this.path = `/tmp/sflo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    mkdirSync(this.path, { recursive: true });
  }

  get dir(): string {
    return this.path;
  }

  write(filename: string, content: string): string {
    const fullPath = `${this.path}/${filename}`;
    const dir = fullPath.split('/').slice(0, -1).join('/');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, content);
    return fullPath;
  }

  clean(): void {
    rmSync(this.path, { recursive: true, force: true });
  }
}

/**
 * Create mock plugin manifest
 */
export function createMockPluginManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    source: 'file:///test/plugin.ts',
    checksum: 'sha256:test',
    installedAt: new Date().toISOString(),
    enabled: true,
    permissions: [],
    ...overrides,
  };
}

/**
 * Create mock config
 */
export function createMockConfig(overrides?: Partial<SfloConfig>): SfloConfig {
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
      searchPaths: [],
    },
    storage: {
      cacheDir: '/tmp/sflo-cache',
      dataDir: '/tmp/sflo-data',
      logsDir: '/tmp/sflo-logs',
      maxCacheSize: 536870912,
    },
    security: {
      allowUnsignedPlugins: false,
      tlsVerify: true,
      disabledPlugins: [],
    },
    repl: {
      enabled: true,
      promptColor: 'cyan',
      historyFile: '/tmp/sflo-history',
    },
    advanced: {
      debugMode: false,
      metricsEnabled: false,
      asyncConcurrency: 4,
    },
    ...overrides,
  };
}

/**
 * Run command in subprocess and capture output
 */
export async function runCommand(args: string[]): Promise<CommandResult> {
  const proc = Bun.spawn(args);
  const [stdout, stderr] = await Promise.all([
    proc.stdout?.text() || '',
    proc.stderr?.text() || '',
  ]);

  return {
    exitCode: proc.exitCode || 0,
    stdout,
    stderr,
  };
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
```

### 9.2 Example Test Suite (`test/unit/config.test.ts`)

```typescript
// test/unit/config.test.ts (simplified excerpt)

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ConfigManager, ConfigError } from '../../src/config';
import { createMockConfig, TempDir } from '../helpers';

describe('ConfigManager', () => {
  let manager: ConfigManager;
  let tempDir: TempDir;

  beforeEach(() => {
    manager = new ConfigManager();
    tempDir = new TempDir();
  });

  afterEach(() => {
    tempDir.clean();
  });

  describe('resolve', () => {
    it('should return merged config from all sources', async () => {
      const config = await manager.resolve();

      expect(config).toBeDefined();
      expect(config.version).toBe('1');
      expect(config.cli).toBeDefined();
      expect(config._meta).toBeDefined();
    });

    it('should cache config for performance', async () => {
      const config1 = await manager.resolve();
      const config2 = await manager.resolve();

      // Should be same object (cached)
      expect(config1).toBe(config2);
    });

    it('should invalidate cache on demand', async () => {
      const config1 = await manager.resolve();
      manager.invalidate();
      const config2 = await manager.resolve();

      // Should be different objects after invalidation
      expect(config1).not.toBe(config2);
    });
  });

  describe('get', () => {
    it('should retrieve config value by path', async () => {
      await manager.resolve();

      const verbosity = manager.get('cli.verbosity');
      expect(verbosity).toBe('normal');
    });

    it('should return default value if path not found', async () => {
      await manager.resolve();

      const value = manager.get('nonexistent.path', 'default');
      expect(value).toBe('default');
    });
  });
});
```

---

## 10. CI/CD Integration

### 10.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run unit tests
        run: bun test test/unit

      - name: Run integration tests
        run: bun test test/integration

      - name: Generate coverage
        run: bun test --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-summary.json
          flags: unittests
          name: codecov-umbrella

      - name: Build binary
        run: bun run build

      - name: Run E2E tests
        run: bun test test/e2e
```

---

## 11. Performance Testing

### 11.1 Startup Time

```typescript
// test/performance/startup.perf.ts

import { describe, it, expect } from 'bun:test';
import { spawn } from 'bun';

describe('Performance: Startup Time', () => {
  it('should start in < 100ms', async () => {
    const start = performance.now();
    const proc = spawn(['./dist/sflo', '--version']);
    await proc.exited;
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // Must start within 100ms
  });
});
```

### 11.2 Config Loading Performance

```typescript
// test/performance/config.perf.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import { ConfigManager } from '../../src/config';

describe('Performance: Config Loading', () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = new ConfigManager();
  });

  it('should load config in < 15ms', async () => {
    const start = performance.now();
    await manager.resolve();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(15);
  });

  it('should access cached config in < 1ms', async () => {
    await manager.resolve(); // Warm cache

    const start = performance.now();
    const config = await manager.resolve();
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(1);
  });
});
```

---

## 12. Debugging Failed Tests

### 12.1 Debug Output

```bash
# Run tests with debug output
bun test --verbose

# Run single test with debugging
bun test test/unit/config.test.ts --debug

# Use Bun's debugger
bun --inspect-brk test test/unit/config.test.ts
```

### 12.2 Common Test Failures

| Issue | Cause | Solution |
|-------|-------|----------|
| Timeout | Test takes too long | Increase timeout or optimize code |
| File not found | Path is relative | Use absolute paths or __dirname |
| Permission denied | Test doesn't cleanup | Ensure afterEach cleanup |
| Flaky test | Race condition | Add waits or improve synchronization |
| Mock not called | Wrong spy setup | Verify mock is applied correctly |

### 12.3 Debugging Template

```typescript
it('should do something', async () => {
  // 1. Setup
  const config = createMockConfig();
  console.log('Input config:', config);

  // 2. Execute
  const result = await manager.resolve();
  console.log('Result:', result);

  // 3. Debug breakpoint
  debugger; // Add breakpoint here
  expect(result.cli.verbosity).toBe('normal');
});
```

---

## Summary

The Testing Strategy specification provides:

1. **Multi-tier testing pyramid** (unit, integration, E2E)
2. **Bun native test runner** with zero external dependencies
3. **Comprehensive examples** for all test types
4. **Coverage goals** (80% overall, 90% for security-critical modules)
5. **CI/CD integration** with GitHub Actions
6. **Performance benchmarks** (startup <100ms, config load <15ms)
7. **Test helpers and fixtures** (TempDir, mock creators)
8. **Debugging strategies** (verbose output, breakpoints)

All tests follow AGENTS.md constraints: zero external dependencies, Bun native APIs, 100% TypeScript Strict Mode.
