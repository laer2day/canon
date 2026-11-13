#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runCheck } from "../lib.mjs";

runCheck(import.meta.url, "checker-maintainer", (work, { root }) => {
  const findings = [];
  if (work.badInputShown !== true) findings.push({ code: "bad_input_not_shown" });
  if (!Array.isArray(work.tests) || work.tests.length === 0) findings.push({ code: "no_tests" });
  for (const file of work.tests ?? []) {
    if (typeof file !== "string" || !existsSync(join(root, file))) findings.push({ code: "test_missing", file });
  }
  return findings;
});
