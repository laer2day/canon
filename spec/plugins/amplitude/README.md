# Canon plugin: Amplitude

**Status:** Draft, non-normative. Does not change specification 0.3 or `canon.schema.json`.
**Applies to:** web and headless surfaces that send Amplitude `track` events. Native iOS and Android SDKs are not derived.
**Manifest:** [plugin.json](plugin.json). Each claim about Amplitude carries an evidence class. A `design` claim is not established.
**Contract:** [../CONTRACT.md](../CONTRACT.md) (draft 0.2).
**Property contract:** the sibling artifact defined in [../../property-enrichment.md](../../property-enrichment.md). The example is [../../property-contracts/meridian.json](../../property-contracts/meridian.json).

Canon owns the cardinal and the property contract. Amplitude consumes them. This plugin does not keep a second list of Amplitude property names.

## What it derives

From a CardinalCollege plus a property contract, `derive.mjs` produces:

- element-scoped properties for `canon:click` payloads, keyed by notation;
- page-scoped properties for `canon:page` payloads;
- user-scoped properties for `canon:identify` payloads, never copied onto a click;
- a refusal for every `excluded` property;
- a generated enrichment `execute` function whose property names are the contract's names.

Identity keys `canon`, `canon_element` and `canon_instance` are added by the plugin from the notation and `prefix@version`. They are not contract properties and they are not hand-authored vendor names.

`masked` values are sent as the token `[masked]`. The raw value is not copied. That token is this plugin's rule (tested here). It is not an Amplitude product feature.

## Check

```bash
node spec/plugins/amplitude/check.mjs \
  --college spec/cardinal-colleges/meridian.json \
  --contract spec/property-contracts/meridian.json
```

| Exit | Meaning |
|---|---|
| 0 | ran; the contract derives; an excluded property is refused and absent from the payload |
| 1 | ran; schema, unknown notation, excluded value emitted, unknown name, bad type, or wrong scope |
| 2 | did not run |

Exit 2 is not a pass. A pre-0.3 college (`concepts` or a top-level `canon` field) does not run.

Failing fixtures live in [../../conformance/property-enrichment/](../../conformance/property-enrichment/). The tests in `scripts/amplitude-plugin.test.mjs` run each one and require exit 1.

## What was not run

Nothing in this directory was sent to Amplitude. Documented claims cite the page they were read from. Design claims, including "Amplitude has no DOM access" and "Amplitude has an is-in-schema flag", are not established. Browser SDK 2 autocapture does read the DOM; this plugin does not use it to name properties. The generated `execute` is tested in a local `vm`, not inside the SDK. The documented SDK rule is that an enrichment `execute` which does not return the event drops it, so this function always returns an event.
