import { expect, test, describe } from "bun:test";

import { IMPORT_EXPORT_REGEX } from "~/mod.js";

describe("IMPORT_EXPORT_REGEX", () => {
  const testCases = [
    // 1
    {
      input: `import { defineConfigDler } from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 2
    {
      input: `import type { DefineConfigDler } from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 3
    {
      input: `import defineConfigDler from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 4
    {
      input: `import type DefineConfigDler from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 5
    {
      input: `export * from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 6
    {
      input: `export type * from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 7
    {
      input: `import { a, b, c } from '~/path'`,
      expected: "~/path",
    },
    // 8
    {
      input: `import type { A, B, C } from '~/path'`,
      expected: "~/path",
    },
    // 9
    {
      input: `import * as ns from '~/path'`,
      expected: "~/path",
    },
    // 10
    {
      input: `import type * as ns from '~/path'`,
      expected: "~/path",
    },
    // 11
    {
      input: `export { a, b, c } from '~/path'`,
      expected: "~/path",
    },
    // 12
    {
      input: `export type { A, B, C } from '~/path'`,
      expected: "~/path",
    },
    // 13
    {
      input: `export {
    defineConfigDler
} from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 14
    {
      input: `export something, {
    defineConfigDler,
    type Something
} from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 15
    {
      input: `export default, {
    defineConfigDler
} from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 16
    {
      input: `export type Something, {
    defineConfigDler
} from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 17
    {
      input: `export { defineConfigDler }, something from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 18
    {
      input: `export type { DefineConfigDler }, something from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 19
    {
      input: `export { defineConfigDler }, { another } from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 20
    {
      input: `export type { DefineConfigDler }, { Another } from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 21
    {
      input: `export { defineConfigDler }, default from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
    // 22
    {
      input: `export type { DefineConfigDler }, default from '~/libs/sdk/sdk-impl/config/default'`,
      expected: "~/libs/sdk/sdk-impl/config/default",
    },
  ];

  // Test cases that should not match
  const nonMatchingCases = [
    `export const x = '~/path'`, // non-import 1
    `export type X = '~/path'`, // non-import 2
  ];

  // should not match non-import/export statement 1
  testCases.forEach(({ input, expected }, index) => {
    test(`should match import/export statement ${index + 1}`, () => {
      const matches = [...input.matchAll(IMPORT_EXPORT_REGEX)];
      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0] as RegExpMatchArray;
      expect(match[2]).toBe(expected);
    });
  });

  // should not match non-import/export statement 2
  nonMatchingCases.forEach((input, index) => {
    test(`should not match non-import/export statement ${index + 1}`, () => {
      const matches = [...input.matchAll(IMPORT_EXPORT_REGEX)];
      expect(matches.length).toBe(0);
    });
  });
});
