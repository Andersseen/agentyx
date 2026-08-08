import { AgnoxError } from "@agnox/core";

/**
 * Runs a command body and writes its output.
 *
 * Domain failures are the expected way commands report a problem, so they print
 * their message on stderr and set exit code 1. Anything else is a bug and is
 * left to surface as a crash.
 */
export async function emit(produce: () => string | Promise<string>): Promise<void> {
  try {
    process.stdout.write(`${await produce()}\n`);
  } catch (error) {
    if (!(error instanceof AgnoxError)) {
      throw error;
    }

    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

/** A titled, indented block of values, with an explicit marker when empty. */
export function section(title: string, values: readonly string[]): string {
  const lines = values.length > 0 ? values.map((value) => `  ${value}`) : ["  (none)"];

  return [title, ...lines].join("\n");
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
