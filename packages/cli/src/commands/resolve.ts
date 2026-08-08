import { AgnoxError, loadAgnoxConfig, resolveAgnoxConfig, resolveStacks } from "@agnox/core";
import { Command } from "commander";

export interface ResolveCommandInput {
  /**
   * Stacks passed on the command line. When present they replace the stacks
   * from `.agnox.json`, and the project configuration is not read at all.
   */
  readonly stacks: readonly string[];
  readonly json: boolean;
  readonly cwd: string;
}

/**
 * Produces the exact text `agnox resolve` writes to stdout. Kept free of
 * terminal side effects so the behaviour can be tested directly.
 */
export async function runResolveCommand(input: ResolveCommandInput): Promise<string> {
  if (input.stacks.length > 0) {
    const requestedStacks = [...input.stacks];
    const resolvedStacks = resolveStacks(requestedStacks);

    return input.json ? toJson({ requestedStacks, resolvedStacks }) : resolvedStacks.join("\n");
  }

  const resolved = resolveAgnoxConfig(await loadAgnoxConfig(input.cwd));

  if (input.json) {
    return toJson(resolved);
  }

  return [
    "Agnox configuration",
    section("Profile", [resolved.profile]),
    section("Targets", resolved.targets),
    section("Stacks", resolved.resolvedStacks),
  ].join("\n\n");
}

export function createResolveCommand(): Command {
  return new Command("resolve")
    .description("Resolve the stack composition for this project.")
    .argument("[stacks...]", "resolve these stacks instead of the ones in .agnox.json")
    .option("--json", "print machine-readable JSON only", false)
    .action(async (stacks: string[], options: { json: boolean }) => {
      try {
        const output = await runResolveCommand({
          stacks,
          json: options.json,
          cwd: process.cwd(),
        });

        process.stdout.write(`${output}\n`);
      } catch (error) {
        if (!(error instanceof AgnoxError)) {
          throw error;
        }

        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
      }
    });
}

function section(title: string, values: readonly string[]): string {
  const lines = values.length > 0 ? values.map((value) => `  ${value}`) : ["  (none)"];

  return [title, ...lines].join("\n");
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
