#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from "node:fs";
import { check } from "../lib/check.mjs";
import { inspect, formatInspection } from "../lib/inspect.mjs";
import { render } from "../lib/render.mjs";

const USAGE = `Usage: opencheckpoint <command> <file> [options]

Commands:
  validate <file> [--parent <file>] [--json]   Check the schema and the semantic rules.
  inspect <file> [--json]                      What to deal with before continuing.
  render <file>                                A brief for an AI with no OpenCheckpoint support.

<file> may be "-" to read standard input. Exit codes: 0 valid, 1 invalid, 2 usage or read error.
Specification: https://opencheckpoint.org/specification/`;

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function read(path) {
  try {
    return JSON.parse(readFileSync(path === "-" ? 0 : path, "utf8"));
  } catch (e) {
    console.error(
      `opencheckpoint: cannot read ${path === "-" ? "standard input" : path}: ${e.message}`,
    );
    process.exit(2);
  }
}

function option(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args.splice(i, 2)[1];
}

function main(argv) {
  const args = [...argv];
  if (args.includes("--version")) return console.log(pkg.version);
  const json = args.includes("--json") && args.splice(args.indexOf("--json"), 1);
  const parentPath = option(args, "--parent");
  const [command, file] = args;
  if (!command || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(command ? 0 : 2);
  }
  if (!file || !["validate", "inspect", "render"].includes(command)) {
    console.error(USAGE);
    process.exit(2);
  }
  const doc = read(file);
  const result = check(doc, parentPath ? read(parentPath) : undefined);

  if (command === "validate") {
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(result.level === "ok" ? "valid" : `invalid (${result.level})`);
      for (const e of result.errors)
        console.log(
          typeof e === "string" ? `  error ${e}` : `  error ${e.code} ${e.path}: ${e.message}`,
        );
      for (const w of result.warnings) console.log(`  warning ${w.code} ${w.path}: ${w.message}`);
    }
    process.exit(result.level === "ok" ? 0 : 1);
  }

  // inspect and render read the document's fields, which only a valid document guarantees.
  if (result.level !== "ok") {
    console.error(
      `opencheckpoint: ${file} is invalid (${result.level}); run "opencheckpoint validate ${file}"`,
    );
    process.exit(1);
  }
  if (command === "inspect") {
    const r = inspect(doc);
    console.log(json ? JSON.stringify(r, null, 2) : formatInspection(r));
  } else process.stdout.write(render(doc));
}

main(process.argv.slice(2));
