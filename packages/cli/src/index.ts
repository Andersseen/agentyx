#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { agnoxAdaptersName } from "@agnox/adapters";
import { agnoxCoreName } from "@agnox/core";
import { Command } from "commander";
import { z } from "zod";

export const cliVersion = "0.0.0";

const cliMetadataSchema = z.object({
  adaptersPackage: z.literal("agnox-adapters"),
  corePackage: z.literal("agnox-core"),
});

export function createAgnoxProgram(): Command {
  cliMetadataSchema.parse({
    adaptersPackage: agnoxAdaptersName,
    corePackage: agnoxCoreName,
  });

  return new Command()
    .name("agnox")
    .description("Agnox — provider-agnostic tooling for coding agents.")
    .version(cliVersion);
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entrypoint);
}

if (isMainModule()) {
  createAgnoxProgram().parse(process.argv);
}
