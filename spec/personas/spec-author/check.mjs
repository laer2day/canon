#!/usr/bin/env node
import { runCheck } from "../lib.mjs";

const SPEC_FILES = new Set(["spec/semantic-surface-taxonomy.md", "spec/canon.schema.json"]);

runCheck(import.meta.url, "spec-author", (work) => {
  if (!Array.isArray(work.changed)) return [{ code: "work_shape", detail: "changed must be an array of paths" }];
  const touched = work.changed.some((file) => SPEC_FILES.has(file));
  if (touched && !(typeof work.versionDecision === "string" && work.versionDecision.trim())) {
    return [{ code: "version_decision_missing" }];
  }
  return [];
});
