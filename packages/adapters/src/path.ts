import { lstat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { InstallPathError } from "./errors.js";

/**
 * Fails unless `path` is strictly inside `root`.
 *
 * This is the containment rule the whole install pipeline rests on: a plan may
 * only touch files below the directory an adapter owns, and that directory must
 * itself be below the project. `root` itself does not count as inside it, so an
 * adapter cannot claim the project root.
 *
 * @throws {InstallPathError} when `path` escapes `root`.
 */
export function assertInside(path: string, root: string): void {
  const offset = relative(root, path);

  if (offset === "" || offset === ".." || offset.startsWith(`..${sep}`) || isAbsolute(offset)) {
    throw new InstallPathError(path, root);
  }
}

/**
 * Fails unless `path` is inside `root` without crossing an existing symlink.
 *
 * `assertInside` is lexical: it catches `../` and absolute-path escapes, but the
 * filesystem can still redirect an otherwise-valid path through a symlink. This
 * guard walks the existing path segments before a plan reads, writes or deletes
 * so a project-local destination cannot resolve outside the project at runtime.
 */
export async function assertInsideRealPath(path: string, root: string): Promise<void> {
  assertInside(path, root);

  let current = root;
  for (const segment of relative(root, path).split(sep)) {
    current = join(current, segment);

    const stats = await lstatExisting(current);
    if (stats === undefined) {
      return;
    }

    if (stats.isSymbolicLink()) {
      throw new InstallPathError(path, root);
    }
  }
}

async function lstatExisting(path: string) {
  try {
    return await lstat(path);
  } catch (cause) {
    if (cause instanceof Error && (cause as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw cause;
  }
}

/**
 * Renders `path` relative to `root` with `/` separators.
 *
 * Absolute paths differ per machine and separators differ per platform, so
 * everything user-facing and everything asserted in a test uses this form.
 */
export function toDisplayPath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}
