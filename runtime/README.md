# Canon Runtime

A lightweight checker that verifies a live surface still speaks its published canon.
Same idea as TLS: the surface is either still conforming or it isn't, and the failure is visible before anyone acts on broken data.

## What it does

1. Loads a canon JSON file (from disk or URL).
2. Fetches a target URL and parses the DOM.
3. Walks every element carrying `data-element`.
4. Resolves each notation against the canon: cardinality, namedBy policy, deprecation, privacy.
5. Emits one signed attestation per check — pass/fail, per-concept results, reason codes.

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
  "canonVersion": "0.2.0",
  "surface": "https://example.com",
  "timestamp": "2026-10-19T12:00:00.000Z",
  "pass": false,
  "results": [
    { "notation": "meridian.button.get-demo", "status": "conforming" },
    { "notation": "meridian.card.plan", "status": "flagged", "reason": "cardinality_mismatch", "expected": "repeating", "observed": 1 }
  ]
}
```

Reason codes: `renamed`, `missing_attribute`, `cardinality_mismatch`, `deprecated_emitted`, `privacy_leak`, `namedby_violation`, `unknown_notation`.

Fail closed: a non-pass attestation means Sekizui (or any consumer) should refuse to treat that surface's data as trustworthy until it's fixed.

## Dependencies

Node 18+. Uses built-in `fetch` and a minimal HTML parser (no jsdom — keeps it edge-deployable).
Zero npm dependencies beyond what's already in the repo.
