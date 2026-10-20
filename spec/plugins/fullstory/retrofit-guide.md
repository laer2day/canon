# Fullstory retrofit guide

**Status:** Draft, non-normative. Companion to [README.md](README.md), which defines the mapping. This file defines the order of work.

Pick the path that matches the surface today.

| Surface today | Path | Goal |
|---|---|---|
| Runs Fullstory, no canon | [A](#path-a-fullstory-present-canon-absent) | Adopt a canon without losing Fullstory history |
| Has a canon, no Fullstory | [B](#path-b-canon-present-fullstory-absent) | Add Fullstory with names that come from the canon |
| Neither | [C](#path-c-neither-present) | Adopt both in one pass |

Paths B and C share most steps. Path A is the risky one, because existing Fullstory element names may already feed searches, metrics and dashboards.

Every step ends with a **Check**. Do not start the next step until the check passes.

---

## Shared definitions

- **Surface**: one platform's rendering of the product (web, iOS, Android). A multi-surface product has one canon and one fragment set per surface.
- **Part**: an interactive element that gets a notation.
- **Binding helper**: the single function or component per platform that sets canon and Fullstory attributes together (README section 5).
- **Legacy name**: any identifier already in use, whether a `data-fs-element` value, an `accessibilityIdentifier`, or a `testTag`.

---

## Path A: Fullstory present, canon absent

The surface already has Fullstory and probably has hand-named elements. The job is to introduce notations and swap names, without breaking what depends on the old ones.

### A1. Inventory what exists

List every legacy name per surface with its file and line. Include `data-fs-element`, `data-fs-properties-schema`, `accessibilityIdentifier`, `testTag`, `contentDescription`, and page names.

Record, for each: the name, the element type, the screen, and whether it appears in a test.

**Check:** the inventory count matches a fresh search of the code. No name is listed without a file reference.

### A2. Find what depends on the legacy names

Fullstory names are consumed outside the code. Before changing any, list the dependents.

- Fullstory searches, segments, metrics, funnels and dashboards that filter on the element name.
- Automation that selects by name (test suites, bots, scripted agents).
- Downstream exports that group by element name.

This step needs access to the Fullstory org and to the test code. If it cannot be done, treat every legacy name as depended upon.

**Check:** each legacy name is marked `depended-on`, `unused`, or `unknown`. `unknown` is treated as `depended-on`.

### A3. Draft the canon

1. Group legacy names into concepts. Several legacy names for one thing become one notation. A name that mixes a type and an instance is split into a concept and an instance.
2. Choose the prefix, default locale and locales.
3. Declare cardinality per concept: `singleton` once per screen, `repeating` otherwise.
4. Take instance ids from the source of truth: record id, SKU or route id. Never from visible text or position.
5. For one product on several surfaces, write a single canon. The same entity carries the same instance id on every surface (spec §1.3).
6. Mark ephemeral lists (`ephemeral: true`) and user-owned records. Neither gets an instance id.

**Check:** the canon passes `node --experimental-strip-types --no-warnings scripts/validate-canon.mjs <canon.json>` and prints `VALID`.

### A4. Write the mapping table

One row per legacy name:

| Surface | Legacy name | File | Notation | Instance source | Dependents |
|---|---|---|---|---|---|

The mapping is the migration's source of truth. It is also the record that lets a person translate an old dashboard filter into a new one.

**Check:** every legacy name from A1 has a row. A row with no notation is a decision to leave that element undecorated, and says so.

### A5. Decide the cutover strategy per name

Use the dependents from A2.

| Dependents | Strategy |
|---|---|
| `unused` | Replace in place. |
| `depended-on`, Fullstory searches or metrics only | Replace, then rebuild the affected searches and metrics against the new names. Keep the old name working until they are rebuilt (see below). |
| `depended-on`, automation | Update the automation in the same change. |

To keep an old name working during the cutover, emit the old name on a wrapper or ancestor element while the new name sits on the part itself, then remove the wrapper once dependents are rebuilt. Fullstory's property inheritance (parent to child, and child to parent) makes this possible. This is untested here (README section 7, question 1). Prove it on one element in a non-production org before relying on it.

**Check:** each `depended-on` name has an owner and a date for removing the old name.

### A6. Build the binding helper

Implement the helper once per platform, per README section 5. It takes a notation constant and an optional instance, and sets canon and Fullstory attributes in the right order (values, then schema).

Generate the notation constants from the canon. Do not retype them.

**Check:** a unit or UI test confirms the helper sets `data-element` (or the platform equivalent) and `data-fs-element` to the same notation, and sets no instance for a singleton.

### A7. Migrate screen by screen

Order screens by traffic, or by the shared journey. For each screen:

1. Write the surface fragment (`spec/surfaces/<surface>-<screen>.json`).
2. Replace legacy decoration with the helper.
3. Remove `aria-label`, `accessibilityLabel` and `contentDescription` wherever visible text already carries the name (spec §2).
4. Add the Fullstory page start and end for the screen, on platforms that have it.
5. Move page-scoped data (filters, search terms) to page properties, and delete any copy on elements (README section 4).

**Check:** the fragment resolves against the conformance suite for that canon version, and the screen shows only notations from the canon when inspected in a browser or the view hierarchy.

### A8. Verify against live Fullstory

Open a recorded session of the migrated screen in Fullstory.

- The elements appear under their notation names.
- The `instance` property is present on repeating parts and absent on singletons.
- No personal data appears in any element property.
- Rebuilt searches and metrics return data.

**Check:** a named person has looked at a real session and signed off on each point. Local tests alone do not satisfy this step.

### A9. Retire legacy names

Remove each legacy name on the date set in A5. Delete the mapping rows or mark them `retired`.

**Check:** a search of the code for every legacy name returns nothing. The inventory from A1 is empty.

---

## Path B: Canon present, Fullstory absent

The surface already emits notations. Fullstory is added on top, with its names taken from the canon and never written by hand.

### B1. Install and initialize the SDK

Follow Fullstory's own getting-started guidance for the platform. This guide does not restate installation. Order matters: initialization, then consent and privacy, then identity, then screens, then parts. This is the Fullstory skills' mobile instrumentation sequence, and the same order applies to web.

**Check:** a session is recorded in Fullstory from a test run.

### B2. Set the privacy baseline first

Before any element is decorated:

- Apply mask and exclude classes to sensitive views.
- If consent applies, gate capture on it.
- Confirm no part of the canon contains personal data (spec §6). The Fullstory binding will copy canon strings, so a leak in the canon becomes a leak in Fullstory.

**Check:** the canon passes the privacy scan in the conformance suite, and the sensitive views are absent or masked in a recorded session.

### B3. Wire identity and screens

- Identify users with an internal id and never an email or name as the uid.
- Create and start a Fullstory page per screen on platforms that have the concept. Use the fragment's `id` as the page name unless the team has decided otherwise (README section 7, question 4).
- Put screen-scoped data on the page, not on elements.

**Check:** a recorded session shows the correct page name per screen.

### B4. Add the Fullstory half of the binding helper

If the surface already has a canon emission helper, extend it so the same call also sets `data-fs-element` to the notation and the instance property with its schema. If it has none, build the helper as in A6.

Do not touch call sites for this step. Every part that already emits a notation gains its Fullstory name through the helper.

**Check:** a test confirms the helper emits identical notation in the canon attribute and in `data-fs-element`.

### B5. Handle parts the helper cannot reach

Some parts are drawn outside the helper (third-party widgets, native components, Compose-only screens). List them. For each, either wrap it, or record that it has no Fullstory name yet (README section 7, question 2).

**Check:** the list exists and every entry has a decision.

### B6. Verify against live Fullstory

As A8.

**Check:** a named person has signed off on a real session.

---

## Path C: Neither present

Adopt both in one pass, in this order. Doing the canon first costs less than the reverse, because Fullstory names then come from the canon and no mapping or cutover is needed.

1. **Draft the canon.** As A3, without the legacy inventory. Start from the screens and the shared journey.
2. **Validate the canon.** As A3's check.
3. **Install Fullstory and set privacy.** As B1 and B2.
4. **Build the binding helper** that emits canon and Fullstory attributes together (A6).
5. **Wire identity and screens.** As B3.
6. **Build screens with the helper from the start.** For each screen, write the fragment, use the helper, and check as A7.
7. **Verify against live Fullstory.** As A8.

There is no cutover and no legacy name, so A2, A4, A5 and A9 do not apply.

**Check:** the final check of each step above has passed, and a named person has signed off on a real session.

---

## Multi-surface products

When one product ships on web, iOS and Android:

- Write **one canon**. Concepts and instance ids are shared.
- Write **one fragment per surface per screen**.
- Diff the notation sets across surfaces. A notation that exists on one surface and not another is either a real difference or a gap. Decide which and record it.
- Run each surface through its own path. Surfaces do not have to be on the same path. A product with Fullstory on all three but a canon on none is three runs of Path A against one shared canon.
- A notation must mean the same thing on every surface. If it cannot, split it into two notations. Never overload one.

---

## What this guide does not claim

- It does not claim old Fullstory dashboards survive a rename. That depends on the answer to README section 7, question 1.
- It does not claim a Fullstory element name can be set on Jetpack Compose. See README section 7, question 2.
- It does not replace Fullstory's own installation, privacy and consent documentation. It orders the work and fixes the names.
