import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve, win32 } from "node:path";

export interface ExecutableLookupOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
}

/** Whether `command` resolves to an executable file without invoking it. */
export async function isExecutableOnPath(
  command: string,
  options: ExecutableLookupOptions = {},
): Promise<boolean> {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const pathApi = platform === "win32" ? win32 : { isAbsolute, join, resolve };
  const candidates = executableCandidates(command, platform, env.PATHEXT);

  if (hasPathSeparator(command)) {
    const path = pathApi.isAbsolute(command) ? command : pathApi.resolve(cwd, command);
    return someCandidate(path, candidates, platform);
  }

  const pathDelimiter = platform === "win32" ? ";" : delimiter;

  for (const directory of (env.PATH ?? "").split(pathDelimiter)) {
    if (directory.length === 0) {
      continue;
    }

    if (await someCandidate(pathApi.join(directory, command), candidates, platform)) {
      return true;
    }
  }

  return false;
}

/** Candidate suffixes used by executable lookup; exported for platform-neutral tests. */
export function executableCandidates(
  command: string,
  platform: NodeJS.Platform = process.platform,
  pathext = process.env.PATHEXT,
): readonly string[] {
  if (platform !== "win32") {
    return [command];
  }

  if (/[.][^\\/]+$/.test(command)) {
    return [command];
  }

  const extensions = (pathext ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter((extension) => extension.length > 0)
    .map((extension) => extension.toLowerCase());

  return [command, ...extensions.map((extension) => `${command}${extension}`)];
}

function hasPathSeparator(command: string): boolean {
  return command.includes("/") || command.includes("\\") || isAbsolute(command);
}

async function someCandidate(
  path: string,
  candidates: readonly string[],
  platform: NodeJS.Platform,
): Promise<boolean> {
  const original = candidates[0];

  if (original === undefined) {
    return false;
  }

  for (const candidate of candidates) {
    const candidatePath =
      candidate === original ? path : `${path}${candidate.slice(original.length)}`;

    if (await isFileExecutable(candidatePath, platform)) {
      return true;
    }
  }

  return false;
}

async function isFileExecutable(path: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    await access(path, platform === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
