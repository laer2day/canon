// Turn a scan into job definitions the persona orchestrator can assign.
// Drift kinds are named in the job reason and listed in files. They are not omitted.
import { jobValidator } from "../personas/lib.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const personasDir = join(dirname(fileURLToPath(import.meta.url)), "..", "personas");

const DRIFT = ["set-attribute", "input-props", "css-selector"];

function unique(paths) {
  return [...new Set(paths.filter(Boolean))];
}

function filesOf(scan, kinds) {
  return unique(scan.facts.filter((fact) => kinds.includes(fact.kind)).map((fact) => fact.file));
}

function driftCodes(scan) {
  return DRIFT.filter((kind) => scan.facts.some((fact) => fact.kind === kind));
}

export function bootstrap(scan) {
  const codes = driftCodes(scan);
  const driftFiles = filesOf(scan, DRIFT);
  const collegeFiles = filesOf(scan, ["cardinal-college", "cardinal-college-invalid", "pre-0.3-college"]);
  const emissionFiles = filesOf(scan, ["data-element", "set-attribute", "input-props", "watermark"]);
  const pluginFiles = filesOf(scan, ["css-selector", "property-contract"]);
  const named = codes.length ? codes.join(", ") : "none";

  const jobs = [
    {
      id: "inventory-cardinals",
      persona: "retrofit-inventory",
      files: unique([...collegeFiles, ...emissionFiles, ...driftFiles]),
      reason:
        codes.length > 0
          ? `Inventory cardinals. Attribute-only scans miss these drift sources: ${named}.`
          : "Inventory cardinals from the files the scan opened. Attribute-only drift codes: none.",
      evidence: "observed",
    },
    {
      id: "emit-attributes",
      persona: "checker-maintainer",
      files: unique([...emissionFiles, ...driftFiles]),
      reason:
        codes.length > 0
          ? `Emission includes sources an attribute-only check does not see: ${named}.`
          : emissionFiles.length
            ? "Static data-element or watermark emission was read. Attribute-only drift codes: none."
            : "No data-element, setAttribute, or inputProps emission in the files read. Attribute-only drift codes: none.",
      evidence: "observed",
    },
    {
      id: "derive-plugin-outputs",
      persona: "plugin-author",
      files: unique([...pluginFiles, ...filesOf(scan, ["set-attribute", "input-props"])]),
      reason: codes.includes("css-selector")
        ? `CSS-selector-defined elements are not a Canon notation. Drift sources: ${named}.`
        : codes.length
          ? `Plugin derivation must account for drift sources: ${named}.`
          : "No css_selector definitions in the files read. Attribute-only drift codes: none.",
      evidence: "observed",
    },
    {
      id: "run-conformance",
      persona: "conformance-author",
      files: unique([...collegeFiles, ...emissionFiles, ...driftFiles]),
      reason:
        codes.length > 0
          ? `A conformance run that only reads data-element attributes will miss: ${named}.`
          : "Conformance over the files the scan opened. Attribute-only drift codes: none.",
      evidence: "observed",
    },
  ];

  const validate = jobValidator(personasDir);
  const doc = { jobs };
  if (!validate(doc)) {
    const detail = validate.errors.map((err) => `${err.instancePath || "/"} ${err.message}`).join("; ");
    throw new Error(`bootstrap produced a job file the orchestrator schema rejects: ${detail}`);
  }
  return {
    personasVersion: "0.1.0",
    jobs: doc,
    level: scan.level,
    levelEvidence: scan.levelEvidence,
    drift: codes,
    facts: scan.facts,
  };
}
