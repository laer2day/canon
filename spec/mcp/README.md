# Canon MCP bootstrap

**Status:** Scaffold, non-normative. Not part of specification 0.3. Not connected to a live MCP client beyond the tests in `scripts/mcp-bootstrap.test.mjs`.
**Version:** server info `0.1.0`. Independent of the specification and of `spec/personas/version.json`.

The server scans a directory, then exposes tools built from that scan. The tools are job definitions. `spec/personas/orchestrator.mjs` is what assigns them. An agent runs the assigned persona. It does not invent the job.

## Tools

| Tool | Persona | When the reason changes |
|---|---|---|
| `canon_scan` | — | always. Re-reads the root. |
| `inventory_cardinals` | `retrofit-inventory` | names drift sources when any were read |
| `emit_attributes` | `checker-maintainer` | names emissions that are not static attributes |
| `derive_plugin_outputs` | `plugin-author` | names CSS-selector element definitions |
| `run_conformance` | `conformance-author` | says when an attribute-only conformance run would miss a source |

```bash
node spec/mcp/server.mjs --root <directory>
```

Missing `--root` exits 2. The process speaks JSON-RPC, one message per line.

## Evidence

Every fact has one of `tested`, `documented`, `observed`, `design`.

| Fact | Class | Why |
|---|---|---|
| A `data-element` attribute, a `setAttribute` call, an `inputProps` value, a `css_selector`, a `<meta name="canon">`, a pre-0.3 JSON shape | observed | the scanner read that text in a file |
| A JSON file with `cardinals`, `version`, and `prefix` that validates against `spec/canon.schema.json` | tested | Ajv ran in this process. The file was not loaded from a live surface |
| The same shape when validation fails | observed | the keys were read; validation did not pass, so it is not reported as a CardinalCollege |
| `level` (`none`, `partial`, `college`, `emitting`) | design | a classification of the facts. Not conformance. Not a running surface |

## Drift the scan must not miss

An attribute-only search for `data-element=` does not see:

- `setAttribute("data-element" | "data-instance" | "data-fs-element" | "data-fs-properties-schema", ...)`
- `inputProps` objects carrying those names
- element definitions keyed by `css_selector` / `cssSelector`

Those three are facts of kind `set-attribute`, `input-props`, and `css-selector`. Bootstrap copies them into the job `files` and names the kind in the job `reason`. A scan that found them and then reported no drift would fail `scripts/mcp-bootstrap.test.mjs`.

Fixtures under `fixtures/` are the known-bad and known-quiet inputs. They are not a product surface.

## What this does not do

- It does not call Fullstory, Amplitude, or any other vendor.
- It does not decide that a repository is canon-governed. A watermark is observed as a declaration.
- It does not execute the persona's work. It writes the job file the orchestrator assigns.
- It does not see every way to set an attribute. A helper that hides the name in a variable, a native `FS.setAttribute` call split across a builder, or a definition stored only in a vendor account is not claimed. The three patterns above are the ones the fixtures exercise.
