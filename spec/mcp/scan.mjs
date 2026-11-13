// Scan a tree for Canon adoption. Facts are what the scanner read.
// Drift sources that an attribute-only scan cannot see are first-class facts.
// They are never dropped to make the summary look clean.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const CODE = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".html", ".vue", ".svelte", ".json"]);
const SKIP = new Set(["node_modules", ".git", "dist", "coverage"]);
const MAX_BYTES = 1_000_000;

const SCHEMA_PATH = new URL("../canon.schema.json", import.meta.url);
let schemaValidate = null;
function collegeSchema() {
  if (!schemaValidate) {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
    schemaValidate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  }
  return schemaValidate;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (stat.isFile() && stat.size <= MAX_BYTES && CODE.has(ext(name))) out.push(path);
  }
}

function ext(name) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function push(facts, fact) {
  if (!fact.evidence) throw new Error(`scan fact missing evidence: ${fact.kind}`);
  facts.push(fact);
}

export function scan(root) {
  const files = [];
  walk(root, files);
  const facts = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(root, file);
    scanText(rel, text, facts);
  }
  const drift = ["set-attribute", "input-props", "css-selector"].filter((kind) => facts.some((fact) => fact.kind === kind));
  const hasCollege = facts.some((fact) => fact.kind === "cardinal-college" || fact.kind === "cardinal-college-invalid");
  const hasEmission = facts.some((fact) => fact.kind === "data-element" || fact.kind === "set-attribute" || fact.kind === "input-props");
  let level = "none";
  if (hasCollege && hasEmission) level = "emitting";
  else if (hasCollege) level = "college";
  else if (hasEmission || drift.length || facts.length) level = "partial";
  return {
    root,
    filesRead: files.length,
    extensions: [...CODE],
    level,
    levelEvidence: "design",
    levelNote: "level is a classification of the facts below. It is not a conformance result and it was not checked against a running surface.",
    drift,
    facts,
  };
}

function scanText(file, text, facts) {
  if (file.endsWith(".json")) scanJson(file, text, facts);

  const attr = /data-element\s*=\s*["']([^"']*)["']/g;
  for (const match of text.matchAll(attr)) {
    push(facts, {
      kind: "data-element",
      evidence: "observed",
      file,
      line: lineOf(text, match.index),
      notation: match[1],
      detail: "static data-element attribute",
    });
  }

  const setAttr = /setAttribute(?:NS)?\(\s*["'](data-element|data-instance|data-fs-element|data-fs-properties-schema)["']/g;
  for (const match of text.matchAll(setAttr)) {
    push(facts, {
      kind: "set-attribute",
      evidence: "observed",
      file,
      line: lineOf(text, match.index),
      attribute: match[1],
      detail: "setAttribute emission. An attribute-only scan of the markup does not see this.",
    });
  }

  const inputProps = /inputProps\s*[:=]\s*\{[\s\S]{0,500}?["'](data-element|data-instance|data-fs-element|data-fs-properties-schema)["']/g;
  for (const match of text.matchAll(inputProps)) {
    push(facts, {
      kind: "input-props",
      evidence: "observed",
      file,
      line: lineOf(text, match.index),
      attribute: match[1],
      detail: "value passed through inputProps. An attribute-only scan of the rendered tag does not see this.",
    });
  }

  const selector = /["']?css_?[Ss]elector["']?\s*[:=]\s*["']([^"']+)["']/g;
  for (const match of text.matchAll(selector)) {
    push(facts, {
      kind: "css-selector",
      evidence: "observed",
      file,
      line: lineOf(text, match.index),
      selector: match[1],
      detail: "element defined by a CSS selector. A data-element scan does not see this definition.",
    });
  }

  const meta = /<meta\s+[^>]*name\s*=\s*["']canon["'][^>]*>/gi;
  for (const match of text.matchAll(meta)) {
    push(facts, {
      kind: "watermark",
      evidence: "observed",
      file,
      line: lineOf(text, match.index),
      detail: "meta name=canon is a declaration. It is not by itself conformance.",
    });
  }
}

function scanJson(file, text, facts) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return;
  }
  const docs = Array.isArray(doc) ? doc : [doc];
  for (const item of docs) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    if (Object.hasOwn(item, "concepts") || Object.hasOwn(item, "canon")) {
      push(facts, {
        kind: "pre-0.3-college",
        evidence: "observed",
        file,
        line: 1,
        detail: "JSON still has concepts or a top-level canon field. It is not read as a CardinalCollege.",
      });
    }
    if (Array.isArray(item.cardinals) && typeof item.version === "string" && typeof item.prefix === "string") {
      const validate = collegeSchema();
      const valid = validate(item);
      push(facts, {
        kind: valid ? "cardinal-college" : "cardinal-college-invalid",
        evidence: valid ? "tested" : "observed",
        file,
        line: 1,
        prefix: item.prefix,
        version: item.version,
        cardinals: item.cardinals.length,
        detail: valid
          ? "JSON validates against spec/canon.schema.json. The validation ran in this process. The file was not fetched from a surface."
          : "JSON has cardinals, version, and prefix, and does not validate against spec/canon.schema.json.",
        where: valid ? "spec/canon.schema.json" : undefined,
      });
    }
    if (Array.isArray(item.cardinals) && item.contractVersion && item.college) {
      push(facts, {
        kind: "property-contract",
        evidence: "observed",
        file,
        line: 1,
        detail: "JSON looks like a property contract (contractVersion, college, cardinals). Not schema-checked here.",
      });
    }
  }
}
