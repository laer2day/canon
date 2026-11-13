# Personas

**Status:** Draft, non-normative. Not part of specification 0.3.
**Version:** `spec/personas/version.json` (`personas` 0.1.0). This version is independent of the specification. Bumping a persona does not bump the spec, and a new spec version does not by itself change a persona. `writtenBesideSpec` records which spec this directory was written next to. It is not a lock.

One concern, one directory. The orchestrator reads the directory. It does not embed the personas.

| Directory | Concern |
|---|---|
| `spec-author/` | specification text, schema, version decision |
| `retrofit-inventory/` | legacy names before they become notations |
| `plugin-author/` | one plugin's manifest, check, and evidence classes |
| `checker-maintainer/` | rule checker and runtime checker, including a known-bad input |
| `conformance-author/` | fixtures that are able to fail |
| `privacy-reviewer/` | privacy class on a property contract |
| `surface-visitor/` | a visit report that does not upgrade design or documented facts |

Each directory has `persona.json` (scope, owns, does, doesNot, claims with an evidence class) and `check.mjs`.

## Orchestrator

```bash
node spec/personas/orchestrator.mjs list
node spec/personas/orchestrator.mjs assign --jobs <jobs.json>
node spec/personas/orchestrator.mjs check --persona <id> [--work <work.json>]
```

`--dir` points at another personas directory. Tests use it to show an empty directory does not pass.

| Exit | Meaning |
|---|---|
| 0 | ran; list or assignment is complete, or the named check passed |
| 1 | ran; unknown persona, invalid jobs, or the check found a problem |
| 2 | did not run |

A job file matches [job.schema.json](job.schema.json). The MCP bootstrap writes that shape so an agent runs the assigned persona instead of guessing the work. `assign` copies `scope` from the persona file it just read.

## Evidence

Claims on a persona use the same four classes as a plugin. A `tested` claim in this directory means `scripts/personas.test.mjs` showed the check pass and fail. It does not mean a vendor was called. The surface-visitor claim that an absent watermark means conformance is `design` and is not established: the runtime checker still passes a surface with no marker.
