# Canon plugin contract

**Status:** Draft 0.1, non-normative. It does not change the specification (draft 0.2) or `canon.schema.json`. The specification changes only by a new version of that document (§10), so promoting this contract into the specification is a separate step that is not taken here.

## What a plugin is

A plugin **derives** a vendor-specific structure from a canon. The canon is the single source of truth and is defined first. Nothing vendor-specific is maintained beside it: a name, a property schema or a page name that a vendor needs is the output of the plugin applied to the canon, not a second vocabulary kept in step by hand.

A plugin never changes the canon. It reads it. A canon that validates against `canon.schema.json` keeps validating whether a plugin is applied or not, and removing a plugin must leave every canon attribute on a surface intact.

## Layout

One directory per plugin, directly under `spec/plugins/`, named by the plugin id:

| Path | Role |
|---|---|
| `spec/plugins/CONTRACT.md` | this document |
| `spec/plugins/plugin.schema.json` | schema for a plugin manifest |
| `spec/plugins/<id>/plugin.json` | the manifest (required) |
| `spec/plugins/<id>/<check entry>` | the plugin's drift-check entry point (required) |
| `spec/plugins/<id>/README.md` | the plugin's own documentation (required in practice, not machine-checked) |

## The manifest

`plugin.json` validates against `plugin.schema.json`. It states:

- `plugin`: the id, which **must equal the directory name**.
- `contract`: the version of this document the manifest was written against.
- `vendor`, `derives` (the kinds of structure produced, for example `element-name`), and `platforms` (any of `web`, `ios`, `android`, `headless`).
- `check`: the entry point, its `status` (`stub` or `implemented`) and, once implemented, the `layers` it covers (`static`, `live`).
- `claims`: every behavioural claim the plugin makes about the vendor, each with an **evidence class**.

### Evidence classes

A claim about how the vendor behaves is only as strong as how it is known. Every claim carries one of:

| Class | Meaning |
|---|---|
| `tested` | run, and shown to pass and to fail |
| `documented` | stated in a vendor document; not run |
| `observed` | seen in a real read; say where and how many |
| `design` | a proposal with no evidence |

A plugin may not describe a `design` or `documented` claim as established. The purpose of the field is to keep a plugin's text from outrunning what is known about the vendor.

## The check entry point

Every plugin supplies one. It is the plugin's side of drift detection: given a canon and a surface, does the surface emit what the plugin would derive.

**Exit codes**

| Code | Meaning |
|---|---|
| 0 | the check ran and found no drift |
| 1 | the check ran and found drift |
| 2 | the check did not run (not implemented, unreadable input, undeclared plugin) |

Exit 2 is **never** a pass. An unknown, unreadable or unimplemented check fails closed. A `stub` prints that it is not implemented, writes nothing to standard output, and exits 2.

**A check may report `implemented` only after it has been shown to exit non-zero on a known-bad input.** A check that cannot fail is not a check.

**Layers.** A plugin may offer a static layer (no network: source and built surface against the canon and the plugin's derived output; runs in CI and is the deploy gate) and an optional live layer (reads the vendor's own system through a reader the plugin supplies). A live reader may be weaker than the static check. A plugin must say what its live layer cannot see.

## What a plugin must not do

- Edit a canon, or require a field in a canon that `canon.schema.json` does not allow.
- Put personal data in anything it derives (spec §6).
- Store a secret in the repository. A live layer that needs a credential must take it from the environment of whoever runs it.
- Modify anything in the vendor's system from a check. A check is read-only.
- Report success when it did not run.

## What is enforced today, and what is not

`scripts/plugin-manifest.test.mjs` runs under `npm test` and enforces:

- every directory under `spec/plugins/` has a `plugin.json` that validates against the schema;
- the manifest id equals the directory name;
- the `check.entry` file exists;
- a `stub` check exits 2 and writes nothing to standard output;
- an `implemented` check declares at least one layer;
- the schema rejects an unknown field, a missing field, a bad id, a bad platform, an empty platform list, a bad status, an unknown evidence class, a missing evidence class and a bad contract version.

Each of these was shown to fail by mutation before being relied on.

**Not enforced, and not yet designed:**

- **Discovery.** How a surface or canon declares that it uses a plugin. The intended answer is a `plugins` entry in a canon or surface file, with a missing or unreadable declaration failing closed and an undeclared plugin in use being a drift finding. This cannot go in `canon.schema.json` without a new version of the specification, because that schema is closed. A separate surface-side declaration file is the likely home.
- **A common runner.** Nothing yet calls every plugin's check entry point in turn. A plugin added today is validated as a manifest but not run as a check.
- **That a check does what it says.** The contract fixes exit codes and requires a failing case before `implemented`, but it cannot verify that a particular check is correct.
- **A mapping format.** Each plugin will need a per-canon mapping from notation to the vendor's label (for Fullstory, a display name), with its own conformance checks. Not yet written.
- **Everything a plugin claims about its vendor.** The manifest records how each claim is known. It does not make an untested claim true.
