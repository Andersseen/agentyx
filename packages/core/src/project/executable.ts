import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter } from "node:path";

/** Whether `command` resolves to an executable file, via `PATH` unless it already contains a `/`. */
export async function isExecutableOnPath(command: string): Promise<boolean> {
  if (command.includes("/")) {
    return isFileExecutable(command);
  }

  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory.length === 0) {
      continue;
    }

    if (await isFileExecutable(`${directory}/${command}`)) {
      return true;
    }
  }

  return false;
}

async function isFileExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
