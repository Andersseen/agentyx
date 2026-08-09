import { builtInMcpServerRegistry } from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export function runMcpListCommand(): string {
  return builtInMcpServerRegistry.names.join("\n");
}

export interface McpShowCommandInput {
  readonly name: string;
  readonly json: boolean;
}

export function runMcpShowCommand(input: McpShowCommandInput): string {
  const server = builtInMcpServerRegistry.get(input.name);

  if (input.json) {
    return toJson(redactedServer(server));
  }

  const common = [
    server.name,
    server.description,
    `transport: ${server.transport}`,
    `context cost: ${server.contextCost ?? "unspecified"}`,
  ];

  if (server.transport === "stdio") {
    return [
      ...common,
      `command: ${server.command}`,
      section("args", server.args),
      section(
        "required environment",
        Object.values(server.env).map((reference) => reference.fromEnv),
      ),
    ].join("\n");
  }

  return [
    ...common,
    `url: ${server.url}`,
    section(
      "required environment",
      Object.values(server.headers).map((reference) => reference.fromEnv),
    ),
  ].join("\n");
}

export function createMcpCommand(): Command {
  const mcp = new Command("mcp").description("Inspect MCP servers Agentyx ships with.");

  mcp
    .command("list")
    .description("List the built-in MCP server identifiers.")
    .action(async () => {
      await emit(() => runMcpListCommand());
    });

  mcp
    .command("show")
    .description("Print one MCP server definition without secret values.")
    .argument("<name>", "MCP server identifier, for example context7")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (name: string, options: { json: boolean }) => {
      await emit(() => runMcpShowCommand({ name, json: options.json }));
    });

  return mcp;
}

function redactedServer(server: ReturnType<typeof builtInMcpServerRegistry.get>) {
  return server;
}
