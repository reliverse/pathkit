import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import path from "node:path";

import { convertImportPaths } from "../../@dler/mod.js";

export async function exampleKeepResult(): Promise<void> {
  const src = path.join(process.cwd(), "src/libs/pathkit");
  const dest = path.join(process.cwd(), "dist-test");

  relinka("log", `Starting exampleKeepResult: ${src} -> ${dest}`);

  await fs.ensureDir(path.dirname(dest));

  // Validate source is a directory
  const stats = await fs.stat(src);
  if (!stats.isDirectory()) {
    throw new Error(
      "Please provide path to directory instead of path to file when using 'jsr' builder.",
    );
  }

  try {
    // Copy the files
    await fs.copy(src, dest, { overwrite: true });
    relinka("verbose", `Copied directory from ${src} to ${dest}`);

    // Convert import paths in the copied files
    const results = await convertImportPaths({
      baseDir: dest,
      fromType: "alias",
      toType: "relative",
      aliasPrefix: "~/",
      libsList: {},
      distJsrDryRun: false,
    });

    const successCount = results.filter((r) => r.success).length;
    const changedCount = results.filter((r) =>
      r.message.startsWith("Processed"),
    ).length;
    relinka(
      "success",
      `Completed regular JSR bundling: ${successCount} files processed, ${changedCount} modified`,
    );
  } catch (error) {
    // Fallback if there's an error
    const errorMessage = error instanceof Error ? error.message : String(error);
    relinka("warn", `${errorMessage}, falling back to copying ${src}`);
    await fs.copy(src, dest, { overwrite: true });
  }
}

await exampleKeepResult();
