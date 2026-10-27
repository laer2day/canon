# Canon plugin: Fullstory binding

**Status:** Draft, non-normative. Does not change the specification (draft 0.2).
**Applies to:** surfaces that emit a canon and also run Fullstory (web, iOS, Android).
**Source of Fullstory guidance:** [fullstorydev/fs-skills](https://github.com/fullstorydev/fs-skills) (skills `fullstory-element-properties`, `fullstory-stable-selectors`, `fullstory-page-properties`, `universal-data-scoping-and-decoration`, `mobile-instrumentation-orchestrator`). Read at the time of writing; re-check before relying on any API detail.

Canon names the part. Fullstory records the part. This plugin says how the two line up so a surface does the work once.

For step-by-step adoption, see [retrofit-guide.md](retrofit-guide.md). The plugin's manifest is [plugin.json](plugin.json); what a plugin is and must do is defined in [../CONTRACT.md](../CONTRACT.md).

## 1. Principle: Canon owns identity, Fullstory consumes it

A Fullstory-first surface decorates elements so Fullstory can search, group and replay them. A canon surface decorates the same elements so people, tests and agents resolve one identity. These are the same elements. Decorating them twice with two vocabularies is the failure this plugin prevents.

- The canon is the only source of names. Fullstory element names are derived from it, never authored by hand.
- Fullstory is a consumer in the sense of spec §11 (Analytics): it groups by notation and keeps the instance as a separate property.
- Removing Fullstory must leave the canon emission intact. Removing the canon must not be required to remove Fullstory. The binding is one thin layer between them (section 5).

## 2. Emission map

| Concern | Canon emits (spec §3) | Fullstory receives | Web | iOS | Android |
|---|---|---|---|---|---|
| Part identity | notation | element name | `data-fs-element="<notation>"` | `FS.setAttribute(view, "data-fs-element", notation)` | `FS.setAttribute(view, "data-fs-element", notation)` (View-based UI; see section 7) |
| Instance | instance id | element property | `data-instance` plus schema entry | `FS.setAttribute(view, "data-instance", id)` plus schema | same as iOS |
| Property typing | n/a | schema | `data-fs-properties-schema='{"data-instance":{"type":"str","name":"instance"}}'` | `FS.setAttribute(view, "data-fs-properties-schema", json)` | same as iOS |
| Screen / page | surface id | page name | `FS('setProperties', {type:'page', ...})` | `FS.page(withName:properties:).start()` | `FS.page(name, props).start()` |
| Privacy | no personal data in labels or properties | classification, mask, exclude | `data-fs-classification`, `fs-mask`, `fs-exclude` | `FS.addClass` (class `fs-mask`, `fs-exclude`, `fs-unmask`), `data-fs-classification` | `FS.mask(view)`, `FS.unmask(view)`, `FS.exclude(view)` (a different API from iOS; per fs-skills `fullstory-privacy-controls/SKILL-MOBILE.md`, not tested) |

Rules that follow from the map:

1. **`data-fs-element` equals the notation, exactly.** Do not title-case it, shorten it, or append the instance. A notation is immutable (spec §1.1), so the Fullstory element name is stable by construction.
2. **The instance is a property, not part of the name.** `cargo.card.car` is one Fullstory element with an `instance` property. It is never `cargo.card.car.123`. This keeps Fullstory cardinality low.
3. **Singletons carry no instance and no instance schema.** Ephemeral and user-owned parts (spec §1.3) also omit it. For those, do not invent one to satisfy a Fullstory schema.
4. **Set values before the schema.** On mobile, set `data-instance` first, then `data-fs-properties-schema`. The Fullstory skills call the reverse order a bug.
5. **No Fullstory emission without a canon notation.** A part with no notation gets no `data-fs-element`. The gap is a canon gap, fixed in the canon.

## 3. Where the two vocabularies disagree

Fullstory's stable-selector guide recommends five attributes. Canon already covers most of them.

| Fullstory convention | Canon position | Plugin decision |
|---|---|---|
| `data-component` (type, e.g. `button`) | Encoded in the notation's middle segment | Do not emit. The type is derivable from the notation. |
| `data-id` (instance) | Spec §3.1: the specification does not use `data-id`; the instance identifier goes in `data-instance` and must not be stored in `data-id`. The attribute itself is not forbidden. | Emit the instance as `data-instance`. A surface may keep `data-id` for its own purposes, but never with the instance identifier in it. |
| `data-section` | Not an emission. The surface fragment has `place`. | Optional, Fullstory-only. May be added as a plain attribute. It is never a substitute for the notation. |
| `data-position` | Rank for ephemeral items (spec §1.3) | Emit only for ephemeral or ranked lists, as `data-rank`. Do not use it to identify a record. |
| `data-state` | Not in Canon | Fullstory-only. Allowed. State must not appear in the notation. |
| Mobile dot-notation `button.add-to-cart` | Notation is `prefix.type.name` | Use the full notation, prefix included, e.g. `cargo.button.add-to-cart`, as `accessibilityIdentifier` and `testTag`. |

The Fullstory guide says the attribute names are not magic ("it is the concept that matters"). That is why dropping `data-id` costs nothing on the Fullstory side.

## 4. Scoping: what goes at which level

Fullstory's data-scoping rule is to capture data at the highest relevant scope and never duplicate it. Canon's privacy rule (spec §6) is stricter. Combined:

| Data | Scope | Canon rule |
|---|---|---|
| Who the user is (plan, tier) | User properties | Never a label, instance or element property. Personal data stays out of the semantic surface. |
| Which screen, search terms, filters | Page properties | Page level only. Do not repeat on every element. |
| Which car, which plan, which route | Element property `instance` | Record identifier from the source of truth (SKU, route, record id). |
| Something happened (booked, paid) | Event | Not part of Canon. Events are Fullstory's. Canon only names the parts. |

Example for a car search screen: the filters and result count are page properties. Each result row is `cargo.card.car` with `instance` set to the car record id. The user's saved address is user-owned, so it has no instance at all.

## 5. The binding layer

Do not hand-write the Fullstory calls at each element. Provide one emission helper per platform that takes `(notation, instance?)` and sets both the canon attributes and the Fullstory attributes in the right order. This is the "Framework approach" in the Fullstory stable-selectors guide, with the canon as its input.

- Web: a component or wrapper that sets `data-element`, `data-instance`, `data-fs-element` and `data-fs-properties-schema` from the same two arguments.
- iOS: a view extension that sets `accessibilityIdentifier`, the custom content key `instanceIdentifier`, and the Fullstory attributes.
- Android: a modifier or helper that sets `testTag`, the `InstanceIdentifier` semantics property, and (for View-based UI) the Fullstory attributes.

The helper takes the notation from a generated constant, not a string literal, so a typo fails at build time and not in production data.

## 6. Conformance addendum

A surface conforms to this plugin when, in addition to spec §8:

- Every element with `data-fs-element` has a notation in the declared canon, and the two are identical.
- No `data-fs-element` value is Title Case copy, a visible label, or a notation plus instance.
- Elements with an instance carry it as a property and not in the name.
- No Fullstory attribute, page property or element property contains personal data.
- The surface starts a Fullstory page per screen where the platform has the concept (iOS, Android). Ending a page is optional: per fs-skills it is only needed to leave a section of the app without a defined page.
- Disabling the Fullstory SDK leaves every canon attribute in place.

## 7. Open questions (not yet verified)

These are things the Fullstory skills do not settle. Check each against a running Fullstory org before relying on it.

1. **Renaming existing elements.** The Fullstory skill states element names are "permanently attached to their associated Element (though display name can change)". It does not say what happens to saved searches, metrics and dashboards when `data-fs-element` changes value on an existing surface. This decides how risky retrofit path A is. Test on one element in a non-production org first.
2. **Jetpack Compose.** `FS.setAttribute` takes a `View`. The skills show Compose using `testTag` only, and do not show how to reach a Fullstory element name from a composable. Whether Fullstory reads `testTag` directly is not stated. Confirm before promising a Fullstory element name on a Compose-only screen.
3. **Whether Fullstory reads `accessibilityIdentifier` or `testTag` on its own.** The skills present them as identifiers for tests and agents, and `FS.setAttribute` as the way to give Fullstory the same data. Treat them as separate until confirmed.
4. **Screen identity.** Canon fragments have an `id` per screen. Using it as the Fullstory page name is a natural fit, but Canon does not yet define screen ids in the canon itself. Proposal only.

## 8. Demo instances

These are examples of what this plugin has to cope with, taken from the CarGo demo environment. They illustrate the plugin. They are not findings about Fullstory in general. Each was observed in one read-only search of the demo org; the search returned element definitions only (an id, a name and a selector) and nothing about usage or traffic, so an example shows that a definition exists and says nothing about whether it is used.

1. **A helper that names elements generically.** CarGo's web form helper (`useFormDressing`) sets `data-fs-element` to a type name such as `dropdown` on every select inside four forms, without checking whether the element already carries a more specific name. The demo org holds an element definition keyed to exactly that generic selector, with element properties derived from it. *What it shows the plugin:* real org data can depend on names a surface generates, so a plugin that derives names from a canon must account for existing definitions keyed to names the canon never chose. A rename is a data change, not a refactor.
2. **Definitions that do not use `data-fs-element` at all.** Some element definitions in the demo org are keyed to an id or a role selector instead. *What it shows the plugin:* a drift check that looks only at `data-fs-element` will miss definitions that depend on a surface's ids and roles. Path A step A2 (finding dependents) has to include them.
3. **A specific name that a helper may overwrite.** One JSX-level name in the booking form is defined in the demo org, and the form helper may replace it with the generic name after the component mounts. *What it shows the plugin:* a definition existing says nothing about which value is on the element at runtime. Settling that needs a session, not a search. This is the same "one property, two sources" shape as two iOS controls whose storyboard and code set different identifiers.
4. **A live reader is weaker than a static check.** The search tool returns one `name` field per element, with no separate display name. *What it shows the plugin:* a live check through this tool can confirm that a named element exists but cannot check a notation-to-display-name mapping. The plugin's `check` entry point (see `check.mjs`, currently a stub) should treat the live layer as optional and weaker.
