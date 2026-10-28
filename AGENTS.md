# Canon: agent orientation

Read this before acting in this repo. It states what Canon is for and the rules that must not drift. It is short on purpose: detail lives in the files it points to.

**Two kinds of reader.** If you are working on Canon itself (the spec, canons, plugins, checks), this file governs you. If you are an agent **visiting a surface that claims to be canon-governed**, read [spec/SURFACE-CONTRACT.md](spec/SURFACE-CONTRACT.md): it says how to recognise the watermark and how far to trust it.

**Loading.** Tools that read `AGENTS.md` by default pick this up. Claude Code reads it only when no `CLAUDE.md` exists in the working directory or above, so a `CLAUDE.md` higher in the tree hides it. Do not assume it was loaded: if you can see its text, it was.

## North star

**Name each interactive part of a surface once, and derive everything else from that name.**

People, assistive technology, analytics, tests and agents must all resolve the same identity for the same part. Canon is the single source of truth. Anything vendor-specific (a Fullstory element name, a test selector, an agent tool) is the **output** of a plugin applied to a canon, never a second vocabulary kept in step by hand.

If a change would make two places hold the same name that must be edited separately, it is drifting from the north star.

## The picture

```
                        ONE CANON  (spec/canons/<name>.json)
                  notation + cardinality + labels + instances
                                  |
        validates against ----->  spec/canon.schema.json   (normative, closed)
                                  |
          +-----------------------+------------------------+
          |                       |                        |
   SURFACE emits            PLUGIN derives            AGENT calls
   data-element             vendor structure          capability
   data-instance            (e.g. Fullstory           (tool = notation,
   testTag / a11yId         element names)             same identity)
          |                       |                        |
          +-----------+-----------+------------------------+
                      |
              CHECKS compare what is emitted/derived to the canon
              (conformance suite, plugin check, runtime checker)
                      |
         a mismatch is a FAILURE, never silently ignored
```

Three layers, never merged: **concept** (a notation, immutable once published), **label** (human text per locale, never a key), **instance** (a specific record id, never derived from rendered text or position).

## Rules that never change

1. **A check that cannot fail is not a check.** Before relying on any validator, test or gate, run it on a known-bad input and see it fail. A check that exits 0 on empty or bad input is a defect.
2. **Exit 2 is never a pass.** "Did not run" (not implemented, unreadable, undeclared) fails closed.
3. **Notations are immutable.** Deprecate with `replacedBy`; never rename or reuse.
4. **No personal data in a label, instance or property** (spec section 6).
5. **The spec changes only by a new version of the spec** (section 10). The normative schema is closed (`additionalProperties: false`). Do not add a field to it, or to the spec text, as a side effect of other work. Plugins and drafts are non-normative until a spec version promotes them.
6. **Read the source of a claim before repeating it.** Several earlier errors came from quoting a spec section from its heading. Section 3.1 says the specification does not use `data-id` and the instance id must not be stored there. It does not forbid the attribute.
7. **Label evidence.** About a vendor or a running system, say whether it was `tested`, `documented`, `observed` (and where) or only `design`. Do not describe a documented or designed behaviour as established.
8. **Count and name before you write.** Measure a number two ways, or mark it single-method. Never type a count from memory into a document someone will sign.

## Where things are

| Path | What |
|---|---|
| `spec/semantic-surface-taxonomy.md` | the specification, draft 0.2: the authority |
| `spec/canon.schema.json` | normative schema for a canon |
| `spec/canons/` | canons (`meridian.json` is a non-normative example) |
| `spec/surfaces/`, `spec/conformance/` | surface fragments, fixtures, expected resolutions |
| `STATUS.md` | where the project stands and what is left; read this to start a session (it ages: re-check before relying on it) |
| `spec/GLOSSARY.md` | the project's words in plain language (notation, cardinal, instance, binding and more); start here if a term is unfamiliar (draft, non-normative) |
| `spec/SURFACE-CONTRACT.md` | the watermark: how a surface declares it is canon-governed, and how a visiting agent treats that claim (draft, non-normative) |
| `spec/plugins/CONTRACT.md` | what a plugin is and must do (draft, non-normative) |
| `spec/plugins/<id>/` | one directory per plugin: `plugin.json`, a `check` entry point, its docs |
| `scripts/validate-canon.mjs` | validates a canon against the schema and the rule checker |
| `runtime/` | live-surface checker (fail-closed) |
| `src/lib/check.ts` | the rule checker the tests and validator use |
| `planning/` | gitignored; not part of the repo |

The app under `src/`, `server/`, `migrations/` is a non-normative studio demo, not the specification.

## Verify

```bash
npm test                                   # both runners must print a summary; read both
node --experimental-strip-types --no-warnings scripts/validate-canon.mjs spec/canons/meridian.json   # prints VALID
node spec/plugins/fullstory/check.mjs      # currently a stub: must exit 2, never 0
```

`npm test` chains two runners with `&&`. If the first fails the second never starts, so a green result needs two summaries.

## State (re-check before relying on it)

This section ages. Verify against the repo before acting on any line.

- **Built:** the spec (draft 0.2), the schema, one example canon, a conformance suite, a runtime checker, and a plugin contract with a manifest schema and a Fullstory manifest, covered by tests.
- **Not built:** plugin discovery (how a surface declares a plugin), a common runner that calls each plugin's check, the notation-to-label mapping format, a generator that derives vendor names from a canon, and a real drift check. The Fullstory plugin's `check.mjs` is a **stub**. The Fullstory plugin is **not in operation**.
- **The proof case** is the CarGo demo app (web, iOS, Android) as one multi-modal canon. Its canon does not exist yet. A plugin must be hardened against a real canon before it is applied to a real surface.
- **Fullstory claims are untested.** The plugin's `plugin.json` lists each claim with its evidence class. None is `tested`. Whether a rename preserves history, whether a Compose element can be named, and whether the Fullstory name should equal the notation are open until tested on a non-production org.

## Do not

- Edit a surface repo, push, deploy, or call a vendor system as a side effect of canon work without being asked in the current conversation.
- Put an org's element definitions, user data or secrets in this repo. It is public.
- Describe the plugin as live, the drift check as working, or a derived name as verified, unless you have just run the check that shows it.
