import assert from "node:assert/strict";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const { greeting } = await import(pathToFileURL(join(process.cwd(), "src.mjs")));

assert.equal(greeting(), "Hello, Agentyx!");
