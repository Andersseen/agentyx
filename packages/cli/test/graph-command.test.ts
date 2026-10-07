import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runGraphCommand } from "../src/commands/graph.js";

describe("graph command", () => {
  let directory: string;
  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  async function project(config: unknown): Promise<string> {
    directory = await mkdtemp(join(tmpdir(), "agentyx-graph-"));
    await writeFile(join(directory, ".agentyx.json"), JSON.stringify(config));
    return directory;
  }

  it("renders text, JSON, and Mermaid from the same graph", async () => {
    const cwd = await project({
      project: { id: "web", name: "Web" },
      relations: [{ id: "api", name: "API", type: "consumes", role: "backend-api" }],
    });
    expect(await runGraphCommand({ cwd, format: "text" })).toContain(
      "consumes [backend-api] → API",
    );
    expect(await runGraphCommand({ cwd, format: "json" })).toContain('"id": "api"');
    expect(await runGraphCommand({ cwd, format: "mermaid" })).toContain("graph LR");
  });

  it("writes SVG only to a new path inside the project", async () => {
    const cwd = await project({ project: { id: "web", name: "Web" }, relations: [] });
    await expect(runGraphCommand({ cwd, format: "svg" })).rejects.toThrow(/requires --output/);
    await expect(runGraphCommand({ cwd, format: "svg", output: "../escape.svg" })).rejects.toThrow(
      /inside the project/,
    );
    await runGraphCommand({ cwd, format: "svg", output: "graph.svg" });
    expect(await readFile(join(cwd, "graph.svg"), "utf8")).toContain("<svg");
    await expect(runGraphCommand({ cwd, format: "svg", output: "graph.svg" })).rejects.toThrow(
      /already exists/,
    );
    await expect(
      runGraphCommand({ cwd, format: "svg", output: join(cwd, "absolute.svg") }),
    ).rejects.toThrow(/project-relative/);
    const outside = await mkdtemp(join(tmpdir(), "agentyx-graph-outside-"));
    await symlink(outside, join(cwd, "linked"));
    await expect(
      runGraphCommand({ cwd, format: "svg", output: "linked/graph.svg" }),
    ).rejects.toThrow(/inside the project/);
    await rm(outside, { recursive: true, force: true });
  });

  it("requires graph metadata", async () => {
    const cwd = await project({ packs: ["technical"] });
    await expect(runGraphCommand({ cwd, format: "text" })).rejects.toThrow(
      /requires a project object/,
    );
  });
});
