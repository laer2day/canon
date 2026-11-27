#!/usr/bin/env node
// Amplitude plugin static check. No network, no Amplitude account.
//
//   node spec/plugins/amplitude/check.mjs --college <cardinalcollege.json> --contract <property-contract.json> [--fixture <payload.json>]
//
// Exit 0: ran, the contract derives, and (when a fixture is given) the payload matches it.
// Exit 1: ran, and found drift: schema, unknown notation, excluded property emitted, hand-authored name, bad type, wrong scope.
// Exit 2: did not run (missing or unreadable input, or a pre-0.3 college). 2 is never a pass.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { auditPayload, derive, execute, trackPayload } from "./derive.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function notRun(msg) {
  process.stderr.write(`amplitude check did not run: ${msg}\n`);
  process.exit(2);
}

const collegePath = arg("college");
const contractPath = arg("contract");
const fixturePath = arg("fixture");
if (!collegePath || !contractPath) notRun("usage: --college <cardinalcollege.json> --contract <property-contract.json> [--fixture <payload.json>]");

function load(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    notRun(`cannot read ${label} ${path}: ${err.message}`);
  }
}

const college = load(collegePath, "college");
const contract = load(contractPath, "contract");
if (!college || typeof college !== "object" || Array.isArray(college)) notRun(`${collegePath} is not a CardinalCollege object`);
if (Object.hasOwn(college, "concepts") || Object.hasOwn(college, "canon")) {
  notRun(`${collegePath} uses a pre-0.3 key (concepts or top-level canon); a CardinalCollege uses cardinals and version`);
}
if (!Array.isArray(college.cardinals) || typeof college.version !== "string" || !college.version) {
  notRun(`${collegePath} has no cardinals array or no version`);
}

const schema = JSON.parse(readFileSync(join(root, "spec/property-contract.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const findings = [];
if (!validate(contract)) {
  for (const err of validate.errors) findings.push({ code: "schema", detail: `${err.instancePath || "/"} ${err.message}` });
}

let derived = null;
if (findings.length === 0) {
  derived = derive(college, contract);
  for (const err of derived.errors) findings.push(err);
}

if (findings.length === 0 && fixturePath) {
  const fixture = load(fixturePath, "fixture");
  const payload = fixture.payload ?? fixture;
  for (const finding of auditPayload(derived, payload)) findings.push(finding);
}

// Default path, no fixture: prove the excluded class is refused on the contract itself.
// A contract with an excluded property must yield a refusal and a track payload that omits the value.
if (findings.length === 0 && !fixturePath) {
  for (const row of derived.refusals) {
    const built = trackPayload(derived, {
      kind: row.scope === "page" ? "page" : row.scope === "user" ? "user" : "element",
      notation: row.notation,
      values: { [row.name]: "refused-value" },
    });
    if (!built.refusals.some((item) => item.name === row.name && item.reason === "privacy-excluded")) {
      findings.push({ code: "refusal_missing", name: row.name, notation: row.notation });
    }
    if (row.name in built.event.event_properties) {
      findings.push({ code: "excluded_emitted", name: row.name, notation: row.notation });
    }
    const stripped = execute(derived, { event_type: "canon:click", event_properties: { [row.name]: "refused-value" } });
    if (stripped == null || typeof stripped !== "object") findings.push({ code: "execute_dropped", name: row.name });
    if (stripped && row.name in (stripped.event_properties ?? {})) {
      findings.push({ code: "excluded_emitted", name: row.name, detail: "execute left an excluded property on the event" });
    }
  }
}

const report = {
  plugin: "amplitude",
  layer: "static",
  college: `${college.prefix}@${college.version}`,
  pass: findings.length === 0,
  refusals: derived ? derived.refusals : [],
  findings,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(findings.length ? 1 : 0);
