// Checks every plugin manifest under spec/plugins/*/plugin.json against spec/plugins/plugin.schema.json,
// and proves the schema rejects known-bad manifests. Also enforces rules a JSON Schema cannot express:
// the manifest's "plugin" id equals its directory name, and a stubbed check entry point really is a stub
// (it exists and exits 2, never 0). Run by `npm test` through the scripts/**/*.test.mjs glob.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(root, "spec/plugins");
const schema = JSON.parse(readFileSync(join(pluginsDir, "plugin.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

function manifests() {
  return readdirSync(pluginsDir)
    .filter((name) => statSync(join(pluginsDir, name)).isDirectory())
    .map((name) => ({
      dir: name,
      path: join(pluginsDir, name, "plugin.json"),
    }));
}

const good = JSON.parse(readFileSync(join(pluginsDir, "fullstory/plugin.json"), "utf8"));
const clone = () => structuredClone(good);

describe("plugin manifests on disk", () => {
  const found = manifests();

  it("finds at least one plugin directory (an empty set must not pass)", () => {
    assert.ok(found.length >= 1);
  });

  for (const { dir, path } of found) {
    describe(dir, () => {
      it("has a plugin.json", () => {
        assert.ok(existsSync(path), `${dir} has no plugin.json`);
      });

      it("validates against plugin.schema.json", () => {
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        const ok = validate(manifest);
        assert.ok(ok, JSON.stringify(validate.errors));
      });

      it("names itself after its directory", () => {
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        assert.equal(manifest.plugin, dir);
      });

      it("points at a check entry that exists", () => {
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        assert.ok(existsSync(join(pluginsDir, dir, manifest.check.entry)));
      });

      it("a stubbed check exits 2 and never 0", () => {
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        if (manifest.check.status !== "stub") return;
        const run = spawnSync(process.execPath, [join(pluginsDir, dir, manifest.check.entry)], {
          encoding: "utf8",
        });
        assert.equal(run.status, 2);
        assert.equal(run.stdout, "");
      });

      it("an implemented check declares at least one layer", () => {
        const manifest = JSON.parse(readFileSync(path, "utf8"));
        if (manifest.check.status !== "implemented") return;
        assert.ok(Array.isArray(manifest.check.layers) && manifest.check.layers.length >= 1);
      });
    });
  }
});

describe("the schema rejects bad manifests (must-fail controls)", () => {
  it("accepts the real fullstory manifest (positive control)", () => {
    assert.ok(validate(clone()), JSON.stringify(validate.errors));
  });

  it("rejects a missing required field", () => {
    const m = clone();
    delete m.claims;
    assert.equal(validate(m), false);
  });

  it("rejects an unknown top-level field", () => {
    const m = clone();
    m.surprise = true;
    assert.equal(validate(m), false);
  });

  it("rejects a bad plugin id", () => {
    const m = clone();
    m.plugin = "Full Story";
    assert.equal(validate(m), false);
  });

  it("rejects a platform that is not web, ios, android or headless", () => {
    const m = clone();
    m.platforms = ["web", "windows"];
    assert.equal(validate(m), false);
  });

  it("rejects an empty platforms list", () => {
    const m = clone();
    m.platforms = [];
    assert.equal(validate(m), false);
  });

  it("rejects a check status other than stub or implemented", () => {
    const m = clone();
    m.check.status = "done";
    assert.equal(validate(m), false);
  });

  it("rejects a claim with an unknown evidence class", () => {
    const m = clone();
    m.claims[0].evidence = "trust-me";
    assert.equal(validate(m), false);
  });

  it("rejects a claim with no evidence field", () => {
    const m = clone();
    delete m.claims[0].evidence;
    assert.equal(validate(m), false);
  });

  it("rejects a malformed contract version", () => {
    const m = clone();
    m.contract = "one";
    assert.equal(validate(m), false);
  });
});
