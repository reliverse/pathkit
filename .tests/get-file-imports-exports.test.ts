// getFileImportsExports.test.ts

import { expect, test, describe } from "bun:test";

import { getFileImportsExports } from "~/mod.js";

describe("import/export analysis", () => {
  test("getFileImportsExports basic functionality", () => {
    const content = `
      import { Button } from './components/Button';
      import type { Props } from './types';
      import * as utils from '@/utils';
      import defaultExport from '/absolute/path';
      export { default as MyComponent } from './MyComponent';
      export const foo = 'bar';
      export default function App() {}
    `;

    const analysis = getFileImportsExports(content);

    // test basic counts
    expect(analysis.length).toBe(7);

    // test import types
    const imports = analysis.filter((i) => i.kind === "import");
    expect(imports.length).toBe(4);

    // test export types
    const exports = analysis.filter((i) => i.kind === "export");
    expect(exports.length).toBe(3);

    // test path types (only for imports/exports with sources)
    const withSources = analysis.filter((i) => i.source);
    const relativePaths = withSources.filter((i) => i.pathType === "relative");
    expect(relativePaths.length).toBe(3);

    const aliasPaths = withSources.filter((i) => i.pathType === "alias");
    expect(aliasPaths.length).toBe(1);

    const absolutePaths = withSources.filter((i) => i.pathType === "absolute");
    expect(absolutePaths.length).toBe(1);
  });

  test("getFileImportsExports specifier extraction", () => {
    const content = `
      import { Button, Text as Label } from './components';
      import * as utils from '@/utils';
      import defaultExport from './default';
    `;

    const analysis = getFileImportsExports(content);

    // test named imports with aliases
    const namedImport = analysis.find(
      (i) =>
        i.source === "./components" &&
        i.specifiers?.some((s) => s.type === "named"),
    );
    expect(namedImport?.specifiers).toContainEqual(
      expect.objectContaining({ type: "named", name: "Button" }),
    );
    expect(namedImport?.specifiers).toContainEqual(
      expect.objectContaining({ type: "named", name: "Text", alias: "Label" }),
    );

    // test namespace import
    const namespaceImport = analysis.find(
      (i) =>
        i.source === "@/utils" &&
        i.specifiers?.some((s) => s.type === "namespace"),
    );
    expect(namespaceImport?.specifiers).toContainEqual(
      expect.objectContaining({ type: "namespace", name: "utils" }),
    );

    // test default import
    const defaultImport = analysis.find(
      (i) =>
        i.source === "./default" &&
        i.specifiers?.some((s) => s.type === "default"),
    );
    expect(defaultImport?.specifiers).toContainEqual(
      expect.objectContaining({ type: "default", name: "defaultExport" }),
    );
  });

  test("getFileImportsExports type-only imports", () => {
    const content = `
      import type { Props } from './types';
      import { type Component, Button } from './components';
      import type * as Types from './all-types';
    `;

    const analysis = getFileImportsExports(content);

    // find type-only imports
    const typeOnlyImports = analysis.filter((i) => i.isTypeOnly);
    expect(typeOnlyImports.length).toBe(2); // first and third imports

    // find mixed import
    const mixedImport = analysis.find((i) => i.source === "./components");
    expect(mixedImport?.isTypeOnly).toBe(false);

    // verify individual specifiers
    const componentSpec = mixedImport?.specifiers?.find(
      (s) => s.name === "Component",
    );
    expect(componentSpec?.isType).toBe(true);

    const buttonSpec = mixedImport?.specifiers?.find(
      (s) => s.name === "Button",
    );
    expect(buttonSpec?.isType).toBe(false);
  });
});
