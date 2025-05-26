import { relinka } from "@reliverse/relinka";
import * as path from "node:path";
import { cwd } from "node:process";

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

export function convertAliasedPathToRelative(
  workspaceRoot: string,
  currentFilePath: string, // Relative to workspaceRoot
  aliasedPath: string,
  tsConfig: TsConfig,
): string | null {
  const { compilerOptions } = tsConfig;
  if (!compilerOptions?.paths) {
    return null; // No paths defined
  }

  // Resolve baseUrl relative to workspaceRoot. If not defined, assume workspaceRoot is baseUrl.
  const resolvedBaseUrl = compilerOptions.baseUrl
    ? path.join(workspaceRoot, compilerOptions.baseUrl)
    : workspaceRoot;

  for (const alias in compilerOptions.paths) {
    // Ensure the alias pattern matches from the start and handles the wildcard
    const aliasPrefix = alias.replace(/\*$/, "");
    const aliasSuffixPattern = alias.endsWith("/*") ? "(.*)" : "";
    const aliasRegExp = new RegExp(
      `^${escapeRegExp(aliasPrefix)}${aliasSuffixPattern}$`,
    );

    const match = aliasedPath.match(aliasRegExp);

    if (match) {
      const remainingPathAfterAlias = match[1] || ""; // Captured part after wildcard, or empty if no wildcard

      const pathMappings = compilerOptions.paths[alias];
      if (!pathMappings) continue;
      for (const mappingTemplate of pathMappings) {
        // Replace wildcard in mapping with the captured part from the aliased path
        const mappedPathSuffix = mappingTemplate.endsWith("/*")
          ? remainingPathAfterAlias
          : "";
        const resolvedMappedBase = mappingTemplate.replace(/\*$/, "");

        // Construct the full path from the alias resolution
        const fullyResolvedAliasedPath = path.join(
          resolvedBaseUrl,
          resolvedMappedBase,
          mappedPathSuffix,
        );

        // Resolve currentFilePath relative to workspaceRoot to get its absolute representation (or at least common base)
        const absoluteCurrentFilePath = path.join(
          workspaceRoot,
          currentFilePath,
        );
        const currentFileDir = path.dirname(absoluteCurrentFilePath);

        let relativePath = path.relative(
          currentFileDir,
          fullyResolvedAliasedPath,
        );

        // Normalize to forward slashes and ensure it starts with ./ or ../
        relativePath = relativePath.replace(/\\/g, "/");
        if (
          !relativePath.startsWith(".") &&
          !relativePath.startsWith("/") &&
          !path.isAbsolute(relativePath)
        ) {
          relativePath = `./${relativePath}`;
        }
        return relativePath;
      }
    }
  }

  return null; // No alias matched or no mapping resolved
}

// Helper function to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+\-?^{}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

async function main() {
  const workspaceRoot = cwd();
  relinka("info", `Using workspace root: ${workspaceRoot}`);

  relinka("info", "--- Scenario 1: Common project setup ---");
  const currentFilePath1 = "example/app/ui/buttons.js"; // Relative to workspaceRoot
  const aliasedPath1 = "@/core/utils.js";
  const tsConfig1 = {
    compilerOptions: {
      baseUrl: ".", // Paths in "paths" are relative to workspaceRoot (where tsconfig.json would be)
      paths: {
        "@/*": ["src/app/*"], // Corrected: e.g., @/core/utils.js -> <workspaceRoot>/src/app/core/utils.js
        // and @/utils.js -> <workspaceRoot>/src/app/utils.js
        "~/*": ["src/legacy_modules/*"], // e.g., ~/old-feature -> <workspaceRoot>/src/legacy_modules/old-feature
      },
    },
  };

  const result1 = convertAliasedPathToRelative(
    workspaceRoot,
    currentFilePath1,
    aliasedPath1,
    tsConfig1,
  );
  relinka(
    "info",
    `Aliased '${aliasedPath1}' in '${currentFilePath1}' resolved to: '${result1}'`,
  );
  // Expected for current 'example/app/ui/buttons.js' and target 'src/app/core/utils.js':
  // Relative path from 'example/app/ui' to 'src/app/core' is '../../../src/app/core/utils.js'
  // Or, if path.relative normalizes differently, check output.

  relinka(
    "info",
    "--- Scenario 2: Based on original example's tsConfig structure ---",
  );
  // Simulating the structure from the initial example but with clearer paths:
  // Original had: baseUrl: "~/", paths: { "~/*": ["example/*"] }
  // Interpreting this as: baseUrl is project root, and "~" alias maps to "example/lib" directory.
  const currentFilePath2 = "example/components/my-view.js";
  const aliasedPath2 = "~/shared/data-model.js";
  const tsConfig2 = {
    compilerOptions: {
      baseUrl: ".", // tsconfig.json at workspaceRoot
      paths: {
        // "~/" prefix in aliasedPath2 maps to "example/lib/" directory within workspaceRoot
        "~/*": ["example/lib/*"],
      },
    },
  };

  const result2 = convertAliasedPathToRelative(
    workspaceRoot,
    currentFilePath2,
    aliasedPath2,
    tsConfig2,
  );
  relinka(
    "info",
    `Aliased '${aliasedPath2}' in '${currentFilePath2}' resolved to: '${result2}'`,
  );
  // Expected for current 'example/components/my-view.js' and target 'example/lib/shared/data-model.js':
  // Relative path from 'example/components' to 'example/lib' is '../lib/shared/data-model.js'

  relinka(
    "info",
    "--- Scenario 3: Alias pointing directly to a file (no wildcard) ---",
  );
  const currentFilePath3 = "src/features/settings/page.js";
  const aliasedPath3 = "config/app-settings";
  const tsConfig3 = {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "config/app-settings": ["src/core/config/settings.js"], // Direct file mapping
        "@services/*": ["src/services/*"],
      },
    },
  };
  const result3 = convertAliasedPathToRelative(
    workspaceRoot,
    currentFilePath3,
    aliasedPath3,
    tsConfig3,
  );
  relinka(
    "info",
    `Aliased '${aliasedPath3}' in '${currentFilePath3}' resolved to: '${result3}'`,
  );
  // Expected for current 'src/features/settings/page.js' and target 'src/core/config/settings.js':
  // Relative path: '../../core/config/settings.js'

  relinka("info", "--- Scenario 4: Regular alias to relative path ---");
  const currentFilePath4 = "example/app/ui/buttons.js";
  const aliasedPath4 = "~/cli/mod.js";
  const tsConfig4 = {
    compilerOptions: {
      baseUrl: ".",
      paths: {
        "~/*": ["src/*"],
      },
    },
  };
  const result4 = convertAliasedPathToRelative(
    workspaceRoot,
    currentFilePath4,
    aliasedPath4,
    tsConfig4,
  );
  relinka(
    "info",
    `Aliased '${aliasedPath4}' in '${currentFilePath4}' resolved to: '${result4}'`,
  );
  // Expected for current 'example/app/ui/buttons.js' and target 'src/cli/mod.js':
  // Relative path: '../../src/cli/mod.js'
}

await main();
