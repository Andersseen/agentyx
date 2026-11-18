import assert from "node:assert/strict";
import { parsePort } from "./src.mjs";

assert.equal(parsePort("8080"), 8080);
assert.equal(parsePort("0"), null);
assert.equal(parsePort("65536"), null);
assert.equal(parsePort("80x"), null);
console.log("port tests passed");
