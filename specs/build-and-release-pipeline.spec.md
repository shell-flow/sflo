# Build and Release Pipeline Specification

**Document Version:** 1.0  
**Status:** Final Specification  
**Audience:** DevOps Engineers, Release Managers, CI/CD Architects  
**Last Updated:** April 2026

---

## 1. Overview

This specification defines the complete architecture for cross-platform binary compilation and automated release distribution of SFLO using GitHub Actions and GitHub Releases.

**Objectives:**
- Generate standalone, zero-dependency executables via `bun build --compile` for all major operating systems and architectures
- Automate the entire build-to-release pipeline triggered by semantic version tags
- Standardize artifact naming and packaging for integration with package managers (Homebrew, Scoop, npm)
- Minimize build time through matrix parallelization across runners
- Ensure reproducible, auditable builds with full release history

---

## 2. Compilation Strategy

### 2.1 Bun Compile Approach

The `bun build --compile` command generates standalone executables by:
1. Bundling the TypeScript source code
2. Embedding the Bun runtime (JavaScriptCore engine)
3. Creating a self-contained binary requiring zero external dependencies

**Key Advantages:**
- Native TypeScript execution at build-time (no external transpilation)
- Millisecond startup times (Bun JIT compiled bytecode)
- Single-file deployment (no `node_modules`, no package manager required)
- Full access to Bun APIs (`Bun.spawn()`, `Bun.file()`, etc.)

**Binary Sizes (Estimated):**
| Target | Size | Notes |
|--------|------|-------|
| Linux x64 | 45–55 MB | Modern CPUs (Haswell+) |
| Linux x64 (baseline) | 48–58 MB | Older CPUs (Nehalem+) |
| Linux ARM64 | 48–58 MB | Graviton, Raspberry Pi |
| Windows x64 | 48–58 MB | Windows 10+ |
| macOS x64 | 48–58 MB | Intel Macs |
| macOS ARM64 | 48–58 MB | Apple Silicon |

### 2.2 Target Matrix

The pipeline generates binaries for **6 primary targets**:

| OS | Arch | Bun Target | Release Suffix | Runner |
|---|---|---|---|---|
| Linux | x64 | `bun-linux-x64` | `linux-x64` | `ubuntu-latest` |
| Linux | ARM64 | `bun-linux-arm64` | `linux-arm64` | `ubuntu-latest` (cross-compile) |
| Windows | x64 | `bun-windows-x64` | `windows-x64` | `windows-latest` |
| macOS | x64 | `bun-darwin-x64` | `macos-x64` | `macos-12` |
| macOS | ARM64 | `bun-darwin-arm64` | `macos-arm64` | `macos-latest-xlarge` (arm64) |

**Rationale:**
- **Linux:** x64 for servers, ARM64 for IoT and cloud instances (Graviton)
- **Windows:** x64 only (ARM64 Windows is rare)
- **macOS:** x64 for Intel, ARM64 for Apple Silicon

### 2.3 Build-Time Optimization

**Compile Flags Used:**

```bash
bun build --compile \
  --minify \                          # Reduce binary size
  --sourcemap=linked \               # Embedded sourcemap for debugging
  --bytecode \                       # Pre-compile JavaScript bytecode
  --target=bun-<os>-<arch> \         # Cross-compilation target
  --define VERSION='"x.y.z"' \       # Version injection
  ./src/index.ts \                   # Entry point
  --outfile=./sflo[.exe]             # Output binary
```

**Flags Explained:**
- `--minify` - Reduces transpiled code size by 15–25%
- `--sourcemap=linked` - Embeds zstd-compressed sourcemap for stack traces
- `--bytecode` - JavaScriptCore bytecode precompilation (~2x startup improvement)
- `--define` - Injects build-time constants (version, timestamp) into binary

---

## 3. Versioning & Naming Convention

### 3.1 Version Format

SFLO follows **Semantic Versioning 2.0.0**:

**Format:** `v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>][+<BUILD>]`

**Examples:**
```
v1.0.0           # Stable release
v1.0.0-beta.1    # Beta prerelease
v1.0.0-rc.1      # Release candidate
v1.0.0+20260406  # Build metadata (not used in releases)
```

**Trigger:** Git tags matching pattern `v*` (e.g., `v1.0.0`, `v2.1.3-rc.1`)

### 3.2 Artifact Naming Convention

**Standard Pattern:**
```
sflo-<VERSION>-<OS>-<ARCH>.<EXT>
```

**Complete Examples:**

| OS | Architecture | Compressed Artifact | Contains |
|---|---|---|---|
| Linux | x64 | `sflo-v1.0.0-linux-x64.tar.gz` | Binary + LICENSE + README |
| Linux | ARM64 | `sflo-v1.0.0-linux-arm64.tar.gz` | Binary + LICENSE + README |
| Windows | x64 | `sflo-v1.0.0-windows-x64.zip` | sflo.exe + LICENSE + README |
| macOS | x64 | `sflo-v1.0.0-macos-x64.tar.gz` | Binary + LICENSE + README |
| macOS | ARM64 | `sflo-v1.0.0-macos-arm64.tar.gz` | Binary + LICENSE + README |

### 3.3 Compression Strategy

**Unix-like (Linux, macOS):**
- Format: `.tar.gz` (gzip compression)
- Contents:
  ```
  sflo-v1.0.0-linux-x64/
  ├── sflo                 (executable, 755 permissions)
  ├── LICENSE             (MIT license text)
  └── README.md           (release notes reference)
  ```
- Compression: `tar --owner=0 --group=0 -czf archive.tar.gz sflo LICENSE README.md`

**Windows:**
- Format: `.zip` (standard zip)
- Contents:
  ```
  sflo-v1.0.0-windows-x64/
  ├── sflo.exe            (executable)
  ├── LICENSE             (MIT license text)
  └── README.md           (release notes reference)
  ```
- Compression: `Compress-Archive -Path sflo.exe,LICENSE,README.md -DestinationPath archive.zip`

### 3.4 Checksum Generation

For every artifact, generate SHA256 checksums:

**File:** `sflo-v1.0.0.sha256`
```
abc123def456...  sflo-v1.0.0-linux-x64.tar.gz
fed789cba012...  sflo-v1.0.0-linux-arm64.tar.gz
...
```

**Generation:**
```bash
sha256sum sflo-v*.tar.gz sflo-v*.zip > sflo-v1.0.0.sha256
```

---

## 4. GitHub Actions Workflow Architecture

### 4.1 Workflow Trigger

**Event:** `push` with tag filter

```yaml
on:
  push:
    tags:
      - 'v*'                 # Matches: v1.0.0, v1.0.0-rc.1, etc.
```

**Execution:** Triggered automatically when a tag matching `v*` is pushed to any branch.

### 4.2 Runner Selection

**Matrix Strategy** ensures parallel compilation across platforms:

| Target | Runner | Notes |
|--------|--------|-------|
| Linux x64 | `ubuntu-latest` | Native compilation |
| Linux ARM64 | `ubuntu-latest` | Cross-compile (via bun-linux-arm64 target) |
| Windows x64 | `windows-latest` | Native compilation |
| macOS x64 | `macos-12` | Intel runner, native compilation |
| macOS ARM64 | `macos-latest-xlarge` | Apple Silicon runner, native compilation |

**Execution Timeline:**
- All 5 jobs start in parallel
- Typical duration: 5–8 minutes per job
- Total pipeline time: ~8 minutes (parallel execution)

### 4.3 Workflow Steps

**Stage 1: Setup (30 seconds)**
```
✓ Checkout repository
✓ Install Bun runtime
✓ Extract version from tag
✓ Setup build environment
```

**Stage 2: Compile (2–3 minutes per job)**
```
✓ Run bun build --compile
✓ Validate binary exists
✓ Test binary (quick sanity check)
✓ Compress artifact
✓ Generate checksum
```

**Stage 3: Upload (1 minute)**
```
✓ Upload artifact to GitHub release
✓ Log artifact details
```

**Stage 4: Finalize (1 minute)**
```
✓ Combine checksums
✓ Publish release
✓ Mark as latest (if not prerelease)
```

### 4.4 Matrix Configuration

```yaml
strategy:
  matrix:
    include:
      - os: ubuntu-latest
        target: bun-linux-x64
        arch: linux-x64
        artifact_ext: tar.gz
        
      - os: ubuntu-latest
        target: bun-linux-arm64
        arch: linux-arm64
        artifact_ext: tar.gz
        
      - os: windows-latest
        target: bun-windows-x64
        arch: windows-x64
        artifact_ext: zip
        
      - os: macos-12
        target: bun-darwin-x64
        arch: macos-x64
        artifact_ext: tar.gz
        
      - os: macos-latest-xlarge
        target: bun-darwin-arm64
        arch: macos-arm64
        artifact_ext: tar.gz

  fail-fast: false  # Continue even if one job fails
```

---

## 5. GitHub Releases Integration

### 5.1 Release Creation Strategy

**Flow:**
1. Workflow creates a **draft release** with tag and version
2. All binaries uploaded as release assets
3. Release body auto-populated with changelog references
4. Release published as **pre-release** (if tag contains `-`)
5. Release published as **latest** (if tag is stable semver)

### 5.2 Release Metadata

**Release Title:** `Release v1.0.0` (auto-generated from tag)

**Release Body Template:**

```markdown
## Changes in v1.0.0

### Features
- [Link to issues/PRs by semantic commit analysis]

### Bug Fixes
- [Link to bug fixes]

### Breaking Changes
- [If any]

## Installation

### Linux / macOS
\`\`\`bash
curl -fsSL https://github.com/brennon/shell-flow/releases/download/v1.0.0/sflo-v1.0.0-linux-x64.tar.gz | tar xz
sudo mv sflo /usr/local/bin/
\`\`\`

### Windows (Scoop)
\`\`\`powershell
scoop bucket add sflo https://github.com/brennon/scoop-sflo
scoop install sflo
\`\`\`

### npm
\`\`\`bash
npm install -g sflo
\`\`\`

## Checksums
[Auto-inserted SHA256 checksums]

## Artifacts
| Platform | Architecture | Download |
|----------|--------------|----------|
| Linux | x64 | sflo-v1.0.0-linux-x64.tar.gz |
| Linux | ARM64 | sflo-v1.0.0-linux-arm64.tar.gz |
| Windows | x64 | sflo-v1.0.0-windows-x64.zip |
| macOS | Intel | sflo-v1.0.0-macos-x64.tar.gz |
| macOS | Apple Silicon | sflo-v1.0.0-macos-arm64.tar.gz |
```

### 5.3 Upload Action

Uses: `softprops/action-gh-release` (v1.x)

**Configuration:**
```yaml
- name: Publish Release
  uses: softprops/action-gh-release@v1
  with:
    files: |
      ./builds/sflo-*
      ./builds/sflo-*.sha256
    draft: false
    prerelease: ${{ contains(github.ref, '-') }}  # True if tag has pre-release suffix
    generate_release_notes: true
```

**Features:**
- Automatically detects all files matching glob patterns
- Generates release notes from commits since last release
- Sets `prerelease` flag if tag contains hyphen (e.g., `-rc.1`)
- Publishes immediately (no manual approval needed)

---

## 6. Reference Code / Boilerplate

### 6.1 Complete GitHub Actions Workflow

**File:** `.github/workflows/release.yml`

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  ARTIFACT_DIR: ./dist

jobs:
  build:
    name: Build ${{ matrix.arch }}
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        include:
          # Linux x64
          - os: ubuntu-latest
            target: bun-linux-x64
            arch: linux-x64
            artifact_ext: tar.gz
            compress_cmd: |
              mkdir -p sflo-${{ needs.setup.outputs.version }}-linux-x64
              cp sflo LICENSE README.md sflo-${{ needs.setup.outputs.version }}-linux-x64/
              tar --owner=0 --group=0 -czf sflo-${{ needs.setup.outputs.version }}-linux-x64.tar.gz sflo-${{ needs.setup.outputs.version }}-linux-x64/

          # Linux ARM64
          - os: ubuntu-latest
            target: bun-linux-arm64
            arch: linux-arm64
            artifact_ext: tar.gz
            compress_cmd: |
              mkdir -p sflo-${{ needs.setup.outputs.version }}-linux-arm64
              cp sflo LICENSE README.md sflo-${{ needs.setup.outputs.version }}-linux-arm64/
              tar --owner=0 --group=0 -czf sflo-${{ needs.setup.outputs.version }}-linux-arm64.tar.gz sflo-${{ needs.setup.outputs.version }}-linux-arm64/

          # Windows x64
          - os: windows-latest
            target: bun-windows-x64
            arch: windows-x64
            artifact_ext: zip
            compress_cmd: |
              mkdir sflo-${{ needs.setup.outputs.version }}-windows-x64
              copy sflo.exe LICENSE README.md sflo-${{ needs.setup.outputs.version }}-windows-x64\
              powershell Compress-Archive -Path sflo-${{ needs.setup.outputs.version }}-windows-x64 -DestinationPath sflo-${{ needs.setup.outputs.version }}-windows-x64.zip

          # macOS Intel x64
          - os: macos-12
            target: bun-darwin-x64
            arch: macos-x64
            artifact_ext: tar.gz
            compress_cmd: |
              mkdir -p sflo-${{ needs.setup.outputs.version }}-macos-x64
              cp sflo LICENSE README.md sflo-${{ needs.setup.outputs.version }}-macos-x64/
              tar --owner=0 --group=0 -czf sflo-${{ needs.setup.outputs.version }}-macos-x64.tar.gz sflo-${{ needs.setup.outputs.version }}-macos-x64/

          # macOS Apple Silicon ARM64
          - os: macos-latest-xlarge
            target: bun-darwin-arm64
            arch: macos-arm64
            artifact_ext: tar.gz
            compress_cmd: |
              mkdir -p sflo-${{ needs.setup.outputs.version }}-macos-arm64
              cp sflo LICENSE README.md sflo-${{ needs.setup.outputs.version }}-macos-arm64/
              tar --owner=0 --group=0 -czf sflo-${{ needs.setup.outputs.version }}-macos-arm64.tar.gz sflo-${{ needs.setup.outputs.version }}-macos-arm64/

      fail-fast: false

    needs: setup

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build binary for ${{ matrix.arch }}
        run: |
          bun build --compile \
            --minify \
            --sourcemap=linked \
            --bytecode \
            --target=${{ matrix.target }} \
            --define VERSION='"${{ needs.setup.outputs.version }}"' \
            ./src/index.ts \
            --outfile=./sflo${{ matrix.os == 'windows-latest' && '.exe' || '' }}

      - name: Verify binary
        run: |
          if [ ! -f ./sflo${{ matrix.os == 'windows-latest' && '.exe' || '' }} ]; then
            echo "Binary not created!"
            exit 1
          fi
          ls -lh ./sflo${{ matrix.os == 'windows-latest' && '.exe' || '' }}

      - name: Run smoke test
        run: |
          if [ "${{ matrix.os }}" = "windows-latest" ]; then
            ./sflo.exe --version
          else
            chmod +x ./sflo
            ./sflo --version
          fi

      - name: Compress artifact
        shell: bash
        run: |
          mkdir -p ${{ env.ARTIFACT_DIR }}
          if [ "${{ matrix.os }}" = "windows-latest" ]; then
            mkdir sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}
            cp sflo.exe LICENSE README.md sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}/
            powershell -Command "Compress-Archive -Path sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }} -DestinationPath ${{ env.ARTIFACT_DIR }}/sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.zip"
          else
            mkdir -p sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}
            cp sflo LICENSE README.md sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}/
            tar --owner=0 --group=0 -czf ${{ env.ARTIFACT_DIR }}/sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.tar.gz sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}/
          fi

      - name: Generate checksum
        run: |
          if [ "${{ matrix.os }}" = "windows-latest" ]; then
            powershell -Command "(Get-FileHash -Path '${{ env.ARTIFACT_DIR }}/sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.zip' -Algorithm SHA256).Hash + '  sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.zip' | Out-File -FilePath ${{ env.ARTIFACT_DIR }}/sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.sha256 -Encoding utf8"
          else
            cd ${{ env.ARTIFACT_DIR }} && sha256sum sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.tar.gz > sflo-${{ needs.setup.outputs.version }}-${{ matrix.arch }}.sha256
          fi

      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: sflo-${{ matrix.arch }}
          path: ${{ env.ARTIFACT_DIR }}/

  setup:
    name: Setup
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - name: Extract version from tag
        id: version
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

  release:
    name: Create Release
    runs-on: ubuntu-latest
    needs: [setup, build]
    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v3
        with:
          path: ./artifacts

      - name: Combine artifacts
        run: |
          mkdir -p ./release-assets
          find ./artifacts -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.sha256" \) -exec cp {} ./release-assets/ \;

      - name: Generate release notes
        id: notes
        run: |
          cat > /tmp/release_notes.md << 'EOF'
          ## Installation

          ### Linux / macOS
          \`\`\`bash
          curl -fsSL https://github.com/${{ github.repository }}/releases/download/${{ needs.setup.outputs.version }}/sflo-${{ needs.setup.outputs.version }}-linux-x64.tar.gz | tar xz
          sudo mv sflo /usr/local/bin/
          \`\`\`

          ### Windows (Scoop)
          \`\`\`powershell
          scoop bucket add sflo https://github.com/brennon/scoop-sflo
          scoop install sflo
          \`\`\`

          ### npm
          \`\`\`bash
          npm install -g sflo
          \`\`\`

          ## Artifacts & Checksums
          EOF

          echo "" >> /tmp/release_notes.md
          echo "Checksums:" >> /tmp/release_notes.md
          echo '```' >> /tmp/release_notes.md
          cat ./release-assets/*.sha256 >> /tmp/release_notes.md || true
          echo '```' >> /tmp/release_notes.md
          cat /tmp/release_notes.md

      - name: Publish Release
        uses: softprops/action-gh-release@v1
        with:
          files: ./release-assets/*
          draft: false
          prerelease: ${{ contains(needs.setup.outputs.version, '-') }}
          body_path: /tmp/release_notes.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Notify release
        run: |
          echo "✅ Release published: ${{ needs.setup.outputs.version }}"
          echo "📦 Artifacts: ${{ github.repository }}/releases/tag/${{ needs.setup.outputs.version }}"
```

### 6.2 Build Script for Local Testing

**File:** `scripts/build.ts`

```typescript
import { $, file } from "bun";

const VERSION = process.env.VERSION || "dev";
const targets = [
  { name: "linux-x64", target: "bun-linux-x64" },
  { name: "linux-arm64", target: "bun-linux-arm64" },
  { name: "windows-x64", target: "bun-windows-x64" },
  { name: "macos-x64", target: "bun-darwin-x64" },
  { name: "macos-arm64", target: "bun-darwin-arm64" },
];

async function build() {
  console.log(`🔨 Building SFLO v${VERSION}\n`);

  for (const { name, target } of targets) {
    console.log(`📦 Compiling for ${name}...`);

    const outfile = name.includes("windows") ? `sflo-${name}.exe` : `sflo-${name}`;

    try {
      await $`bun build --compile \
        --minify \
        --sourcemap=linked \
        --bytecode \
        --target=${target} \
        --define VERSION='"${VERSION}"' \
        ./src/index.ts \
        --outfile=./${outfile}`;

      const stats = await file(outfile).stat();
      console.log(`  ✅ ${outfile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)\n`);
    } catch (error) {
      console.error(`  ❌ Failed to compile for ${name}:`, error);
      process.exit(1);
    }
  }

  console.log("✨ Build complete!");
}

build();
```

**Usage:**
```bash
VERSION=1.0.0 bun scripts/build.ts
```

### 6.3 Release Preparation Script

**File:** `scripts/release.ts`

```typescript
import { $, file } from "bun";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";

async function hashFile(filePath: string): Promise<string> {
  const content = await file(filePath).arrayBuffer();
  return createHash("sha256").update(Buffer.from(content)).digest("hex");
}

async function prepare() {
  const version = process.argv[2];

  if (!version || !/^v\d+\.\d+\.\d+/.test(version)) {
    console.error(
      "Usage: bun scripts/release.ts <version> (e.g., v1.0.0, v1.0.0-rc.1)"
    );
    process.exit(1);
  }

  console.log(`📋 Preparing release: ${version}\n`);

  // Create dist directory
  await fs.mkdir("./dist", { recursive: true });

  // Generate checksums
  const artifacts = await fs.readdir("./dist");
  let checksums = "";

  for (const artifact of artifacts) {
    if (artifact.endsWith(".tar.gz") || artifact.endsWith(".zip")) {
      const hash = await hashFile(join("./dist", artifact));
      checksums += `${hash}  ${artifact}\n`;
    }
  }

  if (checksums) {
    await fs.writeFile(`./dist/${version}.sha256`, checksums);
    console.log(`✅ Checksums written to ${version}.sha256\n`);
  }

  console.log("📦 Release assets ready in ./dist/");
  console.log(`\n📍 Next step: git tag ${version} && git push origin ${version}`);
}

prepare();
```

**Usage:**
```bash
bun scripts/release.ts v1.0.0
```

---

## 7. Performance & Optimization

### 7.1 Build Time Breakdown

| Stage | Time | Notes |
|-------|------|-------|
| Checkout | 10s | Git clone + checkout |
| Bun install | 15s | Dependency cache hit |
| Compilation | 90–120s | Bun JIT + bundling |
| Compression | 10s | tar/zip with gzip |
| Checksum | 5s | SHA256 calculation |
| Upload | 20s | To GitHub releases |
| **Total** | **~8 min** | Per job (parallel) |

### 7.2 Cache Strategy

**Bun Cache:**
```yaml
- uses: actions/cache@v3
  with:
    path: ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
```

**Expected Savings:** 30–50% reduction in `bun install` time on cache hit

### 7.3 Parallel Execution

All 5 platform builds run **simultaneously**:
- Linux x64: 8 min
- Linux ARM64: 8 min (parallel)
- Windows x64: 8 min (parallel)
- macOS x64: 8 min (parallel)
- macOS ARM64: 8 min (parallel)

**Total Wall-Clock Time:** ~8–10 minutes (not 40 minutes if sequential)

---

## 8. Error Handling & Resilience

### 8.1 Build Failure Handling

**Strategy:** `fail-fast: false`

If one platform build fails:
- Other platform builds continue
- Release job waits for all to complete
- Failed jobs marked in workflow summary
- Can retry individual failed jobs

### 8.2 Validation Checks

Each job includes:
1. **Binary existence check** - Ensures compiler produced output
2. **Smoke test** - Runs `sflo --version` (validates runtime)
3. **Artifact validation** - Verifies compression succeeded

**Failure cascade:**
```
Build failed → Smoke test skipped → Release skipped
```

### 8.3 Rollback Strategy

**If release has issues:**
1. Delete release tag: `git tag -d v1.0.0 && git push origin :refs/tags/v1.0.0`
2. Workflow will not re-trigger (tag deleted)
3. Fix code and push new tag: `git tag v1.0.0-hotfix && git push origin v1.0.0-hotfix`

---

## 9. Package Manager Integration

### 9.1 Artifact Mapping

Once CI/CD publishes binaries, package managers consume them:

**Homebrew Formula** (`brennon/sflo/sflo.rb`):
```ruby
class Sflo < Formula
  desc "Shell-Flow: High-performance terminal assistant"
  homepage "https://github.com/brennon/shell-flow"
  license "MIT"

  on_linux do
    on_intel do
      url "https://github.com/brennon/shell-flow/releases/download/v#{version}/sflo-v#{version}-linux-x64.tar.gz"
      sha256 "abc123def456..." # From CI/CD release
    end
    on_arm do
      url "https://github.com/brennon/shell-flow/releases/download/v#{version}/sflo-v#{version}-linux-arm64.tar.gz"
      sha256 "fed789cba012..." # From CI/CD release
    end
  end

  on_macos do
    on_intel do
      url "https://github.com/brennon/shell-flow/releases/download/v#{version}/sflo-v#{version}-macos-x64.tar.gz"
      sha256 "..."
    end
    on_arm do
      url "https://github.com/brennon/shell-flow/releases/download/v#{version}/sflo-v#{version}-macos-arm64.tar.gz"
      sha256 "..."
    end
  end

  def install
    bin.install "sflo"
    chmod 0o755, bin/"sflo"
  end

  test do
    assert_match /SFLO v/, shell_output("#{bin}/sflo --version")
  end
end
```

**Scoop Manifest** (`bucket/sflo.json`):
```json
{
  "version": "1.0.0",
  "homepage": "https://github.com/brennon/shell-flow",
  "license": "MIT",
  "architecture": {
    "64bit": {
      "url": "https://github.com/brennon/shell-flow/releases/download/v1.0.0/sflo-v1.0.0-windows-x64.zip",
      "hash": "sha256:abc123def456..."
    }
  },
  "bin": "sflo.exe",
  "checkver": "github",
  "autoupdate": {
    "url": "https://github.com/brennon/shell-flow/releases/download/v$version/sflo-v$version-windows-x64.zip",
    "hash": {
      "url": "$url.sha256"
    }
  }
}
```

**npm Package** (`packages/@sflo/cli/package.json`):
```json
{
  "name": "sflo",
  "version": "1.0.0",
  "optionalDependencies": {
    "@sflo/linux-x64": "1.0.0",
    "@sflo/linux-arm64": "1.0.0",
    "@sflo/windows-x64": "1.0.0",
    "@sflo/macos-x64": "1.0.0",
    "@sflo/macos-arm64": "1.0.0"
  }
}
```

---

## 10. Security & Signing

### 10.1 Artifact Verification

Users can verify downloads:

```bash
# Download binary and checksum
curl -O https://github.com/brennon/shell-flow/releases/download/v1.0.0/sflo-v1.0.0-linux-x64.tar.gz
curl -O https://github.com/brennon/shell-flow/releases/download/v1.0.0/sflo-v1.0.0.sha256

# Verify
sha256sum -c sflo-v1.0.0.sha256
```

### 10.2 Code Signing (Future)

**macOS Codesigning** (optional, future enhancement):
```bash
codesign --deep --force -vvvv --sign "XXXXXXXXXX" --entitlements entitlements.plist ./sflo
```

---

## 11. Troubleshooting

### 11.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Illegal instruction" | CPU incompatible with modern flags | Use baseline target (`-baseline` suffix) |
| Large binary (>100MB) | Minification disabled | Verify `--minify` flag in build command |
| Cross-compile fails | Wrong Bun version | Update to latest Bun: `bun upgrade` |
| Checksum mismatch | File corrupted in transit | Re-download from GitHub releases |

---

## 12. Maintenance & Updates

### 12.1 Release Cadence

- **Patch (x.y.Z):** Bug fixes, security updates (as-needed)
- **Minor (x.Y.0):** New features (monthly)
- **Major (X.0.0):** Breaking changes (quarterly)

### 12.2 Dependency Updates

Bun updates handled via:
```bash
bun upgrade
```

Pinned in CI: `uses: oven-sh/setup-bun@v1` (always latest stable)

---

**End of Specification**

---

### Document Metadata

| Attribute | Value |
|-----------|-------|
| Version | 1.0 |
| Author | SFLO DevOps Team |
| Last Reviewed | April 2026 |
| Status | Final |
| Audience | DevOps, Release Managers |
