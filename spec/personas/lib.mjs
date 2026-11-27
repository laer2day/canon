// Shared loader for persona files. Personas themselves stay one directory each.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });

export function repoRootFrom(metaUrl) {
  return join(dirname(fileURLToPath(metaUrl)), "..", "..", "..");
}

export function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

export function notRun(msg) {
  process.stderr.write(`persona check did not run: ${msg}\n`);
  process.exit(2);
}

export function finish(report) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(report.pass ? 0 : 1);
}

function compile(schemaPath) {
  return ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
}

export function personaValidator(personasDir) {
  return compile(join(personasDir, "persona.schema.json"));
}

export function jobValidator(personasDir) {
  return compile(join(personasDir, "job.schema.json"));
}

export function readPersona(personaPath, validate) {
  const persona = JSON.parse(readFileSync(personaPath, "utf8"));
  const findings = [];
  if (!validate(persona)) {
    for (const err of validate.errors) findings.push({ code: "schema", detail: `${err.instancePath || "/"} ${err.message}` });
  }
  return { persona, findings };
}

export function personaDirs(personasDir) {
  return readdirSync(personasDir)
    .filter((name) => {
      const path = join(personasDir, name);
      return statSync(path).isDirectory();
    })
    .sort();
}

export function loadVersion(personasDir) {
  const path = join(personasDir, "version.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function runCheck(metaUrl, id, review) {
  const here = dirname(fileURLToPath(metaUrl));
  const personasDir = join(here, "..");
  const root = join(personasDir, "..", "..");
  const validate = personaValidator(personasDir);
  const personaPath = join(here, "persona.json");
  if (!existsSync(personaPath)) notRun(`no persona.json in ${here}`);
  let loaded;
  try {
    loaded = readPersona(personaPath, validate);
  } catch (err) {
    notRun(`cannot read ${personaPath}: ${err.message}`);
  }
  const findings = [...loaded.findings];
  if (loaded.persona.id !== id) findings.push({ code: "id_mismatch", detail: `${loaded.persona.id} != ${id}` });
  const dirName = here.split("/").at(-1);
  if (loaded.persona.id !== dirName) findings.push({ code: "directory_mismatch", detail: dirName });
  const workPath = arg("work");
  if (workPath) {
    let work;
    try {
      work = JSON.parse(readFileSync(workPath, "utf8"));
    } catch (err) {
      notRun(`cannot read work ${workPath}: ${err.message}`);
    }
    if (findings.length === 0) findings.push(...review(work, { root, persona: loaded.persona }));
  }
  finish({
    persona: id,
    version: loaded.persona.version ?? null,
    pass: findings.length === 0,
    findings,
  });
}

export function exists(root, rel) {
  return existsSync(join(root, rel));
}
