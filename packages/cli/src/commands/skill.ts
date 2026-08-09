import { builtInSkillRegistry } from "@agentyx/core";
import { Command } from "commander";
import { emit, toJson } from "../output.js";

/** The built-in skill identifiers, one per line. Never reads a skill body. */
export function runSkillListCommand(): string {
  return builtInSkillRegistry.names.join("\n");
}

export interface SkillShowCommandInput {
  readonly name: string;
  readonly json: boolean;
}

/**
 * Renders one skill in full — this is the command that loads instructions.
 *
 * @throws {UnknownSkillError} when the skill is not registered.
 */
export function runSkillShowCommand(input: SkillShowCommandInput): string {
  const skill = builtInSkillRegistry.get(input.name);

  if (input.json) {
    return toJson(skill);
  }

  return [skill.name, skill.description, "", skill.content].join("\n");
}

export function createSkillCommand(): Command {
  const skill = new Command("skill").description("Inspect the skills Agentyx ships with.");

  skill
    .command("list")
    .description("List the built-in skill identifiers.")
    .action(async () => {
      await emit(() => runSkillListCommand());
    });

  skill
    .command("show")
    .description("Print one skill, including its instructions.")
    .argument("<name>", "skill identifier, for example angular-modern")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (name: string, options: { json: boolean }) => {
      await emit(() => runSkillShowCommand({ name, json: options.json }));
    });

  return skill;
}
