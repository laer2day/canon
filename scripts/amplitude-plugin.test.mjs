// Amplitude plugin: derivation, the excluded-property refusal, and a check that fails on bad fixtures.
// Every exit-code claim is shown both ways (AGENTS.md rule 1). No network. No Amplitude account.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { coerce, derive, enrichmentSource, execute, trackPayload } from "../spec/plugins/amplitude/derive.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = join(root, "spec/plugins/amplitude/check.mjs");
const collegePath = join(root, "spec/cardinal-colleges/meridian.json");
const contractPath = join(root, "spec/property-contracts/meridian.json");
const fixtures = join(root, "spec/conformance/property-enrichment");
const college = JSON.parse(readFileSync(collegePath, "utf8"));
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

function run(args) {
  const r = spawnSync(process.execPath, [check, ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr, report: r.stdout ? JSON.parse(r.stdout) : null };
}

describe("amplitude derive", () => {
  const derived = derive(college, contract);

  it("reads the meridian contract with no errors", () => {
    assert.deepEqual(derived.errors, []);
    assert.equal(derived.canon, "meridian@0.1.0");
  });

  it("puts price and productId on the plan cardinal, as element properties", () => {
    const names = derived.element.filter((prop) => prop.notation === "meridian.card.plan").map((prop) => prop.name);
    assert.deepEqual(names.sort(), ["price", "productId"]);
    assert.equal(derived.element.find((prop) => prop.name === "price").type, "number");
    assert.equal(derived.element.find((prop) => prop.name === "productId").type, "string");
  });

  it("keeps section as a page property", () => {
    assert.deepEqual(derived.page.map((prop) => prop.name), ["section"]);
    assert.equal(derived.page[0].scope, "page");
  });

  it("gives the ephemeral result cardinal no properties", () => {
    assert.equal(derived.element.some((prop) => prop.notation === "meridian.list.result"), false);
    assert.equal(derived.page.some((prop) => prop.notation === "meridian.list.result"), false);
  });

  it("refuses the excluded property and does not copy its value", () => {
    assert.ok(derived.refusals.some((row) => row.name === "workEmail" && row.reason === "privacy-excluded"));
    const built = trackPayload(derived, {
      kind: "element",
      notation: "meridian.form.request-demo",
      values: { workEmail: "person@example.com" },
    });
    assert.equal(built.event.event_properties.workEmail, undefined);
    assert.ok(built.refusals.some((row) => row.reason === "privacy-excluded"));
    assert.equal(built.event.event_type, "canon:click");
  });

  it("coerces a JSON number and refuses a numeric string", () => {
    assert.equal(coerce("number", 20).ok, true);
    assert.equal(coerce("number", "20").ok, false);
    assert.equal(coerce("integer", 2).ok, true);
    assert.equal(coerce("integer", 2.5).ok, false);
    assert.equal(coerce("date", "2026-11-13").ok, true);
    assert.equal(coerce("date", 1762992000000).ok, false);
  });

  it("sends a masked value only as the token [masked]", () => {
    const local = derive(college, {
      ...contract,
      cardinals: [
        {
          notation: "meridian.card.plan",
          properties: [
            { name: "note", type: "string", scope: "element", source: "text-node", privacy: "masked" },
          ],
        },
      ],
    });
    const built = trackPayload(local, {
      kind: "element",
      notation: "meridian.card.plan",
      values: { note: "person@example.com" },
    });
    assert.equal(built.event.event_properties.note, "[masked]");
    assert.equal(built.refusals.length, 0);
  });

  it("keeps a user-scoped property off the element track payload", () => {
    const local = derive(college, {
      ...contract,
      cardinals: [
        {
          notation: "meridian.nav.primary",
          properties: [{ name: "planTier", type: "string", scope: "user", source: "data-layer", privacy: "public" }],
        },
      ],
    });
    const identified = trackPayload(local, { kind: "user", values: { planTier: "growth" } });
    assert.equal(identified.event.event_type, "canon:identify");
    assert.equal(identified.event.event_properties.planTier, "growth");
    const click = trackPayload(local, { kind: "element", notation: "meridian.nav.primary", values: { planTier: "growth" } });
    assert.equal(click.event.event_properties.planTier, undefined);
    assert.ok(click.refusals.some((row) => row.reason === "not-in-contract"));
  });

  it("execute always returns an event and strips excluded names", () => {
    const stripped = execute(derived, {
      event_type: "canon:click",
      event_properties: { workEmail: "person@example.com", price: 1 },
    });
    assert.equal(stripped.event_properties.workEmail, undefined);
    assert.equal(stripped.event_properties.price, 1);
    const empty = execute(derived, null);
    assert.equal(typeof empty, "object");
    assert.notEqual(empty, null);
    assert.equal(empty.event_type, "canon:unknown");
  });

  it("the generated enrichment source also returns the event and strips the excluded name", () => {
    const context = { result: null };
    vm.runInNewContext(`${enrichmentSource(derived)}\nresult = execute({ event_type: "canon:click", event_properties: { workEmail: "x", price: 1 } });`, context);
    assert.equal(context.result.event_properties.workEmail, undefined);
    assert.equal(context.result.event_properties.price, 1);
    assert.equal(context.result.event_type, "canon:click");
  });
});

describe("amplitude check exit codes", () => {
  const base = ["--college", collegePath, "--contract", contractPath];

  it("passes the meridian contract (exit 0) and records the excluded refusal", () => {
    const r = run(base);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.report.pass, true);
    assert.ok(r.report.refusals.some((row) => row.name === "workEmail"));
  });

  it("passes a plan click and a page payload (exit 0)", () => {
    for (const name of ["good-plan-click.json", "good-page.json"]) {
      const r = run([...base, "--fixture", join(fixtures, name)]);
      assert.equal(r.code, 0, `${name}\n${r.out}`);
    }
  });

  const bad = {
    "bad-excluded.json": "excluded_emitted",
    "bad-hand-authored.json": "unknown_property",
    "bad-type.json": "type_coercion",
    "bad-scope.json": "scope_mismatch",
    "bad-ephemeral-property.json": "unknown_property",
  };
  for (const [name, code] of Object.entries(bad)) {
    it(`fails ${name} with ${code} (exit 1)`, () => {
      const r = run([...base, "--fixture", join(fixtures, name)]);
      assert.equal(r.code, 1, r.out);
      assert.equal(r.report.pass, false);
      assert.ok(r.report.findings.some((finding) => finding.code === code), r.out);
    });
  }

  it("fails a contract that names an unknown cardinal (exit 1)", () => {
    const r = run(["--college", collegePath, "--contract", join(fixtures, "bad-unknown-notation.contract.json")]);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.report.findings.some((finding) => finding.code === "unknown_notation"), r.out);
  });

  it("fails a contract the schema rejects (exit 1, not a silent ignore)", () => {
    const broken = { ...contract, surprise: true };
    const file = join(mkdtempSync(join(tmpdir(), "amp-schema-")), "contract.json");
    writeFileSync(file, JSON.stringify(broken));
    const r = run(["--college", collegePath, "--contract", file]);
    assert.equal(r.code, 1, r.out + r.err);
    assert.ok(r.report.findings.some((finding) => finding.code === "schema"), r.out);
  });

  it("does not run without arguments (exit 2)", () => {
    assert.equal(run([]).code, 2);
  });

  it("does not run on a missing contract (exit 2)", () => {
    assert.equal(run(["--college", collegePath, "--contract", join(tmpdir(), "missing-contract.json")]).code, 2);
  });

  it("does not run on a pre-0.3 college (exit 2, never 0)", () => {
    const old = { ...college, canon: college.version, concepts: college.cardinals };
    delete old.version;
    delete old.cardinals;
    const file = join(mkdtempSync(join(tmpdir(), "amp-old-")), "college.json");
    writeFileSync(file, JSON.stringify(old));
    const r = run(["--college", file, "--contract", contractPath]);
    assert.equal(r.code, 2, r.out + r.err);
    assert.equal(r.out, "");
  });
});
