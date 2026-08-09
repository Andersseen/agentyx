// Regenerates schema/agentyx.schema.json from the Zod model.
// Run `pnpm --filter @agentyx/core run build` first, then `pnpm --filter @agentyx/core run schema`.
// A test asserts the committed file matches, so drift is caught by `pnpm test`.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildAgentyxConfigJsonSchema } from "../dist/index.mjs";

const target = fileURLToPath(new URL("../schema/agentyx.schema.json", import.meta.url));

await writeFile(target, `${JSON.stringify(buildAgentyxConfigJsonSchema(), null, 2)}\n`, "utf8");

process.stdout.write(`Wrote ${target}\n`);
