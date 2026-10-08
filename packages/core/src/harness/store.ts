import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
  type HarnessObservation,
  harnessObservationSchema,
  parseObservationLine,
} from "./observation.js";

/** File name inside the Agentyx-owned directory; the suffix is the observation version. */
export const USAGE_FILE_NAME = "usage-v2.jsonl";

/**
 * Earlier observation files. They are never read, migrated or deleted: v1 sessions were not tied to
 * a harness baseline, so they cannot be told apart from sessions of a different configuration.
 */
export const LEGACY_USAGE_FILE_NAMES = ["usage-v1.jsonl"] as const;

/**
 * Retention heuristics. They are product choices, not scientific constants: enough recent sessions
 * to see a pattern, small enough that the state never becomes an analytics log.
 */
export const MAX_RETAINED_SESSIONS = 50;
export const MAX_USAGE_FILE_BYTES = 256 * 1024;
/** Compaction runs once the file passes this size, and whenever a session ends. */
export const COMPACTION_THRESHOLD_BYTES = 128 * 1024;

/**
 * Where runtime observations live: `<git dir>/agentyx/usage-v2.jsonl`.
 *
 * Git ignores unknown directories inside its own metadata directory, so the state never shows up in
 * `git status`, is never committed, needs no `.gitignore` entry and disappears with the checkout. The
 * git dir is found the way Git does: `.git` may be a directory, or a file containing
 * `gitdir: <path>` (linked worktrees and submodules). Agentyx only ever creates its own `agentyx`
 * subdirectory there. Outside a Git checkout there is no safe project-local location, so this
 * returns `undefined` and nothing is recorded — it never falls back to `$HOME`.
 */
export async function resolveUsageFile(projectDir: string): Promise<string | undefined> {
  let dir = resolve(projectDir);

  for (;;) {
    const gitDir = await gitDirOf(dir);

    if (gitDir !== undefined) {
      return join(gitDir, "agentyx", USAGE_FILE_NAME);
    }

    const parent = dirname(dir);

    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
}

async function gitDirOf(dir: string): Promise<string | undefined> {
  const dotGit = join(dir, ".git");

  try {
    const info = await stat(dotGit);

    if (info.isDirectory()) {
      return dotGit;
    }

    const match = /^gitdir:\s*(.+?)\s*$/m.exec(await readFile(dotGit, "utf8"));

    if (match?.[1] === undefined) {
      return undefined;
    }

    const target = isAbsolute(match[1]) ? match[1] : resolve(dir, match[1]);

    return (await stat(target)).isDirectory() ? target : undefined;
  } catch {
    return undefined;
  }
}

/** Reads every valid observation; malformed lines are skipped, a missing file is empty. */
export async function readObservations(projectDir: string): Promise<{
  readonly available: boolean;
  /** The store file exists, even if none of its lines are valid. */
  readonly present: boolean;
  /** An ignored earlier-format file sits next to the store. */
  readonly legacyData: boolean;
  readonly observations: readonly HarnessObservation[];
}> {
  const file = await resolveUsageFile(projectDir);

  if (file === undefined) {
    return { available: false, present: false, legacyData: false, observations: [] };
  }

  const legacyData = (
    await Promise.all(
      LEGACY_USAGE_FILE_NAMES.map((name) =>
        stat(join(dirname(file), name)).then(
          (info) => info.isFile(),
          () => false,
        ),
      ),
    )
  ).some(Boolean);

  try {
    const text = await readFile(file, "utf8");

    return {
      available: true,
      present: true,
      legacyData,
      observations: text
        .split("\n")
        .map(parseObservationLine)
        .filter((observation) => observation !== undefined),
    };
  } catch {
    return { available: true, present: false, legacyData, observations: [] };
  }
}

/**
 * Appends one observation, compacting when the file has grown or a session ends.
 *
 * Returns `false` when there is nowhere safe to write. Concurrent writers can in principle lose a
 * line during compaction; this is best-effort analytics, not an audit log.
 */
export async function recordObservation(
  projectDir: string,
  observation: HarnessObservation,
): Promise<boolean> {
  const file = await resolveUsageFile(projectDir);

  if (file === undefined) {
    return false;
  }

  const valid = harnessObservationSchema.parse(observation);

  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(valid)}\n`, "utf8");

  if (valid.event === "session-end" || (await stat(file)).size > COMPACTION_THRESHOLD_BYTES) {
    await compactUsageFile(file);
  }

  return true;
}

/**
 * Collapses identical records into one with a `count`, keeps the most recent
 * {@link MAX_RETAINED_SESSIONS} sessions and drops the oldest sessions until the file fits
 * {@link MAX_USAGE_FILE_BYTES}.
 */
export async function compactUsageFile(file: string): Promise<void> {
  const text = await readFile(file, "utf8");

  const compacted = compactObservations(
    text
      .split("\n")
      .map(parseObservationLine)
      .filter((observation) => observation !== undefined),
  );
  const body = compacted.map((observation) => JSON.stringify(observation)).join("\n");
  const temporary = `${file}.${process.pid}.tmp`;

  await writeFile(temporary, body === "" ? "" : `${body}\n`, "utf8");
  await rename(temporary, file);
}

/** Pure part of compaction, exported for tests. */
export function compactObservations(
  observations: readonly HarnessObservation[],
  limits: { readonly sessions: number; readonly bytes: number } = {
    sessions: MAX_RETAINED_SESSIONS,
    bytes: MAX_USAGE_FILE_BYTES,
  },
): HarnessObservation[] {
  const merged = new Map<string, HarnessObservation>();
  const lastSeen = new Map<string, string>();

  for (const observation of observations) {
    const sessionKey = `${observation.provider}:${observation.session}`;
    const previousSeen = lastSeen.get(sessionKey);

    if (previousSeen === undefined || previousSeen < observation.timestamp) {
      lastSeen.set(sessionKey, observation.timestamp);
    }

    const key = [
      sessionKey,
      observation.event,
      observation.capabilityKind ?? "",
      observation.capability ?? "",
      observation.contextTokens ?? "",
      observation.baseline ?? "",
    ].join("\0");
    const existing = merged.get(key);

    merged.set(
      key,
      existing === undefined
        ? observation
        : {
            ...existing,
            timestamp:
              existing.timestamp > observation.timestamp
                ? existing.timestamp
                : observation.timestamp,
            count: (existing.count ?? 1) + (observation.count ?? 1),
          },
    );
  }

  const keep = new Set(
    [...lastSeen.entries()]
      .sort((left, right) => (left[1] < right[1] ? 1 : left[1] > right[1] ? -1 : 0))
      .slice(0, limits.sessions)
      .map(([sessionKey]) => sessionKey),
  );
  const retained = [...merged.values()]
    .filter((observation) => keep.has(`${observation.provider}:${observation.session}`))
    .sort((left, right) =>
      left.timestamp < right.timestamp ? -1 : left.timestamp > right.timestamp ? 1 : 0,
    );

  // Size cap: drop the oldest sessions until the serialized records fit.
  const sizeOf = (list: readonly HarnessObservation[]): number =>
    list.reduce((total, observation) => total + JSON.stringify(observation).length + 1, 0);
  let result = retained;

  while (result.length > 0 && sizeOf(result) > limits.bytes) {
    const oldest = result[0];

    if (oldest === undefined) {
      break;
    }

    const oldestKey = `${oldest.provider}:${oldest.session}`;

    result = result.filter(
      (observation) => `${observation.provider}:${observation.session}` !== oldestKey,
    );
  }

  return result;
}
