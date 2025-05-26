// types for import/export analysis
export interface ImportExportSpecifier {
  type: "named" | "default" | "namespace" | "all";
  name: string;
  alias?: string;
  isType?: boolean;
}

export interface ImportExportInfo {
  statement: string;
  type: "static" | "dynamic";
  kind: "import" | "export";
  source?: string;
  pathType?: "alias" | "relative" | "absolute" | "bare" | "module";
  pathTypeSymbol?: string;
  isTypeOnly?: boolean;
  specifiers?: ImportExportSpecifier[];
  start: number;
  end: number;
}

export interface GetFileImportsExportsOptions {
  kind?: "import" | "export" | "all";
  pathTypes?: ("alias" | "relative" | "absolute" | "bare" | "module")[];
  limitPerType?: number;
}

/**
 * analyzes a file's content to extract import and export statements
 */
export function getFileImportsExports(
  content: string,
  options: GetFileImportsExportsOptions = {},
): ImportExportInfo[] {
  const {
    kind = "all",
    pathTypes = ["alias", "relative", "absolute", "bare", "module"],
    limitPerType,
  } = options;

  const results: ImportExportInfo[] = [];

  // regex patterns for different import/export types
  const patterns = {
    // import statements with from clause
    staticImport:
      /import\s+(?:type\s+)?(?:(?:\w+)(?:\s*,\s*)?)?(?:\{[^}]*\}|\*\s+as\s+\w+)?\s+from\s+['"]([^'"]+)['"]|import\s+(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g,
    // dynamic imports
    dynamicImport: /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // export statements with from clause
    staticExport:
      /export\s+(?:type\s+)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g,
    // default exports without from
    defaultExport:
      /export\s+default\s+(?:\w+|\{[^}]*\}|class\s+\w+|function\s+\w+)/g,
    // named exports without from
    namedExport:
      /export\s+(?:const|let|var|function|class|enum|interface|type)\s+(\w+)/g,
  };

  // helper to determine path type
  function getPathType(path: string): ImportExportInfo["pathType"] {
    if (path.startsWith(".")) return "relative";
    if (path.startsWith("/")) return "absolute";
    if (path.startsWith("@") || path.startsWith("~")) return "alias";
    if (path.startsWith("http://") || path.startsWith("https://"))
      return "module";
    return "bare";
  }

  // helper to extract specifiers from import/export statements
  function extractSpecifiers(statement: string): ImportExportSpecifier[] {
    const specifiers: ImportExportSpecifier[] = [];
    const isTypeOnly =
      statement.includes("import type") || statement.includes("export type");

    // handle namespace imports/exports (import * as name / export * as name)
    const namespaceMatch =
      /(?:import|export)\s+(?:type\s+)?\*\s+as\s+(\w+)/.exec(statement);
    if (namespaceMatch?.[1]) {
      specifiers.push({
        type: "namespace",
        name: namespaceMatch[1],
        isType: isTypeOnly,
      });
      return specifiers;
    }

    // handle default imports (import name from ...)
    const defaultMatch = /import\s+(?:type\s+)?(\w+)(?:\s*,|\s+from)/.exec(
      statement,
    );
    if (defaultMatch?.[1] && !statement.includes("{")) {
      specifiers.push({
        type: "default",
        name: defaultMatch[1],
        isType: isTypeOnly,
      });
    }

    // handle named imports/exports
    const namedMatch = /{([^}]*)}/.exec(statement);
    if (namedMatch?.[1]) {
      const items = namedMatch[1]
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const item of items) {
        const typeMatch = /^type\s+(.+)/.exec(item);
        const actualItem = typeMatch ? typeMatch[1] : item;
        if (!actualItem) continue;

        const isItemType = !!typeMatch || isTypeOnly;

        if (actualItem.includes(" as ")) {
          const [name, alias] = actualItem.split(" as ").map((p) => p.trim());
          if (!name) continue;

          specifiers.push({
            type: "named",
            name,
            alias,
            isType: isItemType,
          });
        } else {
          specifiers.push({
            type: "named",
            name: actualItem,
            isType: isItemType,
          });
        }
      }
    }

    return specifiers;
  }

  // process static imports
  if (kind === "import" || kind === "all") {
    const importMatches = [...content.matchAll(patterns.staticImport)];

    for (const match of importMatches) {
      // handle both patterns in staticImport regex
      const source = match[1] || match[3];
      if (!source) continue;

      const pathType = getPathType(source);
      if (!pathType || !pathTypes.includes(pathType)) continue;

      const info: ImportExportInfo = {
        statement: match[0],
        type: "static",
        kind: "import",
        source,
        pathType,
        pathTypeSymbol:
          pathType === "alias" ? /^[@~]/.exec(source)?.[0] : undefined,
        isTypeOnly: match[0].includes("import type"),
        specifiers: extractSpecifiers(match[0]),
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      };

      results.push(info);
    }

    // process dynamic imports
    const dynamicMatches = [...content.matchAll(patterns.dynamicImport)];
    for (const match of dynamicMatches) {
      const source = match[1];
      if (!source) continue;

      const pathType = getPathType(source);
      if (!pathType || !pathTypes.includes(pathType)) continue;

      const info: ImportExportInfo = {
        statement: match[0],
        type: "dynamic",
        kind: "import",
        source,
        pathType,
        pathTypeSymbol:
          pathType === "alias" ? /^[@~]/.exec(source)?.[0] : undefined,
        isTypeOnly: false,
        specifiers: [],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      };

      results.push(info);
    }
  }

  // process exports
  if (kind === "export" || kind === "all") {
    // exports with from clause
    const exportMatches = [...content.matchAll(patterns.staticExport)];
    for (const match of exportMatches) {
      const source = match[1];
      if (!source) continue;

      const pathType = getPathType(source);
      if (!pathType || !pathTypes.includes(pathType)) continue;

      const info: ImportExportInfo = {
        statement: match[0],
        type: "static",
        kind: "export",
        source,
        pathType,
        pathTypeSymbol:
          pathType === "alias" ? /^[@~]/.exec(source)?.[0] : undefined,
        isTypeOnly: match[0].includes("export type"),
        specifiers: extractSpecifiers(match[0]),
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
      };

      results.push(info);
    }

    // default exports (without from)
    const defaultMatches = [...content.matchAll(patterns.defaultExport)];
    for (const match of defaultMatches) {
      const info: ImportExportInfo = {
        statement: match[0],
        type: "static",
        kind: "export",
        source: undefined,
        pathType: undefined,
        pathTypeSymbol: undefined,
        isTypeOnly: false,
        specifiers: [{ type: "default", name: "default" }],
        start: match.index,
        end: match.index + match[0].length,
      };

      results.push(info);
    }

    // named exports (without from)
    const namedMatches = [...content.matchAll(patterns.namedExport)];
    for (const match of namedMatches) {
      const name = match[1];
      if (!name) continue;

      const info: ImportExportInfo = {
        statement: match[0],
        type: "static",
        kind: "export",
        source: undefined,
        pathType: undefined,
        pathTypeSymbol: undefined,
        isTypeOnly: match[0].includes("export type"),
        specifiers: [{ type: "named", name }],
        start: match.index,
        end: match.index + match[0].length,
      };

      results.push(info);
    }
  }

  // apply limit per type if specified
  if (limitPerType) {
    const groupedByType = results.reduce<Record<string, ImportExportInfo[]>>(
      (acc, curr) => {
        const key = `${curr.kind}-${curr.pathType || "none"}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
      },
      {},
    );

    return Object.values(groupedByType).flatMap((group) =>
      group.slice(0, limitPerType),
    );
  }

  return results;
}
