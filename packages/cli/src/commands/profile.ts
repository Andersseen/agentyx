import {
  AGENTYX_PROFILES,
  type AgentyxProfile,
  getOptimizationProfile,
  optimizationProfiles,
} from "@agentyx/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export function runProfileListCommand(): string {
  return optimizationProfiles.map((profile) => profile.name).join("\n");
}

export interface ProfileShowCommandInput {
  readonly name: AgentyxProfile;
  readonly json: boolean;
}

export function runProfileShowCommand(input: ProfileShowCommandInput): string {
  const profile = getOptimizationProfile(input.name);

  if (input.json) {
    return toJson(profile);
  }

  return [
    profile.name,
    profile.goal,
    "",
    section("MCP", profile.mcpLevels),
    section("Notes", profile.notes),
  ].join("\n");
}

export function createProfileCommand(): Command {
  const profile = new Command("profile").description("Inspect optimization profiles.");

  profile
    .command("list")
    .description("List optimization profile identifiers.")
    .action(async () => {
      await emit(() => runProfileListCommand());
    });

  profile
    .command("show")
    .description("Print one optimization profile.")
    .argument("<name>", "profile identifier: lean, balanced, or autonomous")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (name: string, options: { json: boolean }) => {
      if (!AGENTYX_PROFILES.includes(name as AgentyxProfile)) {
        throw new Error(`Profile must be one of: ${AGENTYX_PROFILES.join(", ")}.`);
      }

      await emit(() => runProfileShowCommand({ name: name as AgentyxProfile, json: options.json }));
    });

  return profile;
}
