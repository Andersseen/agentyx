import { fileURLToPath } from "node:url";

/**
 * Location of the non-code assets that ship with `@agentyx/core`.
 *
 * **This module must stay directly under `src/`.** The path is derived from
 * `import.meta.url` rather than the working directory, and `src/assets.ts` and
 * the bundled `dist/index.mjs` sit at the same depth below the package root, so
 * one relative path is correct both in development and in the published
 * package. Moving this file into a subdirectory breaks built-in skill loading;
 * `packages/core/test/built-in-skills.test.ts` guards against that.
 *
 * `skills/` is listed in the package's `files`, so it is published alongside
 * `dist/`.
 */
export const BUILT_IN_SKILLS_PATH = fileURLToPath(new URL("../skills", import.meta.url));
