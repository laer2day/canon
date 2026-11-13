#!/usr/bin/env node
import { runCheck } from "../lib.mjs";

const EVIDENCE = new Set(["tested", "documented", "observed", "design"]);

runCheck(import.meta.url, "surface-visitor", (work) => {
  if (!Array.isArray(work.facts) || work.facts.length === 0) return [{ code: "no_facts" }];
  const findings = [];
  work.facts.forEach((fact, index) => {
    if (!fact || !EVIDENCE.has(fact.evidence)) findings.push({ code: "evidence_missing", index });
    if (fact && fact.established === true && (fact.evidence === "design" || fact.evidence === "documented")) {
      findings.push({ code: "overclaim", index, evidence: fact.evidence });
    }
  });
  return findings;
});
