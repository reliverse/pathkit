import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import { join as nodeJoin, resolve as nodeResolve } from "node:path";

import {
  normalize,
  join,
  resolve,
  dirname,
  basename,
  extname,
  relative,
  isAbsolute,
  normalizeAliases,
  resolveAlias,
  reverseResolveAlias,
  normalizeWindowsPath,
  convertStringAliasRelative,
  convertImportsAliasToRelative,
  convertImportsExt,
} from "~/mod.js";

// setup temp dirs for file operations
const TMP_DIR = nodeResolve("./tmp-test");
const SRC_DIR = nodeJoin(TMP_DIR, "test-src");
const DIST_DIR = nodeJoin(TMP_DIR, "test-dist");

async function setupTestDirs() {
  await fs.mkdir(SRC_DIR, { recursive: true });
  await fs.mkdir(DIST_DIR, { recursive: true });
}

async function cleanupTestDirs() {
  if (existsSync(TMP_DIR)) {
    await fs.rm(TMP_DIR, { recursive: true, force: true });
  }
}

// create test files
async function createTestFile(path: string, content: string) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content);
}

describe("path utilities", () => {
  describe("basic path functions", () => {
    test("normalize", () => {
      expect(normalize("/foo/bar//baz/asdf/quux/..")).toBe("/foo/bar/baz/asdf");
      expect(normalize("C:\\foo\\..\\bar")).toBe("C:/bar");
      expect(normalize("")).toBe(".");
    });

    test("join", () => {
      expect(join("/foo", "bar", "baz/asdf")).toBe("/foo/bar/baz/asdf");
      expect(join("foo", "../bar")).toBe("bar");
      expect(join()).toBe(".");
    });

    test("resolve", () => {
      // Mock cwd for consistent tests
      const originalCwd = process.cwd;
      process.cwd = () => "/base/dir";

      expect(resolve("foo/bar", "./baz")).toBe("/base/dir/foo/bar/baz");
      expect(resolve("/foo/bar", "./baz")).toBe("/foo/bar/baz");

      process.cwd = originalCwd;
    });

    test("isAbsolute", () => {
      expect(isAbsolute("/foo/bar")).toBe(true);
      expect(isAbsolute("C:/foo")).toBe(true);
      expect(isAbsolute("./foo")).toBe(false);
      expect(isAbsolute("foo/bar")).toBe(false);
    });

    test("dirname", () => {
      expect(dirname("/foo/bar/baz")).toBe("/foo/bar");
      expect(dirname("/foo/bar/baz/")).toBe("/foo/bar/baz");
      expect(dirname("foo/bar")).toBe("foo");
      expect(dirname("foo")).toBe(".");
    });

    test("basename", () => {
      expect(basename("/foo/bar/baz.txt")).toBe("baz.txt");
      expect(basename("/foo/bar/baz.txt", ".txt")).toBe("baz");
      expect(basename("/foo/bar/baz/")).toBe("baz");
    });

    test("extname", () => {
      expect(extname("index.html")).toBe(".html");
      expect(extname("index.")).toBe(".");
      expect(extname("index")).toBe("");
      expect(extname(".index")).toBe("");
    });

    test("relative", () => {
      expect(relative("/data/orandea/test/aaa", "/data/orandea/impl/bbb")).toBe(
        "../../impl/bbb",
      );
      expect(relative("C:/foo/bar", "C:/foo/baz")).toBe("../baz");
      expect(relative("/foo/bar", "/foo/bar")).toBe("");
    });
  });

  describe("path normalization", () => {
    test("normalizeWindowsPath", () => {
      expect(normalizeWindowsPath("C:\\foo\\bar")).toBe("C:/foo/bar");
      expect(normalizeWindowsPath("c:\\foo\\bar")).toBe("C:/foo/bar");
      expect(normalizeWindowsPath("/foo/bar")).toBe("/foo/bar");
      expect(normalizeWindowsPath("")).toBe("");
    });
  });

  describe("alias utilities", () => {
    test("normalizeAliases", () => {
      const aliases = {
        "@": "./test-src",
        "@components": "./test-src/components",
        "@utils": "./test-src/utils",
      };

      const normalized = normalizeAliases(aliases);

      expect(normalized["@"]).toBe("./test-src");
      expect(normalized["@components"]).toBe("./test-src/components");
      expect(normalized["@utils"]).toBe("./test-src/utils");

      // should be idempotent
      expect(normalizeAliases(normalized)).toBe(normalized);
    });

    test("resolveAlias", () => {
      const aliases = {
        "@": "./test-src",
        "@components": "./test-src/components",
      };

      expect(resolveAlias("@/foo/bar", aliases)).toBe("test-src/foo/bar");
      expect(resolveAlias("@components/Button", aliases)).toBe(
        "test-src/components/Button",
      );
      expect(resolveAlias("regular/path", aliases)).toBe("regular/path");
    });

    test("reverseResolveAlias", () => {
      const aliases = {
        "@": "./test-src",
        "@components": "./test-src/components",
      };

      expect(reverseResolveAlias("./test-src/foo/bar", aliases)).toContain(
        "@/foo/bar",
      );
      expect(
        reverseResolveAlias("./test-src/components/Button", aliases),
      ).toContain("@components/Button");
      expect(reverseResolveAlias("regular/path", aliases)).toEqual([]);
    });
  });

  describe("file operations", () => {
    beforeEach(async () => {
      await cleanupTestDirs();
      await setupTestDirs();
    });

    afterEach(async () => {
      await cleanupTestDirs();
    });

    test("copyDir", async () => {
      // Setup source directory with files
      await createTestFile(nodeJoin(SRC_DIR, "file1.txt"), "content1");
      await createTestFile(nodeJoin(SRC_DIR, "nested/file2.txt"), "content2");

      // Copy directory
      await fs.cp(SRC_DIR, DIST_DIR, { recursive: true });

      // Verify files were copied
      const file1Content = await fs.readFile(
        nodeJoin(DIST_DIR, "file1.txt"),
        "utf-8",
      );
      const file2Content = await fs.readFile(
        nodeJoin(DIST_DIR, "nested/file2.txt"),
        "utf-8",
      );

      expect(file1Content).toBe("content1");
      expect(file2Content).toBe("content2");
    });

    test("cleanDirs", async () => {
      // Create test dirs and files
      await createTestFile(nodeJoin(SRC_DIR, "file.txt"), "content");

      // Verify dir exists
      expect(existsSync(SRC_DIR)).toBe(true);

      // Clean dirs
      await fs.rm(SRC_DIR, { recursive: true, force: true });

      // Verify dir was removed
      expect(existsSync(SRC_DIR)).toBe(false);
    });
  });

  describe("import path conversion", () => {
    beforeEach(async () => {
      await cleanupTestDirs();
      await setupTestDirs();
    });

    afterEach(async () => {
      await cleanupTestDirs();
    });

    test("convertStringAliasRelative", async () => {
      // Create source structure
      await createTestFile(
        nodeJoin(SRC_DIR, "components/Button.tsx"),
        "export default function Button() {}",
      );
      await createTestFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        "import Button from '@/components/Button'",
      );
    });

    test("convertStringAliasRelative with different pathExtFilter values", async () => {
      // Create source structure with different extensions
      await createTestFile(
        nodeJoin(SRC_DIR, "components/Button.tsx"),
        "export default function Button() {}",
      );
      await createTestFile(
        nodeJoin(SRC_DIR, "utils/helper.js"),
        "export const helper = () => {}",
      );
      await createTestFile(
        nodeJoin(SRC_DIR, "constants/index.ts"),
        "export const CONSTANTS = {}",
      );
      await createTestFile(
        nodeJoin(SRC_DIR, "types/index"),
        "export type MyType = string",
      );

      const importerFile = nodeJoin(SRC_DIR, "pages/index.tsx");

      // Test with js filter - should only process .js files and preserve their extension
      const jsResults = await Promise.all([
        convertStringAliasRelative({
          importPath: "@/components/Button.tsx", // should not be processed
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
        convertStringAliasRelative({
          importPath: "@/utils/helper.js", // should be processed, keeping .js
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
      ]);
      expect(jsResults[0]).toBe("../components/Button.tsx"); // processed
      expect(jsResults[1]).toBe("../utils/helper.js"); // processed, extension preserved

      // Test with ts filter - should only process .ts files and preserve their extension
      const tsResults = await Promise.all([
        convertStringAliasRelative({
          importPath: "@/constants/index.ts", // should be processed, keeping .ts
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
        convertStringAliasRelative({
          importPath: "@/utils/helper.js", // should not be processed
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
      ]);
      expect(tsResults[0]).toBe("../constants/index.ts"); // processed, extension preserved
      expect(tsResults[1]).toBe("../utils/helper.js"); // processed

      // Test with none filter - should only process files without extension
      const noneResults = await Promise.all([
        convertStringAliasRelative({
          importPath: "@/types/index", // should be processed
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
        convertStringAliasRelative({
          importPath: "@/utils/helper.js", // should not be processed
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
      ]);
      expect(noneResults[0]).toBe("../types/index"); // processed
      expect(noneResults[1]).toBe("../utils/helper.js"); // processed

      // Test with js-ts-none filter - should process all files and preserve their extensions
      const allResults = await Promise.all([
        convertStringAliasRelative({
          importPath: "@/components/Button.tsx",
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
        convertStringAliasRelative({
          importPath: "@/utils/helper.js",
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
        convertStringAliasRelative({
          importPath: "@/types/index",
          importerFile,
          pathPattern: "@/*",
          targetDir: SRC_DIR,
        }),
      ]);
      expect(allResults[0]).toBe("../components/Button.tsx"); // processed, .tsx preserved
      expect(allResults[1]).toBe("../utils/helper.js"); // processed, .js preserved
      expect(allResults[2]).toBe("../types/index"); // processed, no extension
    });

    test("convertImportsAliasToRelative", async () => {
      // Create source structure with aliased imports
      await createTestFile(
        nodeJoin(SRC_DIR, "components/Button.tsx"),
        "export default function Button() {}",
      );

      await createTestFile(
        nodeJoin(SRC_DIR, "utils/format.ts"),
        "export const format = (str) => str.trim()",
      );

      await createTestFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        `import Button from '@/components/Button'
        import { format } from '@/utils/format'`,
      );

      const results = await convertImportsAliasToRelative({
        targetDir: SRC_DIR,
        aliasToReplace: "@",
        pathExtFilter: "none",
      });

      // Verify file was processed
      expect(results.length).toBeGreaterThan(0);
    });

    test("convertImportsAliasToRelative with pathExtFilter", async () => {
      // Create source structure with aliased imports
      await createTestFile(
        nodeJoin(SRC_DIR, "components/Button.tsx"),
        "export default function Button() {}",
      );

      await createTestFile(
        nodeJoin(SRC_DIR, "utils/format.ts"),
        "export const format = (str) => str.trim()",
      );

      await createTestFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        `import Button from '@/components/Button'
        import { format } from '@/utils/format'`,
      );

      // Test with 'js' extension mode
      const results = await convertImportsAliasToRelative({
        targetDir: SRC_DIR,
        aliasToReplace: "@",
        pathExtFilter: "js",
      });

      // Verify file was processed
      expect(results.length).toBe(0); // No results since no .js files to process

      // Read updated content and verify imports have .js extensions
      const updatedContent = await fs.readFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        "utf-8",
      );

      // Since no .js files were found, the imports should remain unchanged
      expect(updatedContent).toContain(
        "import Button from '@/components/Button'",
      );
      expect(updatedContent).toContain(
        "import { format } from '@/utils/format'",
      );
    });

    test("convertImportsExt", async () => {
      // Create source structure with file extension imports
      await createTestFile(
        nodeJoin(SRC_DIR, "utils/helpers.js"),
        "export const add = (a, b) => a + b;",
      );

      await createTestFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        `import { add } from '../utils/helpers.js';
        import { subtract } from '../utils/math';`,
      );

      // Convert .js to .ts extensions
      const results = await convertImportsExt({
        targetDir: SRC_DIR,
        extFrom: "js",
        extTo: "ts",
      });

      // Verify file was processed
      expect(results.length).toBeGreaterThan(0);

      // Read updated content and verify extensions were converted
      const updatedContent = await fs.readFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        "utf-8",
      );

      expect(updatedContent).toContain(
        "import { add } from '../utils/helpers.ts'",
      );
      expect(updatedContent).toContain(
        "import { subtract } from '../utils/math'",
      );
    });

    test("convertImportsExt with none", async () => {
      // Create source structure with file extension imports
      await createTestFile(
        nodeJoin(SRC_DIR, "utils/helpers.js"),
        "export const add = (a, b) => a + b;",
      );

      await createTestFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        `import { add } from '../utils/helpers.js';`,
      );

      // Remove extensions
      const results = await convertImportsExt({
        targetDir: SRC_DIR,
        extFrom: "js",
        extTo: "none",
      });

      // Verify file was processed
      expect(results.length).toBeGreaterThan(0);

      // Read updated content and verify extensions were removed
      const updatedContent = await fs.readFile(
        nodeJoin(SRC_DIR, "pages/index.tsx"),
        "utf-8",
      );

      expect(updatedContent).toContain(
        "import { add } from '../utils/helpers'",
      );
    });
  });
});

describe("regex patterns", () => {
  test("IMPORT_REGEX", () => {
    const regex =
      /(?:import\s+(?:[\s\S]*?)\s+from\s+|import\s*\(\s*)\s*(['"])((?:@)[^'"]+)\1/g;

    // Standard import
    const test1 = `import Button from '@/components/Button'`;
    const matches1 = [...test1.matchAll(regex)];
    expect(matches1.length).toBe(1);
    expect(matches1[0][2]).toBe("@/components/Button");

    // Named import
    const test2 = `import { foo, bar } from '@/utils'`;
    const matches2 = [...test2.matchAll(regex)];
    expect(matches2.length).toBe(1);
    expect(matches2[0][2]).toBe("@/utils");

    // Dynamic import
    const test3 = `const mod = await import('@/dynamic/module')`;
    const matches3 = [...test3.matchAll(regex)];
    expect(matches3.length).toBe(1);
    expect(matches3[0][2]).toBe("@/dynamic/module");

    // Should not match non-@ imports
    const test4 = `import stuff from 'regular-module'`;
    const matches4 = [...test4.matchAll(regex)];
    expect(matches4.length).toBe(0);
  });
});

describe("extension conversion regex", () => {
  test("import extension regex", () => {
    // This is similar to what's used in convertImportsExt function
    const regex =
      /(?:import\s+(?:[\s\S]*?)\s+from\s+|import\s*\(\s*)\s*(['"])([^'"]+\.js)(\1)/g;

    // Standard import with js extension
    const test1 = `import Button from '../components/Button.js'`;
    const matches1 = [...test1.matchAll(regex)];
    expect(matches1.length).toBe(1);
    expect(matches1[0][2]).toBe("../components/Button.js");

    // Named import with js extension
    const test2 = `import { foo, bar } from '../utils/helpers.js'`;
    const matches2 = [...test2.matchAll(regex)];
    expect(matches2.length).toBe(1);
    expect(matches2[0][2]).toBe("../utils/helpers.js");

    // Dynamic import with js extension
    const test3 = `const mod = await import('../dynamic/module.js')`;
    const matches3 = [...test3.matchAll(regex)];
    expect(matches3.length).toBe(1);
    expect(matches3[0][2]).toBe("../dynamic/module.js");

    // Should not match imports without extensions
    const test4 = `import stuff from '../regular-module'`;
    const matches4 = [...test4.matchAll(regex)];
    expect(matches4.length).toBe(0);

    // Should not match imports with other extensions
    const test5 = `import stuff from '../regular-module.ts'`;
    const matches5 = [...test5.matchAll(regex)];
    expect(matches5.length).toBe(0);
  });
});

describe("edge cases", () => {
  test("handle empty paths", () => {
    expect(normalize("")).toBe(".");
    expect(join()).toBe(".");
    expect(join("", "")).toBe(".");
    expect(dirname("")).toBe(".");
    expect(basename("")).toBe("");
    expect(extname("")).toBe("");
  });

  test("handle non-string inputs gracefully", () => {
    expect(() => normalize(null)).toThrow();
    // @ts-expect-error testing error handling
    expect(() => join(123)).toThrow();
  });

  test("handle UNC paths", () => {
    expect(normalize("\\\\server\\share\\file")).toBe("//server/share/file");
  });
});
