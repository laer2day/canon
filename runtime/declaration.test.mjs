// Tests for the shared canon watermark parser (runtime/declaration.mjs). Run by `npm test` through the
// runtime/**/*.test.mjs glob. Every rule here has a must-fail case, because a check that cannot fail is not a check.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { agree, parseDeclared, strictDeclared } from "./declaration.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// MUTATION RECORD (2026-10-28). The module was mutated 21 ways and this file failed on 18. The 3 survivors are
// equivalent mutants (no input can tell them from the original), so no test can kill them:
//   - strictDeclared split at the FIRST "@": every value with two "@" is rejected either way, because one part
//     then contains an "@" that the prefix or version rule refuses.
//   - agree() without the x.ok check, and without the y.ok check: strictDeclared never returns a partial (pinned
//     by the "never returns a partial" test), so an invalid side has no prefix and the equality already fails.
// Two further mutants (dropping the empty check, dropping the whitespace check) change only the failure REASON,
// which the "reports WHICH rule failed" test pins. Do not spend time trying to kill the three above.

describe("parseDeclared: the lenient reader the checker has always used (behaviour is fixed)", () => {
  it("splits prefix@version", () => {
    assert.deepEqual(parseDeclared("fx@0.1.0"), {
      raw: "fx@0.1.0",
      prefix: "fx",
      version: "0.1.0",
    });
  });
  it("reads a value with no @ as a bare version with no prefix", () => {
    assert.deepEqual(parseDeclared("0.1.0"), { raw: "0.1.0", prefix: null, version: "0.1.0" });
  });
  it("splits at the LAST @", () => {
    const r = parseDeclared("a@b@c");
    assert.equal(r.prefix, "a@b");
    assert.equal(r.version, "c");
  });
  it("returns nulls for an empty value", () => {
    assert.deepEqual(parseDeclared(""), { raw: "", prefix: null, version: null });
  });
  it("returns nulls for a missing value", () => {
    assert.deepEqual(parseDeclared(undefined), { raw: undefined, prefix: null, version: null });
    assert.deepEqual(parseDeclared(null), { raw: null, prefix: null, version: null });
  });
  it("does NOT validate: it accepts values the strict reader rejects", () => {
    assert.equal(parseDeclared("Not A Prefix@v 1").prefix, "Not A Prefix");
    assert.equal(strictDeclared("Not A Prefix@v 1").ok, false);
  });
});

describe("strictDeclared: what a new carrier must emit", () => {
  const good = ["fx@0.1.0", "meridian@0.1.0", "cargo@1", "a-b-c@2026.10.28", "x9@v1"];
  for (const v of good) {
    it(`accepts ${JSON.stringify(v)}`, () => {
      const r = strictDeclared(v);
      assert.equal(r.ok, true);
      assert.equal(r.raw, v);
    });
  }

  it("returns the parts on success", () => {
    const r = strictDeclared("cargo@0.2.0");
    assert.equal(r.prefix, "cargo");
    assert.equal(r.version, "0.2.0");
  });

  const bad = [
    ["", "empty"],
    ["0.1.0", "no @"],
    ["@0.1.0", "empty prefix"],
    ["fx@", "empty version"],
    ["@", "both empty"],
    ["FX@0.1.0", "uppercase prefix"],
    ["9fx@0.1.0", "prefix starting with a digit"],
    ["-fx@0.1.0", "prefix starting with a hyphen"],
    ["f_x@0.1.0", "underscore in prefix (the schema forbids it)"],
    ["f x@0.1.0", "space in prefix"],
    ["fx@0 1", "space in version"],
    ["fx@a@b", "@ in version (splits at the last @, leaving prefix 'fx@a')"],
    ["a@b@c", "two @ signs"],
    [" fx@0.1.0", "leading whitespace"],
    ["fx@0.1.0 ", "trailing whitespace"],
    ["fx@0.1.0\n", "trailing newline"],
    ["fx@\t1", "tab in version"],
  ];
  for (const [v, why] of bad) {
    it(`rejects ${JSON.stringify(v)} (${why})`, () => {
      const r = strictDeclared(v);
      assert.equal(r.ok, false);
      assert.equal(typeof r.reason, "string");
      assert.ok(r.reason.length > 0);
    });
  }

  it("rejects non-string input without throwing", () => {
    for (const v of [undefined, null, 0, 1, {}, [], true, NaN]) {
      assert.equal(strictDeclared(v).ok, false);
    }
  });

  it("never returns a partial: a failure carries no prefix or version, whichever rule failed", () => {
    // One input per failing rule, so a leak in any branch is caught (a prefix-rule failure alone would miss a
    // leak in the version-rule branch).
    for (const v of ["", "0.1.0", "FX@1", "fx@", "fx@a b", " fx@1", "fx@1 "]) {
      const r = strictDeclared(v);
      assert.equal(r.ok, false, JSON.stringify(v));
      assert.equal("prefix" in r, false, `prefix leaked on ${JSON.stringify(v)}`);
      assert.equal("version" in r, false, `version leaked on ${JSON.stringify(v)}`);
      assert.equal("raw" in r, false, `raw leaked on ${JSON.stringify(v)}`);
    }
  });

  it("reports WHICH rule failed, because callers log the reason", () => {
    assert.match(strictDeclared("").reason, /empty/);
    assert.match(strictDeclared("0.1.0").reason, /no @/);
    assert.match(strictDeclared(" fx@1").reason, /whitespace/);
    assert.match(strictDeclared("fx@1\n").reason, /whitespace/);
    assert.match(strictDeclared("FX@1").reason, /prefix/);
    assert.match(strictDeclared("fx@").reason, /version/);
    assert.match(strictDeclared(undefined).reason, /empty/);
  });
});

describe("strictDeclared agrees with the canon schema's prefix rule", () => {
  const schema = JSON.parse(readFileSync(join(root, "spec/canon.schema.json"), "utf8"));
  const pattern = new RegExp(schema.properties.prefix.pattern);

  it("reads a pattern out of the schema (an empty read must not pass)", () => {
    assert.equal(typeof schema.properties.prefix.pattern, "string");
    assert.ok(schema.properties.prefix.pattern.length > 0);
  });

  it("accepts and rejects the same prefixes as the schema over a set of probes", () => {
    const probes = [
      "fx",
      "meridian",
      "cargo",
      "a",
      "a1",
      "a-b",
      "a--b",
      "a-",
      "-a",
      "A",
      "aB",
      "1a",
      "a_b",
      "a b",
      "a.b",
      "",
      "x".repeat(60),
      "é",
      "a@b",
    ];
    for (const p of probes) {
      const viaSchema = pattern.test(p);
      const viaStrict = strictDeclared(`${p}@1`).ok;
      // "a@b" is a prefix probe whose "@" the strict reader sees as a separator; the schema pattern rejects it
      // outright, and so must the strict reader (it splits at the last @, leaving prefix "a@b").
      assert.equal(
        viaStrict,
        viaSchema,
        `probe ${JSON.stringify(p)}: schema=${viaSchema} strict=${viaStrict}`,
      );
    }
  });

  it("every real prefix in spec/canons passes the strict reader", () => {
    const meridian = JSON.parse(readFileSync(join(root, "spec/canons/meridian.json"), "utf8"));
    const r = strictDeclared(`${meridian.prefix}@${meridian.canon}`);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.prefix, meridian.prefix);
    assert.equal(r.version, meridian.canon);
  });
});

describe("agree: the same value reads the same on every carrier", () => {
  it("is true for identical valid values", () => {
    assert.equal(agree("fx@0.1.0", "fx@0.1.0"), true);
  });
  it("is false when the version differs", () => {
    assert.equal(agree("fx@0.1.0", "fx@0.1.1"), false);
  });
  it("is false when the prefix differs", () => {
    assert.equal(agree("fx@0.1.0", "gx@0.1.0"), false);
  });
  it("is false when either side is invalid, even if they are equal", () => {
    assert.equal(agree("0.1.0", "0.1.0"), false);
    assert.equal(agree("", ""), false);
    assert.equal(agree("FX@1", "FX@1"), false);
    assert.equal(agree("fx@1", "FX@1"), false);
  });
  it("is false for non-string input", () => {
    assert.equal(agree(undefined, undefined), false);
    assert.equal(agree(null, "fx@1"), false);
  });
  it("needs BOTH sides valid, whichever side is the bad one", () => {
    assert.equal(agree("fx@1", "FX@1"), false);
    assert.equal(agree("FX@1", "fx@1"), false);
    assert.equal(agree("fx@1", ""), false);
    assert.equal(agree("", "fx@1"), false);
    assert.equal(agree("fx@1", "fx@1 "), false);
    assert.equal(agree("fx@1 ", "fx@1"), false);
  });
  it("is symmetric over a set of pairs", () => {
    const vals = ["fx@1", "fx@2", "gx@1", "0.1", "", "FX@1", "fx@1 "];
    for (const a of vals) for (const b of vals) assert.equal(agree(a, b), agree(b, a));
  });
  it("treats surrounding whitespace as a mismatch with the clean value", () => {
    assert.equal(agree("fx@1", "fx@1 "), false);
  });
});
