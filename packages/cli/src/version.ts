import { createRequire } from "node:module";
import { z } from "zod";

const require = createRequire(import.meta.url);
const cliPackageMetadataSchema = z.object({
  version: z.string().min(1),
});

/** Exact version from the packaged CLI's own package.json. */
export const cliVersion = cliPackageMetadataSchema.parse(require("../package.json")).version;
