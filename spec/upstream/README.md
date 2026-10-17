# Upstream references

Canon references external specifications by stable URL rather than vendoring them. This keeps Canon's normative surface small and avoids coupling conformance to another project's release cadence — but it means the two upstream surfaces have different update mechanics, and teams should know which is which.

## Sightmap schema

- **Address:** `https://raw.githubusercontent.com/sightmap/sightmap/main/spec/v1/sightmap.schema.json`
- **Secondary schema:** `https://raw.githubusercontent.com/sightmap/sightmap/main/spec/v1/config.schema.json`
- **Provenance:** GitHub raw URL, tracked to `main`. Not published in the sightmap npm package (v0.3.2's `files` field covers only `bin/`, `README.md`, and `skills/`).
- **Normative status:** Per Sightmap's AGENTS.md, `spec/v1/` is the source of truth — on any disagreement between the package and the spec, the spec wins.
- **Update mechanics:** When Sightmap ships a schema change, Canon updates this reference deliberately. Record the commit SHA you pulled in this file or in a marker alongside it, so the provenance is explicit rather than implicit.

## Canon's own schema

- **Address:** `https://raw.githubusercontent.com/laer2day/canon/main/spec/canon.schema.json`
- **Provenance:** GitHub raw URL with the `$id` field inside the schema pointing at that address. Same addressable-by-URL posture as Sightmap.
- **Contrast:** Canon's schema is first-party and moves with Canon's own commits. Sightmap's is third-party and moves with Sightmap's.

## Why URL, not npm

Referencing by URL means Canon never imports another project's runtime or skill surface. The sightmap CLI binary is separately installable from npm (`sightmap` on the PATH) if a team wants `sightmap validate` as a CI pre-step before Canon's own conformance suite — that is optional and orthogonal to this reference.

The Subtext vendoring pattern — pinning the sightmap package as a dev dependency and syncing skills through a script — is the right approach for *skills*, which ship in the npm package. Schemas do not, so they take the URL path.
