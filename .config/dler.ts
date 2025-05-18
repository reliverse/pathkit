import { defineConfig } from "@reliverse/dler";

/**
 * Reliverse Bundler Configuration
 * Hover over a field to see more details
 * @see https://github.com/reliverse/dler
 */
export default defineConfig({
  // Bump configuration
  bumpDisable: true,
  bumpFilter: ["package.json", ".config/rse.ts"],
  bumpMode: "autoPatch",

  // Common configuration
  commonPubPause: false,
  commonPubRegistry: "npm-jsr",
  commonVerbose: false,

  // Core configuration
  coreDeclarations: true,
  coreEntryFile: "mod.ts",
  coreEntrySrcDir: "src",
  // coreIsCLI: false,

  // JSR-only config
  distJsrAllowDirty: true,
  distJsrBuilder: "jsr",
  distJsrCopyRootFiles: ["README.md", "LICENSE"],
  distJsrDirName: "dist-jsr",
  distJsrDryRun: false,
  distJsrGenTsconfig: false,
  distJsrOutFilesExt: "ts",
  distJsrSlowTypes: true,

  // NPM-only config
  distNpmBuilder: "mkdist",
  distNpmCopyRootFiles: ["README.md", "LICENSE"],
  distNpmDirName: "dist-npm",
  distNpmOutFilesExt: "js",

  // Libraries Dler Plugin
  // Publish specific dirs as separate packages
  // This feature is experimental at the moment
  // Please commit your changes before using it
  libsActMode: "main-and-libs",
  libsDirDist: "dist-libs",
  libsDirSrc: "src/libs",
  libsList: {
    "@reliverse/pathkit": {
      libDeclarations: true,
      libDescription:
        "@reliverse/pathkit delivers slash-consistent, cross-platform path manipulation that just works. Ensures predictable POSIX (/) separators everywhere, simplifying your code and eliminating OS-specific pathing issues.",
      libDirName: "pathkit",
      libMainFile: "pathkit/pathkit-mod.ts",
      libPkgKeepDeps: false,
      libTranspileMinify: true,
      libPubPause: false,
      libPubRegistry: "npm",
    },
  },

  // Logger setup
  logsFileName: "logs/relinka.log",
  logsFreshFile: true,

  // Dependency filtering
  rmDepsMode: "patterns-and-devdeps",
  rmDepsPatterns: [
    "@types",
    "biome",
    "eslint",
    "knip",
    "prettier",
    "@reliverse/cli-cfg",
  ],

  // Build setup
  transpileEsbuild: "es2023",
  transpileFormat: "esm",
  transpileMinify: true,
  transpilePublicPath: "/",
  transpileSourcemap: "none",
  transpileSplitting: false,
  transpileStub: false,
  transpileTarget: "node",
  transpileWatch: false,
});
