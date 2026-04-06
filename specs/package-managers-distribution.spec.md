# SFLO Package Managers Distribution Specification

## Table of Contents

1. [Overview](#overview)
2. [Windows Ecosystem](#windows-ecosystem)
3. [macOS & Linux (Homebrew)](#macos--linux-homebrew)
4. [Linux Ecosystem (Native & Universal)](#linux-ecosystem-native--universal)
5. [NPM Distribution (Native Binaries Approach)](#npm-distribution-native-binaries-approach)
6. [Universal Fallback](#universal-fallback)
7. [Reference Code / Boilerplate](#reference-code--boilerplate)
8. [Automation & GitHub Actions](#automation--github-actions)
9. [Versioning & Update Strategy](#versioning--update-strategy)
10. [Package Manager Comparison Matrix](#package-manager-comparison-matrix)
11. [Rollback & Hotfix Procedures](#rollback--hotfix-procedures)
12. [Metrics & Adoption Tracking](#metrics--adoption-tracking)

---

## 1. Overview

SFLO distribution strategy establishes **GitHub Releases as the single source of truth** for all package manager distributions. All installers, manifests, and package definitions pull artifacts directly from GitHub Releases using semantic versioning tags (e.g., `v1.2.3`).

### 1.1 Distribution Architecture

```
GitHub Releases (Source of Truth)
├─ sflo-v1.2.3-linux-x64.tar.gz
├─ sflo-v1.2.3-linux-arm64.tar.gz
├─ sflo-v1.2.3-macos-x64.zip
├─ sflo-v1.2.3-macos-arm64.zip
├─ sflo-v1.2.3-windows-x64.zip
└─ Release notes + checksums.txt

        ↓ (Artifacts pulled from)

├─ NPM (@sflo/cli root, @sflo/linux-x64, etc.)
├─ Scoop (sflo.json → bucket)
├─ Homebrew (sflo.rb → homebrew-sflo tap)
├─ APT/DNF (.deb, .rpm generated via fpm)
├─ AUR (PKGBUILD maintained)
├─ Flatpak/Snap (manifests)
└─ Universal installer (install.sh)
```

### 1.2 Version Numbering

All distributions use **semantic versioning** aligned with GitHub Release tags:

```
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>][+<BUILD>]

Examples:
v1.0.0          (stable release)
v1.2.3          (patch update)
v2.0.0-beta.1   (beta prerelease)
v1.0.0-rc.1     (release candidate)
```

Every GitHub Release is tagged with this format. Package managers consume this tag to generate checksums, URLs, and version metadata.

---

## 2. Windows Ecosystem

### 2.1 Scoop Distribution

**Scoop** is a command-line installer for Windows that relies on JSON manifests. SFLO maintains a dedicated Scoop bucket.

#### 2.1.1 Bucket Structure

```
github.com/sflo-cli/scoop-sflo (private or public bucket)
├── bucket/
│   ├── sflo.json              (main manifest)
│   ├── sflo-beta.json         (optional: prerelease)
│   └── ...
├── .github/
│   └── workflows/
│       └── ci.yml             (optional: bucket validation)
├── README.md
└── LICENSE
```

#### 2.1.2 Manifest URL Pattern

Scoop requires manifests to be served over HTTPS:

```
https://raw.githubusercontent.com/sflo-cli/scoop-sflo/main/bucket/sflo.json
```

Users install via:
```powershell
scoop bucket add sflo https://github.com/sflo-cli/scoop-sflo.git
scoop install sflo
```

#### 2.1.3 Manifest Structure

The `sflo.json` manifest contains:
- Version number
- Download URL (GitHub Release)
- File hash (SHA256)
- Installation instructions
- Architecture-specific URLs

### 2.2 Winget Distribution

**Winget** (Windows Package Manager) is Microsoft's official package manager for Windows. SFLO manifests are submitted to `microsoft/winget-pkgs`.

#### 2.2.1 Manifest Submission

Winget requires manifests in YAML format, submitted to `https://github.com/microsoft/winget-pkgs/tree/master/manifests`.

#### 2.2.2 Manifest Path Convention

```
manifests/
└── s/
    └── sflo/
        └── cli/
            └── 1.2.3/
                ├── sflo.cli.installer.yaml
                ├── sflo.cli.locale.en-US.yaml
                └── sflo.cli.yaml
```

#### 2.2.3 Manifest Content

Manifests declare:
- Package identifier (`sflo.cli`)
- Version (`1.2.3`)
- Download URLs (one per architecture)
- SHA256 checksums
- Installer type (`zip`, `exe`, `msi`)
- Installation scope (`user`, `machine`)

---

## 3. macOS & Linux (Homebrew)

### 3.1 Homebrew Tap Structure

SFLO maintains a custom Homebrew Tap (third-party formula repository) at:

```
github.com/sflo-cli/homebrew-sflo
```

#### 3.1.1 Tap Directory Layout

```
github.com/sflo-cli/homebrew-sflo
├── Formula/
│   └── sflo.rb              (main formula)
├── Casks/
│   └── sflo.rb              (macOS cask variant, optional)
├── .github/
│   └── workflows/
│       └── tests.yml        (formula syntax validation)
├── README.md
└── LICENSE
```

#### 3.1.2 Installation

Users add the tap and install via:

```bash
brew tap sflo-cli/sflo
brew install sflo
```

Or install directly:

```bash
brew install sflo-cli/sflo/sflo
```

#### 3.1.3 Formula File (`sflo.rb`)

The formula is a Ruby DSL that:
1. Defines the package name, version, and homepage
2. Specifies download URLs for each architecture (Intel, Apple Silicon)
3. Declares SHA256 checksums
4. Defines installation steps
5. Lists dependencies (if any)

---

## 4. Linux Ecosystem (Native & Universal)

### 4.1 APT/DNF Distribution Strategy

**APT** (Debian/Ubuntu) and **DNF** (Fedora/RHEL) require `.deb` and `.rpm` packages.

#### 4.1.1 Package Generation via FPM

SFLO uses **FPM (Effing Package Manager)** to generate native Linux packages from compiled binaries:

```bash
# Generate .deb package
fpm -s dir -t deb \
  -n sflo \
  -v 1.2.3 \
  -p sflo_1.2.3_amd64.deb \
  -a amd64 \
  --maintainer "SFLO Team <info@sflo.io>" \
  --description "High-performance terminal assistant CLI" \
  --url "https://github.com/sflo-cli/sflo" \
  --license MIT \
  /path/to/sflo=/usr/local/bin/sflo

# Generate .rpm package
fpm -s dir -t rpm \
  -n sflo \
  -v 1.2.3 \
  -p sflo-1.2.3-1.x86_64.rpm \
  -a x86_64 \
  --maintainer "SFLO Team <info@sflo.io>" \
  /path/to/sflo=/usr/local/bin/sflo
```

#### 4.1.2 Repository Hosting

Generated packages are hosted in **GitHub Releases** and optionally in self-hosted APT/DNF repositories.

**Simple approach:** Serve `.deb` and `.rpm` files directly from GitHub Releases.

**Advanced approach:** Maintain an APT/DNF repository with:
- Signed metadata (`Release`, `InRelease` files)
- GPG key for package authentication
- Package index files (`Packages`, `Packages.gz`)

#### 4.1.3 APT Repository Setup

Host an APT repository at a custom domain or GitHub Pages:

```bash
# Add repository to user's system
echo "deb https://apt.sflo.io/debian stable main" | \
  sudo tee /etc/apt/sources.list.d/sflo.list

# Import GPG key
wget -qO - https://apt.sflo.io/gpg.key | sudo apt-key add -

# Install
sudo apt update
sudo apt install sflo
```

#### 4.1.4 Repository Maintenance

Maintain repository metadata using tools like:
- **Reprepro** (Debian repository tool)
- **Aptly** (APT package repository manager)
- **GitHub Releases** (simplest: direct downloads)

### 4.2 Pacman & AUR Distribution

**AUR** (Arch User Repository) is the community-driven repository for Arch Linux and derivatives.

#### 4.2.1 PKGBUILD Maintenance

AUR packages are defined by a `PKGBUILD` file submitted to the AUR.

```
aur.archlinux.org/sflo.git
```

Users install via:

```bash
git clone https://aur.archlinux.org/sflo.git
cd sflo
makepkg -si
```

#### 4.2.2 AUR Automation

AUR requires manual updates (no automated sync). SFLO maintainer:
1. Updates `PKGBUILD` when new version released
2. Updates checksums (regenerate from GitHub Release)
3. Pushes to AUR SSH repository
4. Validates with `makepkg`

Typically done via GitHub Actions + SSH key stored in repository secrets.

### 4.3 Flatpak & Snap

#### 4.3.1 Flatpak Viability

**Pros:**
- Sandboxed execution (security)
- Single package format (all Linux distros)
- Auto-updates support

**Cons:**
- CLI tools don't benefit much from sandboxing
- Overhead compared to native packages
- Requires approval from Flatseal for file access

**Verdict:** Optional, lower priority. Implement if users request it.

#### 4.3.2 Snap Viability

**Pros:**
- Official support from Canonical
- Auto-updates built-in

**Cons:**
- Slower startup (snapd overhead)
- Not as widely adopted in server environments
- Storage overhead (self-contained)

**Verdict:** Optional. Implement for Ubuntu users if needed.

#### 4.3.3 Implementation Path

If implemented, both would:
1. Use `snapcraft.yaml` or `flatpak.yaml` manifest
2. Download binary from GitHub Release
3. Define sandbox/confinement permissions
4. Submit to Snap Store or Flatseal

---

## 5. NPM Distribution (Native Binaries Approach)

### 5.1 NPM Architecture

SFLO distributes compiled binaries through NPM without requiring Node.js at runtime.

#### 5.1.1 Package Structure

```
@sflo/cli (root package, 10KB)
├── dependencies:
│   └── "@sflo/[os]-[arch]": "1.2.3"
│
@sflo/linux-x64 (2.5MB per platform)
@sflo/linux-arm64
@sflo/macos-x64
@sflo/macos-arm64
@sflo/windows-x64
```

#### 5.1.2 Installation Flow

1. User: `npm install -g @sflo/cli`
2. NPM evaluates `package.json` dependencies
3. NPM detects user's platform via `process.platform` and `process.arch`
4. NPM installs only the matching `@sflo/[os]-[arch]` package
5. Post-install script symlinks binary to `bin/sflo`
6. Binary available globally without Node.js

#### 5.1.3 Binary Extraction

Each platform package contains:
- Precompiled binary (e.g., `sflo`)
- Post-install script to set permissions
- README with version info

```
@sflo/linux-x64/
├── package.json
├── bin/
│   └── sflo              (compiled Bun binary)
├── postinstall.js        (sets +x permission)
└── README.md
```

### 5.2 Platform Detection

NPM uses `os` and `cpu` fields in `package.json` to conditionally install packages:

```json
{
  "os": ["linux"],
  "cpu": ["x64"]
}
```

Valid values:
- `os`: `linux`, `darwin`, `win32`, `aix`, `freebsd`, `openbsd`, `sunos`
- `cpu`: `x64`, `arm64`, `arm`, `ia32`, `ppc64`, `ppc`, `s390`, `s390x`, `mips64el`

### 5.3 Size Optimization

Binary packages are large (2-5MB each). Minimize by:

1. **Bun compile with `--minify`**: Already done in build pipeline
2. **Strip binaries**: Remove debug symbols before packaging
3. **Compression**: Store as `.tar.gz` in NPM (NPM auto-decompresses)
4. **Lazy loading**: Only download when installing (users don't download all architectures)

### 5.4 Version Pinning

All platform packages must use the **exact same version**. Root package depends on:

```json
"dependencies": {
  "@sflo/linux-x64": "1.2.3",
  "@sflo/linux-arm64": "1.2.3",
  "@sflo/macos-x64": "1.2.3",
  "@sflo/macos-arm64": "1.2.3",
  "@sflo/windows-x64": "1.2.3"
}
```

All must be published simultaneously to maintain consistency.

---

## 6. Universal Fallback

### 6.1 Install Script Strategy

SFLO provides a universal installation script that:
1. Detects OS and architecture
2. Determines correct binary to download
3. Downloads from GitHub Release
4. Verifies SHA256 checksum
5. Extracts and installs to `/usr/local/bin` (Unix) or `%PROGRAMFILES%` (Windows)
6. Makes binary executable
7. Verifies installation

### 6.2 Installation Methods

#### 6.2.1 Curl-based Installation

```bash
curl -fsSL https://install.sflo.io | bash
```

Or with environment variables:

```bash
SFLO_VERSION=v1.2.3 \
INSTALL_DIR=/opt/sflo \
  curl -fsSL https://install.sflo.io | bash
```

#### 6.2.2 Wget-based Installation

```bash
wget -qO - https://install.sflo.io | bash
```

#### 6.2.3 Direct Download

```bash
# Detect platform and download
https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-linux-x64.tar.gz
```

### 6.3 Script Location

Host `install.sh` at:
- GitHub Releases (as artifact in release)
- CDN (e.g., AWS CloudFront at `install.sflo.io`)
- Repository (raw.githubusercontent.com)

**Recommended:** CDN for reliability and performance.

---

## 7. Reference Code / Boilerplate

### 7.1 Scoop Manifest (`sflo.json`)

```json
{
  "version": "1.2.3",
  "description": "High-performance terminal assistant CLI built with Bun",
  "homepage": "https://github.com/sflo-cli/sflo",
  "license": "MIT",
  "architecture": {
    "64bit": {
      "url": "https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-windows-x64.zip",
      "hash": "sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef90"
    },
    "32bit": {
      "url": "https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-windows-i386.zip",
      "hash": "sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef91"
    },
    "arm64": {
      "url": "https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-windows-arm64.zip",
      "hash": "sha256:abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef92"
    }
  },
  "bin": "sflo.exe",
  "checkver": {
    "url": "https://api.github.com/repos/sflo-cli/sflo/releases/latest",
    "jp": "$.tag_name",
    "re": "v([\\w.]+)"
  },
  "autoupdate": {
    "architecture": {
      "64bit": {
        "url": "https://github.com/sflo-cli/sflo/releases/download/v$version/sflo-v$version-windows-x64.zip",
        "hash": {
          "url": "https://github.com/sflo-cli/sflo/releases/download/v$version/checksums.txt",
          "find": "(?<hash>\\w+)\\s+sflo-v\\$version-windows-x64\\.zip"
        }
      },
      "32bit": {
        "url": "https://github.com/sflo-cli/sflo/releases/download/v$version/sflo-v$version-windows-i386.zip",
        "hash": {
          "url": "https://github.com/sflo-cli/sflo/releases/download/v$version/checksums.txt",
          "find": "(?<hash>\\w+)\\s+sflo-v\\$version-windows-i386\\.zip"
        }
      },
      "arm64": {
        "url": "https://github.com/sflo-cli/sflo/releases/download/v$version/sflo-v$version-windows-arm64.zip",
        "hash": {
          "url": "https://github.com/sflo-cli/sflo/releases/download/v$version/checksums.txt",
          "find": "(?<hash>\\w+)\\s+sflo-v\\$version-windows-arm64\\.zip"
        }
      }
    }
  },
  "notes": [
    "SFLO is distributed as a standalone binary.",
    "No dependencies required."
  ]
}
```

#### 7.1.1 Scoop Manifest Validation

```bash
# Test manifest syntax
scoop search sflo

# Validate autoupdate configuration
scoop checkver sflo

# Test installation
scoop install ./sflo.json
```

### 7.2 Homebrew Formula (`sflo.rb`)

```ruby
# homebrew-sflo/Formula/sflo.rb

class Sflo < Formula
  desc "High-performance terminal assistant CLI built with Bun"
  homepage "https://github.com/sflo-cli/sflo"
  license "MIT"

  on_macos do
    on_intel do
      url "https://github.com/sflo-cli/sflo/releases/download/v#{version}/sflo-v#{version}-macos-x64.tar.gz"
      sha256 "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef90"
    end
    on_arm do
      url "https://github.com/sflo-cli/sflo/releases/download/v#{version}/sflo-v#{version}-macos-arm64.tar.gz"
      sha256 "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef91"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/sflo-cli/sflo/releases/download/v#{version}/sflo-v#{version}-linux-x64.tar.gz"
      sha256 "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef92"
    end
    on_arm do
      url "https://github.com/sflo-cli/sflo/releases/download/v#{version}/sflo-v#{version}-linux-arm64.tar.gz"
      sha256 "abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef93"
    end
  end

  version "1.2.3"

  def install
    bin.install "sflo"
  end

  def post_install
    # Optional: Create shell completions, cache directories, etc.
  end

  def caveats
    <<~EOS
      SFLO has been installed successfully.
      
      To get started:
        sflo --help
      
      For more information:
        https://github.com/sflo-cli/sflo
    EOS
  end

  test do
    system "#{bin}/sflo", "--version"
  end
end
```

#### 7.2.1 Homebrew Testing

```bash
# Test formula syntax
brew install --build-from-source ./sflo.rb

# Test installation
brew install sflo-cli/sflo/sflo
brew test sflo

# Audit formula
brew audit --strict sflo-cli/sflo/sflo
```

### 7.3 NPM Package Structure

#### 7.3.1 Root Package (`@sflo/cli`)

```json
{
  "name": "@sflo/cli",
  "version": "1.2.3",
  "description": "High-performance terminal assistant CLI",
  "homepage": "https://github.com/sflo-cli/sflo",
  "repository": {
    "type": "git",
    "url": "https://github.com/sflo-cli/sflo.git"
  },
  "license": "MIT",
  "type": "module",
  "bin": {
    "sflo": "bin/sflo.js"
  },
  "preferGlobal": true,
  "engines": {
    "npm": ">=9.0.0"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "dependencies": {
    "@sflo/linux-x64": "1.2.3",
    "@sflo/linux-arm64": "1.2.3",
    "@sflo/linux-armv7l": "1.2.3",
    "@sflo/macos-x64": "1.2.3",
    "@sflo/macos-arm64": "1.2.3",
    "@sflo/windows-x64": "1.2.3",
    "@sflo/windows-ia32": "1.2.3"
  },
  "scripts": {
    "postinstall": "node scripts/postinstall.js"
  },
  "keywords": [
    "cli",
    "shell",
    "terminal",
    "assistant",
    "bun"
  ],
  "author": "SFLO Team <info@sflo.io>",
  "maintainers": [
    {
      "name": "SFLO Team",
      "email": "info@sflo.io",
      "url": "https://github.com/sflo-cli"
    }
  ]
}
```

#### 7.3.2 Platform-Specific Package (`@sflo/linux-x64`)

```json
{
  "name": "@sflo/linux-x64",
  "version": "1.2.3",
  "description": "SFLO CLI for Linux x64 (prebuilt binary)",
  "homepage": "https://github.com/sflo-cli/sflo",
  "license": "MIT",
  "type": "module",
  "os": ["linux"],
  "cpu": ["x64"],
  "files": [
    "bin/sflo",
    "postinstall.js"
  ],
  "bin": {
    "sflo": "bin/sflo"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "scripts": {
    "postinstall": "node postinstall.js"
  },
  "author": "SFLO Team <info@sflo.io>",
  "repository": {
    "type": "git",
    "url": "https://github.com/sflo-cli/sflo.git",
    "directory": "packages/sflo-linux-x64"
  }
}
```

#### 7.3.3 Post-Install Script (`postinstall.js`)

```javascript
// postinstall.js
// Runs after NPM installs the package
// Makes the binary executable on Unix systems

import { chmod } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function postinstall() {
  const platform = process.platform;
  
  // Only needed on Unix-like systems
  if (platform === 'darwin' || platform === 'linux' || platform === 'freebsd') {
    const binaryPath = join(__dirname, 'bin', 'sflo');
    
    try {
      // Make binary executable (chmod +x)
      await chmod(binaryPath, 0o755);
      console.log(`✓ SFLO binary installed: ${binaryPath}`);
    } catch (err) {
      console.error(`✗ Failed to set executable permission: ${err.message}`);
      process.exit(1);
    }
  }
}

postinstall().catch(err => {
  console.error(err);
  process.exit(1);
});
```

#### 7.3.4 Wrapper Script (`bin/sflo.js`)

```javascript
// Root package wrapper that delegates to platform-specific binary

import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Determine platform
const platform = process.platform;
const arch = process.arch;

let binaryPath;

switch (platform) {
  case 'linux':
    if (arch === 'x64') {
      binaryPath = require.resolve('@sflo/linux-x64/bin/sflo');
    } else if (arch === 'arm64') {
      binaryPath = require.resolve('@sflo/linux-arm64/bin/sflo');
    } else if (arch === 'arm') {
      binaryPath = require.resolve('@sflo/linux-armv7l/bin/sflo');
    }
    break;

  case 'darwin':
    if (arch === 'x64') {
      binaryPath = require.resolve('@sflo/macos-x64/bin/sflo');
    } else if (arch === 'arm64') {
      binaryPath = require.resolve('@sflo/macos-arm64/bin/sflo');
    }
    break;

  case 'win32':
    if (arch === 'x64') {
      binaryPath = require.resolve('@sflo/windows-x64/bin/sflo.exe');
    } else if (arch === 'ia32') {
      binaryPath = require.resolve('@sflo/windows-ia32/bin/sflo.exe');
    }
    break;

  default:
    console.error(`Platform ${platform} (${arch}) is not supported.`);
    process.exit(1);
}

if (!binaryPath) {
  console.error(`Architecture ${arch} is not supported on ${platform}.`);
  process.exit(1);
}

// Spawn the actual binary with all CLI arguments
const proc = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  shell: false,
});

proc.on('exit', code => {
  process.exit(code || 0);
});

proc.on('error', err => {
  console.error(`Failed to execute SFLO: ${err.message}`);
  process.exit(1);
});
```

### 7.4 Winget Manifest

#### 7.4.1 Installer Manifest (`sflo.cli.installer.yaml`)

```yaml
# manifests/s/sflo/cli/1.2.3/sflo.cli.installer.yaml

PackageIdentifier: sflo.cli
PackageVersion: 1.2.3
MinimumOSVersion: "10.0.0.0"
InstallerType: zip
Installers:
  - Architecture: x64
    InstallerUrl: https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-windows-x64.zip
    InstallerSha256: abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef90
    InstallerLocale: en-US
    
  - Architecture: x86
    InstallerUrl: https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-windows-i386.zip
    InstallerSha256: abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef91
    
  - Architecture: arm64
    InstallerUrl: https://github.com/sflo-cli/sflo/releases/download/v1.2.3/sflo-v1.2.3-windows-arm64.zip
    InstallerSha256: abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef92

ManifestType: installer
ManifestVersion: 1.2.0
```

#### 7.4.2 Locale Manifest (`sflo.cli.locale.en-US.yaml`)

```yaml
# manifests/s/sflo/cli/1.2.3/sflo.cli.locale.en-US.yaml

PackageIdentifier: sflo.cli
PackageVersion: 1.2.3
PackageLocale: en-US
Publisher: SFLO Team
PublisherUrl: https://github.com/sflo-cli
PublisherSupportUrl: https://github.com/sflo-cli/sflo/issues
PrivacyUrl: https://github.com/sflo-cli/sflo/blob/main/PRIVACY.md
Author: SFLO Team
PackageName: SFLO CLI
PackageUrl: https://github.com/sflo-cli/sflo
License: MIT
LicenseUrl: https://github.com/sflo-cli/sflo/blob/main/LICENSE
ShortDescription: High-performance terminal assistant CLI
Description: |
  SFLO (Shell-Flow) is a high-performance, zero-dependency terminal assistant 
  built with Bun and TypeScript. Execute complex shell operations with natural 
  language interface.
Tags:
  - cli
  - shell
  - terminal
  - assistant
  - bun

ManifestType: locale
ManifestVersion: 1.2.0
```

#### 7.4.3 Version Manifest (`sflo.cli.yaml`)

```yaml
# manifests/s/sflo/cli/1.2.3/sflo.cli.yaml

PackageIdentifier: sflo.cli
PackageVersion: 1.2.3
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.2.0
```

### 7.5 AUR PKGBUILD Template

```bash
# AUR: aur.archlinux.org/sflo.git/PKGBUILD

pkgname=sflo
pkgver=1.2.3
pkgrel=1
pkgdesc="High-performance terminal assistant CLI built with Bun"
arch=('x86_64' 'aarch64')
url="https://github.com/sflo-cli/sflo"
license=('MIT')
depends=()
makedepends=()
source_x86_64=(
  "sflo-${pkgver}-linux-x64.tar.gz::https://github.com/sflo-cli/sflo/releases/download/v${pkgver}/sflo-v${pkgver}-linux-x64.tar.gz"
)
source_aarch64=(
  "sflo-${pkgver}-linux-arm64.tar.gz::https://github.com/sflo-cli/sflo/releases/download/v${pkgver}/sflo-v${pkgver}-linux-arm64.tar.gz"
)
sha256sums_x86_64=('abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef90')
sha256sums_aarch64=('abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx1234yzab5678cdef91')

package() {
  install -Dm755 "${srcdir}/sflo" "${pkgdir}/usr/local/bin/sflo"
  # Optional: Install bash completion if available
  # install -Dm644 "${srcdir}/completions/sflo.bash" "${pkgdir}/usr/share/bash-completion/completions/sflo"
}
```

### 7.6 Universal Install Script (`install.sh`)

```bash
#!/usr/bin/env bash
# install.sh
# Universal SFLO installation script for all platforms

set -e

# Configuration
REPO="sflo-cli/sflo"
GITHUB_API="https://api.github.com/repos/${REPO}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
SFLO_VERSION="${SFLO_VERSION:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# Detect operating system
detect_os() {
  case "$(uname -s)" in
    Darwin*)  echo "macos" ;;
    Linux*)   echo "linux" ;;
    MINGW*)   echo "windows" ;;
    MSYS*)    echo "windows" ;;
    *)        echo "unknown" ;;
  esac
}

# Detect architecture
detect_arch() {
  case "$(uname -m)" in
    x86_64)   echo "x64" ;;
    aarch64)  echo "arm64" ;;
    arm64)    echo "arm64" ;;
    armv7l)   echo "armv7l" ;;
    i686)     echo "i386" ;;
    *)        echo "unknown" ;;
  esac
}

# Get latest release version from GitHub API
get_latest_version() {
  local url="${GITHUB_API}/releases/latest"
  
  if command -v curl &>/dev/null; then
    curl -s "${url}" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/'
  elif command -v wget &>/dev/null; then
    wget -qO- "${url}" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/'
  else
    log_error "curl or wget is required"
    return 1
  fi
}

# Download file
download_file() {
  local url="$1"
  local output="$2"
  
  if command -v curl &>/dev/null; then
    curl -fsSL "${url}" -o "${output}"
  elif command -v wget &>/dev/null; then
    wget -q "${url}" -O "${output}"
  else
    log_error "curl or wget is required"
    return 1
  fi
}

# Verify SHA256 checksum
verify_checksum() {
  local file="$1"
  local expected="$2"
  
  if command -v sha256sum &>/dev/null; then
    local actual=$(sha256sum "${file}" | awk '{print $1}')
  elif command -v shasum &>/dev/null; then
    local actual=$(shasum -a 256 "${file}" | awk '{print $1}')
  else
    log_warn "sha256sum/shasum not found, skipping checksum verification"
    return 0
  fi
  
  if [ "$actual" != "$expected" ]; then
    log_error "Checksum mismatch!\nExpected: ${expected}\nActual:   ${actual}"
    return 1
  fi
  
  log_info "Checksum verified"
}

# Main installation flow
main() {
  log_info "Installing SFLO CLI..."
  
  # Detect OS and architecture
  OS=$(detect_os)
  ARCH=$(detect_arch)
  
  if [ "$OS" = "unknown" ] || [ "$ARCH" = "unknown" ]; then
    log_error "Unsupported platform: $(uname -s) $(uname -m)"
    exit 1
  fi
  
  log_info "Detected platform: ${OS}-${ARCH}"
  
  # Get version to install
  if [ "$SFLO_VERSION" = "latest" ]; then
    SFLO_VERSION=$(get_latest_version)
    if [ -z "$SFLO_VERSION" ]; then
      log_error "Failed to determine latest version"
      exit 1
    fi
  fi
  
  # Remove 'v' prefix if present
  SFLO_VERSION="${SFLO_VERSION#v}"
  log_info "Installing version ${SFLO_VERSION}..."
  
  # Download and install binary
  if [ "$OS" = "windows" ]; then
    # Windows: .zip file
    FILENAME="sflo-v${SFLO_VERSION}-${OS}-${ARCH}.zip"
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${SFLO_VERSION}/${FILENAME}"
    TEMP_DIR=$(mktemp -d)
    
    download_file "${DOWNLOAD_URL}" "${TEMP_DIR}/${FILENAME}"
    
    if [ ! -f "${TEMP_DIR}/${FILENAME}" ]; then
      log_error "Failed to download ${FILENAME}"
      exit 1
    fi
    
    unzip -q "${TEMP_DIR}/${FILENAME}" -d "${TEMP_DIR}"
    cp "${TEMP_DIR}/sflo.exe" "${INSTALL_DIR}/sflo.exe"
    
    rm -rf "${TEMP_DIR}"
    
  else
    # Unix: .tar.gz file
    FILENAME="sflo-v${SFLO_VERSION}-${OS}-${ARCH}.tar.gz"
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/v${SFLO_VERSION}/${FILENAME}"
    TEMP_DIR=$(mktemp -d)
    
    download_file "${DOWNLOAD_URL}" "${TEMP_DIR}/${FILENAME}"
    
    if [ ! -f "${TEMP_DIR}/${FILENAME}" ]; then
      log_error "Failed to download ${FILENAME}"
      exit 1
    fi
    
    tar -xzf "${TEMP_DIR}/${FILENAME}" -C "${TEMP_DIR}"
    
    # Set permissions and install
    chmod +x "${TEMP_DIR}/sflo"
    
    # Use sudo if install dir requires it
    if [ ! -w "${INSTALL_DIR}" ]; then
      sudo cp "${TEMP_DIR}/sflo" "${INSTALL_DIR}/sflo"
      sudo chmod +x "${INSTALL_DIR}/sflo"
    else
      cp "${TEMP_DIR}/sflo" "${INSTALL_DIR}/sflo"
      chmod +x "${INSTALL_DIR}/sflo"
    fi
    
    rm -rf "${TEMP_DIR}"
  fi
  
  # Verify installation
  if command -v sflo &>/dev/null; then
    INSTALLED_VERSION=$(sflo --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
    log_info "SFLO ${INSTALLED_VERSION} installed successfully!"
    log_info "Run 'sflo --help' to get started"
  else
    log_error "Installation verification failed"
    exit 1
  fi
}

main "$@"
```

---

## 8. Automation & GitHub Actions

### 8.1 Release Publishing Workflow

When a release is created in GitHub, automated workflows:
1. Build and compile binaries (already done via release.yml)
2. Generate checksums
3. Update all package manager manifests
4. Publish to NPM (all platform packages)
5. Publish to Scoop bucket
6. Create Homebrew PR
7. Update AUR PKGBUILD
8. Deploy install script

### 8.2 Package Manager Update Automation

#### 8.2.1 Scoop Update Workflow

```yaml
# .github/workflows/update-scoop.yml

name: Update Scoop

on:
  release:
    types: [published]

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: sflo-cli/scoop-sflo
          token: ${{ secrets.SCOOP_TOKEN }}

      - name: Get release info
        id: release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          VERSION="${VERSION#v}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          
          # Download checksums
          curl -fsSL "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/checksums.txt" \
            -o checksums.txt

      - name: Parse checksums and update manifest
        run: |
          VERSION="${{ steps.release.outputs.version }}"
          
          # Extract hashes for each platform
          HASH_X64=$(grep "sflo-v${VERSION}-windows-x64.zip" checksums.txt | awk '{print $1}')
          HASH_I386=$(grep "sflo-v${VERSION}-windows-i386.zip" checksums.txt | awk '{print $1}')
          HASH_ARM64=$(grep "sflo-v${VERSION}-windows-arm64.zip" checksums.txt | awk '{print $1}')
          
          # Update sflo.json with jq
          jq --arg version "${VERSION}" \
             --arg hash_x64 "${HASH_X64}" \
             --arg hash_i386 "${HASH_I386}" \
             --arg hash_arm64 "${HASH_ARM64}" \
             '.version = $version | 
              .architecture["64bit"].hash = "sha256:\($hash_x64)" |
              .architecture["32bit"].hash = "sha256:\($hash_i386)" |
              .architecture["arm64"].hash = "sha256:\($hash_arm64)"' \
             bucket/sflo.json > bucket/sflo.json.tmp && \
          mv bucket/sflo.json.tmp bucket/sflo.json

      - name: Commit and push
        run: |
          git config user.name "sflo-bot"
          git config user.email "bot@sflo.io"
          git add bucket/sflo.json
          git commit -m "chore: update sflo to v${{ steps.release.outputs.version }}"
          git push
```

#### 8.2.2 Homebrew Update Workflow

```yaml
# .github/workflows/update-homebrew.yml

name: Update Homebrew

on:
  release:
    types: [published]

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: sflo-cli/homebrew-sflo
          token: ${{ secrets.HOMEBREW_TOKEN }}

      - name: Get release info
        id: release
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          VERSION="${VERSION#v}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          
          curl -fsSL "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/checksums.txt" \
            -o checksums.txt

      - name: Update formula
        run: |
          VERSION="${{ steps.release.outputs.version }}"
          
          # Extract hashes
          HASH_MACOS_X64=$(grep "sflo-v${VERSION}-macos-x64.tar.gz" checksums.txt | awk '{print $1}')
          HASH_MACOS_ARM64=$(grep "sflo-v${VERSION}-macos-arm64.tar.gz" checksums.txt | awk '{print $1}')
          HASH_LINUX_X64=$(grep "sflo-v${VERSION}-linux-x64.tar.gz" checksums.txt | awk '{print $1}')
          HASH_LINUX_ARM64=$(grep "sflo-v${VERSION}-linux-arm64.tar.gz" checksums.txt | awk '{print $1}')
          
          # Create formula with Ruby
          cat > Formula/sflo.rb <<EOF
          class Sflo < Formula
            desc "High-performance terminal assistant CLI"
            homepage "https://github.com/sflo-cli/sflo"
            license "MIT"

            on_macos do
              on_intel do
                url "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/sflo-v${VERSION}-macos-x64.tar.gz"
                sha256 "${HASH_MACOS_X64}"
              end
              on_arm do
                url "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/sflo-v${VERSION}-macos-arm64.tar.gz"
                sha256 "${HASH_MACOS_ARM64}"
              end
            end

            on_linux do
              on_intel do
                url "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/sflo-v${VERSION}-linux-x64.tar.gz"
                sha256 "${HASH_LINUX_X64}"
              end
              on_arm do
                url "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/sflo-v${VERSION}-linux-arm64.tar.gz"
                sha256 "${HASH_LINUX_ARM64}"
              end
            end

            version "${VERSION}"

            def install
              bin.install "sflo"
            end

            test do
              system "#{bin}/sflo", "--version"
            end
          end
          EOF

      - name: Commit and push
        run: |
          git config user.name "sflo-bot"
          git config user.email "bot@sflo.io"
          git add Formula/sflo.rb
          git commit -m "chore: update sflo to v${{ steps.release.outputs.version }}"
          git push
```

#### 8.2.3 NPM Publish Workflow

```yaml
# .github/workflows/publish-npm.yml

name: Publish to NPM

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package:
          - '@sflo/cli'
          - '@sflo/linux-x64'
          - '@sflo/linux-arm64'
          - '@sflo/linux-armv7l'
          - '@sflo/macos-x64'
          - '@sflo/macos-arm64'
          - '@sflo/windows-x64'
          - '@sflo/windows-ia32'

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Get version
        id: version
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          echo "version=${VERSION#v}" >> $GITHUB_OUTPUT

      - name: Update package.json version
        run: |
          jq '.version = "${{ steps.version.outputs.version }}"' \
            "packages/${{ matrix.package }}/package.json" \
            > "packages/${{ matrix.package }}/package.json.tmp" && \
          mv "packages/${{ matrix.package }}/package.json.tmp" \
             "packages/${{ matrix.package }}/package.json"

      - name: Publish to NPM
        run: |
          npm publish "packages/${{ matrix.package }}" --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Publish root package last
        if: matrix.package == '@sflo/windows-ia32'
        run: npm publish packages/@sflo/cli --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 8.2.4 AUR Update Workflow

```yaml
# .github/workflows/update-aur.yml

name: Update AUR

on:
  release:
    types: [published]

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get release info
        id: release
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          VERSION="${VERSION#v}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          
          curl -fsSL "https://github.com/sflo-cli/sflo/releases/download/v${VERSION}/checksums.txt" \
            -o /tmp/checksums.txt

      - name: Checkout AUR repository
        uses: actions/checkout@v4
        with:
          repository: aur-sflo/sflo
          ssh-key: ${{ secrets.AUR_SSH_KEY }}
          path: aur-repo

      - name: Update PKGBUILD
        run: |
          VERSION="${{ steps.release.outputs.version }}"
          HASH_X64=$(grep "sflo-v${VERSION}-linux-x64.tar.gz" /tmp/checksums.txt | awk '{print $1}')
          HASH_ARM64=$(grep "sflo-v${VERSION}-linux-arm64.tar.gz" /tmp/checksums.txt | awk '{print $1}')
          
          cd aur-repo
          
          # Update PKGBUILD with sed
          sed -i "s/pkgver=.*/pkgver=${VERSION}/" PKGBUILD
          sed -i "s/pkgrel=.*/pkgrel=1/" PKGBUILD
          sed -i "0,/sha256sums_x86_64=.*/s//sha256sums_x86_64=('${HASH_X64}')/" PKGBUILD
          sed -i "0,/sha256sums_aarch64=.*/s//sha256sums_aarch64=('${HASH_ARM64}')/" PKGBUILD

      - name: Generate .SRCINFO
        run: |
          cd aur-repo
          makepkg --printsrcinfo > .SRCINFO

      - name: Commit and push to AUR
        run: |
          cd aur-repo
          git config user.name "sflo-bot"
          git config user.email "bot@sflo.io"
          git add PKGBUILD .SRCINFO
          git commit -m "Update sflo to ${{ steps.release.outputs.version }}"
          git push
```

---

## 9. Versioning & Update Strategy

### 9.1 Version Format

All distributions use **semantic versioning**:

```
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>][+<BUILD>]

v1.0.0           (major release)
v1.2.3           (patch update)
v2.0.0-beta.1    (prerelease)
v2.0.0-rc.1      (release candidate)
```

### 9.2 Release Checklist

Before publishing a release:

1. **Code freeze**: Merge all features to main branch
2. **Version bump**: Update version in:
   - `package.json` (all packages)
   - `Cargo.toml` (if applicable)
   - `VERSION` file
3. **Changelog**: Document changes in `CHANGELOG.md`
4. **Tag release**: Create git tag: `git tag v1.2.3`
5. **Build binaries**: Trigger build workflow (outputs to GitHub Releases)
6. **Verify artifacts**: Ensure all binaries are present and executable
7. **Create GitHub Release**: Publish release with artifacts and checksums
8. **Monitor automations**: Watch GitHub Actions workflows
9. **Verify availability**: Test installation from all package managers

### 9.3 Beta/RC Distribution

For prerelease versions:

1. Create release with `v1.2.3-beta.1` tag
2. Mark GitHub Release as **pre-release** (checkbox)
3. Workflows detect prerelease flag and:
   - Publish to separate NPM prerelease tags (`@sflo/cli@next`)
   - Create separate Scoop/Homebrew branches (not main)
   - Skip AUR update (requires stable versions only)
4. Users opt-in: `npm install @sflo/cli@next` or `brew install sflo-cli/sflo/sflo --head`

---

## 10. Package Manager Comparison Matrix

| Package Manager | Platform | Effort | Stability | Adoption | Auto-Update |
|-----------------|----------|--------|-----------|----------|------------|
| **GitHub Releases** | All | Low | Excellent | N/A | Manual |
| **Homebrew** | macOS/Linux | Low | Excellent | High | Yes |
| **Scoop** | Windows | Low | Excellent | High | Yes |
| **Winget** | Windows | Medium | Good | Growing | Yes |
| **NPM** | All | Medium | Excellent | High | Yes |
| **APT** | Debian/Ubuntu | Medium | Excellent | High | Yes |
| **DNF** | Fedora/RHEL | Medium | Excellent | Medium | Yes |
| **AUR** | Arch | Medium | Good | Medium | No |
| **Snap** | Linux | High | Good | Medium | Yes |
| **Flatpak** | Linux | High | Experimental | Low | Yes |

**Priority ranking:**
1. **Homebrew + Scoop** (covers macOS, Linux, Windows)
2. **NPM** (cross-platform, familiar to developers)
3. **GitHub Releases** (universal fallback)
4. **APT + DNF** (Linux distribution coverage)
5. **Winget** (Windows official channel)
6. **AUR** (Arch Linux community)
7. **Snap/Flatpak** (if user demand exists)

---

## 11. Rollback & Hotfix Procedures

### 11.1 Emergency Rollback

If a critical bug is discovered in released version:

1. **Immediately**: Delete affected GitHub Release (prevents new installs)
2. **Create hotfix branch**: `git checkout -b hotfix/v1.2.4`
3. **Apply fixes**: Cherry-pick or apply fixes to hotfix branch
4. **Test thoroughly**: Run full test suite
5. **Tag and release**: `git tag v1.2.4` and push to GitHub
6. **Verify package managers**: Ensure new version is available
7. **Communicate**: Post security advisory if applicable

### 11.2 Yanked Versions

If a version has critical issues but can't be immediately hotfixed:

1. Mark GitHub Release as **draft** (hides from downloads)
2. Post deprecation notice in release notes
3. Recommend specific version upgrade path
4. Update documentation

Example:
```markdown
## ⚠️ Version 1.2.3 - YANKED

This version has a critical bug affecting file operations on Linux ARM64.
**Do not use this version.**

Users should upgrade to v1.2.4 immediately:
```bash
sflo upgrade v1.2.4
```

### 11.3 Hotfix Distribution

For hotfix versions:

1. Use patch version bump: `v1.2.3` → `v1.2.4`
2. All package managers update immediately (same automation)
3. NPM marks old version as deprecated: `npm deprecate @sflo/cli@1.2.3`
4. Scoop and Homebrew auto-update on next refresh

---

## 12. Metrics & Adoption Tracking

### 12.1 Download Tracking

Track installations via:

1. **GitHub Release downloads**: Built-in GitHub statistics
2. **NPM downloads**: `npm info @sflo/cli` returns weekly stats
3. **Package manager statistics**:
   - Homebrew: `brew info sflo`
   - Scoop: Analytics via bucket repo stars
4. **Install script downloads**: Log HTTP requests to `install.sflo.io`

### 12.2 Installation Breakdown

Use GitHub Releases download statistics to determine popular platforms:

```json
{
  "sflo-v1.2.3-linux-x64.tar.gz": 15420,
  "sflo-v1.2.3-macos-x64.zip": 8950,
  "sflo-v1.2.3-macos-arm64.zip": 12300,
  "sflo-v1.2.3-windows-x64.zip": 9100,
  "sflo-v1.2.3-linux-arm64.tar.gz": 3200,
  "sflo-v1.2.3-windows-i386.zip": 450
}
```

### 12.3 Health Monitoring

Monitor distribution health:

```bash
# Check GitHub API for latest release
curl -s https://api.github.com/repos/sflo-cli/sflo/releases/latest | jq '.tag_name'

# Verify Homebrew formula
brew info sflo-cli/sflo/sflo

# Check NPM package
npm view @sflo/cli@latest version

# Test Scoop installation
scoop bucket add sflo https://github.com/sflo-cli/scoop-sflo.git && scoop install sflo
```

---

## Summary

The Package Managers Distribution specification establishes:

1. **GitHub Releases as single source of truth** for all artifacts
2. **Automated workflows** for updating all package manager manifests
3. **Production-ready boilerplate** for Scoop, Homebrew, NPM, Winget, AUR
4. **Cross-platform coverage** (Windows, macOS, Linux)
5. **Zero-dependency universal installer** (install.sh)
6. **Rollback procedures** for emergency hotfixes
7. **Metrics tracking** for adoption monitoring

All automation follows AGENTS.md constraints with 100% Bash/TypeScript, no external dependencies for end-users, and pragmatic distribution strategies.
