# Property enrichment

**Status:** Companion draft 0.1. Non-normative.
**Date:** 13 November 2026
**Specification it accompanies:** [semantic-surface-taxonomy.md](semantic-surface-taxonomy.md) version 0.3. This file is not part of that version.

## Versioning decision

Specification 0.3, section 10, changes only by a new version of that document. `spec/canon.schema.json` is closed (`additionalProperties: false`). A property contract is therefore a **sibling artifact**. It is not a field on a CardinalCollege, and this draft does not add one.

This companion is versioned on its own (`0.1`). The CardinalCollege schema stays at the 0.3 shape (`version`, `prefix`, `cardinals`, `$defs/cardinal`). Promoting these rules into the specification — including the pointer in that document's section 12, if a later editor decides the pointer itself is a normative change — requires a new version of the specification. That promotion is not taken here. Version 0.3's conformance rules are unchanged: a surface can conform to 0.3 without a property contract.

Plugins may read the sibling. They must still validate the CardinalCollege against `canon.schema.json` alone.

## 1. The contract

A property contract is a JSON document validated by [property-contract.schema.json](property-contract.schema.json). That schema is closed. An unknown field is invalid.

| Field | Meaning |
|---|---|
| `contractVersion` | version of this companion the file was written against (`0.1.0` for this draft) |
| `college` | the CardinalCollege `prefix` |
| `collegeVersion` | the CardinalCollege `version` |
| `cardinals[].notation` | a notation that exists in that CardinalCollege |
| `cardinals[].properties` | the properties of that cardinal. Empty is allowed |

Each property has:

| Field | Values |
|---|---|
| `name` | canonical name. Plugins copy it. They do not invent a vendor name. |
| `type` | a canonical type from section 2 |
| `scope` | `element`, `page`, or `user` |
| `source` | `attribute`, `text-node`, or `data-layer` |
| `privacy` | `public`, `masked`, or `excluded` |
| `attribute` | optional. When `source` is `attribute`, the attribute to read. Not a second name. |

A cardinal omitted from the contract has no properties. An ephemeral cardinal may appear with an empty list, which is the same statement written down. Rank stays an emission fact (specification section 1.3). It is not an analytics property unless the contract lists it.

The example is [property-contracts/meridian.json](property-contracts/meridian.json):

- `meridian.card.plan` has element-scoped `price` (number) and `productId` (string);
- `meridian.nav.primary` has page-scoped `section`;
- `meridian.form.request-demo` has `workEmail`, privacy `excluded`;
- `meridian.list.result` is ephemeral and has no properties.

No property value in that file is personal data. The name `workEmail` names a class of value the contract refuses to carry.

## 2. Canonical types

`string`, `number`, `integer`, `boolean`, `date`, and the list forms `string-list`, `number-list`, `integer-list`, `boolean-list`, `date-list`.

`number` is any finite JSON number. `integer` is a finite JSON number with no fractional part. A numeric string is not a number. `date` is an ISO-8601 string beginning `YYYY-MM-DD`. These are this companion's rules. They are enforced by the Amplitude plugin's `coerce` (tested, see that plugin). They are not a claim that any vendor uses these names.

## 3. Privacy

| Class | Meaning |
|---|---|
| `public` | the value may be derived, after the canonical type check. Spec section 6 still forbids personal data in the value. |
| `masked` | the raw value is not copied. A plugin that sends a token instead says which token and shows it in a test. |
| `excluded` | refusal. The property is not derived. A payload that still contains the name is a failure. A check that drops the name silently and reports success has not shown a refusal. |

The Amplitude plugin's refusal is tested: `trackPayload` omits `workEmail` and records `privacy-excluded`; `execute` deletes the name and still returns an event; `bad-excluded.json` makes the check exit 1.

## 4. Scope

`element` properties travel with an interaction on that cardinal. `page` properties travel with the page, not with one element click. `user` properties travel with the user, not with one click. Putting a property on the wrong scope is drift.

## 5. Vendor triangulation

Read this table as a set of claims, not as established behaviour. The class is how the claim is known. `documented` means a vendor page was fetched on 2026-11-13 and said it. `tested` means a check in this repository passed and failed. `design` means a proposal. Design is not established.

### Fullstory

| Claim | Class | Where |
|---|---|---|
| `data-fs-properties-schema` types include str, strs, int, ints, real, reals, bool, bools, date, dates | documented | https://developer.fullstory.com/browser/fullcapture/set-element-properties/ |
| Up to 50 unique properties on one element interaction, and 500 across element interactions | documented | same page, Limits |
| Interactions inherit properties configured on the element and its ancestors. The deepest value wins when the same name is captured twice | documented | same page |
| A JavaScript number in custom event `properties` is inferred as real. An integer that must stay an int needs an explicit schema | documented | https://developer.fullstory.com/browser/custom-properties/ |
| On mobile, set attribute values before `data-fs-properties-schema` | documented | existing Fullstory plugin claim, where `fs-skills` `SKILL-IOS.md`. This draft did not re-fetch that file |
| Inheritance is bidirectional | design | Not on the element-properties page fetched above, which describes ancestors. Not established |
| `real` must be a bare number, and a numeric string is rejected | design | The element-properties example uses an HTML attribute `data-price='23.99'` with type `real`. The custom-properties page infers JavaScript numbers as real. Neither page was seen to say a numeric string is rejected |
| 1000 API-defined elements | design | Named in the request for this draft. Not on the element-properties page fetched above. Not recorded as documented |
| A property contract is derived into `data-fs-properties-schema` | design | [plugins/fullstory/property-schema.md](plugins/fullstory/property-schema.md). The plugin check is still a stub |

### Heap

| Claim | Class | Where |
|---|---|---|
| `addEventProperties` attaches key-value pairs to subsequent autocaptured and custom events. Values may be array, boolean, number, or string | documented | https://developers.heap.io/reference/addeventproperties |
| Pageview snapshots attach properties chosen in Heap's UI, including from a client-side data object, to a pageview and later events on that page | documented | https://help.heap.io/hc/en-us/articles/37271876877841-Pageview-Snapshots |
| `data-heap-redact-text` and `data-heap-redact-attributes` redact before data leaves the browser. The interaction can still be captured | documented | https://developers.heap.io/docs/ignoring-sensitive-data-and-pii |
| Heap's canonical type names match section 2, and a Canon contract replaces snapshots | design | Not claimed by Heap's docs. A plugin would have to define the coercion. None is implemented here |

### Contentsquare

| Claim | Class | Where |
|---|---|---|
| Element hierarchy is the ancestor chain, serialized and capped at 1024 characters, truncated from the outermost level | documented | https://docs.contentsquare.com/en/web/collected-data/ |
| A project has at most 20 custom vars, indexes 1–20. A key is at most 512 characters and a value at most 255 | documented | https://docs.contentsquare.com/en/web/sending-custom-vars/ |
| Custom vars are often taken from a data layer | documented | same page, and the main tag doc https://docs.contentsquare.com/en/web/ |
| Visit and page properties are not automatically masked. String values on those APIs are truncated | documented | https://docs.contentsquare.com/en/web/personal-data-handling/ |
| A Canon property becomes a custom var or a Product Analytics property with a stable index | design | [plugins/contentsquare/ARCHITECTURE.md](plugins/contentsquare/ARCHITECTURE.md) already sketches event properties. The check is a stub. No index assignment is implemented |

### Amplitude

| Claim | Class | Where |
|---|---|---|
| `track` sends the event the caller supplies. It does not read a Canon attribute | documented | https://amplitude.com/docs/sdks/analytics/browser/browser-sdk-2/reference |
| Browser SDK 2 autocapture can read the DOM for clicks and page views | documented | same page, `autocapture` |
| Enrichment `execute` must return the event or the event does not propagate. `null` drops it | documented | https://amplitude.com/docs/sdks/sdk-plugins |
| Ampli is generated from a tracking plan. The SDK can attach a `plan` object to events | documented | https://amplitude.com/docs/sdks/analytics/browser/ampli-for-browser-sdk-2-0 and the `plan` option on the Browser SDK reference |
| This plugin's `execute` always returns an event and deletes excluded names | tested | `spec/plugins/amplitude/derive.mjs`, `scripts/amplitude-plugin.test.mjs`. Not run inside the SDK |
| Canonical types coerce as section 2, and a numeric string is refused | tested | same tests. Not sent to Amplitude |
| Excluded, unknown, mistyped, and wrong-scope payloads fail the static check | tested | `spec/conformance/property-enrichment/` |
| Amplitude has an `is-in-schema` flag this plugin should set | design | Not found on the pages fetched above |
| Amplitude has no DOM access | design | Contradicted by autocapture. Not established. This plugin does not use autocapture to name properties |
| iOS and Android Amplitude SDKs consume the same contract | design | Not written |

## 6. What a plugin does

A plugin reads the CardinalCollege and the property contract. It writes vendor structure. It does not write either source.

The Amplitude plugin is the first one that does this. Its layout and check are in [plugins/amplitude/](plugins/amplitude/README.md). The check exits 0, 1, or 2 as [plugins/CONTRACT.md](plugins/CONTRACT.md) requires, and it has been shown to exit 1 on the failing fixtures.

The Fullstory derivation in section 5 is a design proposal only.

## 7. Conformance of a contract

A contract conforms to this companion when:

- it validates against `property-contract.schema.json`;
- `college` and `collegeVersion` equal the CardinalCollege `prefix` and `version`;
- every notation exists and is not deprecated;
- property names are unique on a cardinal and are not the reserved identity keys `canon`, `canon_element`, `canon_instance`;
- an `excluded` property produces a refusal and is absent from derived payloads.

These checks are what the Amplitude plugin runs for its own output. They are not yet a common runner over every plugin. A contract that fails them is not silently accepted.
