import type { SourceMap } from "magic-string";

import { readFile, writeFile, readdir, stat } from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import rematch from "@reliverse/rematch";
import MagicString from "magic-string";
import path from "node:path";
import { normalize } from "node:path";
import pMap from "p-map";

// ========================================
// Types
// ========================================

// ========================================
// Type Definitions
// ========================================

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when publishing multiple packages from a single repository.
 *
 * Deprecated: Will be removed coming soon.
 */
export interface LibConfigDeprecated {
  /**
   * When `true`, generates TypeScript declaration files (.d.ts) for NPM packages.
   */
  libDeclarations: boolean;

  /**
   * An optional description of the library, included in the dist's package.json.
   * Provides users with an overview of the library's purpose.
   *
   * @example "Utility functions for data manipulation"
   * @example "Core configuration module for the framework"
   *
   * @default `package.json`'s "description"
   */
  libDescription: string;

  /**
   * The directory where the library's dist files are stored.
   *
   * @default name is derived from the library's name after slash
   */
  libDirName: string;

  /**
   * The path to the library's main entry file.
   * This file serves as the primary entry point for imports.
   * The path should be relative to the project root.
   * The full path to the library's main file is derived by joining `libsDirDist` with `main`.
   *
   * @example "my-lib-1/mod.ts"
   * @example "my-lib-2/ml2-mod.ts"
   * @example "src/libs/my-lib-3/index.js"
   */
  libMainFile: string;

  /**
   * Dependencies to include in the dist's package.json.
   * The final output may vary based on `rmDepsMode` and `rmDepsPatterns`.
   * Defines how dependencies are handled during publishing:
   * - `string[]`: Includes only the specified dependencies.
   * - `true`: Includes all dependencies from the main package.json.
   * - `false` or `undefined`: Automatically determines dependencies based on imports.
   *
   * @example ["@reliverse/pathkit", "@reliverse/relifso"] - Only include these specific dependencies.
   * @example true - Include all `dependencies` from the main package.json.
   */
  libPkgKeepDeps: boolean | string[];

  /**
   * When `true`, minifies the output to reduce bundle size.
   * Recommended for production builds but may increase build time.
   *
   * @default true
   */
  libTranspileMinify: boolean;

  /**
   * When true, pauses publishing for this specific library (overridden by commonPubPause).
   * If true, this library will be built but not published, even if other libs are published.
   *
   * @default false
   */
  libPubPause?: boolean;

  /**
   * The registry to publish the library to.
   *
   * @default "npm"
   */
  libPubRegistry?: "jsr" | "npm" | "npm-jsr";
}

/** Configuration options contextualizing a path conversion operation. */
export interface ConversionOptions {
  aliasPrefix: string; // The alias prefix (e.g., "~/") - normalized to end with '/'
  baseDir: string; // The base directory for resolving aliases or relative paths (absolute path)
  currentLibName?: string; // The name of the library the source file belongs to (for avoiding self-imports)
  libsList: Record<string, LibConfigDeprecated>; // Map of library names to their configurations
  sourceFile: string; // The full path to the file being processed
  urlMap: Record<string, string>; // Map of bare import URLs to local paths
  strip: string[]; // Array of path segments to remove from the start of converted paths
}

/** Function signature for a specific path conversion (e.g., absolute to relative). */
export type ConverterFunction = (
  importPath: string,
  opts: ConversionOptions,
) => string;

/** Represents the type classification of an import path. */
export type ImportType =
  | "absolute" // Path starting with '/' or drive letter
  | "alias" // Path starting with the configured alias prefix
  | "bare" // Package name or URL (http/https)
  | "dynamic" // The path string *inside* an `import()` call
  | "module" // A reference (typically package name) to another library within the monorepo (defined in libsList)
  | "relative"; // Path starting with './' or '../'

/** String literal representing a specific conversion pair (e.g., "relative:alias"). */
export type ConversionPair = `${ImportType}:${ImportType}`;

/** Represents the result of processing a single file. */
export interface FileResult {
  filePath: string; // Path of the processed file
  message: string; // Status message (e.g., "Processed", "No changes", error details)
  success: boolean; // Indicates if processing completed without errors
}

/** Options for the `convertImportPaths` function. */
export interface ConvertImportPathsOptions {
  baseDir: string; // Directory to process files within
  fromType: ImportType; // The type of import paths to convert from
  toType: ImportType; // The type to convert import paths to
  libsList: Record<string, LibConfigDeprecated>; // Required for module/bare conversions involving local packages
  aliasPrefix?: string; // Required if fromType or toType is 'alias'
  currentLibName?: string; // Optional: Context for 'module' conversion to avoid self-references
  distJsrDryRun?: boolean; // If true, performs all checks but doesn't write changes
  fileExtensions?: string[]; // File extensions to process (defaults to JS/TS(X))
  generateSourceMap?: boolean; // If true, generates .map files alongside modified files
  strip?: string[]; // Path segments to remove from the beginning of converted paths
  urlMap?: Record<string, string>; // Map for converting bare URL imports to local paths
}

/** Options for the `convertImportExtensionsJsToTs` function. */
export interface ConvertImportExtensionsOptions {
  dirPath: string; // Directory to process files within
  distJsrDryRun?: boolean; // If true, performs all checks but doesn't write changes
  fileExtensions?: string[]; // File extensions to process (defaults to JS/TS(X))
  generateSourceMap?: boolean; // If true, generates .map files alongside modified files
}

/** Options for internal file content processing. */
export interface ProcessFileContentOptions {
  distJsrDryRun?: boolean;
  generateSourceMap?: boolean;
}

/**
 * Options for filtering import statements
 */
export interface GetFileImportsOptions {
  /** Limit results to specific import path types */
  pathTypes?: ImportType[];
  /** Maximum number of results to return for each specified path type */
  limitPerType?: number;
}

/**
 * Result of path type analysis
 */
export interface PathTypeInfo {
  type: ImportType;
  symbol: string | null;
}

/**
 * Represents a single import or export statement with detailed information
 */
export interface ImportExportInfo {
  /** The full original import/export statement */
  statement: string;
  /** The type of statement */
  type: "static" | "dynamic" | "export";
  /** The kind of statement */
  kind: "import" | "export";
  /** The source path/package being imported from or exported to (if any) */
  source?: string;
  /** The type of the path (if source exists) */
  pathType?: ImportType;
  /** The specific symbol used in the path (e.g., '@/', '~/', './', '../', null for bare/module imports) */
  pathTypeSymbol?: string | null;
  /** The imported/exported items */
  specifiers?: {
    /** The type of specifier */
    type: "named" | "default" | "namespace" | "all";
    /** The original name being imported/exported */
    name: string;
    /** The local alias if renamed, otherwise same as name */
    alias?: string;
    /** Whether this is a type import/export */
    isType?: boolean;
  }[];
  /** Whether this is a type-only import/export statement */
  isTypeOnly?: boolean;
  /** Start position in the source code */
  start: number;
  /** End position in the source code */
  end: number;
}

/**
 * Options for filtering import/export statements
 */
export interface GetFileImportsExportsOptions {
  /** Limit results to specific import path types */
  pathTypes?: ImportType[];
  /** Maximum number of results to return for each specified path type */
  limitPerType?: number;
  /** Filter by statement kind */
  kind?: "import" | "export" | "all";
}

// ========================================
// Constants
// ========================================

const CONCURRENCY_DEFAULT = 5;

const DEBUG_MODE = false; // Toggles verbose logging for debugging path conversions
const CWD = process.cwd(); // Cache current working directory

// Regular expressions for finding import/export statements
const STATIC_IMPORT_REGEX =
  /(import|export)(?:\s+type)?[\s\n]*(?:(?:\{[^}]*\}|\*\s+as\s+[^,\s]+|[^\s,]+(?:\s+as\s+[^\s,]+)?(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[^,\s]+|[^\s,]+(?:\s+as\s+[^\s,]+)?))*)[\s\n]*from\s+)?(['"])((?:(?!\2).|\\\2)*)\2/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

// Default file extensions to process if not specified
const DEFAULT_FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// ========================================
// Helper Functions & Utilities
// ========================================

/**
 * Extracts the package name (or scoped package name) from a potential bare import path.
 * Returns null if the path is relative, absolute, or empty.
 * @param importPath - The import path string.
 * @returns The package name (e.g., "react", "@scope/pkg") or null.
 */
export function extractPackageName(
  importPath: string | undefined,
): null | string {
  if (!importPath || importPath.startsWith(".") || importPath.startsWith("/")) {
    return null;
  }
  // Match 'package', '@scope/package'
  const match = /^(@[^/]+\/[^/]+|[^/]+)/.exec(importPath);
  return match ? match[0] : null;
}

/**
 * Ensures an alias prefix ends with a forward slash.
 * @param prefix - The alias prefix (e.g., "~", "~/").
 * @returns The normalized alias prefix (e.g., "~/").
 */
// function normalizeAliasPrefix(prefix: string): string {
//   return prefix.endsWith("/") ? prefix : `${prefix}/`;
// }

/**
 * Extracts a bare import URL (http/https) from an import statement string or path.
 * @param importStr - The string containing the potential URL (e.g., full import statement or just the path).
 * @param requireFromKeyword - If true, specifically looks for `from "http..."`. Otherwise, just finds `"http..."`.
 * @returns The extracted URL or null if not found.
 */
function getBareImportUrl(
  importStr: string,
  requireFromKeyword = false,
): null | string {
  // Regex targets 'http://...' or 'https://...' inside quotes.
  // If requireFromKeyword is true, it must be preceded by 'from'.
  const regex = requireFromKeyword
    ? /from\s+(['"])(https?:\/\/[^'"]+)\1/
    : /(['"])(https?:\/\/[^'"]+)\1/;
  const match = regex.exec(importStr);
  return match?.[2] ?? null; // Group 2 captures the URL itself
}

/**
 * Checks if a given path (relative to CWD) likely belongs to a specific library,
 * excluding the library the current file belongs to.
 * @param relativePathToRoot - Path relative to the project root (CWD), using forward slashes.
 * @param libName - The name of the library to check against.
 * @param libConfigDeprecated - Configuration of the library being checked.
 * @param currentLibName - The name of the library containing the file being processed (optional).
 * @returns True if the path seems to belong to the specified library (and is not the current library).
 */
function isLibraryImport(
  relativePathToRoot: string,
  libName: string,
  libConfigDeprecated: LibConfigDeprecated,
  currentLibName?: string,
): boolean {
  // Avoid classifying an import as belonging to the library it's already in.
  if (currentLibName && libName === currentLibName) {
    return false;
  }

  // Determine the directory containing the library's main file, relative to CWD.
  // Use forward slashes for consistent comparison.
  const libMainDir = path
    .dirname(libConfigDeprecated.libMainFile)
    .replace(/\\/g, "/");

  // Check if the import path starts with the library's directory path.
  return relativePathToRoot.startsWith(`${libMainDir}/`);
}

/**
 * Tries to match a path (relative to project root) to a library defined in libsList.
 * @param relativeToRoot - Path relative to the project root (CWD), using forward slashes.
 * @param libsList - Map of library names to their configurations.
 * @param currentLibName - The name of the library containing the file being processed (optional).
 * @returns The name of the matched library, or null if no match.
 */
function matchLibraryImport(
  relativeToRoot: string,
  libsList: Record<string, LibConfigDeprecated>,
  currentLibName?: string,
): null | string {
  for (const [libName, libConfigDeprecated] of Object.entries(libsList)) {
    // Ensure the library has a defined main file before checking.
    if (
      libConfigDeprecated?.libMainFile &&
      isLibraryImport(
        relativeToRoot,
        libName,
        libConfigDeprecated,
        currentLibName,
      )
    ) {
      return libName; // Return the name of the first matching library.
    }
  }
  return null; // No matching library found.
}

/**
 * Replaces a trailing ".js" extension with ".ts" in an import path.
 * @param importPath - The import path string.
 * @returns The path with the extension replaced, or the original path.
 */
function replaceJsExtension(importPath: string): string {
  if (importPath.endsWith(".js")) {
    return `${importPath.slice(0, -3)}.ts`;
  }
  // Example: Add support for JSX -> TSX
  // if (importPath.endsWith(".jsx")) {
  //   return `${importPath.slice(0, -4)}.tsx`;
  // }
  return importPath;
}

// ========================================
// Core Path Conversion Logic
// ========================================

// --- Conversion Implementations ---
// Each function converts *from* a specific type *to* another.
// They receive the import path and the full ConversionOptions context.

// Absolute -> *
function convertAbsoluteToAlias(ip: string, opts: ConversionOptions): string {
  const relativePath = path.relative(opts.baseDir, ip).replace(/\\/g, "/");
  return `${opts.aliasPrefix}${relativePath}`;
}
function convertAbsoluteToBare(ip: string): string {
  relinka(
    "warn",
    `Ambiguous conversion: absolute:bare for ${ip}. Using path relative to CWD.`,
  );
  return path.relative(CWD, ip).replace(/\\/g, "/");
}
function convertAbsoluteToModule(ip: string, opts: ConversionOptions): string {
  const relativeToRoot = path.relative(CWD, ip).replace(/\\/g, "/");
  const libName = matchLibraryImport(
    relativeToRoot,
    opts.libsList,
    opts.currentLibName,
  );
  if (libName) {
    relinka("verbose", `Converted absolute ${ip} to module ${libName}`);
    return libName; // Return the library name
  }
  return ip; // No match, return original
}
function convertAbsoluteToRelative(
  ip: string,
  opts: ConversionOptions,
): string {
  let relativePath = path
    .relative(path.dirname(opts.sourceFile), ip)
    .replace(/\\/g, "/");
  // Ensure relative paths start with './' or '../'
  if (!relativePath.startsWith(".") && !path.isAbsolute(relativePath)) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
}

// Alias -> *
function convertAliasToAbsolute(ip: string, opts: ConversionOptions): string {
  if (!ip.startsWith(opts.aliasPrefix)) return ip;
  const subPath = ip.slice(opts.aliasPrefix.length);

  // First, resolve the path relative to baseDir
  const absolutePath = path.resolve(opts.baseDir, subPath);

  // If we're in a new output directory (e.g., dist), we need to preserve the directory structure
  const sourceFileRelativeToBase = path.relative(opts.baseDir, opts.sourceFile);
  if (sourceFileRelativeToBase) {
    // Get the new base directory by walking up the directory structure
    let newBaseDir = path.dirname(opts.sourceFile);
    const sourceFileParts = sourceFileRelativeToBase.split(/[\\/]/);
    // Walk up the same number of directories as the original relative path had segments
    // minus 1 to account for the filename itself
    for (let i = 0; i < sourceFileParts.length - 1; i++) {
      newBaseDir = path.dirname(newBaseDir);
    }

    // Extract the relative path from the original alias path
    const relativeToBase = subPath.split("/").filter(Boolean);

    // Reconstruct the path in the new location
    return path.resolve(newBaseDir, ...relativeToBase);
  }

  return absolutePath;
}
function convertAliasToBare(ip: string, opts: ConversionOptions): string {
  // "bare" means relative to CWD.
  if (!ip.startsWith(opts.aliasPrefix)) return ip;
  const absolutePath = convertAliasToAbsolute(ip, opts);
  return convertAbsoluteToBare(absolutePath);
}
function convertAliasToModule(ip: string, opts: ConversionOptions): string {
  if (!ip.startsWith(opts.aliasPrefix)) return ip;
  const absolutePath = convertAliasToAbsolute(ip, opts);
  return convertAbsoluteToModule(absolutePath, opts);
}
function convertAliasToRelative(ip: string, opts: ConversionOptions): string {
  if (!ip.startsWith(opts.aliasPrefix)) return ip;
  const absolutePath = convertAliasToAbsolute(ip, opts);
  return convertAbsoluteToRelative(absolutePath, opts);
}

// Bare -> * (Package names or URLs)
function convertBareToAbsolute(ip: string, opts: ConversionOptions): string {
  const url = getBareImportUrl(ip);
  if (url && opts.urlMap[url]) {
    // Handle URL imports via urlMap
    const localPath = opts.urlMap[url];
    relinka("verbose", `Mapping URL ${url} to local path ${localPath}`);
    return path.resolve(CWD, localPath);
  }

  const packageName = extractPackageName(ip);
  const libConfigDeprecated = packageName
    ? opts.libsList[packageName]
    : undefined;
  if (libConfigDeprecated?.libMainFile) {
    // Handle package name imports via libsList (maps to the library's main file)
    const libEntryPoint = path.resolve(CWD, libConfigDeprecated.libMainFile);
    relinka(
      "verbose",
      `Mapping package ${packageName} to absolute path ${libEntryPoint}`,
    );
    return libEntryPoint;
  }

  relinka(
    "verbose",
    `Cannot convert bare import to absolute: ${ip}. No mapping found.`,
  );
  return ip; // Return original if no mapping found
}
function convertBareToAlias(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertBareToAbsolute(ip, opts);
  if (absolutePath !== ip) {
    return convertAbsoluteToAlias(absolutePath, opts);
  }
  return ip; // Return original if bare wasn't converted
}
// Note: bare:dynamic conversion is handled specially within transformImportPathsLogic
function convertBareToDynamic(ip: string): string {
  relinka(
    "warn",
    "bare:dynamic conversion requires special handling of the full import statement.",
  );
  return ip; // Actual logic is in transformImportPathsLogic
}
function convertBareToModule(ip: string, opts: ConversionOptions): string {
  const url = getBareImportUrl(ip);
  if (url && opts.urlMap[url]) {
    // If URL maps to a local path, check if that path belongs to a module
    const localPath = opts.urlMap[url];
    const absolutePath = path.resolve(CWD, localPath);
    return convertAbsoluteToModule(absolutePath, opts);
  }

  const packageName = extractPackageName(ip);
  if (packageName && opts.libsList[packageName]) {
    // If the bare import is already a known library name, it *is* the module name.
    relinka("verbose", `Bare import ${packageName} is already a module.`);
    return packageName;
  }

  return ip; // Return original if no mapping or not a module
}
function convertBareToRelative(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertBareToAbsolute(ip, opts);
  if (absolutePath !== ip) {
    return convertAbsoluteToRelative(absolutePath, opts);
  }
  return ip; // Return original if bare wasn't converted
}

// Dynamic -> * (Path inside import())
function convertDynamicToAbsolute(ip: string, opts: ConversionOptions): string {
  // The path inside import() is relative to the source file.
  return path.resolve(path.dirname(opts.sourceFile), ip);
}
function convertDynamicToAlias(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertDynamicToAbsolute(ip, opts);
  return convertAbsoluteToAlias(absolutePath, opts);
}
function convertDynamicToBare(ip: string, opts: ConversionOptions): string {
  // "bare" means relative to CWD.
  const absolutePath = convertDynamicToAbsolute(ip, opts);
  return convertAbsoluteToBare(absolutePath);
}
function convertDynamicToModule(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertDynamicToAbsolute(ip, opts);
  return convertAbsoluteToModule(absolutePath, opts);
}
function convertDynamicToRelative(ip: string, opts: ConversionOptions): string {
  // Ensures the path is correctly formatted as relative, even if already relative.
  const absolutePath = convertDynamicToAbsolute(ip, opts);
  return convertAbsoluteToRelative(absolutePath, opts);
}

// Module -> * (Library name from libsList)
function convertModuleToAbsolute(ip: string, opts: ConversionOptions): string {
  const packageName = extractPackageName(ip); // Module name acts like a package name
  const libConfigDeprecated = packageName
    ? opts.libsList[packageName]
    : undefined;
  if (!libConfigDeprecated?.libMainFile) return ip;

  // convert to the directory of the library's main file for resolving further imports.
  const libMainDir = path.dirname(
    path.resolve(CWD, libConfigDeprecated.libMainFile),
  );
  relinka(
    "verbose",
    `Converted module ${packageName} to absolute path ${libMainDir}`,
  );
  return libMainDir;
}
function convertModuleToAlias(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertModuleToAbsolute(ip, opts);
  if (absolutePath !== ip) {
    return convertAbsoluteToAlias(absolutePath, opts);
  }
  return ip;
}
function convertModuleToBare(ip: string, opts: ConversionOptions): string {
  // "bare" means relative to CWD.
  const absolutePath = convertModuleToAbsolute(ip, opts);
  if (absolutePath !== ip) {
    return convertAbsoluteToBare(absolutePath);
  }
  return ip;
}
function convertModuleToRelative(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertModuleToAbsolute(ip, opts);
  if (absolutePath !== ip) {
    return convertAbsoluteToRelative(absolutePath, opts);
  }
  return ip;
}

// Relative -> *
function convertRelativeToAbsolute(
  ip: string,
  opts: ConversionOptions,
): string {
  return path.resolve(path.dirname(opts.sourceFile), ip);
}
function convertRelativeToAlias(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertRelativeToAbsolute(ip, opts);
  return convertAbsoluteToAlias(absolutePath, opts);
}
function convertRelativeToBare(ip: string, opts: ConversionOptions): string {
  // "bare" means relative to CWD.
  const absolutePath = convertRelativeToAbsolute(ip, opts);
  return convertAbsoluteToBare(absolutePath);
}
function convertRelativeToModule(ip: string, opts: ConversionOptions): string {
  const absolutePath = convertRelativeToAbsolute(ip, opts);
  return convertAbsoluteToModule(absolutePath, opts);
}

// --- Conversion Mapping ---

/** Maps "fromType:toType" string to the corresponding conversion function. */
const conversionMapping: Partial<Record<ConversionPair, ConverterFunction>> = {
  // Route all conversions through the specific functions defined above.
  // The `opts` object contains all necessary context.
  "absolute:alias": convertAbsoluteToAlias,
  "absolute:bare": convertAbsoluteToBare,
  "absolute:module": convertAbsoluteToModule,
  "absolute:relative": convertAbsoluteToRelative,

  "alias:absolute": convertAliasToAbsolute,
  // alias:alias is identity if prefix/base match (handled in dispatcher)
  "alias:bare": convertAliasToBare,
  "alias:module": convertAliasToModule,
  "alias:relative": convertAliasToRelative,

  "bare:absolute": convertBareToAbsolute,
  "bare:alias": convertBareToAlias,
  "bare:dynamic": convertBareToDynamic, // Placeholder, logic elsewhere
  "bare:module": convertBareToModule,
  "bare:relative": convertBareToRelative,

  "dynamic:absolute": convertDynamicToAbsolute,
  "dynamic:alias": convertDynamicToAlias,
  "dynamic:bare": convertDynamicToBare,
  "dynamic:module": convertDynamicToModule,
  "dynamic:relative": convertDynamicToRelative,

  "module:absolute": convertModuleToAbsolute,
  "module:alias": convertModuleToAlias,
  "module:bare": convertModuleToBare,
  "module:relative": convertModuleToRelative,

  "relative:absolute": convertRelativeToAbsolute,
  "relative:alias": convertRelativeToAlias,
  "relative:bare": convertRelativeToBare,
  "relative:module": convertRelativeToModule,
};

/**
 * Dispatches to the appropriate conversion function based on fromType and toType.
 * Applies post-processing like stripping path segments.
 * @param fromType - The type of the original import path.
 * @param toType - The desired type of the import path.
 * @param importPath - The original import path string.
 * @param options - Contextual options, including sourceFile, libsList, etc.
 * @returns The converted (and potentially stripped) import path string.
 */
function convertSingleImportPath(
  fromType: ImportType,
  toType: ImportType,
  importPath: string,
  options: Omit<ConversionOptions, "aliasPrefix"> & { aliasPrefix?: string },
): string {
  // --- Prepare Full Conversion Options ---
  const fullOptions: ConversionOptions = {
    ...options,
    aliasPrefix: options.aliasPrefix ?? "~/",
  };

  // --- Get Conversion Function ---
  const conversionKey = `${fromType}:${toType}`;
  const converter = conversionMapping[conversionKey];
  if (!converter) {
    relinka("warn", `No converter found for ${fromType} -> ${toType}`);
    return importPath;
  }

  // --- Apply Conversion ---
  let convertedPath = converter(importPath, fullOptions);

  // --- Post-processing (Strip) ---
  if (
    fullOptions.strip.length > 0 &&
    convertedPath !== importPath &&
    fullOptions.sourceFile
  ) {
    let processedPath = convertedPath;
    const importingFileDir = path.dirname(fullOptions.sourceFile);

    // If we're converting from an alias path, we need to handle the case where
    // both the importing and imported files have been moved to new locations
    if (fromType === "alias" && fullOptions.baseDir) {
      // First, resolve the absolute path of the target file in the source tree
      const sourceTreeTarget = path.resolve(
        fullOptions.baseDir,
        importPath.slice(fullOptions.aliasPrefix.length),
      );

      // Calculate the relative position of both files relative to baseDir
      const importingFileRelativeToBase = path.relative(
        fullOptions.baseDir,
        fullOptions.sourceFile,
      );
      const targetFileRelativeToBase = path.relative(
        fullOptions.baseDir,
        sourceTreeTarget,
      );

      // If both files have moved relative to baseDir, we need to adjust the path
      if (importingFileRelativeToBase && targetFileRelativeToBase) {
        // Get the new base directory (e.g., dist-test instead of src)
        // Walk up the directory structure of the importing file until we find the new base
        let newBaseDir = path.dirname(fullOptions.sourceFile);
        const importingFileParts = importingFileRelativeToBase.split(/[\\/]/);
        // Walk up the same number of directories as the original relative path had segments
        // minus 1 to account for the filename itself
        for (let i = 0; i < importingFileParts.length - 1; i++) {
          newBaseDir = path.dirname(newBaseDir);
        }

        // Calculate where the target file should be in the new structure
        const newTargetLocation = path.join(
          newBaseDir,
          path.basename(targetFileRelativeToBase),
        );

        // Calculate the relative path from the importing file to the new target location
        processedPath = path
          .relative(importingFileDir, newTargetLocation)
          .replace(/\\/g, "/");

        // Ensure it starts with ./ or ../
        if (!processedPath.startsWith(".")) {
          processedPath = `./${processedPath}`;
        }

        if (DEBUG_MODE) {
          relinka(
            "verbose",
            `Adjusted path for moved files: ${processedPath} (from ${importingFileDir} to ${newTargetLocation})`,
          );
        }

        convertedPath = processedPath;
        return convertedPath;
      }
    }

    // Original stripping logic for other cases
    for (const stripSegment of fullOptions.strip) {
      const normalizedStripSegment = stripSegment.endsWith("/")
        ? stripSegment
        : `${stripSegment}/`;
      const leadingMatch = /^((\.\.\/|\.\/)+)/.exec(processedPath);
      const leading = leadingMatch ? leadingMatch[0] : "";
      const afterLeading = processedPath.slice(leading.length);
      if (afterLeading.startsWith(normalizedStripSegment)) {
        const strippedPath = afterLeading.slice(normalizedStripSegment.length);
        processedPath = leading + strippedPath;
      }
    }

    // Verify path resolution
    const preStripAbsoluteTarget = path.resolve(
      importingFileDir,
      convertedPath,
    );
    const postStripAbsoluteTarget = path.resolve(
      importingFileDir,
      processedPath,
    );

    if (
      normalize(preStripAbsoluteTarget) !== normalize(postStripAbsoluteTarget)
    ) {
      // If stripping would break the path, calculate direct relative path
      processedPath = path
        .relative(importingFileDir, preStripAbsoluteTarget)
        .replace(/\\/g, "/");
      if (!processedPath.startsWith(".")) {
        processedPath = `./${processedPath}`;
      }
    }

    convertedPath = processedPath;
  }

  return convertedPath;
}

// ========================================
// File & Directory Processing Utilities
// ========================================

/**
 * Reads a file, processes its content using MagicString via a provided logic function,
 * and writes changes back to the file system (unless in dry run mode).
 * Handles sourcemap generation.
 *
 * @param filePath - The absolute path to the file to process.
 * @param processLogic - An async function that modifies the MagicString instance `s` based on `content`.
 *                       Should return `true` if modifications were made, `false` otherwise.
 * @param options - Configuration for dry run and sourcemap generation.
 * @returns A FileResult object indicating the outcome.
 */
async function processFileContent(
  filePath: string,
  processLogic: (content: string, s: MagicString) => Promise<boolean> | boolean,
  options: ProcessFileContentOptions,
): Promise<FileResult> {
  const { distJsrDryRun = false, generateSourceMap = false } = options;
  try {
    const originalContent = await readFile(filePath, "utf-8");
    const s = new MagicString(originalContent);

    // Apply the specific transformation logic (e.g., path conversion, extension change)
    const changesMade = await processLogic(originalContent, s);

    if (!changesMade) {
      return {
        filePath,
        message: "No matching import paths found",
        success: true,
      };
    }

    const newContent = s.toString();
    let map: SourceMap | undefined;

    // Check if the content *actually* changed after MagicString operations
    if (originalContent === newContent) {
      return {
        filePath,
        message: `No effective changes for ${path.basename(filePath)}`,
        success: true,
      };
    }

    // Generate sourcemap if requested *before* writing
    if (generateSourceMap) {
      map = s.generateMap({
        file: `${path.basename(filePath)}.map`, // Map file named relative to source
        includeContent: true,
        source: path.basename(filePath), // Source file named relative to map
      });
    }

    // Write changes if not a dry run
    if (!distJsrDryRun) {
      await writeFile(filePath, newContent, "utf-8");
      if (map) {
        await writeFile(`${filePath}.map`, map.toString(), "utf-8");
      }
    }

    const message = `Processed ${path.basename(filePath)}${distJsrDryRun ? " (dry run)" : ""}${map ? " + sourcemap" : ""}`;
    if (DEBUG_MODE || distJsrDryRun) {
      relinka("verbose", message);
    }
    return { filePath, message, success: true };
  } catch (error) {
    const errorMessage = `Error processing file ${filePath}: ${error instanceof Error ? error.message : String(error)}`;
    relinka("error", errorMessage);
    return { filePath, message: errorMessage, success: false };
  }
}

/**
 * Recursively traverses a directory, identifies files matching specified extensions,
 * and applies an asynchronous file processor function to each. Uses p-map for concurrency.
 *
 * @param dirPath - The absolute path to the directory to start traversal.
 * @param fileExtensions - An array of file extensions to target (e.g., ['.ts', '.js']).
 * @param fileProcessor - An async function (`(filePath: string) => Promise<T>`) to run on each matched file.
 * @param concurrency - The maximum number of file processing operations to run in parallel.
 * @returns A promise resolving to a flattened array of results from the fileProcessor.
 */
async function processDirectoryRecursively<T>(
  dirPath: string,
  fileExtensions: string[],
  fileProcessor: (filePath: string) => Promise<T>,
  concurrency: number,
): Promise<T[]> {
  let results: T[] = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    const filesToProcess: string[] = [];
    const directoriesToRecurse: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isFile()) {
        if (fileExtensions.some((ext) => entry.name.endsWith(ext))) {
          filesToProcess.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        // Avoid recursing into node_modules or hidden directories
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) {
          directoriesToRecurse.push(fullPath);
        }
      }
    }

    // Process files in the current directory concurrently
    if (filesToProcess.length > 0) {
      const fileResults = await pMap(filesToProcess, fileProcessor, {
        concurrency,
      });
      results = results.concat(fileResults);
    }

    // Recursively process subdirectories sequentially to avoid overwhelming fs limits
    for (const subDirPath of directoriesToRecurse) {
      const subDirResults = await processDirectoryRecursively(
        subDirPath,
        fileExtensions,
        fileProcessor,
        concurrency,
      );
      results = results.concat(subDirResults);
    }
  } catch (error) {
    const errorMessage = `Error reading directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`;
    relinka("error", errorMessage);
    // TODO: bubble up the error or return partial results
    // In the future we should add an error result if T is structured like FileResult
    // results.push({ filePath: dirPath, message: errorMessage, success: false } as unknown as T);
  }
  return results;
}

// ========================================
// Specific File Transformation Logic (to be used with processFileContent)
// ========================================

/**
 * Finds static and dynamic imports in content and converts their paths.
 * This function is intended to be passed to `processFileContent`.
 * @param content - The file content string.
 * @param s - The MagicString instance for modifications.
 * @param options - Context including `fromType`, `toType`, `filePath`, etc.
 * @returns `true` if any changes were made to the MagicString instance.
 */
async function transformImportPathsLogic(
  content: string,
  s: MagicString,
  options: {
    fromType: ImportType;
    toType: ImportType;
    filePath: string; // The file being processed (absolute path)
    aliasPrefix?: string;
    baseDir: string; // Absolute path
    currentLibName?: string;
    libsList: Record<string, LibConfigDeprecated>;
    strip?: string[];
    urlMap?: Record<string, string>;
  },
): Promise<boolean> {
  let changesMade = false;
  const { fromType, toType, filePath, ...conversionArgs } = options;

  // Define the options object once for convertSingleImportPath
  const converterOptions = {
    ...conversionArgs,
    sourceFile: filePath, // absolute file path
    strip: conversionArgs.strip ?? [],
    urlMap: conversionArgs.urlMap ?? {},
  };

  // --- Process Static Imports/Exports (`from "..."`) ---
  for (const match of content.matchAll(STATIC_IMPORT_REGEX)) {
    const fullMatch = match[0]; // e.g., import { x } from "./util";
    const importPath = match[3]; // e.g., "./util"
    if (typeof match.index !== "number" || !importPath) continue;

    // Calculate precise start/end indices of the path *within* the quotes
    const quoteChar = match[2]; // ' or "
    const pathStartIndex = match.index + fullMatch.lastIndexOf(importPath) - 1; // Start of quote
    // const pathStartIndex = match.index + fullMatch.indexOf(quoteChar + importPath + quoteChar) + 1; // Start of path content
    const pathEndIndex = pathStartIndex + importPath.length + 2; // End of quote

    // Special case: Convert `from "http://..."` to ` = await import("./local/path")`
    const bareUrl = getBareImportUrl(fullMatch, true /* require 'from' */);
    if (fromType === "bare" && toType === "dynamic" && bareUrl) {
      const localPath = converterOptions.urlMap?.[bareUrl];
      if (localPath) {
        // Construct the dynamic import expression
        const dynamicImportStatement = `await import(${quoteChar}${localPath}${quoteChar})`;
        // Find where ` from ` starts to replace ` from "..."` with ` = await import(...)`
        const fromIndex = fullMatch.toLowerCase().lastIndexOf(" from ");
        if (fromIndex > 0) {
          const replacementStart = match.index + fromIndex;
          const replacementEnd = match.index + fullMatch.length;
          // Overwrite ' from "url"' with ' = await import("local")'
          s.overwrite(
            replacementStart,
            replacementEnd,
            ` = ${dynamicImportStatement}`,
          );
          changesMade = true;
          if (DEBUG_MODE)
            relinka(
              "verbose",
              `Converted bare URL import to dynamic: ${bareUrl} -> ${localPath}`,
            );
        } else {
          relinka(
            "warn",
            `Could not find ' from ' in statement for bare:dynamic conversion: ${fullMatch}`,
          );
        }
      } else {
        relinka(
          "verbose",
          `No local mapping found for URL: ${bareUrl} in bare:dynamic conversion.`,
        );
      }
      continue; // Skip normal path conversion for this handled case
    }

    // --- Apply standard path conversion ---
    const convertedPath = convertSingleImportPath(
      fromType,
      toType,
      importPath,
      converterOptions,
    );

    if (convertedPath !== importPath) {
      // Overwrite only the path part inside the quotes
      s.overwrite(pathStartIndex + 1, pathEndIndex - 1, convertedPath);
      changesMade = true;
      if (DEBUG_MODE)
        relinka(
          "verbose",
          `Converted path: ${importPath} -> ${convertedPath} (${fromType} -> ${toType})`,
        );
    }
  }

  // --- Process Dynamic Imports (`import(...)`) ---
  // Use a fresh regex instance for each file or reset manually if reusing
  const dynamicImportRegexLocal = new RegExp(DYNAMIC_IMPORT_REGEX.source, "g");
  for (const match of content.matchAll(dynamicImportRegexLocal)) {
    const fullMatch = match[0]; // e.g., import("./lazy")
    const importPath = match[2]; // e.g., "./lazy"
    if (typeof match.index !== "number" || !importPath) continue;

    // Calculate precise start/end indices of the path *within* the quotes
    const quoteChar = match[1]; // ' or "
    const pathStartIndex =
      match.index + fullMatch.indexOf(quoteChar + importPath + quoteChar) + 1; // Start of path content
    const pathEndIndex = pathStartIndex + importPath.length; // End of path content

    // Determine the path type for conversion input
    // If converting *from* dynamic, the type is 'dynamic'.
    // Otherwise, determine the type of the path found inside import().
    // 'dynamic' is primarily a *target* type
    // More complex logic could analyze the path itself.
    const effectiveFromType = fromType === "dynamic" ? "dynamic" : fromType;

    // --- Apply path conversion ---
    const convertedPath = convertSingleImportPath(
      effectiveFromType, // Use determined 'from' type
      toType,
      importPath, // The path string from inside import()
      converterOptions,
    );

    if (convertedPath !== importPath) {
      // Overwrite only the path part inside the quotes
      s.overwrite(pathStartIndex, pathEndIndex, convertedPath);
      changesMade = true;
      if (DEBUG_MODE)
        relinka(
          "verbose",
          `Converted dynamic path: ${importPath} -> ${convertedPath} (${effectiveFromType} -> ${toType})`,
        );
    }
  }

  return changesMade;
}

/**
 * Finds import paths ending in `.js` and changes them to `.ts`.
 * This function is intended to be passed to `processFileContent`.
 * @param content - The file content string.
 * @param s - The MagicString instance for modifications.
 * @returns `true` if any changes were made to the MagicString instance.
 */
async function transformJsToTsExtensionLogic(
  content: string,
  s: MagicString,
): Promise<boolean> {
  let changesMade = false;

  // Helper to process matches from a regex
  const processMatches = (regex: RegExp, pathGroupIndex: number) => {
    // Use a local instance with 'g' flag ensure state isolation per call
    const localRegex = new RegExp(
      regex.source,
      regex.flags.includes("g") ? regex.flags : `${regex.flags}g`,
    );
    for (const match of content.matchAll(localRegex)) {
      const fullMatch = match[0];
      const importPath = match[pathGroupIndex]; // The captured path string
      if (typeof match.index !== "number" || !importPath) continue;

      // Attempt to replace the extension
      const replacedPath = replaceJsExtension(importPath);

      if (replacedPath !== importPath) {
        // Calculate precise start/end indices of the path *within* the quotes
        const quoteChar = match[pathGroupIndex - 1]; // Quote is group before path
        const pathStartIndex =
          match.index +
          fullMatch.lastIndexOf(quoteChar + importPath + quoteChar) +
          1; // Start of path content
        const pathEndIndex = pathStartIndex + importPath.length; // End of path content

        s.overwrite(pathStartIndex, pathEndIndex, replacedPath);
        changesMade = true;
        if (DEBUG_MODE)
          relinka(
            "verbose",
            `Changed extension: ${importPath} -> ${replacedPath}`,
          );
      }
    }
  };

  // Process both static and dynamic imports
  processMatches(STATIC_IMPORT_REGEX, 3); // Path is group 3 in static imports
  processMatches(DYNAMIC_IMPORT_REGEX, 2); // Path is group 2 in dynamic imports

  return changesMade;
}

// ========================================
// Main Public Functions
// ========================================

/**
 * Recursively searches for files in a directory and converts import path formats
 * (e.g., relative to alias, absolute to module) based on specified types.
 *
 * @param options - Configuration defining the directory, conversion types, libraries, etc.
 * @returns A promise resolving to an array of FileResult objects, one for each processed file.
 */
export async function convertImportPaths(
  options: ConvertImportPathsOptions,
): Promise<FileResult[]> {
  const {
    baseDir: rawBaseDir,
    fromType,
    toType,
    libsList,
    aliasPrefix: rawAliasPrefix,
    currentLibName,
    distJsrDryRun = false,
    fileExtensions = DEFAULT_FILE_EXTENSIONS,
    generateSourceMap = false,
    strip: userProvidedStrip,
    urlMap = {},
  } = options;

  // --- Input Validation & Normalization ---
  if (!rawBaseDir) {
    throw new Error("`baseDir` option is required.");
  }
  const baseDir = path.resolve(CWD, rawBaseDir); // Ensure absolute path

  if ((fromType === "alias" || toType === "alias") && !rawAliasPrefix) {
    throw new Error("aliasPrefix is required for alias path conversions");
  }

  try {
    const stats = await stat(baseDir);
    if (!stats.isDirectory()) {
      throw new Error(`Specified baseDir is not a directory: ${baseDir}`);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error(`Specified baseDir does not exist: ${baseDir}`);
    }
    throw error; // Re-throw other errors (e.g., permissions)
  }

  // --- Determine strip segments ---
  let strip = userProvidedStrip ? [...userProvidedStrip] : []; // Start with user provided or empty, ensure it's a new array

  if (fromType === "alias") {
    const autoStripPatterns = new Set<string>(strip); // Use a Set to avoid duplicates from user-provided and auto-generated
    const derivedAliasPathSegments = new Set<string>();

    // Determine a suitable ancestor directory for path.relative. Start with CWD as a fallback.
    let ancestorDirForRelativePath = CWD;
    const parentDir = path.dirname(baseDir);

    if (
      parentDir !== baseDir &&
      parentDir !== path.dirname(parentDir) /* not fs root */
    ) {
      const grandParentDir = path.dirname(parentDir);
      if (
        grandParentDir !== parentDir &&
        grandParentDir !== path.dirname(grandParentDir)
      ) {
        const greatGrandParentDir = path.dirname(grandParentDir);
        // Check if greatGrandParentDir is distinct and not the fs root itself
        if (
          greatGrandParentDir !== grandParentDir &&
          greatGrandParentDir !== path.dirname(greatGrandParentDir)
        ) {
          ancestorDirForRelativePath = greatGrandParentDir;
        } else {
          ancestorDirForRelativePath = grandParentDir; // Fallback to grandParent if greatGrand is root or same
        }
      } else {
        ancestorDirForRelativePath = parentDir; // Fallback to parent if grandParent is root or same
      }
    } else if (baseDir !== CWD) {
      // If baseDir is a direct child of fs root, or baseDir is CWD's child.
      // Use parentDir (which could be fs root or CWD) if it's different from baseDir.
      if (parentDir !== baseDir) {
        ancestorDirForRelativePath = parentDir;
      }
    }

    // Attempt 1: Structural path relative to the determined ancestor.
    const structuralPath = path
      .relative(ancestorDirForRelativePath, baseDir)
      .replace(/\\/g, "/");
    if (
      structuralPath &&
      structuralPath !== "." &&
      !structuralPath.startsWith("..") &&
      structuralPath !== "/"
    ) {
      derivedAliasPathSegments.add(structuralPath);
    }

    // Attempt 2: Basename of the alias resolution directory.
    const baseDirName = path.basename(baseDir);
    if (
      baseDirName &&
      baseDirName !== "." &&
      !baseDirName.startsWith("..") &&
      baseDirName !== "/"
    ) {
      derivedAliasPathSegments.add(baseDirName.replace(/\\/g, "/"));
    }

    // Fallback: If no segments derived yet, and baseDir is not CWD, use path relative to CWD.
    if (derivedAliasPathSegments.size === 0 && baseDir !== CWD) {
      const pathFromCwd = path.relative(CWD, baseDir).replace(/\\/g, "/");
      if (
        pathFromCwd &&
        pathFromCwd !== "." &&
        !pathFromCwd.startsWith("..") &&
        pathFromCwd !== "/"
      ) {
        derivedAliasPathSegments.add(pathFromCwd);
      }
    }

    if (derivedAliasPathSegments.size > 0) {
      if (DEBUG_MODE) {
        // Only log if verbosity is enabled via DEBUG_MODE
        relinka(
          "verbose",
          `Derived alias base path segments for stripping: ${Array.from(derivedAliasPathSegments).join(", ")}`,
        );
      }

      // Iterate over the derived core segments and add them to the strip patterns.
      // The actual stripping logic in convertSingleImportPath handles leading ../ parts.
      for (const segment of derivedAliasPathSegments) {
        if (!segment) continue; // Should already be filtered, but as a safeguard

        let pattern = segment.replace(/\\/g, "/"); // Ensure forward slashes

        // Ensure it ends with a slash
        if (!pattern.endsWith("/")) {
          pattern = `${pattern}/`;
        }
        // Normalize potential double slashes (e.g. if a segment somehow was `/foo`)
        pattern = pattern.replace(/\/\//g, "/");

        // Add non-trivial and meaningful patterns
        // (e.g. avoid adding just "/" or "./")
        if (
          pattern &&
          pattern !== "/" &&
          pattern !== "./" &&
          pattern.length > 1
        ) {
          autoStripPatterns.add(pattern);
        }
      }
    }

    const originalUserStripCount = userProvidedStrip?.length ?? 0;
    strip = Array.from(autoStripPatterns);

    if (strip.length > originalUserStripCount) {
      relinka(
        "verbose",
        `Using strip patterns for alias conversion: ${strip.join(", ")}`,
      );
    }
  } else if (userProvidedStrip) {
    // If not 'alias' fromType, just use userProvidedStrip if available
    strip = [...userProvidedStrip];
  } else {
    // Default to no stripping if not 'alias' and no user strip provided
    strip = [];
  }

  if (distJsrDryRun) {
    relinka(
      "log",
      "[path conversion] Dry run mode enabled: No files will be modified.",
    );
  } else {
    relinka(
      "log",
      `Starting import path conversion (${fromType} -> ${toType}) in directory: ${baseDir}`,
    );
  }

  // --- Define File Processing Logic ---
  // Create a processor function that closes over the conversion options.
  const fileProcessor = async (filePath: string): Promise<FileResult> => {
    return processFileContent(
      filePath,
      (content, s) =>
        transformImportPathsLogic(content, s, {
          fromType,
          toType,
          filePath, // absolute file path
          aliasPrefix: rawAliasPrefix, // raw prefix, normalization happens inside
          baseDir, // resolved absolute baseDir
          currentLibName,
          libsList,
          strip,
          urlMap,
        }),
      { distJsrDryRun, generateSourceMap }, // file writing options
    );
  };

  // --- Execute Directory Processing ---
  const results = await processDirectoryRecursively(
    baseDir,
    fileExtensions,
    fileProcessor,
    CONCURRENCY_DEFAULT,
  );

  // --- Log Summary ---
  const successCount = results.filter((r) => r.success).length;
  const changedCount = results.filter((r) =>
    r.message.startsWith("Processed"),
  ).length;
  const errorResults = results.filter((r) => !r.success);

  relinka(
    "log",
    `Import path conversion finished. ${successCount} files processed successfully (${changedCount} modified), ${errorResults.length} errors.`,
  );
  // Log specific errors
  for (const result of errorResults) {
    relinka("error", result.message); // Error details already include filePath
  }

  return results;
}

/**
 * Recursively searches for files in a directory and changes import paths
 * ending in `.js` to end in `.ts`.
 *
 * @param options - Configuration defining the directory and processing options.
 * @returns A promise resolving to an array of FileResult objects, one for each processed file.
 */
export async function convertImportExtensionsJsToTs(
  options: ConvertImportExtensionsOptions,
): Promise<FileResult[]> {
  const {
    dirPath: rawDirPath,
    distJsrDryRun = false,
    fileExtensions = DEFAULT_FILE_EXTENSIONS,
    generateSourceMap = false,
  } = options;

  // --- Input Validation & Normalization ---
  if (!rawDirPath) {
    throw new Error("`dirPath` option is required.");
  }
  const absoluteDirPath = path.resolve(CWD, rawDirPath); // Ensure absolute path

  try {
    const stats = await stat(absoluteDirPath);
    if (!stats.isDirectory()) {
      throw new Error(
        `Specified dirPath is not a directory: ${absoluteDirPath}`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      throw new Error(`Specified dirPath does not exist: ${absoluteDirPath}`);
    }
    throw error; // Re-throw other errors
  }

  relinka(
    "log",
    `Starting .js -> .ts import extension conversion in directory: ${absoluteDirPath}`,
  );
  if (distJsrDryRun) {
    relinka("log", "Dry run mode enabled: No files will be modified.");
  }

  // --- Define File Processing Logic ---
  // Use the generic file processor with the specific extension transformation logic.
  const fileProcessor = async (filePath: string): Promise<FileResult> => {
    return processFileContent(
      filePath,
      transformJsToTsExtensionLogic,
      { distJsrDryRun, generateSourceMap }, // file writing options
    );
  };

  // --- Execute Directory Processing ---
  const results = await processDirectoryRecursively(
    absoluteDirPath,
    fileExtensions,
    fileProcessor,
    CONCURRENCY_DEFAULT,
  );

  // --- Log Summary ---
  const successCount = results.filter((r) => r.success).length;
  const changedCount = results.filter((r) =>
    r.message.startsWith("Processed"),
  ).length; // Count files actually modified
  const errorResults = results.filter((r) => !r.success);

  relinka(
    "log",
    `Extension conversion finished. ${successCount} files processed successfully (${changedCount} modified), ${errorResults.length} errors.`,
  );
  // Log specific errors
  for (const result of errorResults) {
    relinka("error", result.message);
  }

  return results;
}

export function normalizeQuotes(str: string): string {
  return str.replace(/['"]/g, '"');
}

/**
 * The `path.matchesGlob()` method determines if `path` matches the `pattern`.
 * @param path The path to glob-match against.
 * @param pattern The glob to check the path against.
 */
export const matchesGlob = (
  path: string,
  pattern: string | string[],
): boolean => {
  return rematch(pattern, normalize(path));
};

/**
 * Determines the type and symbol of an import path
 * @param importPath - The import path to analyze
 * @returns Object containing the ImportType and symbol used
 */
function determineImportPathType(importPath: string): PathTypeInfo {
  // Check for alias paths
  if (importPath.startsWith("@/")) {
    return { type: "alias", symbol: "@/" };
  }
  if (importPath.startsWith("~/")) {
    return { type: "alias", symbol: "~/" };
  }

  // Check for relative paths
  if (importPath.startsWith("./")) {
    return { type: "relative", symbol: "./" };
  }
  if (importPath.startsWith("../")) {
    return { type: "relative", symbol: "../" };
  }

  // Check for absolute paths
  if (importPath.startsWith("/")) {
    return { type: "absolute", symbol: "/" };
  }
  if (/^[A-Za-z]:\\/.test(importPath)) {
    const drivePrefix = importPath.slice(0, 3); // e.g., "C:\"
    return { type: "absolute", symbol: drivePrefix };
  }

  // Check for URLs
  if (importPath.startsWith("http://")) {
    return { type: "bare", symbol: "http://" };
  }
  if (importPath.startsWith("https://")) {
    return { type: "bare", symbol: "https://" };
  }

  // Check for module/bare imports (no special symbol)
  const packageName = extractPackageName(importPath);
  if (packageName) {
    return { type: "module", symbol: null };
  }

  return { type: "bare", symbol: null };
}

/**
 * Parses a block of named imports/exports, handling multi-line and comments
 * @param block - The content between curly braces
 * @returns Array of parsed specifiers with name, alias, and type information
 */
function parseNamedSpecifiers(
  block: string,
): { name: string; alias?: string; isType?: boolean }[] {
  // Remove comments and normalize whitespace
  const cleanBlock = block
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .replace(/\/\/.*/g, "") // Remove single-line comments
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  if (!cleanBlock) return [];

  return cleanBlock
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((imp) => {
      // Check for 'type' keyword before the identifier
      const hasTypeKeyword = imp.startsWith("type ");
      const withoutType = hasTypeKeyword ? imp.slice(5).trim() : imp;

      const [name, alias] = withoutType.split(/\s+as\s+/).map((s) => s.trim());
      return {
        name,
        ...(alias && { alias }),
        ...(hasTypeKeyword && { isType: true }),
      };
    });
}

/**
 * Analyzes code and extracts detailed information about all import and export statements.
 *
 * @param code - The source code string to analyze
 * @param options - Options for filtering results
 * @returns Array of ImportExportInfo objects describing each import/export
 *
 * @example
 * ```ts
 * const code = `
 *   import { ref } from "vue";
 *   export { default as MyComponent } from "./MyComponent";
 *   export * from "./utils";
 *   export const x = 1;
 * `;
 * const statements = getFileImportsExports(code, {
 *   kind: 'all',  // or 'import' or 'export'
 *   pathTypes: ['relative'],
 *   limitPerType: 2
 * });
 * ```
 */
export function getFileImportsExports(
  code: string,
  options: GetFileImportsExportsOptions = {},
): ImportExportInfo[] {
  const { pathTypes, limitPerType, kind = "all" } = options;
  const statements: ImportExportInfo[] = [];
  const typeCounts: Partial<Record<ImportType, number>> = {};

  // Helper to check if we should include a statement based on its path type
  const shouldIncludeByPathType = (pathType: ImportType): boolean => {
    if (!pathTypes) return true;
    if (!pathTypes.includes(pathType)) return false;
    if (!limitPerType) return true;

    typeCounts[pathType] = (typeCounts[pathType] || 0) + 1;
    return typeCounts[pathType] <= limitPerType;
  };

  // Helper to check if we should include a statement based on its kind
  const shouldIncludeByKind = (statementKind: "import" | "export"): boolean => {
    return kind === "all" || kind === statementKind;
  };

  // Process static imports and exports
  const staticMatches = Array.from(code.matchAll(STATIC_IMPORT_REGEX));
  for (const match of staticMatches) {
    const statement = match[0];
    const statementKind =
      match[1] === "import" ? "import" : ("export" as const);

    if (!shouldIncludeByKind(statementKind)) continue;

    const source = match[3];
    const hasSource = statement.includes("from");
    const pathInfo = hasSource ? determineImportPathType(source) : undefined;

    if (pathInfo && !shouldIncludeByPathType(pathInfo.type)) continue;

    const start = match.index ?? 0;
    const end = start + statement.length;

    // Check if this is a type-only statement
    const isTypeOnly =
      statement.includes(`${statementKind} type`) &&
      !statement.includes(`${statementKind} type {`); // Not a type in braces

    // Handle different types of imports/exports
    const beforeFrom = hasSource
      ? statement
          .slice(
            statement.indexOf(statementKind) + statementKind.length,
            statement.indexOf("from"),
          )
          .trim()
      : statement
          .slice(statement.indexOf(statementKind) + statementKind.length)
          .trim();

    const specifiers: ImportExportInfo["specifiers"] = [];

    if (beforeFrom.startsWith("{")) {
      // Named specifiers: import/export { x, y as z }
      const block = beforeFrom.slice(1, beforeFrom.lastIndexOf("}")).trim();
      const namedSpecifiers = parseNamedSpecifiers(block);

      for (const { name, alias, isType } of namedSpecifiers) {
        specifiers.push({
          type: "named",
          name,
          ...(alias && { alias }),
          ...(isType && { isType: true }),
        });
      }
    } else if (beforeFrom.startsWith("*")) {
      // Namespace or all: import/export * as x or export *
      const asMatch = /\*\s+as\s+([^\s,]+)/.exec(beforeFrom);
      if (asMatch) {
        // Namespace: import/export * as x
        specifiers.push({
          type: "namespace",
          name: asMatch[1],
          ...(isTypeOnly && { isType: true }),
        });
      } else {
        // Export all: export *
        specifiers.push({
          type: "all",
          name: "*",
          ...(isTypeOnly && { isType: true }),
        });
      }
    } else if (beforeFrom) {
      // Default or mixed: import/export x or import/export x, { y }
      const parts = beforeFrom.split(",").map((p) => p.trim());

      // First part is default if it doesn't start with { and isn't type/interface/etc
      if (
        !parts[0].startsWith("{") &&
        !/^(interface|class|const|let|var)\s/.exec(parts[0])
      ) {
        const hasTypeKeyword = parts[0].startsWith("type ");
        const name = hasTypeKeyword ? parts[0].slice(5).trim() : parts[0];
        specifiers.push({
          type: "default",
          name,
          ...(hasTypeKeyword && { isType: true }),
        });
      }

      // Check for additional named specifiers after comma
      if (parts.length > 1) {
        const namedPart = parts.slice(1).join(",").trim();
        if (namedPart.startsWith("{")) {
          const block = namedPart.slice(1, namedPart.lastIndexOf("}")).trim();
          const namedSpecifiers = parseNamedSpecifiers(block);

          for (const { name, alias, isType } of namedSpecifiers) {
            specifiers.push({
              type: "named",
              name,
              ...(alias && { alias }),
              ...(isType && { isType: true }),
            });
          }
        }
      }
    }

    statements.push({
      statement,
      type: "static",
      kind: statementKind,
      ...(hasSource && {
        source,
        pathType: pathInfo?.type,
        pathTypeSymbol: pathInfo?.symbol,
      }),
      specifiers,
      ...(isTypeOnly && { isTypeOnly: true }),
      start,
      end,
    });
  }

  // Process dynamic imports (if we're including imports)
  if (shouldIncludeByKind("import")) {
    const dynamicImports = Array.from(code.matchAll(DYNAMIC_IMPORT_REGEX));
    for (const match of dynamicImports) {
      const statement = match[0];
      const source = match[2];
      const pathInfo = determineImportPathType(source);

      if (!shouldIncludeByPathType(pathInfo.type)) continue;

      const start = match.index ?? 0;
      const end = start + statement.length;

      statements.push({
        statement,
        type: "dynamic",
        kind: "import",
        source,
        pathType: pathInfo.type,
        pathTypeSymbol: pathInfo.symbol,
        start,
        end,
      });
    }
  }

  return statements;
}
