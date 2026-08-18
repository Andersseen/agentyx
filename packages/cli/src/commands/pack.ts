import { builtInPackRegistry, UnknownPackError } from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export function runPackListCommand(): string {
  return [...builtInPackRegistry.values()]
    .map((pack) => `${pack.name.padEnd(14)} ${pack.category}`)
    .join("\n");
}

export interface PackShowCommandInput {
  readonly name: string;
  readonly json: boolean;
}

export function runPackShowCommand(input: PackShowCommandInput): string {
  const pack = builtInPackRegistry.get(input.name);

  if (pack === undefined) {
    throw new UnknownPackError(input.name, undefined, [...builtInPackRegistry.keys()]);
  }

  if (input.json) {
    return toJson(pack);
  }

  return [
    pack.name,
    pack.description ?? "",
    `category: ${pack.category}`,
    section("Skills", pack.skills),
    section(
      "MCP",
      pack.mcpServers.map((server) => `${server.name}    ${server.activation}`),
    ),
    section(
      "Tools",
      pack.tools.map((tool) => `${tool.name}    ${tool.activation}`),
    ),
  ].join("\n");
}

export function createPackCommand(): Command {
  const pack = new Command("pack").description("Inspect Agentyx capability packs.");

  pack
    .command("list")
    .description("List built-in pack identifiers and categories.")
    .action(async () => {
      await emit(() => runPackListCommand());
    });

  pack
    .command("show")
    .description("Print one pack definition.")
    .argument("<name>", "pack identifier, for example efficiency")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (name: string, options: { json: boolean }) => {
      await emit(() => runPackShowCommand({ name, json: options.json }));
    });

  return pack;
}
