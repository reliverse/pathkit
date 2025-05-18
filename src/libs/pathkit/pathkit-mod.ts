// 👉 (experimental for this lib) bun dler > agg

import { normalizeWindowsPath } from "./pathkit-impl/_internal.js";
import {
  sep,
  normalize,
  join,
  resolve,
  normalizeString,
  isAbsolute,
  toNamespacedPath,
  extname,
  relative,
  dirname,
  format,
  basename,
  parse,
} from "./pathkit-impl/_path.js";
import { delimiter, posix, win32 } from "./pathkit-impl/args-impl.js";
import {
  normalizeAliases,
  resolveAlias,
  reverseResolveAlias,
  filename,
} from "./pathkit-impl/args-utils.js";

export { delimiter, posix, win32 };
export { normalizeAliases, resolveAlias, reverseResolveAlias, filename };
export { normalizeWindowsPath };
export {
  sep,
  normalize,
  join,
  resolve,
  normalizeString,
  isAbsolute,
  toNamespacedPath,
  extname,
  relative,
  dirname,
  format,
  basename,
  parse,
};

// Create a default export with all path utilities
const pathkit = {
  delimiter,
  posix,
  win32,
  normalizeAliases,
  resolveAlias,
  reverseResolveAlias,
  filename,
  normalizeWindowsPath,
  sep,
  normalize,
  join,
  resolve,
  normalizeString,
  isAbsolute,
  toNamespacedPath,
  extname,
  relative,
  dirname,
  format,
  basename,
  parse,
};

export default pathkit;
