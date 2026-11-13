// MCP bootstrap: drift sources must be surfaced, and the jobs must assign through the persona orchestrator.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { bootstrap } from "../spec/mcp/bootstrap.mjs";
import { scan } from "../spec/mcp/scan.mjs";
import { createState, handleMessage } from "../spec/mcp/server.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "spec/mcp/fixtures");
const orchestrator = join(root, "spec/personas/orchestrator.mjs");
const EVIDENCE = new Set(["tested", "documented", "observed", "design"]);
const DRIFT = ["set-attribute", "input-props", "css-selector"];

function kinds(scanned) {
  return new Set(scanned.facts.map((fact) => fact.kind));
}

describe("scan surfaces drift instead of missing it", () => {
  it("stamps every fact with an evidence class", () => {
    const scanned = scan(join(fixtures, "all-drift"));
    assert.ok(scanned.facts.length > 0);
    for (const fact of scanned.facts) assert.ok(EVIDENCE.has(fact.evidence), JSON.stringify(fact));
  });

  it("sees setAttribute even when the file has no data-element attribute", () => {
    const scanned = scan(join(fixtures, "set-attribute"));
    assert.ok(kinds(scanned).has("set-attribute"));
    assert.equal(kinds(scanned).has("data-element"), false);
    assert.deepEqual(scanned.drift, ["set-attribute"]);
  });

  it("sees inputProps values", () => {
    const scanned = scan(join(fixtures, "input-props"));
    assert.ok(kinds(scanned).has("input-props"));
    assert.equal(kinds(scanned).has("data-element"), false);
    assert.deepEqual(scanned.drift, ["input-props"]);
  });

  it("sees CSS-selector element definitions", () => {
    const scanned = scan(join(fixtures, "css-selector"));
    assert.ok(kinds(scanned).has("css-selector"));
    assert.equal(scanned.facts.some((fact) => fact.selector === ".btn-buy"), true);
    assert.deepEqual(scanned.drift, ["css-selector"]);
  });

  it("does not invent those drift codes for a static attribute", () => {
    const scanned = scan(join(fixtures, "attribute-only"));
    assert.ok(kinds(scanned).has("data-element"));
    assert.deepEqual(scanned.drift, []);
    for (const code of DRIFT) assert.equal(kinds(scanned).has(code), false, code);
  });

  it("names all three drift codes together and validates a college in-process", () => {
    const scanned = scan(join(fixtures, "all-drift"));
    assert.deepEqual(scanned.drift, DRIFT);
    const college = scanned.facts.find((fact) => fact.kind === "cardinal-college");
    assert.ok(college, JSON.stringify(scanned.facts, null, 2));
    assert.equal(college.evidence, "tested");
    assert.equal(college.where, "spec/canon.schema.json");
    assert.equal(scanned.level, "emitting");
    assert.equal(scanned.levelEvidence, "design");
  });

  it("records a pre-0.3 document as observed and does not call it a CardinalCollege", () => {
    const scanned = scan(join(fixtures, "pre-0.3"));
    assert.ok(kinds(scanned).has("pre-0.3-college"));
    assert.equal(kinds(scanned).has("cardinal-college"), false);
    assert.equal(scanned.facts.find((fact) => fact.kind === "pre-0.3-college").evidence, "observed");
  });
});

describe("bootstrap jobs are what the orchestrator assigns", () => {
  it("names each drift code in the inventory job and still assigns", () => {
    const built = bootstrap(scan(join(fixtures, "all-drift")));
    const inventory = built.jobs.jobs.find((job) => job.id === "inventory-cardinals");
    for (const code of DRIFT) assert.ok(inventory.reason.includes(code), inventory.reason);
    assert.ok(inventory.files.some((file) => file.endsWith("widget.js")));
    assert.ok(inventory.files.some((file) => file.endsWith("Field.jsx")));
    assert.ok(inventory.files.some((file) => file.endsWith("elements.json")));
    const file = join(mkdtempSync(join(tmpdir(), "mcp-jobs-")), "jobs.json");
    writeFileSync(file, JSON.stringify(built.jobs));
    const run = spawnSync(process.execPath, [orchestrator, "assign", "--jobs", file], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    const report = JSON.parse(run.stdout);
    assert.equal(report.assignments.length, 4);
    assert.ok(report.assignments.every((row) => row.personaFile.endsWith(`${row.persona}/persona.json`)));
  });

  it("does not put drift codes on an attribute-only scan", () => {
    const built = bootstrap(scan(join(fixtures, "attribute-only")));
    for (const job of built.jobs.jobs) {
      for (const code of DRIFT) assert.equal(job.reason.includes(code), false, `${job.id} ${job.reason}`);
    }
    assert.deepEqual(built.drift, []);
  });
});

describe("MCP server erects tools from the scan", () => {
  it("lists the four jobs and puts drift in the tool description", () => {
    const state = createState(join(fixtures, "all-drift"));
    const init = handleMessage(state, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    });
    assert.equal(init.result.serverInfo.name, "canon-bootstrap");
    const listed = handleMessage(state, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = listed.result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      "canon_scan",
      "derive_plugin_outputs",
      "emit_attributes",
      "inventory_cardinals",
      "run_conformance",
    ]);
    const inventory = listed.result.tools.find((tool) => tool.name === "inventory_cardinals");
    for (const code of DRIFT) assert.ok(inventory.description.includes(code), inventory.description);
  });

  it("returns facts with evidence classes from a tool call", () => {
    const state = createState(join(fixtures, "set-attribute"));
    const call = handleMessage(state, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "inventory_cardinals" } });
    const body = JSON.parse(call.result.content[0].text);
    assert.ok(body.facts.some((fact) => fact.kind === "set-attribute" && fact.evidence === "observed"));
    assert.equal(body.levelEvidence, "design");
  });

  it("does not run without --root (exit 2)", () => {
    const run = spawnSync(process.execPath, [join(root, "spec/mcp/server.mjs")], { encoding: "utf8" });
    assert.equal(run.status, 2);
    assert.match(run.stderr, /did not run/);
  });

  it("answers initialize on stdio", () => {
    const run = spawnSync(process.execPath, [join(root, "spec/mcp/server.mjs"), "--root", join(fixtures, "attribute-only")], {
      input: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n",
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    const message = JSON.parse(run.stdout.trim().split("\n")[0]);
    assert.equal(message.result.serverInfo.name, "canon-bootstrap");
  });
});
