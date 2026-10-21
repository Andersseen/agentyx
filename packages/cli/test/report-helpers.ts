import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSyncCommand } from "../src/commands/sync.js";

const created: string[] = [];

export async function cleanupProjects(): Promise<void> {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

export async function reportProject(config: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agentyx-report-"));
  created.push(dir);
  await writeFile(join(dir, ".agentyx.json"), JSON.stringify(config), "utf8");
  return dir;
}

export function sync(cwd: string): Promise<string> {
  return runSyncCommand({ cwd, dryRun: false, json: false, force: false });
}

export async function addLocalSkill(cwd: string, name: string): Promise<void> {
  await mkdir(join(cwd, "local-skills", name), { recursive: true });
  await writeFile(
    join(cwd, "local-skills", name, "SKILL.md"),
    `---\nname: ${name}\ndescription: Local fixture.\n---\n\nSECRET-SKILL-BODY-MARKER\n`,
  );
}

/** Every file under the project with its content, for "nothing else was written" assertions. */
export async function tree(root: string, prefix = ""): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix === "" ? entry.name : `${prefix}/${entry.name}`;

    if (entry.isDirectory()) Object.assign(out, await tree(root, rel));
    else out[rel] = await readFile(join(root, rel), "utf8");
  }

  return out;
}

export const fullConfig = {
  packs: ["technical", "efficiency"],
  targets: ["codex", "claude"],
  project: { id: "report-web", name: "Report Web", owns: ["frontend"] },
  relations: [{ id: "report-api", name: "Report API", type: "consumes", role: "backend-api" }],
  context: { constraints: ["Descriptive only."] },
};
