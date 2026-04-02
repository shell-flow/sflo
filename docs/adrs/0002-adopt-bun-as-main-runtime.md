# ADR 0002: Adopt Bun as Main Runtime and Plugin Engine

## Status
**Accepted**

## Context
SFLO (Shell-Flow) requires an instantaneous response time (fast startup), support for dynamic execution of third-party plugins written in TypeScript, and distribution as a self-contained binary (without requiring a pre-installed Node, TypeScript, or Git environment). 

## Decision
Adopt Bun as the primary development runtime, execution engine, and packaging tool (`bundler`) for SFLO.

## Consequences

### Positive
* **Absolute Developer Experience (DX) for Plugins:** Bun executes TypeScript code natively and in real-time. Community developers only need to publish `.ts` files. SFLO will process the execution instantly, removing the need for external build tools or transpilation.
* **Unified Maintenance:** Both the core and the plugin ecosystem will operate under the same typing and language. This removes the maintenance bottleneck of creating and sustaining a complex communication bridge (*marshalling/unmarshalling*) between different languages.
* **Execution Performance:** Bun's millisecond-level startup meets the fluidity requirements for sequential terminal operations.
* **Native Packaging:** Using `bun build --compile` generates a standalone binary containing the application code and the runtime, satisfying the "self-contained" requirement.

### Negative and Mitigations
* **Artifact Size (Binary):** The final executable will have a nominally larger size (estimated 40MB to 90MB) due to encapsulating the JavaScriptCore engine and the Bun runtime. This trade-off is accepted in favor of simple extensibility.
* **Isolation and Security:** To counter the natural permissiveness of JS modules and protect the local environment from malicious plugins, the SFLO core architecture must implement encapsulation layers (using restricted Workers or wrapped global objects). Access to system calls, such as bash execution or directory manipulation, will occur strictly through functions injected and audited by the SFLO context (e.g., `sflo.exec`), never through direct OS APIs.