# Contentsquare plugin architecture proposal

**Status:** Draft proposal, non-normative. Does not change the specification or `canon.schema.json`.
**Applies to:** canon-governed surfaces (web, iOS, Android, WebView) that use Contentsquare for experience analytics, zoning, heatmaps, session replay, and Product Analytics.
**Contract:** [../CONTRACT.md](../CONTRACT.md).
**Date:** 12 November 2026.

Canon names the interactive part once (the cardinal). Contentsquare is one consumer of that name. This proposal defines how a CardinalCollege becomes Contentsquare identities and events without a second vocabulary.

## 1. Contentsquare data model (research summary)

Contentsquare collects a broad interaction stream by default and layers additional named signals on top. It is optimized for zone-based analysis and replay more than for a clean, first-class event + property taxonomy.

### Web tag (main tracking tag)

- Autocapture of clicks, pointer events, hovers on interactive elements, focus/blur/change, scrolls, and mouse moves once the tag has loaded and the user is included.
- Each interaction carries a target path. When hierarchy collection is enabled, it also carries an element hierarchy (tag + id + classes + remaining attributes, truncated at 1024 characters, outermost levels dropped first).
- Stable identity for zoning and tracking is provided by `data-cs-override-id="stable-id"` (alphanumeric, hyphen, underscore; must be static across URLs). This is the closest equivalent to Fullstory’s `data-fs-element`.
- Other `data-cs-*` attributes are primarily privacy or special-case controls: `data-cs-mask`, `data-cs-capture`, `data-cs-scroll-container`, `data-cs-encrypt`, `data-cs-hide-title`.
- Classic custom page events (`trackPageEvent` / `event`) are name-only (no properties). Unique event cap of 10,000 on some surfaces; only the most-used names are retained beyond that.

### Product Analytics layer (web)

- Activating Product Analytics loads additional tag logic (historically Heap-related).
- Named custom events with optional properties via `trackEvent`.
- Visit-scoped properties via `customProperties:visit:add` (alias `addEventProperties`) that attach to subsequent events.
- Pageview properties and user identity / user properties also available.
- Autocaptured interactions still occur; custom properties can enrich them.

### Mobile SDKs (iOS, Android, React Native, Flutter, etc.)

- Screen tracking (with autocapture options in some SDKs).
- `CSQ.trackEvent` with properties.
- `addEventProperties` / `addUserProperties`.
- Reliable zone / target identifiers:
  - iOS: `accessibilityIdentifier` is the primary reliable target (restorationIdentifier and tag are secondary or deprecated in newer OS versions).
  - Android: `CSQ.setAreaIdentifier` / `View.csqAreaIdentifier` / Compose modifier for reliable zone identifiers.
- WebView bridging: the web tag inside a WebView can send pageviews, events, and properties that the mobile SDK incorporates.

### Key constraints for a Canon mapping

- Prefer `data-cs-override-id` (web) and platform reliable identifiers (mobile) over relying on hierarchy or CSS, because hierarchy is truncated and optional and CSS is volatile.
- Classic page events cannot carry properties; use Product Analytics `trackEvent` or visit properties when properties are required.
- Never put labels, visible text, or PII into an override ID or event name (Canon spec §6).
- Notation characters that are illegal in Contentsquare IDs must be sanitized (e.g. dots → hyphens).

## 2. Design goals

1. CardinalCollege remains the single source of truth. Nothing vendor-specific is maintained beside it.
2. One cardinal (notation + optional instance) maps to one stable Contentsquare identity on every surface where it appears.
3. Derived names and properties are deterministic and fail-closed: unknown or deprecated notations are drift.
4. Privacy defaults cannot be overridden by the plugin (masking, no PII in names).
5. Minimum viable binding works with the existing web tag and `data-cs-override-id`. Richer event + property mapping is optional and layered on Product Analytics.
6. Mobile is in scope but second-phase: the architecture names the mapping, but the first implementation is web.

## 3. Identity mapping

### Notation to Contentsquare identifier

| Canon | Contentsquare (web) | Contentsquare (mobile) |
|-------|---------------------|------------------------|
| `notation` | `data-cs-override-id` = sanitized notation | `accessibilityIdentifier` (iOS) or `csqAreaIdentifier` (Android) = sanitized notation |
| `notation` + `instance` (repeating) | `data-cs-override-id` = `sanitizedNotation--sanitizedInstance` | same pattern |
| CardinalCollege declaration | optional visit or page property `canon` = `prefix@version` | same |

Sanitization: replace `.` with `-`, drop any character not in `[a-zA-Z0-9_-]`, collapse repeats, max length 100. The mapping is one-way and documented; the original notation is also attached as a property when the Product Analytics path is used.

### Event / property enrichment (optional, Product Analytics)

On interaction with a Canon-decorated element:

- Attach visit or event properties:
  - `canon_element` = original notation
  - `canon_instance` = instance (if present)
  - `canon_prefix` = first segment of the notation
  - `canon` = declared `prefix@version`
- Optionally also fire a custom `trackEvent` named `canon:click` (or a surface-overridable name) carrying the same properties.

This lets Contentsquare group by stable identity even when zoning relies on hierarchy, and lets Product Analytics treat the cardinal as a first-class event dimension.

### What is deliberately not mapped

- Labels or preferred labels become neither override IDs nor event names.
- Visible text is never used as a key.
- Capabilities and deprecation metadata stay in the CardinalCollege; the plugin only rejects deprecated notations at check time.

## 4. Plugin layout (proposed)

```
spec/plugins/contentsquare/
  ARCHITECTURE.md          this document
  README.md                binding contract and install (to be written)
  retrofit-guide.md        how to add the attributes / identifiers to an existing surface
  plugin.json              manifest (claims with evidence classes)
  check.mjs                static drift check (stub first, then implemented)
  client/                  optional web adapter that copies data-element → data-cs-override-id
                           and optionally enriches with trackEvent / addEventProperties
  proxy/                   none required (Contentsquare does not have the same IP-host constraint as the PostHog plugin)
```

The first commit of the plugin directory should contain at least `plugin.json` and a stub `check.mjs` so the existing plugin-manifest tests pass.

## 5. Check (drift detection)

Static layer (no network, CI-safe):

- Every `data-cs-override-id` value must reverse-map to a known cardinal notation (or `notation--instance`).
- No deprecated notation is emitted.
- No personal data patterns in override IDs or event names.
- If the optional client is present, it must be loaded and must not hard-code project keys.

Exit codes follow the plugin contract: 0 (no drift), 1 (drift), 2 (did not run). A stub exits 2.

Live layer (later, optional): read the Contentsquare project through its export or zoning APIs and confirm that override IDs or event names exist. A live reader may be weaker than the static check.

## 6. Implementation phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| 0 | Architecture (this document) | `ARCHITECTURE.md` committed |
| 1 | Web minimum binding | README, retrofit guide, `plugin.json`, stub check, optional tiny client that copies Canon attributes to `data-cs-override-id` |
| 2 | Product Analytics enrichment | Documented `trackEvent` / `addEventProperties` path; client emits properties |
| 3 | Implemented static check | `check.mjs` exits 0/1/2; tests show every rule fails on bad input |
| 4 | Mobile | iOS `accessibilityIdentifier` and Android `csqAreaIdentifier` mappings; WebView notes |
| 5 | Live check (optional) | Reader against Contentsquare APIs; evidence class upgraded from `design` to `tested` only after non-production verification |

## 7. Claims that will appear in plugin.json (evidence class)

All start as `documented` or `design` until tested on a non-production project.

- `data-cs-override-id` provides a stable tracking identity used by zoning and interaction collection (`documented`, Contentsquare events-handling docs).
- Hierarchy collection is truncated at 1024 characters and optional (`documented`).
- Classic `trackPageEvent` / `event` accepts a name only; no properties (`documented`).
- Product Analytics `trackEvent` accepts a name and properties; `customProperties:visit:add` attaches properties to subsequent events (`documented`).
- On iOS, `accessibilityIdentifier` is the primary reliable target (`documented`).
- On Android, `CSQ.setAreaIdentifier` / `csqAreaIdentifier` assigns a reliable zone identifier (`documented`).
- Mapping a Canon notation into `data-cs-override-id` (web) or the platform reliable identifier (mobile) satisfies the goal of one name across surfaces (`design` until tested).

## 8. Open questions

1. Does Contentsquare guarantee that a `data-cs-override-id` value appears as a filterable dimension in Product Analytics, or only in zoning/heatmap targets?
2. What is the practical limit and retention behavior for unique event names when using the Product Analytics path versus the classic page-event path?
3. On Compose / SwiftUI, is there a first-class way to set the reliable identifier without dropping to the underlying view?
4. Should the plugin prefer a pure attribute binding (no client) or a small client that also emits Product Analytics properties?
5. How should WebView surfaces declare which CardinalCollege they belong to when the mobile SDK and the web tag both observe the same interaction?

## 9. Relation to other plugins

- Fullstory: element name via `data-fs-element` is the direct analogue of `data-cs-override-id`.
- PostHog: event properties via `data-ph-capture-attribute-*` or a client is the analogue of the Product Analytics enrichment path.
- A surface may emit Canon attributes once and let multiple plugins derive their decorations. Removing the Contentsquare plugin must leave every Canon attribute intact.

## 10. Next step

Review this proposal. If the mapping and phases are acceptable, implement Phase 1 (README + retrofit guide + manifest + stub check) on a follow-up branch. No changes to the specification or schema are required.
