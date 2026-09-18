import { createMcpServerRegistry, type McpServerSource } from "./registry.js";

/**
 * The MCP servers Agentyx ships with, expressed as data.
 *
 * `runtime` is honest about what *enabling* a server does once a provider launches it. Agentyx
 * itself performs no network access and installs nothing — but a `stdio` server whose `command` is
 * `npx` can fetch a package from the registry on first launch, exactly like running that `npx`
 * command by hand would. Those are marked `"may-download"`; a remote HTTP server or a command
 * expected to already be installed locally is `"local"`. `doctor`, `mcp show` and `pack show`
 * surface this so a user knows before they enable it.
 *
 * `npx`-launched packages are pinned to a known-compatible version rather than `@latest`, so
 * enabling a server is reproducible and does not silently pick up a new release between installs.
 */
export const builtInMcpServerSources: readonly McpServerSource[] = [
  {
    name: "context7",
    load: () => ({
      name: "context7",
      description: "Fetch up-to-date library documentation from Context7.",
      transport: "http",
      contextCost: "medium",
      runtime: "local",
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
      runtime: "may-download",
      command: "npx",
      args: ["@playwright/mcp@0.0.81"],
    }),
  },
  {
    name: "codebase-memory",
    load: () => ({
      name: "codebase-memory",
      description: "Structural code-intelligence MCP backed by a persistent code knowledge graph.",
      transport: "stdio",
      contextCost: "high",
      runtime: "local",
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
      runtime: "local",
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
      runtime: "local",
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
      runtime: "may-download",
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@1.9.0"],
    }),
  },
  {
    name: "supabase",
    load: () => ({
      name: "supabase",
      description: "Inspect and query Supabase project schemas, tables and logs.",
      transport: "stdio",
      contextCost: "high",
      runtime: "may-download",
      command: "npx",
      args: ["-y", "@supabase/mcp-server-supabase@0.13.0"],
      env: { SUPABASE_ACCESS_TOKEN: { fromEnv: "SUPABASE_ACCESS_TOKEN" } },
    }),
  },
];

export const builtInMcpServerRegistry = createMcpServerRegistry(builtInMcpServerSources);

export const builtInMcpServerNames: readonly string[] = builtInMcpServerRegistry.names;
