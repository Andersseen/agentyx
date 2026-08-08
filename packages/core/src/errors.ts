/**
 * Base class for every failure Agnox raises deliberately.
 *
 * Consumers can catch `AgnoxError` to separate expected domain failures from
 * unexpected runtime errors, and branch on the stable `code` when they need to
 * handle a specific failure.
 */
export class AgnoxError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AgnoxError";
    this.code = code;
  }
}
