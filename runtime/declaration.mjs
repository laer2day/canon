// The canon watermark value, shared by every carrier (web meta, iOS, Android, headless) so they cannot drift.
// One value, one grammar, one meaning: "<prefix>@<version>". See spec/SURFACE-CONTRACT.md.

// parseDeclared is the LENIENT reader the runtime checker has always used. Its behaviour is fixed on purpose:
// a value with no "@" is a bare version with no prefix, an empty value yields nulls, and the value is split at
// the LAST "@". Do not tighten it here; the checker's results depend on it.
export function parseDeclared(content) {
  if (!content) return { raw: content, prefix: null, version: null };
  const i = content.lastIndexOf("@");
  return i === -1
    ? { raw: content, prefix: null, version: content }
    : { raw: content, prefix: content.slice(0, i), version: content.slice(i + 1) };
}

// The prefix grammar is the canon schema's: ^[a-z][a-z0-9-]*$ (spec/canon.schema.json).
const PREFIX = /^[a-z][a-z0-9-]*$/;
// A version is a non-empty string with no "@" and no whitespace. The canon schema only requires minLength 1,
// so this is deliberately no stricter than that plus the two characters that would break the split.
const VERSION = /^[^@\s]+$/;

// strictDeclared is what a NEW carrier must emit: both parts present and well formed. It never throws and never
// returns a partial: ok is false with a reason, or true with the parts.
export function strictDeclared(content) {
  if (typeof content !== "string" || content.length === 0) return { ok: false, reason: "empty" };
  if (content !== content.trim()) return { ok: false, reason: "surrounding whitespace" };
  const i = content.lastIndexOf("@");
  if (i === -1) return { ok: false, reason: "no @ (a bare version is not a complete declaration)" };
  const prefix = content.slice(0, i);
  const version = content.slice(i + 1);
  if (!PREFIX.test(prefix)) return { ok: false, reason: "prefix does not match ^[a-z][a-z0-9-]*$" };
  if (!VERSION.test(version))
    return { ok: false, reason: "version is empty or contains @ or whitespace" };
  return { ok: true, prefix, version, raw: content };
}

// The same value must read the same on every carrier. Returns true only when two carrier values are both strictly
// valid and equal in prefix and version.
export function agree(a, b) {
  const x = strictDeclared(a);
  const y = strictDeclared(b);
  return x.ok && y.ok && x.prefix === y.prefix && x.version === y.version;
}
