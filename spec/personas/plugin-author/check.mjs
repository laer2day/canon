#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { runCheck } from "../lib.mjs";

const FILE = /[\w./-]+\.(?:mjs|json|md|js)/g;

runCheck(import.meta.url, "plugin-author", (work, { root }) => {
  if (!work || typeof work.pluginDir !== "string" || !work.pluginDir) {
    return [{ code: "work_shape", detail: "pluginDir is required" }];
  }
  const pluginDir = isAbsolute(work.pluginDir) ? work.pluginDir : join(root, work.pluginDir);
  const manifestPath = join(pluginDir, "plugin.json");
  if (!existsSync(manifestPath)) return [{ code: "manifest_missing", pluginDir: work.pluginDir }];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    return [{ code: "manifest_unreadable", detail: err.message }];
  }
  const findings = [];
  const claims = Array.isArray(manifest.claims) ? manifest.claims : [];
  const tested = claims.filter((claim) => claim.evidence === "tested");
  if (manifest.check?.status === "stub" && tested.length) findings.push({ code: "stub_claims_tested" });
  if (manifest.check?.status === "implemented") {
    if (!Array.isArray(manifest.check.layers) || manifest.check.layers.length === 0) findings.push({ code: "no_layer" });
    for (const claim of tested) {
      const paths = [...String(claim.where ?? "").matchAll(FILE)].map((match) => match[0]);
      if (!paths.some((path) => existsSync(join(root, path)))) {
        findings.push({ code: "tested_claim_unbacked", text: claim.text });
      }
    }
  }
  return findings;
});
