# ADR 0001: Use Go and Embedded JS Engine for Core/Plugin Architecture

## Status
**Rejected**

## Context
The SFLO (Shell-Flow) project requires high CLI performance, standalone binary generation (no external dependencies like Node.js or Git), and support for dynamic execution of third-party plugins. One evaluated path was to develop the core in Go to ensure speed and slim binaries, coupling an embedded ECMAScript engine (`goja` or `v8go`) to interpret and execute the logic of community-developed plugins.

## Decision
Reject the mixed architecture (Go + JS Engine) in favor of a unified stack (Bun), which is detailed in ADR 0002.

## Consequences

### Positive (Acknowledged)
* **Artifact Size:** Generation of small static binaries (10MB to 15MB).
* **Pure Performance:** Native Go startup time, ideal for fast sequential CLI calls.
* **Robust Sandboxing:** The JS interpreter would run completely isolated, forcing plugins to depend exclusively on interfaces exposed by Go, ensuring high execution security and mitigating unauthorized OS access.

### Negative (Rejection Factors)
* **Bridge Maintenance:** A pure JS interpreter lacks standard I/O or network libraries (like Node/Web APIs). All base functionalities (HTTP requests, file manipulation, terminal calls) would require manual implementation in Go, strict typing, and complex asynchronous injection into the JS scope.
* **Plugin Creation Friction (DX):** Since the embedded engine does not compile TypeScript natively, community creators would be forced to manage build steps and bundlers (e.g., `esbuild`, `tsc`) to provide a ready-to-use JavaScript artifact, directly violating the principle of maximum simplicity in plugin conception.