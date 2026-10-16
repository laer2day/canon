import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  audit,
  emissionFor,
  failedIds,
  policySource,
  resolveLabels,
  validateCanon,
  type CanonFile,
  type Emission,
  type SurfaceId,
  type SurfacePart,
} from "./check.ts";

const specRoot = new URL("../../spec/", import.meta.url);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, specRoot), "utf8")) as T;
}

const canon = readJson<CanonFile>("canons/meridian.json");
const home = readJson<{ parts: SurfacePart[] }>("surfaces/meridian-home.json");

type ExpectedName = {
  notation: string;
  instance: string | null;
  rank: number | null;
  accessibleName: string;
  lang: string;
  dir: "ltr" | "rtl";
  fellBack: boolean;
};

type FailureFixture = {
  id: string;
  locale: string;
  surface: SurfaceId;
  notation: string;
  instance: string | null;
  patch?: Partial<Emission>;
  extraParts?: SurfacePart[];
  expectFail: string[];
};

describe("canon document", () => {
  it("accepts the meridian canon", () => {
    assert.deepEqual(validateCanon(canon), []);
  });

  it("rejects a reused notation and a singleton with instances", () => {
    const broken: CanonFile = {
      ...canon,
      concepts: [
        ...canon.concepts,
        { ...canon.concepts[0], instances: [{ id: "nope", stability: "record", name: { en: "Nope" } }] },
      ],
    };
    const errors = validateCanon(broken);
    assert.ok(errors.some((error) => error.includes("Duplicate")));
    assert.ok(errors.some((error) => error.includes("singleton")));
  });
});

describe("meridian home", () => {
  it("matches the English expected resolutions", () => {
    const expected = readJson<ExpectedName[]>("conformance/expected/home-en.json");
    assert.equal(expected.length, home.parts.length);
    home.parts.forEach((part, index) => {
      const concept = canon.concepts.find((item) => item.notation === part.notation);
      assert.ok(concept);
      const resolved = resolveLabels(canon, policySource(concept, part.instance, part.names), "en");
      const row = expected[index];
      assert.equal(row.notation, part.notation);
      assert.equal(row.instance, part.instance);
      assert.equal(row.rank ?? null, part.rank ?? null);
      assert.equal(resolved.label, row.accessibleName);
      assert.equal(resolved.lang, row.lang);
      assert.equal(resolved.dir, row.dir);
      assert.equal(resolved.fellBack, row.fellBack);
      const emission = emissionFor({
        canon,
        concept,
        instance: part.instance,
        rank: part.rank ?? null,
        names: part.names,
        locale: "en",
        surface: "web",
        interactionType: null,
        description: null,
      });
      assert.deepEqual(failedIds(audit(canon, emission, home.parts)), []);
    });
  });

  it("falls enterprise back to English on a Japanese page without an empty name", () => {
    const expected = readJson<{
      accessibleName: string;
      lang: string;
      fellBack: boolean;
      elementLang: string;
      elementDir: null;
    }>("conformance/expected/enterprise-ja.json");
    const concept = canon.concepts.find((item) => item.notation === "meridian.card.plan");
    assert.ok(concept);
    const resolved = resolveLabels(canon, policySource(concept, "sku-enterprise"), "ja");
    assert.equal(resolved.label, expected.accessibleName);
    assert.equal(resolved.lang, expected.lang);
    assert.equal(resolved.fellBack, expected.fellBack);
    const emission = emissionFor({
      canon,
      concept,
      instance: "sku-enterprise",
      locale: "ja",
      surface: "web",
      interactionType: null,
      description: null,
    });
    assert.equal(emission.lang, expected.elementLang);
    assert.equal(emission.dir, expected.elementDir);
    assert.equal(emission.ariaLabel, null);
    assert.deepEqual(failedIds(audit(canon, emission, home.parts)), []);
  });

  it("does not emit the deprecated notation", () => {
    assert.equal(home.parts.some((part) => part.notation === "meridian.link.demo"), false);
  });
});

describe("conformance fixtures", () => {
  const fixtures = readJson<FailureFixture[]>("conformance/fixtures/failures.json");

  for (const fixture of fixtures) {
    it(`${fixture.id} fails ${fixture.expectFail.join(", ")}`, () => {
      const concept = canon.concepts.find((item) => item.notation === fixture.notation);
      assert.ok(concept, fixture.notation);
      const surfacePart = home.parts.find((part) => part.notation === fixture.notation && part.instance === fixture.instance);
      const emission = emissionFor({
        canon,
        concept,
        instance: fixture.instance,
        rank: surfacePart?.rank ?? null,
        names: surfacePart?.names,
        locale: fixture.locale,
        surface: fixture.surface,
        interactionType: fixture.surface === "headless" ? "mcp-tool-call" : null,
        description: fixture.surface === "headless" ? concept.prefLabel.en : null,
      });
      const patched = { ...emission, ...fixture.patch };
      const parts = fixture.extraParts ? [...home.parts, ...fixture.extraParts] : home.parts;
      assert.deepEqual(failedIds(audit(canon, patched, parts)).sort(), [...fixture.expectFail].sort());
    });
  }
});
