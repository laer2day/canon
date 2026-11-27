#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { parseDeclared } from "./declaration.mjs";

const { values: args } = parseArgs({
  options: {
    canon: { type: "string" },
    url: { type: "string" },
    stdin: { type: "boolean", default: false },
    "fail-closed": { type: "boolean", default: true },
  },
});

// A tag, where ">" inside a quoted attribute value does not end the tag.
// Declared before the top-level code below runs (a const is not usable until its line executes).
const TAG = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

if (!args.canon) {
  console.error("Usage: node runtime/check.mjs --canon <file-or-url> [--url <surface>] [--stdin]");
  process.exit(2);
}

const canon = await loadCanon(args.canon);
refuseOldShape(canon, args.canon);
const html = args.stdin ? readFileSync(0, "utf8") : await fetch(args.url).then((r) => r.text());
const { observed, declared } = walkDom(html);
const attestation = verify(canon, observed, declared, args.url ?? "stdin");

console.log(JSON.stringify(attestation, null, 2));

if (args["fail-closed"] && !attestation.pass) process.exit(1);

// ── loader ──────────────────────────────────────────────────────────────

async function loadCanon(src) {
  const text = src.startsWith("http")
    ? await fetch(src).then((r) => r.text())
    : readFileSync(src, "utf8");
  return JSON.parse(text);
}

// A CardinalCollege uses `cardinals` and `version` (spec 0.3, $defs/cardinal). The pre-0.3 keys
// `concepts` and top-level `canon` are not read. Exit 2: the check did not run. Never a pass.
function refuseOldShape(doc, src) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    console.error(`runtime check did not run: ${src} is not a CardinalCollege object`);
    process.exit(2);
  }
  if (Object.hasOwn(doc, "concepts") || Object.hasOwn(doc, "canon")) {
    console.error(
      `runtime check did not run: ${src} uses a pre-0.3 key (\`concepts\` or top-level \`canon\`). A CardinalCollege uses \`cardinals\` and \`version\`.`,
    );
    process.exit(2);
  }
  if (!Array.isArray(doc.cardinals)) {
    console.error(`runtime check did not run: ${src} has no cardinals array`);
    process.exit(2);
  }
  if (typeof doc.version !== "string" || doc.version.length === 0) {
    console.error(`runtime check did not run: ${src} has no version`);
    process.exit(2);
  }
}

// ── DOM walker ──────────────────────────────────────────────────────────
// Minimal tag scanner. No jsdom: regex over the raw HTML runs anywhere Node runs.
// Known limits (not an HTML parser): unquoted attribute values containing ">",
// tag-like text inside <script>/<style>/comments, and malformed markup can fool it.
// It sees server-rendered HTML only.

function walkDom(html) {
  const found = [];
  let declared = null;
  for (const m of html.matchAll(TAG)) {
    const el = m[1].toLowerCase();
    const attrs = m[2];
    if (el === "meta" && attr(attrs, "name") === "canon") {
      declared = parseDeclared(attr(attrs, "content"));
      continue;
    }
    const dataEl = attr(attrs, "data-element");
    if (dataEl === null) continue; // absent. An EMPTY value is kept so it can be flagged.
    found.push({
      element: el,
      notation: dataEl,
      instance: attr(attrs, "data-instance"),
      ariaLabel: decodeEntities(attr(attrs, "aria-label")),
      visibleText: decodeEntities(visibleText(html, m.index + m[0].length, el)),
    });
  }
  return { observed: found, declared };
}

function attr(tag, name) {
  const re = new RegExp(`(?:^|[\\s"'])${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`);
  const m = tag.match(re);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

// Text between the end of an opening tag and the next closing tag of the same element, markup stripped.
function visibleText(html, from, el) {
  const rest = html.slice(from, from + 2000);
  const end = rest.toLowerCase().indexOf(`</${el}`);
  return rest.slice(0, end === -1 ? 80 : end).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Character references in HTML text and attribute values: "Q&amp;A" on the page is the text "Q&A" a person reads
// and assistive technology announces, so the name check compares decoded text with the label.
function decodeEntities(s) {
  if (s === null) return null;
  const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, ref) => {
    if (ref[0] !== "#") return NAMED[ref.toLowerCase()] ?? whole;
    const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

// <meta name="canon" content="<prefix>@<version>">  (parsed by parseDeclared, imported from ./declaration.mjs)

// ── verifier ────────────────────────────────────────────────────────────

function verify(canon, observed, declared, surface) {
  const cardinalByNotation = new Map(canon.cardinals.map((c) => [c.notation, c]));
  const counts = new Map();
  for (const o of observed) counts.set(o.notation, (counts.get(o.notation) ?? 0) + 1);

  const results = [];
  const flagged = [];
  // Every non-conforming result goes through here, so `pass` and the exit code always agree.
  const bad = (notation, reason, detail = {}) => {
    const f = { notation, status: "flagged", reason, ...detail };
    results.push(f);
    flagged.push(f);
  };

  for (const o of observed) {
    const cardinal = cardinalByNotation.get(o.notation);
    if (o.notation === "" || !cardinal) {
      bad(o.notation, "unknown_notation");
      continue;
    }
    if (cardinal.deprecated) {
      bad(o.notation, "deprecated_emitted", { replacedBy: cardinal.replacedBy });
      continue;
    }
    if (cardinal.namedBy === "aria" && !o.ariaLabel) {
      bad(o.notation, "missing_attribute", { attribute: "aria-label" });
      continue;
    }
    const label = labelFor(cardinal, o.instance);
    const accessibleName = o.ariaLabel ?? o.visibleText;
    if (cardinal.namedBy === "visible" && o.ariaLabel !== null && o.visibleText) {
      // Visible text already names the part: spec §2 says do not also set aria-label.
      // A label that does not even contain the visible text is worse: a divergent name.
      if (!o.ariaLabel.toLowerCase().includes(o.visibleText.toLowerCase())) {
        bad(o.notation, "namedby_violation", { accessibleName: o.ariaLabel, visibleText: o.visibleText });
      } else {
        bad(o.notation, "redundant_aria_label", { accessibleName: o.ariaLabel });
      }
      continue;
    }
    if (label && accessibleName && !accessibleName.toLowerCase().includes(label.toLowerCase())) {
      bad(o.notation, "namedby_violation", { accessibleName, expectedLabel: label });
      continue;
    }
    results.push({ notation: o.notation, status: "conforming" });
  }

  for (const cardinal of canon.cardinals) {
    const n = counts.get(cardinal.notation) ?? 0;
    // singletons observed more than once
    if (cardinal.cardinality === "singleton" && n > 1) {
      bad(cardinal.notation, "cardinality_mismatch", { expected: "singleton", observed: n });
    }
    // repeating cardinals with zero observations: note it, do not fail
    if (cardinal.cardinality === "repeating" && n === 0 && !cardinal.ephemeral && !cardinal.deprecated) {
      results.push({ notation: cardinal.notation, status: "absent", severity: "info" });
    }
  }

  // Privacy scan: labels/instances containing email-like or phone-like patterns
  for (const o of observed) {
    const blob = `${o.notation} ${o.instance ?? ""} ${o.ariaLabel ?? ""} ${o.visibleText}`;
    if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(blob) || /\(?\b\d{3}\)?[-. ]*\d{3}[-. ]\d{4}\b/.test(blob)) {
      bad(o.notation, "privacy_leak");
    }
  }

  // Declared version (D-B). Absent meta is not a failure: a bare fragment has no document head.
  if (declared) {
    const prefix = canon.prefix ?? canon.cardinals[0]?.notation.split(".")[0] ?? null;
    if (declared.version !== canon.version || (declared.prefix !== null && prefix && declared.prefix !== prefix)) {
      bad(declared.raw ?? "", "version_mismatch", { declared: declared.raw, expected: `${prefix}@${canon.version}` });
    }
  }

  const pass = flagged.length === 0;
  return {
    canon: canon.prefix ?? canon.cardinals[0]?.notation.split(".")[0] ?? null,
    canonVersion: canon.version,
    declaredVersion: declared ? declared.raw : null,
    surface,
    timestamp: new Date().toISOString(),
    pass,
    failClosed: args["fail-closed"],
    summary: {
      cardinalsDeclared: canon.cardinals.length,
      elementsObserved: observed.length,
      conforming: results.filter((r) => r.status === "conforming").length,
      flagged: flagged.length,
    },
    results,
  };
}

function labelFor(cardinal, instanceId) {
  return instanceId
    ? cardinal.instances?.find((i) => i.id === instanceId)?.name?.en
    : cardinal.prefLabel?.en;
}
