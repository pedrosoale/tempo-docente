// Validates the generated artifacts in public/data/saresp/ against each other -- not the
// calculation logic (see saresp-analysis.test.mjs for that), but whether a real
// `npm run saresp:build-data` run actually produced a self-consistent index/aliases/partitions
// set. Reads the same files the browser fetches, the same way tests/bncc-import.test.mjs reads
// data/bncc/*.json -- except schools/ has one file per school (9k+), so that side is enumerated
// via readdir instead of a static import list.
import assert from "node:assert/strict";
import test from "node:test";
import { readdir } from "node:fs/promises";
import schoolsIndex from "../public/data/saresp/schools-index.json" with { type: "json" };
import schoolsAliases from "../public/data/saresp/schools-aliases.json" with { type: "json" };

const schoolsDir = new URL("../public/data/saresp/schools/", import.meta.url);

async function partitionFiles() {
  return readdir(schoolsDir);
}

test("one partition identity per CODESC -- the index has no duplicate codesc", () => {
  const codes = schoolsIndex.map((entry) => entry.codesc);
  assert.equal(new Set(codes).size, codes.length);
});

test("no partition is missing -- every indexed school has a schools/<codesc>.json file", async () => {
  const fileCodes = new Set((await partitionFiles()).map((file) => file.replace(/\.json$/, "")));
  const missing = schoolsIndex.map((entry) => entry.codesc).filter((code) => !fileCodes.has(code));
  assert.deepEqual(missing, []);
});

test("no partition is orphaned -- every schools/*.json file has a matching index entry", async () => {
  const indexCodes = new Set(schoolsIndex.map((entry) => entry.codesc));
  const orphaned = (await partitionFiles()).map((file) => file.replace(/\.json$/, "")).filter((code) => !indexCodes.has(code));
  assert.deepEqual(orphaned, []);
});

test("every alias entry points to a school that still exists in the index", () => {
  const indexCodes = new Set(schoolsIndex.map((entry) => entry.codesc));
  const dangling = Object.keys(schoolsAliases).filter((code) => !indexCodes.has(code));
  assert.deepEqual(dangling, []);
});

test("each index entry's codesc equals its partition filename exactly -- no coercion or drift", async () => {
  const fileSet = new Set(await partitionFiles());
  for (const entry of schoolsIndex) {
    assert.ok(fileSet.has(`${entry.codesc}.json`), `codesc ${JSON.stringify(entry.codesc)} has no exact schools/${entry.codesc}.json match`);
  }
});

test("index count equals partition file count", async () => {
  assert.equal(schoolsIndex.length, (await partitionFiles()).length);
});
