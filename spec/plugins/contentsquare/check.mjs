#!/usr/bin/env node
// STUB. NOT IMPLEMENTED.
//
// This is the Contentsquare plugin's check entry point. It exists so the gap is visible
// and cannot be mistaken for a passing check: it always exits 2 and says so.
// usage: node spec/plugins/contentsquare/check.mjs [anything]
// Exit 2 always (not implemented). A real check uses 0 (no drift) and 1 (drift);
// see spec/plugins/CONTRACT.md.
//
// See ARCHITECTURE.md for the planned static and live layers.

console.error(
  "contentsquare plugin check: NOT IMPLEMENTED (stub). No drift was checked. This is not a pass.",
);
process.exit(2);
