# Canon: where we are

**As of 2026-10-28.** This file ages. Before relying on any line, check the repository (`git log`, `npm test`). It is a handoff note so the next session starts from the real state. It is not part of the specification.

## In one paragraph

Canon names each interactive part of a digital surface once, so people, assistive technology, analytics, tests and agents all resolve the same identity. Everything vendor-specific is meant to be derived from the canon by a plugin, never kept beside it. What exists today is the specification, a schema, an example canon, a checker, a plain-words glossary, a draft contract for plugins, a draft contract for surfaces, and one plugin (Fullstory) that is **documentation plus a stub**. The Fullstory plugin is **not in operation**. The first real application of all this, a demo app on web, iOS and Android, is being prepared and has not produced a canon yet.

Start with [AGENTS.md](AGENTS.md) for the rules and the picture, and [spec/GLOSSARY.md](spec/GLOSSARY.md) for the words.

## State of the repository (observed 2026-10-28)

- `main` is `048bbd5`, pushed, working tree clean. Other remote branches: `canon-conformance-checker` (the earlier checker work, **not merged**) and `scratch/vercel-commerce`.
- `npm test`: first runner 228 pass, second runner 72 pass, 0 failing. Both runners print a summary; read both.
- `node --experimental-strip-types --no-warnings scripts/validate-canon.mjs spec/canons/meridian.json` prints `VALID`.
- `node spec/plugins/fullstory/check.mjs` exits 2 (the stub). Exit 2 means "did not run" and is never a pass.

## What is built

| Piece | Where | Status |
|---|---|---|
| Specification, draft 0.2 | `spec/semantic-surface-taxonomy.md` | the authority; changes only by a new version (section 10) |
| Canon schema | `spec/canon.schema.json` | normative and closed (`additionalProperties: false`) |
| Example canon, fragment, fixtures | `spec/canons/`, `spec/surfaces/`, `spec/conformance/` | non-normative example |
| Runtime checker | `runtime/check.mjs` | fail-closed; reads `<meta name="canon">`; **passes a surface with no marker** (known gap) |
| Watermark parser | `runtime/declaration.mjs` | `parseDeclared` is used by the checker. `strictDeclared` and `agree` are **tested but called by nothing** |
| Glossary | `spec/GLOSSARY.md` | draft, non-normative |
| Plugin contract | `spec/plugins/CONTRACT.md`, `spec/plugins/plugin.schema.json` | draft, non-normative, with a manifest test in `npm test` |
| Fullstory plugin | `spec/plugins/fullstory/` | README, retrofit guide, manifest and a **stub** check |
| Surface contract (the watermark) | `spec/SURFACE-CONTRACT.md` | draft, non-normative; web only |
| Agent orientation | `AGENTS.md` | loaded by tools that read AGENTS.md by default; Claude Code skips it if a `CLAUDE.md` exists in the working directory or above |

## Decisions made (Lane)

- Canon is governed by `AGENTS.md`, not `CLAUDE.md`.
- Plugins are a first-class concept; each plugin lives in its own directory under `spec/plugins/`, with a common contract. The Fullstory plugin is authored and hardened first.
- **Cardinal** is the planned name for what the specification calls a concept. **CardinalCollege** is today's canon file under a new name, on the condition that the canon file's purpose is to be the one place where a canon of cardinals exists (Jeff2 checked the condition against the specification). Nothing is renamed until a new spec version.
- The watermark is a claim and the runtime checker is the evidence; the attestation is unsigned.
- One canon, covering all three surfaces of the demo app. All eight design questions for that work were decided on 2026-10-20; the project's charter records them.

## What is left

**Not built.** Nothing below exists in the repository.
1. **Plugin discovery:** how a surface or canon declares which plugins it uses. A `plugins` field in a canon needs a new spec version, because the schema is closed; a surface-side file does not.
2. **A common runner** that calls every declared plugin's check.
3. **The notation-to-label mapping format** for plugins, with its own checks.
4. **A generator** that derives vendor names from a canon.
5. **A real drift check.** `spec/plugins/fullstory/check.mjs` is a stub that exits 2.
6. **Watermarks for iOS, Android and headless surfaces.** The design inputs are gathered but nothing is written: a headless surface can carry a prefixed key in the `server/discover` result of the current MCP revision (read from the protocol's own pages); the native carriers are undecided. An agent visiting a native app sees the accessibility tree, so a build-time file such as `Info.plist` is not visible to it.
7. **The standard agent page:** one canon-owned document, linked from a surface's watermark, that explains the contract to a visiting agent. Not written or hosted.
8. **A freshness test for `AGENTS.md`:** every path and command it names should be checked by a test. Done by hand once; not automated. The first attempt could not tell shorthand file names from dead links, so the strictness needs a decision.
9. **A test for the surface contract**, and use of `strictDeclared` and `agree` in a real carrier check.
10. **The checker's gap:** a surface with no marker passes. Whether an absent marker should fail for a surface that is meant to be governed is undecided and would change the checker.
11. **Promoting the plugin contract and the watermark into the specification,** which needs a new spec version.
12. **A canon for the demo app.** That depends on the work below.

**Untested claims.** The Fullstory plugin's manifest lists twelve claims, each with an evidence class, and none is `tested`. Open until tested on a non-production organisation, with the owner's go-ahead: whether renaming an element preserves its history, whether a Jetpack Compose element can be named, whether Fullstory reads native identifiers by itself, and whether the Fullstory name should equal the notation.

## The demo-app work (summary only)

A multi-wave plan prepares one canon for the demo app. **Wave 1 is frozen and in progress**: a planner session (Jeff2) and a builder-critic session (Jeff1, which approved the plan after two rounds) are working under the harness. Wave 1 is read-only on the demo app: it produces inventories, measured limits, an identity map and a taxonomy proposal, then stops at a gate where Lane writes the approval by hand. The first build item (a baseline of the demo-app repositories) is done; the inventories and everything after it are not started.

The plan, its evidence and its decision register live in a planning folder outside this repository, on purpose: it contains specifics about a private demo app and a vendor organisation, and this repository is public. **Nothing from those repositories or any vendor organisation belongs here.** Do not copy it in.

## Rules for the next session

- Read `AGENTS.md` first. Run the three commands above before trusting this note.
- A check that cannot fail is not a check: show it fail on a bad input before relying on it.
- Do not push, deploy, or call a vendor system unless asked in that session. This repository is public: scan a diff for secrets, local paths, emails and names before pushing.
- Which GitHub account pushes matters. The `gh` login in use at the end of this session was `lane2day` (WRITE on the repository).
