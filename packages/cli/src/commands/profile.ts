import {
  AGNOX_PROFILES,
  type AgnoxProfile,
  getOptimizationProfile,
  optimizationProfiles,
} from "@agnox/core";
import { Command } from "commander";
import { emit, section, toJson } from "../output.js";

export function runProfileListCommand(): string {
  return optimizationProfiles.map((profile) => profile.name).join("\n");
}

export interface ProfileShowCommandInput {
  readonly name: AgnoxProfile;
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
      if (!AGNOX_PROFILES.includes(name as AgnoxProfile)) {
        throw new Error(`Profile must be one of: ${AGNOX_PROFILES.join(", ")}.`);
      }

      await emit(() => runProfileShowCommand({ name: name as AgnoxProfile, json: options.json }));
    });

  return profile;
}
