// Persona directory: each check fails on a bad work product, and the orchestrator assigns by file.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const orchestrator = join(root, "spec/personas/orchestrator.mjs");

function run(args, extra = []) {
  const r = spawnSync(process.execPath, [orchestrator, ...args, ...extra], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr, report: r.stdout ? JSON.parse(r.stdout) : null };
}
function work(obj) {
  const file = join(mkdtempSync(join(tmpdir(), "persona-work-")), "work.json");
  writeFileSync(file, JSON.stringify(obj));
  return file;
}
function jobs(doc) {
  const file = join(mkdtempSync(join(tmpdir(), "persona-jobs-")), "jobs.json");
  writeFileSync(file, JSON.stringify(doc));
  return file;
}

describe("orchestrator", () => {
  it("lists one file per persona and a version that is not the spec version", () => {
    const r = run(["list"]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(r.report.personasVersion, "0.1.0");
    assert.notEqual(r.report.personasVersion, r.report.writtenBesideSpec);
    assert.equal(r.report.writtenBesideSpec, "0.3");
    const ids = r.report.personas.map((row) => row.id).sort();
    assert.deepEqual(ids, [
      "checker-maintainer",
      "conformance-author",
      "plugin-author",
      "privacy-reviewer",
      "retrofit-inventory",
      "spec-author",
      "surface-visitor",
    ]);
    for (const row of r.report.personas) {
      assert.match(row.personaFile, new RegExp(`${row.id}/persona.json$`));
      assert.match(row.check, new RegExp(`${row.id}/check.mjs$`));
      assert.equal(typeof row.scope, "string");
      assert.ok(row.scope.length > 0);
    }
  });

  it("does not run on an empty directory (exit 2)", () => {
    const dir = mkdtempSync(join(tmpdir(), "persona-empty-"));
    writeFileSync(join(dir, "version.json"), JSON.stringify({ personas: "0.0.1", writtenBesideSpec: "0.3" }));
    const r = run(["list", "--dir", dir]);
    assert.equal(r.code, 2, r.out + r.err);
    assert.equal(r.out, "");
  });

  it("does not run without a command (exit 2)", () => {
    assert.equal(run([]).code, 2);
  });

  it("assigns a job by the persona file and fails an unknown persona (exit 1)", () => {
    const good = run([
      "assign",
      "--jobs",
      jobs({
        jobs: [
          {
            id: "inventory-cardinals",
            persona: "retrofit-inventory",
            files: ["src/legacy.js"],
            reason: "names exist before a notation",
            evidence: "observed",
          },
        ],
      }),
    ]);
    assert.equal(good.code, 0, good.out);
    assert.equal(good.report.assignments.length, 1);
    assert.match(good.report.assignments[0].personaFile, /retrofit-inventory\/persona.json$/);
    assert.match(good.report.assignments[0].scope, /names a surface already uses/);

    const bad = run([
      "assign",
      "--jobs",
      jobs({
        jobs: [
          {
            id: "inventory-cardinals",
            persona: "not-a-persona",
            files: [],
            reason: "missing",
            evidence: "design",
          },
        ],
      }),
    ]);
    assert.equal(bad.code, 1, bad.out);
    assert.ok(bad.report.findings.some((finding) => finding.code === "unknown_persona"));
  });

  it("rejects a job file with no jobs (exit 1) and does not run on a missing file (exit 2)", () => {
    const empty = run(["assign", "--jobs", jobs({ jobs: [] })]);
    assert.equal(empty.code, 1, empty.out);
    assert.ok(empty.report.findings.some((finding) => finding.code === "job_schema"));
    const missing = run(["assign", "--jobs", join(tmpdir(), "no-such-jobs.json")]);
    assert.equal(missing.code, 2);
    assert.equal(missing.out, "");
  });
});

describe("persona checks", () => {
  it("spec-author passes a non-spec edit and fails a schema edit with no version decision", () => {
    const ok = run(["check", "--persona", "spec-author", "--work", work({ changed: ["README.md"], versionDecision: "" })]);
    assert.equal(ok.code, 0, ok.out);
    const bad = run([
      "check",
      "--persona", "spec-author",
      "--work",
      work({ changed: ["spec/canon.schema.json"], versionDecision: "" }),
    ]);
    assert.equal(bad.code, 1, bad.out);
    assert.ok(bad.report.findings.some((finding) => finding.code === "version_decision_missing"));
    const decided = run([
      "check",
      "--persona", "spec-author",
      "--work",
      work({ changed: ["spec/canon.schema.json"], versionDecision: "companion only; spec stays 0.3" }),
    ]);
    assert.equal(decided.code, 0, decided.out);
  });

  it("retrofit-inventory fails an empty list and a row with no evidence", () => {
    const ok = run([
      "check",
      "--persona", "retrofit-inventory",
      "--work",
      work({ rows: [{ legacy: "dropdown", notation: "meridian.button.get-demo", evidence: "observed" }] }),
    ]);
    assert.equal(ok.code, 0, ok.out);
    const empty = run(["check", "--persona", "retrofit-inventory", "--work", work({ rows: [] })]);
    assert.equal(empty.code, 1);
    assert.ok(empty.report.findings.some((finding) => finding.code === "empty_inventory"));
    const partial = run([
      "check",
      "--persona", "retrofit-inventory",
      "--work",
      work({ rows: [{ legacy: "dropdown" }] }),
    ]);
    assert.equal(partial.code, 1);
    assert.ok(partial.report.findings.some((finding) => finding.code === "notation_missing"));
    assert.ok(partial.report.findings.some((finding) => finding.code === "evidence_missing"));
  });

  it("plugin-author accepts amplitude and fullstory and rejects a stub that claims tested", () => {
    const amplitude = run(["check", "--persona", "plugin-author", "--work", work({ pluginDir: "spec/plugins/amplitude" })]);
    assert.equal(amplitude.code, 0, amplitude.out);
    const fullstory = run(["check", "--persona", "plugin-author", "--work", work({ pluginDir: "spec/plugins/fullstory" })]);
    assert.equal(fullstory.code, 0, fullstory.out);
    const dir = mkdtempSync(join(tmpdir(), "persona-plugin-"));
    const pluginDir = join(dir, "stub-tested");
    mkdirSync(pluginDir);
    writeFileSync(
      join(pluginDir, "plugin.json"),
      JSON.stringify({
        plugin: "stub-tested",
        check: { status: "stub", entry: "check.mjs", layers: [] },
        claims: [{ text: "vendor does the thing", evidence: "tested", where: "nowhere" }],
      }),
    );
    const bad = run(["check", "--persona", "plugin-author", "--work", work({ pluginDir: pluginDir })]);
    assert.equal(bad.code, 1, bad.out + bad.err);
    assert.ok(bad.report.findings.some((finding) => finding.code === "stub_claims_tested"), bad.out);
  });

  it("checker-maintainer requires a known-bad input and a test file that exists", () => {
    const ok = run([
      "check",
      "--persona", "checker-maintainer",
      "--work",
      work({ tests: ["runtime/check.test.mjs"], badInputShown: true }),
    ]);
    assert.equal(ok.code, 0, ok.out);
    const bad = run([
      "check",
      "--persona", "checker-maintainer",
      "--work",
      work({ tests: ["runtime/check.test.mjs"], badInputShown: false }),
    ]);
    assert.equal(bad.code, 1);
    assert.ok(bad.report.findings.some((finding) => finding.code === "bad_input_not_shown"));
    const missing = run([
      "check",
      "--persona", "checker-maintainer",
      "--work",
      work({ tests: ["runtime/no-such-test.mjs"], badInputShown: true }),
    ]);
    assert.equal(missing.code, 1);
    assert.ok(missing.report.findings.some((finding) => finding.code === "test_missing"));
  });

  it("conformance-author accepts a real failure fixture and rejects an empty one", () => {
    const ok = run([
      "check",
      "--persona", "conformance-author",
      "--work",
      work({ fixtures: ["spec/conformance/property-enrichment/bad-excluded.json", "spec/conformance/fixtures/failures.json"] }),
    ]);
    assert.equal(ok.code, 0, ok.out);
    const none = run(["check", "--persona", "conformance-author", "--work", work({ fixtures: [] })]);
    assert.equal(none.code, 1);
    assert.ok(none.report.findings.some((finding) => finding.code === "no_fixtures"));
    const file = join(mkdtempSync(join(tmpdir(), "persona-fixture-")), "empty.json");
    writeFileSync(file, "{}");
    const rel = file; // absolute path: check joins root + file, so use a path under root
    const under = join(root, "spec/conformance/property-enrichment/empty-cannot-fail.json");
    writeFileSync(under, "{}");
    try {
      const bad = run([
        "check",
        "--persona", "conformance-author",
        "--work",
        work({ fixtures: ["spec/conformance/property-enrichment/empty-cannot-fail.json"] }),
      ]);
      assert.equal(bad.code, 1, bad.out);
      assert.ok(bad.report.findings.some((finding) => finding.code === "cannot_fail"));
    } finally {
      spawnSync("rm", ["-f", under]);
    }
  });

  it("privacy-reviewer accepts the excluded meridian email name and rejects a public one", () => {
    const ok = run([
      "check",
      "--persona", "privacy-reviewer",
      "--work",
      work({ contract: "spec/property-contracts/meridian.json" }),
    ]);
    assert.equal(ok.code, 0, ok.out);
    const leaked = run([
      "check",
      "--persona", "privacy-reviewer",
      "--work",
      work({
        contract: "spec/property-contracts/meridian.json",
        payload: { event_properties: { workEmail: "person@example.com" } },
      }),
    ]);
    assert.equal(leaked.code, 1, leaked.out);
    assert.ok(leaked.report.findings.some((finding) => finding.code === "excluded_in_payload"));
    const dir = mkdtempSync(join(tmpdir(), "persona-privacy-"));
    const contractPath = join(root, "spec/property-contracts/personal-name.json");
    writeFileSync(
      contractPath,
      JSON.stringify({
        cardinals: [
          {
            notation: "meridian.form.request-demo",
            properties: [{ name: "customerEmail", type: "string", scope: "element", source: "data-layer", privacy: "public" }],
          },
        ],
      }),
    );
    try {
      const bad = run([
        "check",
        "--persona", "privacy-reviewer",
        "--work",
        work({ contract: "spec/property-contracts/personal-name.json" }),
      ]);
      assert.equal(bad.code, 1, bad.out);
      assert.ok(bad.report.findings.some((finding) => finding.code === "personal_name"));
    } finally {
      spawnSync("rm", ["-f", contractPath]);
    }
    assert.equal(dir.length > 0, true);
  });

  it("surface-visitor fails a design fact marked established and an empty report", () => {
    const ok = run([
      "check",
      "--persona", "surface-visitor",
      "--work",
      work({ facts: [{ text: "marker was absent", evidence: "observed", established: false }] }),
    ]);
    assert.equal(ok.code, 0, ok.out);
    const over = run([
      "check",
      "--persona", "surface-visitor",
      "--work",
      work({ facts: [{ text: "inheritance is bidirectional", evidence: "design", established: true }] }),
    ]);
    assert.equal(over.code, 1);
    assert.ok(over.report.findings.some((finding) => finding.code === "overclaim"));
    const documented = run([
      "check",
      "--persona", "surface-visitor",
      "--work",
      work({ facts: [{ text: "Fullstory has 50 properties", evidence: "documented", established: true }] }),
    ]);
    assert.equal(documented.code, 1);
    const empty = run(["check", "--persona", "surface-visitor", "--work", work({ facts: [] })]);
    assert.equal(empty.code, 1);
    assert.ok(empty.report.findings.some((finding) => finding.code === "no_facts"));
  });

  it("does not run a check whose work file is missing (exit 2)", () => {
    const r = run(["check", "--persona", "spec-author", "--work", join(tmpdir(), "missing-work.json")]);
    assert.equal(r.code, 2, r.out + r.err);
  });

  it("fails an unknown persona on check (exit 1)", () => {
    const r = run(["check", "--persona", "not-a-persona"]);
    assert.equal(r.code, 1, r.out);
    assert.ok(r.report.findings.some((finding) => finding.code === "unknown_persona"));
  });
});
