/**
 * Base class for every failure Agentyx raises deliberately.
 *
 * Consumers can catch `AgentyxError` to separate expected domain failures from
 * unexpected runtime errors, and branch on the stable `code` when they need to
 * handle a specific failure.
 */
export class AgentyxError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AgentyxError";
    this.code = code;
  }
}
