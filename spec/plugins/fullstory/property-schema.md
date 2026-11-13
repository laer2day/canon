# Fullstory property-schema derivation (design)

**Status:** Design. Not implemented. Not tested against Fullstory. The plugin check remains a stub and exits 2.
**Evidence class for every proposal in this file:** `design`, except where a sentence cites a vendor page that was fetched. A fetched page is `documented`. It was not run.
**Does not change** specification 0.3 or `canon.schema.json`.

## What exists today

The Fullstory plugin emits an element name (`data-fs-element` = the notation) and, in [README.md](README.md) section 2, one schema entry for the instance property. That schema is written by hand in the README. There is no rule that creates `data-fs-properties-schema` from a property contract. The check does not compare a schema to anything. Calling the current plugin a property-schema generator would be false.

## Proposal

A future generator, not this file, would read the sibling property contract ([../../property-enrichment.md](../../property-enrichment.md)) and emit `data-fs-properties-schema` for each cardinal that has properties.

Suggested mapping from canonical type to the Fullstory type names. The names in the right column are documented on the element-properties page fetched 2026-11-13 (https://developer.fullstory.com/browser/fullcapture/set-element-properties/). The mapping itself is design: nothing here was applied to a Fullstory org.

| Canonical type | Fullstory type name (documented to exist) | This proposal |
|---|---|---|
| string | str | design |
| string-list | strs | design |
| integer | int | design |
| integer-list | ints | design |
| number | real | design |
| number-list | reals | design |
| boolean | bool | design |
| boolean-list | bools | design |
| date | date | design |
| date-list | dates | design |

Rules the generator would have to enforce, none of which it does today:

1. Property names are the contract's `name`. The schema may set Fullstory's `name` override only to that same name, so a second vocabulary cannot appear.
2. `excluded` properties are omitted. The generator records a refusal. It does not emit a schema entry for them.
3. `masked` properties are not given a raw-value schema entry. How Fullstory's own mask and exclude classes relate to this privacy class is not decided here.
4. On web the schema is the `data-fs-properties-schema` attribute. On mobile, attribute values are set before the schema. That order is already a documented claim in [plugin.json](plugin.json) (where: fs-skills `SKILL-IOS.md`). This file does not re-fetch that skill.
5. A contract with more than 50 properties on one cardinal, or more than 500 element properties in the whole contract, is refused by the generator. Those two limits are documented on the element-properties page (50 unique properties on one element interaction, 500 across element interactions). Refusing them in a generator is design: this repository does not do it, and it was not shown to fail.
6. The same page documents ancestor inheritance and "deepest property wins" when the same name is captured twice. It does not document bidirectional inheritance. Bidirectional inheritance is not a claim of this proposal.

A limit of 1000 API-defined elements was named when this proposal was requested. The element-properties page fetched 2026-11-13 does not state it. It is not recorded as documented.

HTML attributes are strings. The page's example puts `data-price='23.99'` next to a schema type `real`. This proposal does not claim that a real must be a bare JavaScript number on that attribute path. The custom-properties page (https://developer.fullstory.com/browser/custom-properties/, fetched 2026-11-13) says a JavaScript number in `properties` is inferred as real, and that an integer needs an explicit schema. Requiring a bare number for `real` on the JavaScript API is a reasonable reading of that inference note and is still design until a page says a numeric string is rejected.

## What would make this tested

A check, not this document, that:

- exits 1 when a surface's `data-fs-properties-schema` names a property the contract does not;
- exits 1 when an excluded property appears in that schema;
- exits 0 on a schema the generator just emitted;
- exits 2 when the contract or the college cannot be read.

Until that check exists and has been shown to fail, this mechanism stays design. The stub in [check.mjs](check.mjs) must keep exiting 2.
