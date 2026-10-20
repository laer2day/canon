#!/usr/bin/env node
// STUB. NOT IMPLEMENTED. Wave 3 of the Cargo canon plan owns this file.
//
// This is the Fullstory plugin's "check" entry point for drift detection. It exists so the gap is visible
// and cannot be mistaken for a passing check: it always exits 2 and says so. It never reports success.
// usage: node spec/plugins/fullstory/check.mjs [anything]
// Exit 2 always (not implemented). Exit 0 is reserved for a real check that has been shown to fail first.
//
// What Wave 3 has to build here (requirements recorded 2026-10-20; none of it is decided design):
//   1. Discovery by declaration: a `plugins` entry in the canon or surface file names this plugin. Fail closed
//      if the declaration is missing or unreadable. A plugin in use but undeclared (data-fs-element emitted,
//      no declaration) is itself a drift finding.
//   2. Per-plugin check: derive the expected Fullstory output from the canon plus the notation-to-label mapping
//      and compare it with what the surface emits. Every emitted data-fs-element must be accounted for, every
//      notation must have a mapping or a default, and no two notations may share a label.
//   3. Static layer first (no network, runs in CI, the deploy gate). An optional live layer reads the Fullstory
//      org through a reader the plugin supplies; it may only check that a named element EXISTS. The one live
//      read made so far returned {id, name, css_selector} with no separate display name, so a display-name
//      check through that tool is not possible. A live reader may be weaker than the static check.
//   4. Adding a plugin must not require editing the CLI core: this entry point is the plugin's side of a
//      common contract that does not exist yet.
//   5. Known drift sources already found in CarGo: the form helper overwrites specific data-fs-element values
//      with generic ones after mount; some elements are defined in Fullstory by CSS selector, not by
//      data-fs-element; some data-fs-element values are set through inputProps or setAttribute, which an
//      attribute-only scan cannot see.
//   6. Every Done When for this file must be shown to FAIL on a known-bad input before it counts.

console.error(
  "fullstory plugin check: NOT IMPLEMENTED (stub, Wave 3). No drift was checked. This is not a pass.",
);
process.exit(2);
