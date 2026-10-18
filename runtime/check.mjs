#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    canon: { type: "string" },
    url: { type: "string" },
    stdin: { type: "boolean", default: false },
    "fail-closed": { type: "boolean", default: true },
  },
});

if (!args.canon) {
  console.error("Usage: node runtime/check.mjs --canon <file-or-url> [--url <surface>] [--stdin]");
  process.exit(2);
}

const canon = await loadCanon(args.canon);
const html = args.stdin ? readFileSync(0, "utf8") : await fetch(args.url).then((r) => r.text());
const observed = walkDom(html);
const attestation = verify(canon, observed, args.url ?? "stdin");

console.log(JSON.stringify(attestation, null, 2));

if (args["fail-closed"] && !attestation.pass) process.exit(1);

// ── loader ──────────────────────────────────────────────────────────────

async function loadCanon(src) {
  const text = src.startsWith("http")
    ? await fetch(src).then((r) => r.text())
    : readFileSync(src, "utf8");
  return JSON.parse(text);
}

// ── DOM walker ──────────────────────────────────────────────────────────
// Minimal attribute extractor. No jsdom — regex over the raw HTML is
// enough for data-element discovery, and it runs anywhere Node runs.

function walkDom(html) {
  const found = [];
  const re = /<([a-zA-Z][\w-]*)([^>]*?)>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[2];
    const el = m[1].toLowerCase();
    const dataEl = attr(attrs, "data-element");
    if (!dataEl) continue;
    found.push({
      element: el,
      notation: dataEl,
      instance: attr(attrs, "data-instance") ?? null,
      accessibleName: attr(attrs, "aria-label") ?? textContent(html, m.index),
      raw: attrs,
    });
  }
  return found;
}

function attr(tag, name) {
  const re = new RegExp(`${name}=(?:"([^"]*)"|'([^']*)'|([^\s>]+))`);
  const m = tag.match(re);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

function textContent(html, from) {
  const slice = html.slice(from, from + 2000);
  const close = slice.indexOf(">");
  const inner = slice.slice(close + 1);
  const end = inner.search(/<\//);
  return inner.slice(0, end === -1 ? 80 : end).replace(/<[^>]+>/g, "").trim();
}

// ── verifier ────────────────────────────────────────────────────────────

function verify(canon, observed, surface) {
  const conceptByNotation = new Map(canon.concepts.map((c) => [c.notation, c]));
  const counts = new Map();
  for (const o of observed) counts.set(o.notation, (counts.get(o.notation) ?? 0) + 1);

  const results = [];
  const flagged = [];

  for (const o of observed) {
    const concept = conceptByNotation.get(o.notation);
    if (!concept) {
      results.push(flag(o.notation, "unknown_notation"));
      continue;
    }
    if (concept.deprecated) {
      results.push(flag(o.notation, "deprecated_emitted", { replacedBy: concept.replacedBy }));
      continue;
    }
    if (concept.namedBy === "visible" && o.accessibleName && !o.accessibleName.includes(o.notation) === false) {
      // visible-named concepts should not carry a divergent aria-label
      if (o.accessibleName && !visibleNameAgrees(o.accessibleName, concept, o.instance, canon)) {
        results.push(flag(o.notation, "namedby_violation"));
        continue;
      }
    }
    if (concept.namedBy === "aria" && !o.accessibleName) {
      results.push(flag(o.notation, "missing_attribute", { attribute: "aria-label" }));
      continue;
    }
    results.push({ notation: o.notation, status: "conforming" });
  }

  // Cardinality checks: singletons observed more than once
  for (const concept of canon.concepts) {
    if (concept.cardinality !== "singleton") continue;
    const n = counts.get(concept.notation) ?? 0;
    if (n > 1) {
      const f = flag(concept.notation, "cardinality_mismatch", { expected: "singleton", observed: n });
      results.push(f);
      flagged.push(f);
    }
    // repeating concepts with zero observations — note, don't fail
    if (concept.cardinality === "repeating" && n === 0 && !concept.ephemeral) {
      results.push({ notation: concept.notation, status: "absent", severity: "info" });
    }
  }

  // Privacy scan: labels/instances containing email-like or phone-like patterns
  for (const o of observed) {
    const blob = `${o.notation} ${o.instance ?? ""} ${o.accessibleName ?? ""}`;
    if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(blob) || /\b\d{3}[-.]\d{3}[-.]\d{4}\b/.test(blob)) {
      const f = flag(o.notation, "privacy_leak");
      results.push(f);
      flagged.push(f);
    }
  }

  const pass = flagged.length === 0;
  return {
    canon: canon.canon,
    canonVersion: canon.version ?? "unspecified",
    surface,
    timestamp: new Date().toISOString(),
    pass,
    failClosed: args["fail-closed"],
    summary: {
      conceptsDeclared: canon.concepts.length,
      elementsObserved: observed.length,
      conforming: results.filter((r) => r.status === "conforming").length,
      flagged: flagged.length,
    },
    results,
  };
}

function flag(notation, reason, detail = {}) {
  return { notation, status: "flagged", reason, ...detail };
}

function visibleNameAgrees(accessibleName, concept, instanceId, canon) {
  const label = instanceId
    ? concept.instances?.find((i) => i.id === instanceId)?.name?.en
    : concept.prefLabel?.en;
  if (!label) return true;
  return accessibleName.toLowerCase().includes(label.toLowerCase());
}
