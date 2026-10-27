// SPDX-License-Identifier: Apache-2.0
//
// Conformance harness for the OpenCheckpoint repository.
//
// Runs every case in tests/conformance/manifest.json against the JSON Schema
// (syntactic validity) and the semantic rules of spec/versions/v0.1.md §8
// (semantic consistency), then validates every example checkpoint.
//
// This harness is test tooling, not an SDK. Implementations run the same
// manifest with their own validators; see tests/conformance/README.md.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { check } from "../packages/cli/lib/check.mjs";

export { check, checkSemantics, checkTransition } from "../packages/cli/lib/check.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

// ---- runner ----

function main() {
  const codes = (list) => [...new Set(list.map((e) => e.code))].sort();
  let failures = 0;
  const fail = (id, why) => {
    failures++;
    console.log(`FAIL ${id}: ${why}`);
  };

  const manifest = readJson("tests/conformance/manifest.json");
  for (const c of manifest.cases) {
    const base = "tests/conformance";
    const doc = readJson(join(base, c.file));
    const parent = c.parent ? readJson(join(base, c.parent)) : undefined;
    const result = check(doc, parent);
    const want = c.expect;

    if (want.result === "valid") {
      if (result.level !== "ok") {
        fail(c.id, `expected valid, got ${result.level}: ${JSON.stringify(result.errors)}`);
        continue;
      }
      const roundTrip = JSON.parse(JSON.stringify(doc));
      if (!isDeepStrictEqual(roundTrip, doc)) fail(c.id, "round trip changed the document");
    } else if (result.level !== want.result) {
      fail(c.id, `expected ${want.result}, got ${result.level}: ${JSON.stringify(result.errors)}`);
      continue;
    } else if (
      want.result === "semantic" &&
      !isDeepStrictEqual(codes(result.errors), [...want.errors].sort())
    ) {
      fail(c.id, `expected errors ${want.errors}, got ${codes(result.errors)}`);
      continue;
    }
    const gotWarnings = codes(result.warnings);
    if (!isDeepStrictEqual(gotWarnings, [...(want.warnings ?? [])].sort())) {
      fail(c.id, `expected warnings ${want.warnings ?? []}, got ${gotWarnings}`);
      continue;
    }
    console.log(`ok   ${c.id}`);
  }

  // Every fixture on disk must appear in the manifest, so none is silently skipped.
  const listed = new Set(manifest.cases.flatMap((c) => [c.file, c.parent].filter(Boolean)));
  for (const dir of ["fixtures/valid", "fixtures/invalid"]) {
    const abs = join(root, "tests", dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs))
      if (f.endsWith(".json") && !listed.has(`../${dir}/${f}`))
        fail(`${dir}/${f}`, "fixture is not in the manifest");
  }

  for (const dir of readdirSync(join(root, "examples"), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const file = join("examples", dir.name, "checkpoint.json");
    if (!existsSync(join(root, file))) continue;
    const result = check(readJson(file));
    if (result.level !== "ok") fail(file, `${result.level}: ${JSON.stringify(result.errors)}`);
    else
      console.log(
        `ok   ${file}${result.warnings.length ? ` (warnings: ${codes(result.warnings)})` : ""}`,
      );
  }

  console.log(failures ? `\n${failures} failure(s)` : "\nall conformance cases passed");
  process.exit(failures ? 1 : 0);
}

// Run the manifest only when executed directly, so other tools can import check().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
