# Canon surface contract: the watermark

**Status:** Draft 0.1, non-normative. It does not change the specification (draft 0.2). The spec requires a surface to declare the canon version it emits (sections 7 and 8) but defines no attribute for doing so. This draft fixes one for the web so that a visiting agent can tell a canon-governed surface from any other. Promoting it into the specification needs a new spec version (section 10).

This document is for **an agent that visits a surface**. An agent working on the canon repository itself should read `AGENTS.md` at the repository root.

## What the watermark is

A canon-governed surface carries a **watermark**: a declaration, in the surface itself, that says which canon it follows and at which version.

**The watermark is a claim. It is not proof.** Anyone can add the markup to any page. A visiting agent treats it as "this surface says it follows canon X at version V" and nothing stronger. The evidence is the runtime checker (`runtime/check.mjs`), which compares what a surface actually emits with the canon. Its output is unsigned: nothing in it proves who produced it. A mark that the checker confirms is a conforming surface at the time of the check, not a trusted publisher.

## The marker (required)

```html
<meta name="canon" content="<prefix>@<version>">
```

- `prefix` is the canon's prefix (spec section 1.1), for example `cargo`.
- `version` is the canon's own version identifier, the `canon` field of the canon file.
- The value is split at the **last** `@`. A value with no `@` is read as a bare version with no prefix.
- The value must be generated from the canon, never typed by hand, so a surface cannot drift from the version it claims.

This is the only marker the runtime checker reads. It is therefore the only one a conformance claim can rest on.

## Pointer to the canon (recommended, not yet verifiable)

A surface should say where its canon is published so a visiting agent can resolve the notations it finds. Two ways, neither read by the checker today:

- a `<link rel="canon" href="<url of the canon json>">` in the head;
- a line in the surface's `llms.txt` naming the same URL.

`rel="canon"` is not a registered link relation and no tool in this repository reads it. It is specified here as a convention, and the checker cannot confirm that it points at the canon the meta names. An agent must not treat a pointer as established until it has fetched the canon and checked that its prefix and version equal the meta.

## What a visiting agent should do

1. **Look for the marker.** If there is none, treat the surface as not declaring a canon. Absence is not evidence either way: the runtime checker reports a missing marker as `declaredVersion: null` and does not fail it, so today a surface with no marker and a surface with a wrong marker are treated differently.
2. **Resolve the canon.** Fetch the canon from the pointer, or from the location the surface's own `llms.txt` names. Confirm the canon's prefix and version equal the marker. If they differ, the claim is false for that canon: say so, and do not rely on the notations.
3. **Read the parts.** An interactive part carries `data-element` (a notation from that canon) and, when the part repeats, `data-instance` (a record identifier). Use the notation to find what the part is. Use the instance only to tell repeats apart. Do not use visible text or position as a key.
4. **Treat the marker as a claim.** If the task matters, run the runtime checker against the surface and report what it says. A non-passing attestation means the surface's data should not be treated as trustworthy until it is fixed.
5. **Never invent an identity.** Do not make up an instance identifier for an ephemeral or personal record. The spec omits it by design (section 1.3).
6. **Report your own actions under the same notation.** When an agent acts on a part, the notation is the shared name. The spec reserves `interactionType` with the value `mcp-tool-call` for this (section 3).

## What a surface must not do

- Claim a canon it does not emit, or a version it does not match.
- Put personal data in the marker, a notation or an instance (spec section 6).
- Present the marker as a verification. It is a declaration.

## What is enforced today, and what is not

**Enforced** (runtime checker, `runtime/check.test.mjs`): a declared version that differs from the canon is flagged `version_mismatch`; a matching one passes. Run against a one-concept canon, the checker's results were: correct marker passes (exit 0); a wrong version or a wrong prefix fails (exit 1); a bare version with no prefix passes; an **empty** `content=""` fails (exit 1), so an empty marker is not the same as no marker; and **no marker at all passes** (exit 0, `declaredVersion: null`).

**Not enforced, and a known gap:**

- **An absent marker is not a failure.** A surface can claim nothing and still pass. A canon-governed surface that wants to be identifiable as one has no check that it is.
- **Pointer.** Nothing reads `rel="canon"` or compares it with the meta.
- **Runtime-created elements.** The checker reads server-rendered HTML only.
- **Signing.** The attestation is unsigned.
- **A standard agent-facing page.** The planned design is one canon-owned document that explains the contract, which each surface links from its mark. It is not written or hosted. Until it is, a surface should say in its own `llms.txt` what its marker means, as lanewgreer.com does.
- **Non-web surfaces.** iOS, Android and headless surfaces have no `<meta>`. How they carry a watermark is not defined here.
