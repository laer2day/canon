# Canon Runtime

A lightweight checker that verifies a live surface still speaks its published canon.
Same idea as TLS: the surface is either still conforming or it isn't, and the failure is visible before anyone acts on broken data.

## What it does

1. Loads a canon JSON file (from disk or URL).
2. Fetches a target URL and parses the DOM.
3. Walks every element carrying `data-element`.
4. Resolves each notation against the canon: cardinality, namedBy policy, deprecation, privacy.
5. Emits one **unsigned** attestation per check: pass/fail, per-concept results, reason codes. Nothing in the output proves who produced it.

## Usage

```bash
node runtime/check.mjs --canon spec/canons/meridian.json --url https://example.com
```

Or pipe a DOM snapshot:

```bash
cat page.html | node runtime/check.mjs --canon spec/canons/meridian.json --stdin
```

## Output

One JSON attestation to stdout:

```json
{
  "canon": "meridian",
  "canonVersion": "0.1.0",
  "declaredVersion": null,
  "surface": "https://example.com",
  "timestamp": "2026-10-19T12:00:00.000Z",
  "pass": false,
  "results": [
    { "notation": "meridian.button.get-demo", "status": "conforming" },
    { "notation": "meridian.card.plan", "status": "flagged", "reason": "cardinality_mismatch", "expected": "repeating", "observed": 1 }
  ]
}
```

Reason codes: `unknown_notation` (including an empty `data-element`), `deprecated_emitted`, `namedby_violation`, `redundant_aria_label`, `missing_attribute`, `cardinality_mismatch`, `privacy_leak`, `version_mismatch`. A repeating concept with no observations is reported as `absent` (informational; it never fails the check). A rename is not detectable from a single snapshot, so there is no `renamed` code.

Fail closed: every flagged result makes `pass` false and the exit code non-zero. A non-pass attestation means Sekizui (or any consumer) should refuse to treat that surface's data as trustworthy until it's fixed.

## Declared version

A web surface declares the canon version it emits with `<meta name="canon" content="<prefix>@<version>">`. The spec requires a declared version (sections 7 and 8) but defines no web attribute for it, so this is a local convention, not part of the spec. When the meta is present and differs from the canon, the check flags `version_mismatch`. When it is absent, `declaredVersion` is `null` and the check does not fail, because a bare fragment has no document head.

## Known limits

The parser is a regex tag scanner, not an HTML parser. It reads quoted attribute values (a `>` inside quotes is fine), but unquoted attribute values containing `>`, tag-like text inside `<script>`, `<style>` or comments, and malformed markup can fool it. It sees server-rendered HTML only, not elements created at runtime. Do not read a passing attestation as a robustness guarantee.

## Dependencies

Node 18+. Uses built-in `fetch` and a minimal HTML parser (no jsdom — keeps it edge-deployable).
Zero npm dependencies beyond what's already in the repo.
