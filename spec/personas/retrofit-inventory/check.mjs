#!/usr/bin/env node
import { runCheck } from "../lib.mjs";

const EVIDENCE = new Set(["tested", "documented", "observed", "design"]);

runCheck(import.meta.url, "retrofit-inventory", (work) => {
  const findings = [];
  if (!Array.isArray(work.rows) || work.rows.length === 0) {
    return [{ code: "empty_inventory" }];
  }
  work.rows.forEach((row, index) => {
    if (!row || typeof row.legacy !== "string" || !row.legacy.trim()) findings.push({ code: "legacy_missing", index });
    if (!row || typeof row.notation !== "string" || !row.notation.trim()) findings.push({ code: "notation_missing", index });
    if (!row || !EVIDENCE.has(row.evidence)) findings.push({ code: "evidence_missing", index });
  });
  return findings;
});
