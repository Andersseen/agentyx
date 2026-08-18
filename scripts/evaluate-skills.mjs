import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  builtInPackRegistry,
  builtInSkillRegistry,
  resolveAgentyxConfig,
} from "../packages/core/dist/index.mjs";

const suitePath = fileURLToPath(new URL("../evals/skill-behavior.json", import.meta.url));
const scenarios = JSON.parse(await readFile(suitePath, "utf8"));
const seen = new Set();

if (!Array.isArray(scenarios) || scenarios.length === 0) {
  throw new Error("The Skill evaluation suite must contain at least one scenario.");
}

for (const scenario of scenarios) {
  assertNonEmptyString(scenario.id, "scenario id");
  assertNonEmptyString(scenario.prompt, `${scenario.id} prompt`);
  assertStringArray(scenario.packs, `${scenario.id} packs`);
  assertStringArray(scenario.expectedSkills, `${scenario.id} expectedSkills`);
  assertStringArray(scenario.expectedBehaviors, `${scenario.id} expectedBehaviors`);

  if (seen.has(scenario.id)) {
    throw new Error(`Duplicate evaluation scenario: ${scenario.id}`);
  }

  seen.add(scenario.id);
  const resolved = resolveAgentyxConfig(
    { packs: scenario.packs, enable: [], targets: [] },
    builtInPackRegistry,
    builtInSkillRegistry,
  );

  for (const skill of scenario.expectedSkills) {
    if (!resolved.skills.includes(skill)) {
      throw new Error(`${scenario.id} expects ${skill}, but its packs do not contribute it.`);
    }
  }
}

console.log(`Skill evaluation suite valid: ${scenarios.length} scenarios.`);

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function assertStringArray(value, name) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string")
  ) {
    throw new Error(`${name} must be a non-empty string array.`);
  }
}
