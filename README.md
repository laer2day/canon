# Semantic Surface Taxonomy

You're not naming buttons. You're naming one button twice and paying for it forever. Canon is the layer where you name it once.

A vendor-neutral method for naming interactive parts so that people, assistive technologies, analytics, tests, and agents resolve the same identities.

This is a specification and a thin format. It is not a library, a framework, or a runtime. No package is published. Conformance does not require shared code.

## Documents

| Path | Role |
|---|---|
| [spec/semantic-surface-taxonomy.md](spec/semantic-surface-taxonomy.md) | The specification, draft 0.2 |
| [spec/canon.schema.json](spec/canon.schema.json) | Normative JSON Schema for a canon |
| [spec/canons/meridian.json](spec/canons/meridian.json) | Non-normative example canon |
| [spec/surfaces/meridian-home.json](spec/surfaces/meridian-home.json) | Non-normative surface fragment |
| [spec/conformance/](spec/conformance/) | Fixtures and expected resolutions |
| [LICENSE](LICENSE) | MIT |

`spec/semantic-surface-taxonomy.md` is the specification. An earlier engine proposal is not part of this repository. Where an older note disagrees with the spec, the spec wins.

## Checks

```bash
npm test
```

The suite reads the canon and the fixtures. It fails a surface that repeats a singleton, emits a deprecated notation, sets an accessible name that does not contain the visible text, leaves a redundant `aria-label`, leaks personal data, declares the wrong canon version, or uses a notation as a capability description.

## Studio

The page in this workspace is a non-normative demonstration. It imports `spec/canons/meridian.json` rather than keeping a second copy of the vocabulary.

The surrounding app scaffold — authentication, database migrations, and the install page — is how this workspace runs a preview. It is not part of the specification.
