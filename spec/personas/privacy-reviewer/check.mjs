#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runCheck } from "../lib.mjs";

const PERSONAL_NAME = /email|e-mail|phone|ssn|address/i;

runCheck(import.meta.url, "privacy-reviewer", (work, { root }) => {
  if (!work || typeof work.contract !== "string") return [{ code: "work_shape", detail: "contract path is required" }];
  const path = join(root, work.contract);
  if (!existsSync(path)) return [{ code: "contract_missing", contract: work.contract }];
  let contract;
  try {
    contract = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    return [{ code: "contract_unreadable", detail: err.message }];
  }
  const findings = [];
  const excluded = new Set();
  for (const cardinal of contract.cardinals ?? []) {
    for (const prop of cardinal.properties ?? []) {
      if (prop.privacy === "excluded") excluded.add(prop.name);
      else if ((prop.privacy === "public" || prop.privacy === "masked") && PERSONAL_NAME.test(prop.name ?? "")) {
        findings.push({ code: "personal_name", name: prop.name, notation: cardinal.notation });
      } else if (!["public", "masked", "excluded"].includes(prop.privacy)) {
        findings.push({ code: "privacy_class", name: prop.name });
      }
    }
  }
  const props = work.payload?.event_properties;
  if (props && typeof props === "object") {
    for (const name of Object.keys(props)) {
      if (excluded.has(name)) findings.push({ code: "excluded_in_payload", name });
    }
  }
  return findings;
});
