import { AgentyxError } from "../errors.js";

/**
 * Raised when a requested or inherited stack is not present in the registry.
 *
 * The offending name is exposed as `stackName`; `stack` stays the JS stack
 * trace inherited from `Error`.
 */
export class UnknownStackError extends AgentyxError {
  readonly stackName: string;
  readonly requiredBy: string | undefined;
  readonly knownStacks: readonly string[];

  constructor(stackName: string, requiredBy: string | undefined, knownStacks: readonly string[]) {
    const origin = requiredBy === undefined ? "" : ` (required by "${requiredBy}")`;
    const known = knownStacks.length > 0 ? [...knownStacks].sort().join(", ") : "none";

    super("unknown_stack", `Unknown stack "${stackName}"${origin}. Known stacks: ${known}.`);
    this.name = "UnknownStackError";
    this.stackName = stackName;
    this.requiredBy = requiredBy;
    this.knownStacks = knownStacks;
  }
}

/** Raised when stack inheritance forms a cycle. */
export class CircularStackDependencyError extends AgentyxError {
  /** The cycle path, starting and ending with the same stack. */
  readonly cycle: readonly string[];

  constructor(cycle: readonly string[]) {
    super("circular_stack_dependency", `Circular stack dependency: ${cycle.join(" -> ")}.`);
    this.name = "CircularStackDependencyError";
    this.cycle = cycle;
  }
}

/** Raised when a registry is built from definitions that reuse a stack name. */
export class DuplicateStackError extends AgentyxError {
  readonly stackName: string;

  constructor(stackName: string) {
    super("duplicate_stack", `Duplicate stack definition: "${stackName}".`);
    this.name = "DuplicateStackError";
    this.stackName = stackName;
  }
}
