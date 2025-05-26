# pathkit • cross‑platform path manipulation

> @reliverse/pathkit is a slash‑consistent, cross‑platform path manipulation, with POSIX forward slash, drop‑in for node:path and unjs/pathe. This library extends the node:path module with a set of functions for manipulating file paths.

[sponsor](https://github.com/sponsors/blefnk) • [discord](https://discord.gg/Pb8uKbwpsJ) • [npm](https://npmjs.com/package/@reliverse/pathkit) • [repo](https://github.com/reliverse/pathkit)

## Key Features

- 🔹 **drop in** and replace `node:path` and `unjs/pathe` instantly
- ➕ **`unjs/pathe` on steroids** – alias resolution, import parsing, and more
- 🌀 **always `/`** – posix separators 100% of the time (buh‑bye `\\`)
- ⚙️ **node.js api compatible** – familiar methods, no learning curve
- 🚀 **modern & fast** – typescript, pure esm, bun & node‑ready
- 🧠 **predictable & testable** – deterministic output across windows / macos / linux
- 🧼 **no dependencies** – just better path api + couple of cool utilities = [4kB](https://bundlephobia.com/package/@reliverse/pathkit@latest)

## Installation

```bash
# bun • pnpm • yarn • npm
bun add @reliverse/pathkit
```

**Migrate**:

```bash
# soon:
# bun add -D @reliverse/dler
# bun dler migrate --lib path-to-pathkit
# bun dler migrate --lib pathe-to-pathkit
```

### `unjs/pathe` vs `@reliverse/pathkit`

| Package | What you get | When to use |
|---------|--------------|-------------|
| **`pathe`** | Path API only (with POSIX everywhere) | You only need a drop‑in for `node:path` |
| **`pathkit`** | Everything in `pathe` **+** advanced utilities | You need alias resolution, import transforms, etc. |

## Why Pathkit? — The Problem with Native Paths

Native `node:path` flips behavior between operating systems, spurring subtle bugs and OS checks.

```js
// With node:path – the same call may yield different separators on each OS
import path from "node:path";

const project = "users/blefnk/project";
const full = path.join("C:\\", project);
console.log(full); // "C:\\users\\blefnk\\project" (Windows) vs ??? (others)
```

### ✅ The `pathkit` Fix

```js
import { join } from "@reliverse/pathkit";

const full = join("C:", "users", "blefnk", "project");
console.log(full); // "C:/users/blefnk/project" on **every** OS 🎉
```

| Pain Point                     | `@reliverse/pathkit` Solution |
| :----------------------------- | :--------------------------- |
| Inconsistent separators        | ✅ Always `/` |
| OS‑specific work‑arounds       | ✅ One code path |
| Needs TypeScript + ESM         | ✅ Built‑in |
| Works in Bun / Deno / Node     | ✅ Out of the box |

## Quick Start

```ts
import { resolve, join, normalize } from "@reliverse/pathkit";

// Mixed slashes & dot‑segments? No problem.
const messy = "src\\..\\./dist///file.js";
console.log(resolve(messy));             // → "dist/file.js"

// Join is predictable everywhere:
console.log(join("users", "blefnk"));    // → "users/blefnk"
```

**Side‑by‑Side Demo**:

| Code | Windows Output | macOS / Linux Output |
|------|----------------|----------------------|
| `join("a", "b")` | `a/b` | `a/b` |
| `resolve("..", "x")` | `x` | `x` |

Say goodbye to `process.platform` conditionals 👋.

## pathkit advanced features

`@reliverse/pathkit` extends the core functionality of `node:path` with powerful utilities for working with imports, aliases, and more.

### Import/Export Analysis

The `getFileImportsExports` function provides detailed analysis of ES module imports and exports in your code:

```ts
import { getFileImportsExports } from "@reliverse/pathkit";

const code = `
import { ref } from "vue";
import utils from "@/utils";
import type { Config } from "./types";
import * as React from "react";
import { Button as UIButton } from "./components";
export { default as MyComponent } from "./MyComponent";
export type { Props } from "./types";
`;

const analysis = getFileImportsExports(code, {
  kind: "all",           // "import" | "export" | "all"
  pathTypes: ["alias"],  // Filter by path types: "alias" | "relative" | "absolute" | "bare" | "module"
  limitPerType: 2        // Limit results per type
});
```

The analysis provides rich information about each import/export statement:

```ts
interface ImportExportInfo {
  statement: string;           // Full original statement
  type: "static" | "dynamic"; // Import type (static or dynamic import())
  kind: "import" | "export";  // Statement kind
  source?: string;            // Import/export source path
  pathType?: "alias" | "relative" | "absolute" | "bare" | "module";
  pathTypeSymbol?: string;    // Path prefix (e.g., "@/", "~/")
  isTypeOnly?: boolean;       // Type-only import/export
  specifiers?: {              // Imported/exported items
    type: "named" | "default" | "namespace" | "all";
    name: string;
    alias?: string;
    isType?: boolean;
  }[];
  start: number;              // Position in source
  end: number;
}
```

Features:

- ✨ **Comprehensive Syntax Support**
  - Static imports (`import x from "y"`)
  - Dynamic imports (`import("y")`)
  - Named imports/exports (`import { x } from "y"`)
  - Default imports/exports (`import x from "y"`)
  - Namespace imports (`import * as x from "y"`)
  - Re-exports (`export * from "y"`)
  - Type imports/exports (`import type { x } from "y"`)

- 🔍 **Path Analysis**
  - Detects path types (alias, relative, absolute, bare, module)
  - Extracts path prefixes (e.g., `@/`, `~/`)
  - Preserves original path format

- 🎯 **Specifier Details**
  - Named imports/exports with aliases
  - Default imports/exports
  - Namespace imports
  - Type-only imports/exports
  - Mixed type and value imports

- 📊 **Filtering Options**
  - Filter by statement kind (import/export)
  - Filter by path types
  - Limit results per type
  - Preserve statement order

- 🛡️ **Type Safety**
  - Full TypeScript support
  - Detailed type definitions
  - Null-safe operations

Example output:

```ts
[
  {
    statement: 'import { ref } from "vue"',
    type: "static",
    kind: "import",
    source: "vue",
    pathType: "bare",
    specifiers: [{
      type: "named",
      name: "ref"
    }],
    start: 0,
    end: 24
  },
  {
    statement: 'import type { Config } from "./types"',
    type: "static",
    kind: "import",
    source: "./types",
    pathType: "relative",
    isTypeOnly: true,
    specifiers: [{
      type: "named",
      name: "Config",
      isType: true
    }],
    start: 45,
    end: 85
  }
]
```

### Path Transformation

Convert between different path formats:

```ts
import { convertImportPaths } from "@reliverse/pathkit";

await convertImportPaths({
  baseDir: "./src",
  fromType: "relative",    // "./components/Button"
  toType: "alias",         // "@/components/Button"
  aliasPrefix: "@/",
  generateSourceMap: true
});
```

### Extension Conversion

```ts
import { convertImportsExt } from "@reliverse/pathkit";

// Basic usage - convert all relative imports to .ts
await convertImportsExt({
  targetDir: "./src",
  extFrom: "none",
  extTo: "ts"
});

// Convert .js to .ts
await convertImportsExt({
  targetDir: "./src",
  extFrom: "js",
  extTo: "ts"
});

// Remove extensions
await convertImportsExt({
  targetDir: "./src",
  extFrom: "ts",
  extTo: "none"
});

// Handle alias paths (e.g. @/components)
await convertImportsExt({
  targetDir: "./src",
  extFrom: "none",
  extTo: "ts",
  alias: "@" // or "@/*"
});
```

The function intelligently handles different import types:

- ✅ Relative imports (`./file`, `../file`)
- ✅ Alias imports (when alias is specified)
- ❌ Package imports (`lodash`, `@scope/pkg`)
- ❌ Node built-ins (`node:path`, `node:fs`)
- ❌ URLs (`http://`, `https://`)
- ❌ Already processed paths

Features:

- 🔄 Recursively processes directories
- 🎯 Preserves package imports
- 🛡️ Safe for code generation
- 📝 Detailed change logging
- 🎨 Supports custom aliases

### Alias Resolution

```ts
import { 
  normalizeAliases,
  resolveAlias,
  reverseResolveAlias
} from "@reliverse/pathkit";

const aliases = { "@/": "/src/", "~/": "/home/user/" };

// Normalize alias config
console.log(normalizeAliases(aliases));

// Resolve alias to absolute path
console.log(resolveAlias("@/components", aliases));  // "/src/components"

// Convert absolute path back to alias
console.log(reverseResolveAlias("/src/utils", aliases));  // "@/utils"
```

### Utility Functions

```ts
import {
  filename,               // Strip extension
  normalizeQuotes,        // Standardize quote style
  matchesGlob            // Test glob patterns
} from "@reliverse/pathkit";

console.log(filename("/path/component.vue"));     // "component"
console.log(normalizeQuotes("import 'pkg'"));     // 'import "pkg"'
console.log(matchesGlob("file.ts", "**/*.ts"));  // true
```

## Use Cases / Ideal For

- 🛠️ **CLI tools**
- 🌍 **Cross‑platform dev environments**
- 🔄 **Bundlers, linters, compilers**
- 🏗️ **Framework & library authors**
- 📜 **Scripts / test runners**
- …anywhere file‑paths roam!

## Examples & Contributing

```bash
git clone https://github.com/reliverse/pathkit.git
cd pathkit
bun install
bun dev
```

Bug reports & PRs are warmly welcome—come on in!

## Related

- [`@reliverse/rempts`](https://npmjs.com/package/@reliverse/rempts) – Terminal Prompts Engine

## Community

- ⭐ **Star** the repo if this helped you.
- 💖 **Sponsor** [@blefnk](https://github.com/sponsors/blefnk) to keep the lights on.
- 💬 **Chat** with us on [Discord](https://discord.gg/Pb8uKbwpsJ).

## License

[MIT](LICENSE) © [Nazar Kornienko (blefnk)](https://github.com/blefnk), [Reliverse](https://github.com/reliverse)

## Badges

[![npm](https://img.shields.io/npm/v/@reliverse/pathkit?label=npm%20v)](https://npmjs.com/package/@reliverse/pathkit)
[![downloads](https://img.shields.io/npm/dm/@reliverse/pathkit.svg?color=brightgreen)](https://npmjs.com/package/@reliverse/pathkit)
[![typescript](https://img.shields.io/badge/typed-%E2%9C%85-blue)](https://github.com/reliverse/pathkit)
[![license](https://img.shields.io/npm/l/@reliverse/pathkit.svg)](LICENSE)
