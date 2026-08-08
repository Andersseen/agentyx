import { isAbsolute, relative, sep } from "node:path";
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
 * Renders `path` relative to `root` with `/` separators.
 *
 * Absolute paths differ per machine and separators differ per platform, so
 * everything user-facing and everything asserted in a test uses this form.
 */
export function toDisplayPath(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}
