import assert from "node:assert/strict";
import { importFromRun } from "./support.mjs";

const { greeting } = await importFromRun("src.mjs");

assert.equal(greeting(), "Hello, Agentyx!");
