import { randomBytes } from "node:crypto";
import { lstat, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ReportOutputExistsError, ReportOutputPathError, ReportWriteError } from "./errors.js";

export const DEFAULT_REPORT_PATH = "agentyx-report.html";

/**
 * Writes the report to one explicitly requested project-relative HTML file.
 *
 * The report is a user artifact, not managed harness state: it never joins the lock, and only the
 * requested path is touched. Without `overwrite` an existing file is a stable error; with it the
 * file is replaced through a same-directory temporary file so a reader never sees a partial report.
 */
export async function writeReportFile(input: {
  readonly cwd: string;
  readonly output: string;
  readonly html: string;
  readonly overwrite: boolean;
}): Promise<void> {
  const { cwd, output, html, overwrite } = input;

  if (output.length === 0 || isAbsolute(output)) {
    throw new ReportOutputPathError("Report path must be a non-empty project-relative path.");
  }

  if (!/\.html?$/i.test(output)) {
    throw new ReportOutputPathError("Report path must end in .html so no other file is replaced.");
  }

  const root = await realpath(cwd);
  const destination = resolve(cwd, output);

  if (!isInside(resolve(cwd), destination)) {
    throw new ReportOutputPathError("Report path must stay inside the project.");
  }

  let parent: string;

  try {
    parent = await realpath(dirname(destination));
  } catch (cause) {
    throw new ReportOutputPathError(
      `Directory for ${output} does not exist or cannot be read: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  if (!isInside(root, parent)) {
    throw new ReportOutputPathError("Report path must stay inside the project.");
  }

  const target = join(parent, basename(destination));
  const existing = await lstat(target).catch((cause: NodeJS.ErrnoException) => {
    if (cause.code === "ENOENT") return undefined;
    throw new ReportWriteError(output, cause);
  });

  if (existing !== undefined) {
    if (existing.isSymbolicLink() || !existing.isFile()) {
      throw new ReportOutputPathError(`${output} exists and is not a regular file.`);
    }

    if (!overwrite) throw new ReportOutputExistsError(output);
  }

  if (!overwrite) {
    try {
      await writeFile(target, html, { encoding: "utf8", flag: "wx" });
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "EEXIST") {
        throw new ReportOutputExistsError(output);
      }

      throw new ReportWriteError(output, cause);
    }

    return;
  }

  const temporary = join(parent, `.${basename(target)}.${randomBytes(6).toString("hex")}.tmp`);

  try {
    await writeFile(temporary, html, { encoding: "utf8", flag: "wx" });
    await rename(temporary, target);
  } catch (cause) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw new ReportWriteError(output, cause);
  }
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);

  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
