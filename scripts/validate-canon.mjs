#!/usr/bin/env node
// usage: node --experimental-strip-types --no-warnings scripts/validate-canon.mjs <canon.json>
// Validates a canon against the NORMATIVE schema (spec/canon.schema.json) and then the repo's own rule
// checker (validateCanon in src/lib/check.ts). Prints VALID, or INVALID followed by every error.
// Exit 0 when valid, 1 when invalid, 2 on a usage or read error.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { validateCanon } from "../src/lib/check.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/validate-canon.mjs <canon.json>");
  process.exit(2);
}

let canon;
try {
  canon = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error(`cannot read ${file}: ${err.message}`);
  process.exit(2);
}

const schema = JSON.parse(readFileSync(join(root, "spec/canon.schema.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const errors = [];
if (!validate(canon)) {
  for (const e of validate.errors) errors.push(`schema: ${e.instancePath || "/"} ${e.message}`);
}
// validateCanon assumes the shape the schema just checked; only run it on a shape-valid document so a
// malformed file reports schema errors instead of crashing the rule checker.
if (errors.length === 0) {
  for (const e of validateCanon(canon)) errors.push(`rule: ${e}`);
}

if (errors.length === 0) {
  console.log("VALID");
  process.exit(0);
}
console.log(`INVALID ${errors.length} error(s)`);
for (const e of errors) console.log(`  ${e}`);
process.exit(1);
