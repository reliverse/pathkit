import fs from "node:fs/promises";

import path, {
  convertImportsAliasToRelative,
  convertImportsExt,
  attachPathSegmentsInDirectory,
  stripPathSegmentsInDirectory,
  getFileImportsExports,
  type PathExtFilter,
} from "~/mod.js";

const ALIAS = "@";
const E_SRC = "e-src";
const E_DIST = "e-dist";
const EXT_TO_SEARCH_IN_PATHS = "js-ts-none" as PathExtFilter;
const TEST_JS_TO_TS_CONVERSION = false;
const PROJECT_WITH_TYPESCRIPT = false;

// pick ext once per file
function getExt(): string {
  if (EXT_TO_SEARCH_IN_PATHS === "js") return ".js";
  if (EXT_TO_SEARCH_IN_PATHS === "ts") return ".ts";
  if (EXT_TO_SEARCH_IN_PATHS === "none") return "";
  if (EXT_TO_SEARCH_IN_PATHS === "js-ts-none") {
    const choices = PROJECT_WITH_TYPESCRIPT
      ? [".ts", ".tsx", ""]
      : [".js", ".jsx", ""];
    const ext = choices[Math.floor(Math.random() * choices.length)] || "";
    console.log(`chose extension: ${ext || "(none)"}`);
    return ext;
  }
  const choices = PROJECT_WITH_TYPESCRIPT ? [".ts", ".tsx"] : [".js", ".jsx"];
  const ext = choices[Math.floor(Math.random() * choices.length)] || "";
  console.log(`chose extension: ${ext || "(none)"}`);
  return ext;
}

// note: `file` has no extension here
const samples = [
  {
    file: "utils/formatters",
    template: () =>
      PROJECT_WITH_TYPESCRIPT
        ? `
export function formatDate(date: Date): string {
  return date.toLocaleDateString()
}
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
`.trim()
        : `
export function formatDate(date) {
  return date.toLocaleDateString()
}
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
`.trim(),
  },
  {
    file: "components/ui/Button",
    template: (ext: string) =>
      PROJECT_WITH_TYPESCRIPT
        ? `
import { formatCurrency } from "${ALIAS}/utils/formatters${ext}"
interface ButtonProps { price?: number; label: string }
export function Button({ price, label }: ButtonProps) {
  return {
    render: () => {
      const displayText = price
        ? \`\${label} (\${formatCurrency(price)})\`
        : label
      return \`<button>\${displayText}</button>\`
    },
  }
}
`.trim()
        : `
import { formatCurrency } from "${ALIAS}/utils/formatters${ext}"
export function Button({ price, label }) {
  return {
    render: () => {
      const displayText = price
        ? \`\${label} (\${formatCurrency(price)})\`
        : label
      return \`<button>\${displayText}</button>\`
    },
  }
}
`.trim(),
  },
  {
    file: "components/layout/Header",
    template: (ext: string) =>
      PROJECT_WITH_TYPESCRIPT
        ? `
import { Button } from "${ALIAS}/components/ui/Button${ext}"
export function Header() {
  return {
    render: () => {
      const loginButton = Button({ label: "Login" })
      return \`<header>\${loginButton.render()}</header>\`
    },
  }
}
`.trim()
        : `
import { Button } from "${ALIAS}/components/ui/Button${ext}"
export function Header() {
  return {
    render: () => {
      const loginButton = Button({ label: "Login" })
      return \`<header>\${loginButton.render()}</header>\`
    },
  }
}
`.trim(),
  },
  {
    file: "index",
    template: (ext: string) =>
      PROJECT_WITH_TYPESCRIPT
        ? `
import { Header } from "${ALIAS}/components/layout/Header${ext}"
import { Button } from "${ALIAS}/components/ui/Button${ext}"
import { formatDate } from "${ALIAS}/utils/formatters${ext}"

console.log("Today is", formatDate(new Date()))
const buyButton = Button({ price: 99.99, label: "Buy Now" })
const header = Header()

console.log(buyButton.render())
console.log(header.render())

async function loadHelpers() {
  const m = await import("${ALIAS}/utils/formatters${ext}")
  console.log("loaded:", Object.keys(m))
}
void loadHelpers()
`.trim()
        : `
import { Header } from "${ALIAS}/components/layout/Header${ext}"
import { Button } from "${ALIAS}/components/ui/Button${ext}"
import { formatDate } from "${ALIAS}/utils/formatters${ext}"

console.log("Today is", formatDate(new Date()))
const buyButton = Button({ price: 99.99, label: "Buy Now" })
const header = Header()

console.log(buyButton.render())
console.log(header.render())

async function loadHelpers() {
  const m = await import("${ALIAS}/utils/formatters${ext}")
  console.log("loaded:", Object.keys(m))
}
void loadHelpers()
`.trim(),
  },
];

// dim logging function
const log = (msg: string) => console.log(`\x1b[36;2m${msg}\x1b[0m`);

async function createSampleFiles() {
  // gather dirs (will include "." for root)
  const dirs = [...new Set(samples.map((s) => path.dirname(s.file)))];
  // ensure src root exists
  await fs.mkdir(E_SRC, { recursive: true });
  // make subdirs (skip "." because that's the root)
  await Promise.all(
    dirs
      .filter((dir) => dir && dir !== ".")
      .map((dir) => fs.mkdir(path.join(E_SRC, dir), { recursive: true })),
  );
  // write each sample file
  await Promise.all(
    samples.map(async ({ file, template }) => {
      const ext = getExt();
      const fullPath = path.join(
        E_SRC,
        `${file}${PROJECT_WITH_TYPESCRIPT ? ".ts" : ".js"}`,
      );
      await fs.writeFile(fullPath, template(ext));
      log(`created ${fullPath}`);

      // Generate .d.ts file for .js files when not using TypeScript
      if (!PROJECT_WITH_TYPESCRIPT && !ext.endsWith("x")) {
        const dtsPath = path.join(E_SRC, `${file}.d.ts`);
        const dtsContent = generateDtsContent(file, ext);
        await fs.writeFile(dtsPath, dtsContent);
        log(`created ${dtsPath}`);
      }
    }),
  );
  log("✓ created sample files in e-src");
}

function generateDtsContent(file: string, ext: string): string {
  switch (file) {
    case "utils/formatters":
      return `
export function formatDate(date: Date): string;
export function formatCurrency(amount: number): string;
`.trim();

    case "components/ui/Button":
      return `
import { formatCurrency } from "${ALIAS}/utils/formatters${ext}";

interface ButtonProps {
  price?: number;
  label: string;
}

export function Button(props: ButtonProps): {
  render: () => string;
};
`.trim();

    case "components/layout/Header":
      return `
import { Button } from "${ALIAS}/components/ui/Button${ext}";

export function Header(): {
  render: () => string;
};
`.trim();

    case "index":
      return `
import { Header } from "${ALIAS}/components/layout/Header${ext}";
import { Button } from "${ALIAS}/components/ui/Button${ext}";
import { formatDate } from "${ALIAS}/utils/formatters${ext}";

declare const buyButton: ReturnType<typeof Button>;
declare const header: ReturnType<typeof Header>;

declare function loadHelpers(): Promise<void>;
`.trim();

    default:
      return "";
  }
}

async function analyzeImportsExports(filePath: string): Promise<void> {
  const content = await fs.readFile(filePath, "utf-8");
  const analysis = getFileImportsExports(content, {
    kind: "all",
    pathTypes: ["alias", "relative", "absolute", "bare", "module"],
  });

  log(`\n📊 Analysis for ${filePath}:`);
  for (const info of analysis) {
    const typePrefix = info.isTypeOnly ? "[type] " : "";
    log(`  ${typePrefix}${info.kind} ${info.type}: ${info.statement}`);
    if (info.specifiers?.length) {
      for (const spec of info.specifiers) {
        const specStr = spec.alias
          ? `${spec.name} as ${spec.alias}`
          : spec.name;
        log(`    - ${spec.type}: ${specStr}`);
      }
    }
  }
}

async function main(): Promise<void> {
  log("🚀 starting pathkit example");
  await cleanDirs([E_SRC, E_DIST]);
  await createSampleFiles();

  // Demonstrate import/export analysis
  log("\n📦 Example: Analyzing imports and exports");
  const sampleFiles = samples.map((s) =>
    path.join(E_SRC, `${s.file}${PROJECT_WITH_TYPESCRIPT ? ".ts" : ".js"}`),
  );
  for (const file of sampleFiles) {
    await analyzeImportsExports(file);
  }

  // Example: Attach lib prefix and strip segments
  log("\n📦 Example: Attaching lib prefix and stripping segments");
  await cleanDirs([E_DIST]);
  await copyDir(E_SRC, E_DIST);

  // Step 1: Attach libs/my-cool-lib prefix while preserving @ alias
  log("\nStep 1: Attaching libs/my-cool-lib prefix");
  await attachPathSegmentsInDirectory({
    targetDir: E_DIST,
    segments: ["libs", "my-cool-lib"],
    options: { position: "before", preserveAlias: ALIAS },
  });

  // Step 2: Strip segments first
  log("\nStep 2: Stripping segments");
  await stripPathSegmentsInDirectory({
    targetDir: E_DIST,
    segmentsToStrip: 2,
    alias: ALIAS,
  });

  // Step 3: Convert to relative paths
  log("\nStep 3: Converting to relative paths");
  await convertImportsAliasToRelative({
    targetDir: E_DIST,
    aliasToReplace: ALIAS,
    pathExtFilter: EXT_TO_SEARCH_IN_PATHS,
  });

  // Convert extensions
  if (EXT_TO_SEARCH_IN_PATHS === "js" && TEST_JS_TO_TS_CONVERSION) {
    log("\n📦 Converting extensions from .js to .ts");
    await convertImportsExt({
      targetDir: E_DIST,
      extFrom: "js",
      extTo: "ts",
    });
  }

  log("\n✨ Example complete! Check the results in:");
  log(`  - ${E_SRC}: Source files with alias imports`);
  log(`  - ${E_DIST}: Dist files with relative imports`);
}

await main();

// ========
// fs utils
// ========

/**
 * removes directories with recursive force option
 */
async function cleanDirs(dirs: string[]): Promise<void> {
  await Promise.all(
    dirs.map(async (d) => {
      try {
        await fs.rm(d, { recursive: true, force: true });
        log(`✓ cleaned: ${d}`);
      } catch (error) {
        log(
          `✗ error cleaning ${d}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
  );
}

/**
 * recursively copies a directory and its contents
 */
async function copyDir(src: string, dest: string): Promise<void> {
  log(`✓ copying: ${src} → ${dest}`);
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          return copyDir(srcPath, destPath);
        }

        await fs.copyFile(srcPath, destPath);
        log(`  copied: ${srcPath} → ${destPath}`);
      }),
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`✗ error copying directory ${src} to ${dest}: ${errorMsg}`);
    throw error;
  }
}
