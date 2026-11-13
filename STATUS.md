# Canon: where we are

**As of 2026-11-13.** This file ages. Before relying on any line, check the repository (`git log`, `npm test`). It is a handoff note so the next session starts from the real state. It is not part of the specification.

## In one paragraph

Canon names each interactive part of a digital surface once, so people, assistive technology, analytics, tests and agents all resolve the same identity. Everything vendor-specific is meant to be derived from the CardinalCollege by a plugin, never kept beside it. What exists today is the specification (draft 0.3), a schema, an example CardinalCollege, a checker, a plain-words glossary, a draft contract for plugins, a draft contract for surfaces, a non-normative property-enrichment companion, and plugins for Fullstory (documentation plus a stub), PostHog (static check), Contentsquare (architecture plus a stub), and Amplitude (static check over a property contract). The Fullstory plugin is **not in operation**. The Amplitude plugin has not been run against Amplitude. The first real application of all this, a demo app on web, iOS and Android, is being prepared and has not produced a CardinalCollege yet.

Start with [AGENTS.md](AGENTS.md) for the rules and the picture, and [spec/GLOSSARY.md](spec/GLOSSARY.md) for the words.

## State of the repository (observed 2026-11-13)

- Specification 0.3 is on `main` (PR #1 merged). The CardinalCollege key is `cardinals`, each item is `$defs/cardinal`, and the document version is `version`. The example is `spec/cardinal-colleges/meridian.json`.
- The rule checker (`src/lib/check.ts`), the runtime checker (`runtime/check.mjs`), the PostHog static check, and the tests that load the example read those keys and that path. A document that still carries `concepts` or a top-level `canon` version field does not run (exit 2) and is rejected by `validateCanon`. That refusal was shown to fail closed; it is not a silent read of the old keys.
- `node spec/plugins/fullstory/check.mjs` exits 2 (the stub). Exit 2 means "did not run" and is never a pass.

## What is built

| Piece | Where | Status |
|---|---|---|
| Specification, draft 0.3 | `spec/semantic-surface-taxonomy.md` | the authority; changes only by a new version (section 10). Cardinal and CardinalCollege are first-class. |
| CardinalCollege schema | `spec/canon.schema.json` | normative and closed (`additionalProperties: false`). Key is `cardinals`. |
| Example CardinalCollege, fragment, fixtures | `spec/cardinal-colleges/`, `spec/surfaces/`, `spec/conformance/` | non-normative example |
| Runtime checker | `runtime/check.mjs` | fail-closed; reads `<meta name="canon">` and a CardinalCollege (`cardinals`, `version`); **passes a surface with no marker** (known gap). Pre-0.3 keys exit 2. |
| Watermark parser | `runtime/declaration.mjs` | `parseDeclared` is used by the checker. `strictDeclared` and `agree` are **tested but called by nothing** |
| Glossary | `spec/GLOSSARY.md` | draft, non-normative; terms now match the specification |
| Plugin contract | `spec/plugins/CONTRACT.md`, `spec/plugins/plugin.schema.json` | draft 0.2, non-normative, with a manifest test in `npm test` |
| Property enrichment | `spec/property-enrichment.md`, `spec/property-contract.schema.json`, `spec/property-contracts/meridian.json` | companion draft 0.1, non-normative. Not part of spec 0.3. Schema of the CardinalCollege is unchanged |
| Fullstory plugin | `spec/plugins/fullstory/` | README, retrofit guide, manifest and a **stub** check. Property-schema derivation is a design note only |
| Amplitude plugin | `spec/plugins/amplitude/` | derives element and page properties from the property contract. Static check is implemented and covered by `scripts/amplitude-plugin.test.mjs`. Not run against Amplitude |
| Personas | `spec/personas/` | one directory per concern, version 0.1.0, independent of spec 0.3. Orchestrator assigns jobs by file. Each check is shown to fail. Not part of the specification |
| MCP bootstrap | `spec/mcp/` | scans a tree, stamps facts with an evidence class, and writes jobs the orchestrator assigns. Drift fixtures are tested. Not connected to a vendor. The adoption level is design-class |
| PostHog plugin (added 2026-11-12, on branch `posthog-plugin`) | `spec/plugins/posthog/` | privacy-first web client, IP-stripping proxy pattern with a reference proxy, and an **implemented static** check, all covered by `scripts/posthog-plugin.test.mjs`. posthog-js option behaviour is `documented`, not tested |
| Surface contract (the watermark) | `spec/SURFACE-CONTRACT.md` | draft, non-normative; web only |
| Agent orientation | `AGENTS.md` | loaded by tools that read AGENTS.md by default; Claude Code skips it if a `CLAUDE.md` exists in the working directory or above |

## Decisions made (Lane)

- Canon is governed by `AGENTS.md`, not `CLAUDE.md`.
- Plugins are a first-class concept; each plugin lives in its own directory under `spec/plugins/`, with a common contract. The Fullstory plugin is authored and hardened first.
- **Cardinal** is the normative name for the universal identity (previously called concept). **CardinalCollege** is the normative name for the document that holds the list of cardinals as the single source of truth. Implemented in specification version 0.3.
- The watermark is a claim and the runtime checker is the evidence; the attestation is unsigned.
- One CardinalCollege, covering all three surfaces of the demo app. All eight design questions for that work were decided on 2026-10-20; the project's charter records them.

## Personas: versioning (2026-11-13)

`spec/personas/version.json` is `0.1.0`. `writtenBesideSpec` is `0.3` and is a note, not a coupling. A persona file carries its own `version`. The orchestrator does not require them to equal the specification. Personas are not promoted into the specification.

## Property enrichment: versioning decision (2026-11-13)

The property contract is a sibling artifact, companion draft 0.1 (`spec/property-enrichment.md`). Specification 0.3 is not bumped. `canon.schema.json` is not given a new field. Section 12 of the specification gained a non-normative pointer that adds no conformance rule. Promoting the companion into the specification requires a new version of that document (section 10). That promotion is not taken. Plugin contract text moved from draft 0.1 to draft 0.2 so a plugin may read the sibling; manifests say `"contract": "0.2"`. The manifest schema did not change.

## What is left

**Not built.** Nothing below exists in the repository.
1. **Plugin discovery:** how a surface or CardinalCollege declares which plugins it uses. A `plugins` field in a CardinalCollege needs a new spec version, because the schema is closed; a surface-side file does not.
2. **A common runner** that calls every declared plugin's check.
3. **The notation-to-label mapping format** for plugins, with its own checks.
4. **A generator** that derives vendor names from a CardinalCollege.
5. **A real drift check.** `spec/plugins/fullstory/check.mjs` is a stub that exits 2.
6. **Watermarks for iOS, Android and headless surfaces.** The design inputs are gathered but nothing is written: a headless surface can carry a prefixed key in the `server/discover` result of the current MCP revision (read from the protocol's own pages); the native carriers are undecided. An agent visiting a native app sees the accessibility tree, so a build-time file such as `Info.plist` is not visible to it.
7. **The standard agent page:** one CardinalCollege-owned document, linked from a surface's watermark, that explains the contract to a visiting agent. Not written or hosted.
8. **A freshness test for `AGENTS.md`:** every path and command it names should be checked by a test. Done by hand once; not automated. The first attempt could not tell shorthand file names from dead links, so the strictness needs a decision.
9. **A test for the surface contract**, and use of `strictDeclared` and `agree` in a real carrier check.
10. **The checker's gap:** a surface with no marker passes. Whether an absent marker should fail for a surface that is meant to be governed is undecided and would change the checker.
11. **Promoting the plugin contract, the watermark, and the property-enrichment companion into the specification,** which needs a new spec version. The companion stays non-normative on purpose.
12. **A CardinalCollege for the demo app.** That depends on the work below.
13. **A Fullstory property-schema generator.** `spec/plugins/fullstory/property-schema.md` is design only. The check is still a stub.
14. **Heap and Contentsquare property plugins** that read the same contract. The triangulation is documented or design, as the companion says. No Heap plugin exists. The Contentsquare check is still a stub.
15. **Running the Amplitude derivation inside the Amplitude SDK,** and native SDKs. The static check does not do that.
16. **Promoting personas into the specification.** They are a directory the orchestrator reads. They are not spec 0.3, and their version is not the spec version.
17. **A real MCP deployment.** `spec/mcp/server.mjs` is a scaffold. It was exercised on fixtures and one stdio initialize. It does not watch a product repo, and it misses attribute writes that hide the name in a variable or that live only in a vendor account.

The 0.3 key and path migration of the checker, the runtime, the PostHog static check, and the tests is done. On 2026-11-13, before the property-enrichment tests, `npm test` printed two summaries (266 pass, then 73 pass). After those tests the same command printed 294 pass, then 73 pass. After the persona tests it printed 308 pass, then 73 pass. After the MCP bootstrap tests it printed 321 pass, then 73 pass. `scripts/validate-canon.mjs spec/cardinal-colleges/meridian.json` printed `VALID` (exit 0), the same validator exited 1 on a pre-0.3 document and on an illegal notation and 2 on a missing file, and `node spec/plugins/fullstory/check.mjs` exited 2. Re-run before relying on this paragraph.

**Untested claims.** The Fullstory plugin's manifest lists each claim with an evidence class, and none is `tested`. Open until tested on a non-production organisation, with the owner's go-ahead: whether renaming an element preserves its history, whether a Jetpack Compose element can be named, whether Fullstory reads native identifiers by itself, and whether the Fullstory name should equal the notation. The property-schema derivation claim is `design` (`spec/plugins/fullstory/property-schema.md`). Amplitude claims that are `tested` were run in this repository only; they are listed in that plugin's manifest and were not sent to Amplitude.

## The demo-app work (summary only)

A multi-wave plan prepares one CardinalCollege for the demo app. **Wave 1 is frozen and in progress**: a planner session (Jeff2) and a builder-critic session (Jeff1, which approved the plan after two rounds) are working under the harness. Wave 1 is read-only on the demo app: it produces inventories, measured limits, an identity map and a taxonomy proposal, then stops at a gate where Lane writes the approval by hand. The first build item (a baseline of the demo-app repositories) is done; the inventories and everything after it are not started.

The plan, its evidence and its decision register live in a planning folder outside this repository, on purpose: it contains specifics about a private demo app and a vendor organisation, and this repository is public. **Nothing from those repositories or any vendor organisation belongs here.** Do not copy it in.

## Rules for the next session

- Read `AGENTS.md` first. Run the three commands above before trusting this note.
- A check that cannot fail is not a check: show it fail on a bad input before relying on it.
- Do not push, deploy, or call a vendor system unless asked in that session. This repository is public: scan a diff for secrets, local paths, emails and names before pushing.
- Which GitHub account pushes matters. The `gh` login in use at the end of this session was `lane2day` (WRITE on the repository).
