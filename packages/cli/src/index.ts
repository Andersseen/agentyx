#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { agentyxAdaptersName } from "@agentyx/adapters";
import { agentyxCoreName } from "@agentyx/core";
import { Command } from "commander";
import { z } from "zod";
import { createDoctorCommand } from "./commands/doctor.js";
import { createInitCommand } from "./commands/init.js";
import { createInstallCommand } from "./commands/install.js";
import { createMcpCommand } from "./commands/mcp.js";
import { createPackCommand } from "./commands/pack.js";
import { createResolveCommand } from "./commands/resolve.js";
import { createSkillCommand } from "./commands/skill.js";
import { createTargetCommand } from "./commands/target.js";

const require = createRequire(import.meta.url);

const cliPackageMetadataSchema = z.object({
  version: z.string().min(1),
});

export const cliVersion = cliPackageMetadataSchema.parse(require("../package.json")).version;

const cliMetadataSchema = z.object({
  adaptersPackage: z.literal("agentyx-adapters"),
  corePackage: z.literal("agentyx-core"),
});

export function createAgentyxProgram(): Command {
  cliMetadataSchema.parse({
    adaptersPackage: agentyxAdaptersName,
    corePackage: agentyxCoreName,
  });

  return new Command()
    .name("agentyx")
    .description("Agentyx — provider-agnostic tooling for coding agents.")
    .version(cliVersion)
    .addCommand(createInitCommand())
    .addCommand(createDoctorCommand())
    .addCommand(createResolveCommand())
    .addCommand(createSkillCommand())
    .addCommand(createMcpCommand())
    .addCommand(createPackCommand())
    .addCommand(createTargetCommand())
    .addCommand(createInstallCommand());
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entrypoint);
}

if (isMainModule()) {
  await createAgentyxProgram().parseAsync(process.argv);
}
