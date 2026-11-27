#!/usr/bin/env node
// Reads spec/personas/<id>/persona.json and assigns jobs by file.
// It does not contain the personas. An empty directory does not pass.
//
//   node spec/personas/orchestrator.mjs list [--dir <personas dir>]
//   node spec/personas/orchestrator.mjs assign --jobs <jobs.json> [--dir <personas dir>]
//   node spec/personas/orchestrator.mjs check --persona <id> [--work <file>] [--dir <personas dir>]
//
// Exit 0: ran, assignment or list is complete, or the named check passed.
// Exit 1: ran, and a job names an unknown persona, the job file is invalid, or the check failed.
// Exit 2: did not run (missing command, unreadable file, or no persona directories).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jobValidator, loadVersion, personaDirs, personaValidator, readPersona } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}
function notRun(msg) {
  process.stderr.write(`persona orchestrator did not run: ${msg}\n`);
  process.exit(2);
}
function report(body, ok) {
  process.stdout.write(JSON.stringify(body, null, 2) + "\n");
  process.exit(ok ? 0 : 1);
}

const command = process.argv[2];
const dir = arg("dir") ?? here;
if (!command || command.startsWith("--")) notRun("usage: list | assign --jobs <file> | check --persona <id> [--work <file>]");
if (!existsSync(dir)) notRun(`no personas directory at ${dir}`);

const version = loadVersion(dir);
if (!version || typeof version.personas !== "string") notRun(`${dir}/version.json has no personas version`);

const ids = personaDirs(dir);
if (ids.length === 0) notRun(`no persona directories in ${dir}`);

const validatePersona = personaValidator(dir);
const loaded = [];
const findings = [];
for (const id of ids) {
  const personaPath = join(dir, id, "persona.json");
  const checkPath = join(dir, id, "check.mjs");
  if (!existsSync(personaPath) || !existsSync(checkPath)) {
    findings.push({ code: "persona_incomplete", persona: id });
    continue;
  }
  let parsed;
  try {
    parsed = readPersona(personaPath, validatePersona);
  } catch (err) {
    findings.push({ code: "persona_unreadable", persona: id, detail: err.message });
    continue;
  }
  if (parsed.persona.id !== id) findings.push({ code: "directory_mismatch", persona: id, detail: parsed.persona.id });
  findings.push(...parsed.findings.map((item) => ({ ...item, persona: id })));
  loaded.push({
    id,
    version: parsed.persona.version,
    scope: parsed.persona.scope,
    personaFile: join(dir, id, "persona.json"),
    check: checkPath,
  });
}

if (command === "list") {
  report({ personasVersion: version.personas, writtenBesideSpec: version.writtenBesideSpec ?? null, personas: loaded, findings, pass: findings.length === 0 }, findings.length === 0);
}

if (command === "assign") {
  const jobsPath = arg("jobs");
  if (!jobsPath) notRun("assign needs --jobs <file>");
  let jobsDoc;
  try {
    jobsDoc = JSON.parse(readFileSync(jobsPath, "utf8"));
  } catch (err) {
    notRun(`cannot read jobs ${jobsPath}: ${err.message}`);
  }
  const validateJob = jobValidator(dir);
  if (!validateJob(jobsDoc)) {
    for (const err of validateJob.errors) findings.push({ code: "job_schema", detail: `${err.instancePath || "/"} ${err.message}` });
    report({ personasVersion: version.personas, assignments: [], findings, pass: false }, false);
  }
  const byId = new Map(loaded.map((row) => [row.id, row]));
  const assignments = [];
  for (const job of jobsDoc.jobs) {
    const persona = byId.get(job.persona);
    if (!persona) {
      findings.push({ code: "unknown_persona", persona: job.persona, job: job.id });
      continue;
    }
    assignments.push({
      id: job.id,
      persona: persona.id,
      personaVersion: persona.version,
      personaFile: persona.personaFile,
      check: persona.check,
      scope: persona.scope,
      files: job.files,
      reason: job.reason,
      evidence: job.evidence,
    });
  }
  report({ personasVersion: version.personas, assignments, findings, pass: findings.length === 0 }, findings.length === 0);
}

if (command === "check") {
  const id = arg("persona");
  if (!id) notRun("check needs --persona <id>");
  const persona = loaded.find((row) => row.id === id);
  if (!persona) {
    findings.push({ code: "unknown_persona", persona: id });
    report({ personasVersion: version.personas, findings, pass: false }, false);
  }
  if (findings.length) report({ personasVersion: version.personas, findings, pass: false }, false);
  const args = [persona.check];
  const work = arg("work");
  if (work) args.push("--work", work);
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  process.stdout.write(run.stdout);
  process.stderr.write(run.stderr);
  process.exit(run.status ?? 2);
}

notRun(`unknown command ${command}`);
