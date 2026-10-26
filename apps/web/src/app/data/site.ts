import { PACKS } from "./packs.js";
import { PROVIDERS } from "./providers.js";

/**
 * Catalogue-wide facts shown on the marketing pages. Packs and targets derive from their data;
 * Skill and MCP totals cannot (the site imports no workspace package), so
 * `test/site-facts.test.ts` checks them against the core registry.
 */
export const PACK_COUNT = PACKS.length;
export const TARGET_COUNT = PROVIDERS.length;
export const SKILL_COUNT = 73;
export const MCP_SERVER_COUNT = 7;

/** The composition shown on the home page. Every number is a real `resolve` result. */
export const EXAMPLE_COMPOSITION = {
  packs: ["technical", "typescript", "angular", "creative-web", "ui-ux", "accessibility"],
  enable: ["playwright"],
  skills: 27,
  mcpServers: 2,
} as const;
