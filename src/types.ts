// ========================================
// Type Definitions
// ========================================

/**
 * Configuration for a library to be built and published as a separate package.
 * Used when publishing multiple packages from a single repository.
 *
 * Deprecated: Will be removed coming soon.
 */
export type LibConfigDeprecated = {
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
   * @example ["pathe", "fs-extra"] - Only include these specific dependencies.
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
};

/** Configuration options contextualizing a path conversion operation. */
export type ConversionOptions = {
  aliasPrefix: string; // The alias prefix (e.g., "~/") - normalized to end with '/'
  baseDir: string; // The base directory for resolving aliases or relative paths (absolute path)
  currentLibName?: string; // The name of the library the source file belongs to (for avoiding self-imports)
  libsList: Record<string, LibConfigDeprecated>; // Map of library names to their configurations
  sourceFile: string; // The full path to the file being processed
  urlMap: Record<string, string>; // Map of bare import URLs to local paths
  strip: string[]; // Array of path segments to remove from the start of converted paths
};

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
export type FileResult = {
  filePath: string; // Path of the processed file
  message: string; // Status message (e.g., "Processed", "No changes", error details)
  success: boolean; // Indicates if processing completed without errors
};

/** Options for the `convertImportPaths` function. */
export type ConvertImportPathsOptions = {
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
};

/** Options for the `convertImportExtensionsJsToTs` function. */
export type ConvertImportExtensionsOptions = {
  dirPath: string; // Directory to process files within
  distJsrDryRun?: boolean; // If true, performs all checks but doesn't write changes
  fileExtensions?: string[]; // File extensions to process (defaults to JS/TS(X))
  generateSourceMap?: boolean; // If true, generates .map files alongside modified files
};

/** Options for internal file content processing. */
export type ProcessFileContentOptions = {
  distJsrDryRun?: boolean;
  generateSourceMap?: boolean;
};

/**
 * Options for filtering import statements
 */
export type GetFileImportsOptions = {
  /** Limit results to specific import path types */
  pathTypes?: ImportType[];
  /** Maximum number of results to return for each specified path type */
  limitPerType?: number;
};

/**
 * Result of path type analysis
 */
export type PathTypeInfo = {
  type: ImportType;
  symbol: string | null;
};

/**
 * Represents a single import or export statement with detailed information
 */
export type ImportExportInfo = {
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
};

/**
 * Options for filtering import/export statements
 */
export type GetFileImportsExportsOptions = {
  /** Limit results to specific import path types */
  pathTypes?: ImportType[];
  /** Maximum number of results to return for each specified path type */
  limitPerType?: number;
  /** Filter by statement kind */
  kind?: "import" | "export" | "all";
};
