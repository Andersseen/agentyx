import { builtInPacks } from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export function runPackListCommand(): string {
  return builtInPacks.map((pack) => `${pack.name.padEnd(14)} ${pack.category}`).join("\n");
}

export interface PackShowCommandInput {
  readonly name: string;
  readonly json: boolean;
}

export function runPackShowCommand(input: PackShowCommandInput): string {
  const pack = builtInPacks.find((candidate) => candidate.name === input.name);

  if (pack === undefined) {
    throw new Error(
      `Unknown pack "${input.name}". Known packs: ${builtInPacks.map((p) => p.name).join(", ")}.`,
    );
  }

  if (input.json) {
    return toJson(pack);
  }

  return [
    pack.name,
    pack.description ?? "",
    `category: ${pack.category}`,
    section("Skills", pack.skills ?? []),
    section(
      "MCP",
      (pack.mcpServers ?? []).map((server) =>
        typeof server === "string"
          ? `${server}    default`
          : `${server.name}    ${server.activation}`,
      ),
    ),
    section(
      "Tools",
      (pack.tools ?? []).map((tool) =>
        typeof tool === "string" ? `${tool}    default` : `${tool.name}    ${tool.activation}`,
      ),
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
