import { AgentyxError } from "@agentyx/core";

/** The requested report path is not a safe, project-relative HTML file. */
export class ReportOutputPathError extends AgentyxError {
  constructor(message: string) {
    super("report_output_path_invalid", message);
    this.name = "ReportOutputPathError";
  }
}

/** The report destination exists and `--overwrite` was not given. */
export class ReportOutputExistsError extends AgentyxError {
  constructor(output: string) {
    super(
      "report_output_exists",
      `Report file already exists: ${output}. Pass --overwrite to replace it.`,
    );
    this.name = "ReportOutputExistsError";
  }
}

/** The report could not be written. */
export class ReportWriteError extends AgentyxError {
  constructor(output: string, cause: unknown) {
    super(
      "report_write_failed",
      `Could not write ${output}: ${cause instanceof Error ? cause.message : String(cause)}`,
      { cause },
    );
    this.name = "ReportWriteError";
  }
}
