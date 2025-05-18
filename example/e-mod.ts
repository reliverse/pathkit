/**
 *
 * pathkit
 * (default import example)
 */
import path from "~/libs/pathkit/pathkit-mod.js";
/**
 *
 * pathkit
 * (named import example)
 */
// import {
//   normalize,
//   resolve,
//   isAbsolute,
//   extname,
//   relative,
//   dirname,
//   format,
//   basename,
//   parse,
//   normalizeAliases,
//   resolveAlias,
//   reverseResolveAlias,
//   filename,
//   normalizeWindowsPath,
//   normalizeString,
//   toNamespacedPath,
//   delimiter,
//   posix,
//   win32,
//   join,
//   sep,
// } from "~/libs/pathkit/pathkit-mod.js";
/**
 *
 * pathkit-plus
 */
import {
  extractPackageName,
  convertImportPaths,
  convertImportExtensionsJsToTs,
  normalizeQuotes,
  matchesGlob,
  getFileImportsExports,
} from "~/mod.js";

async function main() {
  // pathkit path operations
  const messyPath = "src\\..\\./dist///file.js";
  const fullPath = path.resolve(messyPath);
  console.log("resolve:", messyPath, "->", fullPath);

  const joinedPath = path.join("users", "blefnk", "projects");
  console.log("join:", joinedPath);

  const norm = path.normalize("foo//bar/../baz/");
  console.log("normalize:", norm);

  const rel = path.relative("/a/b/c", "/a/d/e");
  console.log("relative:", rel);

  const abs = path.isAbsolute("/foo/bar");
  console.log("isAbsolute:", abs);

  const ext = path.extname("foo/bar/baz.txt");
  console.log("extname:", ext);

  const dir = path.dirname("/foo/bar/baz.txt");
  console.log("dirname:", dir);

  const base = path.basename("/foo/bar/baz.txt");
  console.log("basename:", base);

  const parsed = path.parse("/foo/bar/baz.txt");
  console.log("parse:", parsed);

  const formatted = path.format(parsed);
  console.log("format:", formatted);

  const globMatch = matchesGlob("foo/bar/baz.txt", "**/*.txt");
  console.log("matchesGlob:", globMatch);

  const normWin = path.normalizeWindowsPath("C:\\foo\\bar");
  console.log("normalizeWindowsPath:", normWin);

  // alias utilities
  const aliases = { "@/": "/src/", "~/": "/home/user/" };
  const normAliases = path.normalizeAliases(aliases);
  console.log("normalizeAliases:", normAliases);

  const resolvedAlias = path.resolveAlias("~/docs/readme.md", aliases);
  console.log("resolveAlias:", resolvedAlias);

  const reversed = path.reverseResolveAlias("/src/utils/index.ts", aliases);
  console.log("reverseResolveAlias:", reversed);

  const fname = path.filename("/some/very/long/path/to/my-component.vue");
  console.log("filename:", fname);

  // pathkit: extractPackageName
  console.log("extractPackageName:", extractPackageName("react"));
  console.log("extractPackageName (scoped):", extractPackageName("@scope/pkg"));
  console.log("extractPackageName (relative):", extractPackageName("./foo"));

  // pathkit: normalizeQuotes
  console.log(
    "normalizeQuotes:",
    normalizeQuotes("import { foo } from 'bar';"),
  );

  // pathkit: getFileImportsExports examples
  console.log("\n=== Import/Export Analysis Examples ===\n");

  // Example 1: Basic imports and exports
  const code1 = `
    import { ref } from "vue";
    import utils from "@/utils";
    import config from "~/config";
    import { helper } from "./helper";
    import { data } from "../data";
    import http from "https://example.com/module.js";
    const dynamicMod = await import("./dynamic.js");

    export { utils as default };
    export * from "./utils";
    export const value = 42;
  `;
  console.log("Example 1 - All imports and exports:");
  const statements1 = getFileImportsExports(code1);
  console.log(JSON.stringify(statements1, null, 2));

  // Example 2: Filter by path type
  console.log("\nExample 2 - Only alias imports/exports (@/ and ~/):");
  const aliasStatements = getFileImportsExports(code1, {
    pathTypes: ["alias"],
  });
  console.log(JSON.stringify(aliasStatements, null, 2));

  // Example 3: Filter by kind and limit results
  console.log("\nExample 3 - Only exports, up to 1 per path type:");
  const limitedExports = getFileImportsExports(code1, {
    kind: "export",
    pathTypes: ["relative", "alias"],
    limitPerType: 1,
  });
  console.log(JSON.stringify(limitedExports, null, 2));

  // Example 4: Complex exports and imports with comments
  const code2 = `
    // Re-export everything
    export * from "@/components";

    // Re-export with renames
    export {
      Button as CustomButton,
      Input as CustomInput,
      /* Some components
         to be renamed */
      Form as CustomForm
    } from "@/components/forms";

    // Export local declarations
    export interface Options {
      value: string;
    }
    export const VERSION = "1.0.0";

    // Import everything
    import * as utils from "./utils";

    // Mixed import with comments
    import defaultFn, {
      // Helper functions
      helper1,
      helper2 as h2,
    } from "../helpers";
  `;
  console.log("\nExample 4 - Complex exports and imports with comments:");
  const statements2 = getFileImportsExports(code2);
  console.log(JSON.stringify(statements2, null, 2));

  // Example 5: Filter only exports
  console.log("\nExample 5 - Only exports from Example 4:");
  const onlyExports = getFileImportsExports(code2, { kind: "export" });
  console.log(JSON.stringify(onlyExports, null, 2));

  // Example 6: Type imports and exports
  const code3 = `
    // Type-only export statement
    export type { ConvertImportPathsOptions } from "./impl.js";

    // Mixed type and value exports
    export {
      convertImportPaths,
      type FileResult,
      type ConvertImportExtensionsOptions,
    } from "./impl.js";

    // Type-only import statement
    import type { Config } from "./config.js";

    // Mixed type and value imports
    import {
      helper,
      type Options,
      utils,
      type Result
    } from "./utils.js";

    // Type export with rename
    export type { FileResult as FileResultType } from "./types.js";

    // Mixed export with type and value renames
    export {
      type Config as Configuration,
      utils as utilities,
      type Result as ActionResult
    } from "./utils.js";
  `;
  console.log("\nExample 6 - Type imports and exports:");
  const typeStatements = getFileImportsExports(code3);
  console.log(JSON.stringify(typeStatements, null, 2));

  // pathkit: convertImportPaths (dry run example)
  try {
    const fakeLibs = {
      "my-lib": {
        libDeclarations: true,
        libDescription: "",
        libDirName: "",
        libMainFile: "",
        libPkgKeepDeps: [],
        libTranspileMinify: false,
      },
    };
    const res = await convertImportPaths({
      baseDir: ".",
      fromType: "relative",
      toType: "alias",
      libsList: fakeLibs,
      distJsrDryRun: true,
    });
    console.log("\nconvertImportPaths (dry run):", res);
  } catch (e) {
    const msg =
      typeof e === "string"
        ? e
        : e instanceof Error
          ? e.message
          : JSON.stringify(e);
    console.log(
      "\nconvertImportPaths error (expected if not in real project):",
      msg,
    );
  }

  // pathkit: convertImportExtensionsJsToTs (dry run example)
  try {
    const res2 = await convertImportExtensionsJsToTs({
      dirPath: ".",
      distJsrDryRun: true,
    });
    console.log(
      "\nconvertImportExtensionsJsToTs (dry run):",
      res2.map((r) => ({
        filePath: r.filePath,
        message: r.message,
        success: r.success,
      })),
    );
  } catch (e) {
    const msg =
      typeof e === "string"
        ? e
        : e instanceof Error
          ? e.message
          : JSON.stringify(e);
    console.log(
      "\nconvertImportExtensionsJsToTs error (expected if not in real project):",
      msg,
    );
  }
}

await main()
  .then(() => {
    console.log("\nDone");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
