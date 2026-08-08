// Regenerates schema/agnox.schema.json from the Zod model.
// Run `pnpm --filter @agnox/core run build` first, then `pnpm --filter @agnox/core run schema`.
// A test asserts the committed file matches, so drift is caught by `pnpm test`.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildAgnoxConfigJsonSchema } from "../dist/index.mjs";

const target = fileURLToPath(new URL("../schema/agnox.schema.json", import.meta.url));

await writeFile(target, `${JSON.stringify(buildAgnoxConfigJsonSchema(), null, 2)}\n`, "utf8");

process.stdout.write(`Wrote ${target}\n`);
