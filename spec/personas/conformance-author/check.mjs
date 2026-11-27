#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runCheck } from "../lib.mjs";

function canFail(item) {
  if (!item || typeof item !== "object") return false;
  if (Array.isArray(item.expectFail) && item.expectFail.length > 0) return true;
  return Boolean(item.payload && typeof item.payload === "object" && item.payload.event_properties && typeof item.payload.event_properties === "object");
}

runCheck(import.meta.url, "conformance-author", (work, { root }) => {
  if (!Array.isArray(work.fixtures) || work.fixtures.length === 0) return [{ code: "no_fixtures" }];
  const findings = [];
  for (const file of work.fixtures) {
    if (typeof file !== "string") {
      findings.push({ code: "fixture_missing", file });
      continue;
    }
    const path = join(root, file);
    if (!existsSync(path)) {
      findings.push({ code: "fixture_missing", file });
      continue;
    }
    let doc;
    try {
      doc = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      findings.push({ code: "fixture_unreadable", file, detail: err.message });
      continue;
    }
    const items = Array.isArray(doc) ? doc : [doc];
    if (!items.length || items.some((item) => !canFail(item))) findings.push({ code: "cannot_fail", file });
  }
  return findings;
});
