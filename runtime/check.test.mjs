import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CHECK = join(here, "check.mjs");

const canon = {
  canon: "0.1.0",
  prefix: "fx",
  defaultLocale: "en",
  locales: [{ tag: "en", dir: "ltr" }],
  concepts: [
    { notation: "fx.link.home", cardinality: "singleton", namedBy: "visible", prefLabel: { en: "Home" } },
    {
      notation: "fx.link.item", cardinality: "repeating", namedBy: "visible", prefLabel: { en: "Item" },
      instances: [{ id: "alpha", stability: "record", name: { en: "Alpha" } }],
    },
    { notation: "fx.link.old", cardinality: "singleton", namedBy: "visible", deprecated: true, replacedBy: "fx.link.home", prefLabel: { en: "Old" } },
    { notation: "fx.nav.main", cardinality: "singleton", namedBy: "aria", prefLabel: { en: "Main navigation" } },
  ],
};
const canonFile = join(mkdtempSync(join(tmpdir(), "check-test-")), "canon.json");
writeFileSync(canonFile, JSON.stringify(canon));

// Run the checker on an HTML string. Returns { rc, out } where out is the parsed attestation.
function run(html) {
  const r = spawnSync("node", [CHECK, "--canon", canonFile, "--stdin"], { input: html, encoding: "utf8" });
  return { rc: r.status, out: r.stdout ? JSON.parse(r.stdout) : null };
}
const reasons = (out) => out.results.filter((r) => r.status === "flagged").map((r) => r.reason);

test("a conforming surface passes with exit 0", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" href="/">Home</a></main>');
  assert.equal(rc, 0);
  assert.equal(out.pass, true);
});

test("unknown notation fails closed (pass false, exit non-zero)", () => {
  const { rc, out } = run('<main><a data-element="fx.link.nope" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.equal(out.pass, false);
  assert.ok(reasons(out).includes("unknown_notation"));
});

test("an empty data-element is an unknown notation, not a skipped element", () => {
  const { rc, out } = run('<main><a data-element="" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("unknown_notation"));
});

test("a deprecated notation fails closed", () => {
  const { rc, out } = run('<main><a data-element="fx.link.old" href="/">Old</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("deprecated_emitted"));
});

test("a divergent aria-label is flagged namedby_violation", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" aria-label="Totally different" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("namedby_violation"));
});

test("a redundant aria-label (spec section 2) is flagged", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" aria-label="Home" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("redundant_aria_label"));
});

test("a redundant aria-label behind a '>' inside another attribute is still flagged", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" title="a > b" aria-label="Home" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("redundant_aria_label"));
});

test("a singleton emitted twice is a cardinality_mismatch", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" href="/">Home</a><a data-element="fx.link.home" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("cardinality_mismatch"));
});

test("an aria-named concept with no aria-label is a missing_attribute", () => {
  const { rc, out } = run('<nav data-element="fx.nav.main"></nav>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("missing_attribute"));
});

test("personal data in a label is a privacy_leak", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" aria-label="Home lane@example.com" href="/">Home</a></main>');
  assert.notEqual(rc, 0);
  assert.ok(reasons(out).includes("privacy_leak"));
});

test("a wrong declared version is a version_mismatch; a right one passes", () => {
  const bad = run('<meta name="canon" content="fx@9.9.9"><main><a data-element="fx.link.home" href="/">Home</a></main>');
  assert.notEqual(bad.rc, 0);
  assert.ok(reasons(bad.out).includes("version_mismatch"));
  const ok = run('<meta name="canon" content="fx@0.1.0"><main><a data-element="fx.link.home" href="/">Home</a></main>');
  assert.equal(ok.rc, 0);
  assert.equal(ok.out.declaredVersion, "fx@0.1.0");
});

test("an absent meta reports declaredVersion null and does not fail", () => {
  const { rc, out } = run('<main><a data-element="fx.link.home" href="/">Home</a></main>');
  assert.equal(rc, 0);
  assert.equal(out.declaredVersion, null);
});

test("a repeating concept with zero observations is reported absent (info, not a failure)", () => {
  const { rc, out } = run("<main></main>");
  assert.equal(rc, 0);
  assert.ok(out.results.some((r) => r.status === "absent" && r.notation === "fx.link.item"));
});

test("canonVersion is the canon's own 'canon' field", () => {
  const { out } = run('<main><a data-element="fx.link.home" href="/">Home</a></main>');
  assert.equal(out.canonVersion, "0.1.0");
});
