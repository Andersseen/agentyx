import { createMcpServerRegistry, type McpServerSource } from "./registry.js";

export const builtInMcpServerSources: readonly McpServerSource[] = [
  {
    name: "context7",
    load: () => ({
      name: "context7",
      description: "Fetch up-to-date library documentation from Context7.",
      transport: "http",
      contextCost: "medium",
      url: "https://mcp.context7.com/mcp",
    }),
  },
  {
    name: "playwright",
    load: () => ({
      name: "playwright",
      description: "Automate and inspect browsers through Playwright MCP.",
      transport: "stdio",
      contextCost: "high",
      command: "npx",
      args: ["@playwright/mcp@latest"],
    }),
  },
  {
    name: "codebase-memory",
    load: () => ({
      name: "codebase-memory",
      description: "Structural code-intelligence MCP backed by a persistent code knowledge graph.",
      transport: "stdio",
      contextCost: "high",
      command: "codebase-memory-mcp",
    }),
  },
];

export const builtInMcpServerRegistry = createMcpServerRegistry(builtInMcpServerSources);

export const builtInMcpServerNames: readonly string[] = builtInMcpServerRegistry.names;
