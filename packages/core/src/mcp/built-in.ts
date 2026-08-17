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
  {
    name: "github",
    load: () => ({
      name: "github",
      description: "Read repositories, issues, pull requests and workflow runs on GitHub.",
      transport: "http",
      contextCost: "high",
      url: "https://api.githubcopilot.com/mcp/",
    }),
  },
  {
    name: "sentry",
    load: () => ({
      name: "sentry",
      description: "Inspect production issues, events and stack traces recorded by Sentry.",
      transport: "http",
      contextCost: "medium",
      url: "https://mcp.sentry.dev/mcp",
    }),
  },
  {
    name: "chrome-devtools",
    load: () => ({
      name: "chrome-devtools",
      description: "Record performance traces and inspect pages through Chrome DevTools.",
      transport: "stdio",
      contextCost: "high",
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    }),
  },
  {
    name: "supabase",
    load: () => ({
      name: "supabase",
      description: "Inspect and query Supabase project schemas, tables and logs.",
      transport: "stdio",
      contextCost: "high",
      command: "npx",
      args: ["-y", "@supabase/mcp-server-supabase@latest"],
      env: { SUPABASE_ACCESS_TOKEN: { fromEnv: "SUPABASE_ACCESS_TOKEN" } },
    }),
  },
];

export const builtInMcpServerRegistry = createMcpServerRegistry(builtInMcpServerSources);

export const builtInMcpServerNames: readonly string[] = builtInMcpServerRegistry.names;
