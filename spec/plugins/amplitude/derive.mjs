// Derives Amplitude enrichment behaviour from a CardinalCollege plus a property contract.
// No Amplitude SDK and no network. Property names come from the contract.
// Identity keys (canon, canon_element, canon_instance) are added by this plugin from the
// notation and the college version. They are not vendor names and they are not contract properties.
//
// Evidence: the coercion below is this plugin's rule. Whether Amplitude accepts the resulting
// JSON was not run against Amplitude. See plugin.json.

export const IDENTITY_KEYS = ["canon", "canon_element", "canon_instance"];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/;

function isInt(value) {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}

function isIsoDate(value) {
  if (typeof value !== "string" || !value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && /^\d{4}-\d{2}-\d{2}/.test(value);
}

// Canonical type → value this plugin will put on an Amplitude track payload.
// number and integer both become a JSON number. Amplitude's track properties are JSON;
// this plugin does not claim Amplitude has a separate integer or date type.
export function coerce(type, value) {
  switch (type) {
    case "string":
      return typeof value === "string" ? { ok: true, value } : { ok: false, reason: "expected string" };
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false, reason: "expected a JSON number, not a numeric string" };
    case "integer":
      return isInt(value) ? { ok: true, value } : { ok: false, reason: "expected an integer JSON number" };
    case "boolean":
      return typeof value === "boolean" ? { ok: true, value } : { ok: false, reason: "expected boolean" };
    case "date":
      return isIsoDate(value) ? { ok: true, value } : { ok: false, reason: "expected an ISO-8601 date string" };
    case "string-list":
      return Array.isArray(value) && value.every((item) => typeof item === "string")
        ? { ok: true, value }
        : { ok: false, reason: "expected an array of strings" };
    case "number-list":
      return Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item))
        ? { ok: true, value }
        : { ok: false, reason: "expected an array of JSON numbers" };
    case "integer-list":
      return Array.isArray(value) && value.every((item) => isInt(item))
        ? { ok: true, value }
        : { ok: false, reason: "expected an array of integer JSON numbers" };
    case "boolean-list":
      return Array.isArray(value) && value.every((item) => typeof item === "boolean")
        ? { ok: true, value }
        : { ok: false, reason: "expected an array of booleans" };
    case "date-list":
      return Array.isArray(value) && value.every((item) => isIsoDate(item))
        ? { ok: true, value }
        : { ok: false, reason: "expected an array of ISO-8601 date strings" };
    default:
      return { ok: false, reason: `unknown canonical type ${type}` };
  }
}

export function personalData(value) {
  return typeof value === "string" && (EMAIL.test(value) || PHONE.test(value));
}

export function derive(college, contract) {
  const errors = [];
  const properties = [];
  const refusals = [];
  if (!college || !Array.isArray(college.cardinals)) {
    errors.push({ code: "college_shape", detail: "CardinalCollege has no cardinals array" });
    return { errors, properties, refusals, element: [], page: [], user: [], canon: null };
  }
  if (college.prefix !== contract.college) {
    errors.push({ code: "college_mismatch", detail: `contract college ${contract.college} != prefix ${college.prefix}` });
  }
  if (college.version !== contract.collegeVersion) {
    errors.push({
      code: "version_mismatch",
      detail: `contract collegeVersion ${contract.collegeVersion} != version ${college.version}`,
    });
  }
  const byNotation = new Map(college.cardinals.map((cardinal) => [cardinal.notation, cardinal]));
  const seen = new Set();
  for (const entry of contract.cardinals ?? []) {
    if (seen.has(entry.notation)) errors.push({ code: "duplicate_notation", notation: entry.notation });
    seen.add(entry.notation);
    const cardinal = byNotation.get(entry.notation);
    if (!cardinal) {
      errors.push({ code: "unknown_notation", notation: entry.notation });
      continue;
    }
    if (cardinal.deprecated) errors.push({ code: "deprecated_notation", notation: entry.notation });
    const names = new Set();
    for (const prop of entry.properties ?? []) {
      if (names.has(prop.name)) errors.push({ code: "duplicate_property", notation: entry.notation, name: prop.name });
      names.add(prop.name);
      if (IDENTITY_KEYS.includes(prop.name)) {
        errors.push({ code: "reserved_name", notation: entry.notation, name: prop.name });
      }
      if (prop.privacy === "excluded") {
        refusals.push({ notation: entry.notation, name: prop.name, scope: prop.scope, reason: "privacy-excluded" });
        continue;
      }
      properties.push({ ...prop, notation: entry.notation });
    }
  }
  return {
    errors,
    properties,
    refusals,
    element: properties.filter((prop) => prop.scope === "element"),
    page: properties.filter((prop) => prop.scope === "page"),
    user: properties.filter((prop) => prop.scope === "user"),
    canon: college.prefix && college.version ? `${college.prefix}@${college.version}` : null,
  };
}

// Build a track payload from caller-supplied values. Excluded properties are refused:
// they are recorded and they are not copied onto the event, even when the caller passed a value.
export function trackPayload(derived, input) {
  const kind = input.kind ?? "element";
  const refusals = [];
  const event_properties = { canon: input.canon ?? derived.canon };
  if (kind === "element") {
    event_properties.canon_element = input.notation;
    if (input.instance) event_properties.canon_instance = input.instance;
  }
  const scoped =
    kind === "page"
      ? derived.page
      : kind === "user"
        ? derived.user
        : derived.element.filter((prop) => prop.notation === input.notation);
  const values = input.values ?? {};
  for (const [name, raw] of Object.entries(values)) {
    const refused = derived.refusals.find(
      (row) => row.name === name && (kind !== "element" || row.notation === input.notation),
    );
    if (refused) {
      refusals.push({ name, reason: "privacy-excluded", notation: refused.notation });
      continue;
    }
    const prop = scoped.find((row) => row.name === name);
    if (!prop) {
      refusals.push({ name, reason: "not-in-contract", notation: input.notation ?? null });
      continue;
    }
    if (prop.privacy === "masked") {
      event_properties[name] = "[masked]";
      continue;
    }
    const coerced = coerce(prop.type, raw);
    if (!coerced.ok) refusals.push({ name, reason: coerced.reason, notation: prop.notation });
    else event_properties[name] = coerced.value;
  }
  const event_type = kind === "page" ? "canon:page" : kind === "user" ? "canon:identify" : "canon:click";
  return { event: { event_type, event_properties }, refusals };
}

// Amplitude enrichment execute. Documented behaviour (see plugin.json): if execute does not
// return the event, the SDK drops it. This function always returns an event object.
export function execute(derived, event) {
  const base = event && typeof event === "object" ? event : {};
  const next = {
    ...base,
    event_type: typeof base.event_type === "string" ? base.event_type : "canon:unknown",
    event_properties: { ...(base.event_properties ?? {}) },
  };
  for (const row of derived.refusals) delete next.event_properties[row.name];
  return next;
}

export function enrichmentSource(derived) {
  const excluded = derived.refusals.map((row) => row.name);
  return `// Generated from a Canon property contract. Property names are the contract's names.
// Do not add a property name that is not in the contract.
function execute(event) {
  const base = event && typeof event === "object" ? event : {};
  const next = {
    ...base,
    event_type: typeof base.event_type === "string" ? base.event_type : "canon:unknown",
    event_properties: { ...(base.event_properties || {}) },
  };
  for (const name of ${JSON.stringify(excluded)}) delete next.event_properties[name];
  return next;
}
`;
}

export function auditPayload(derived, payload) {
  const findings = [];
  if (!payload || typeof payload !== "object" || !payload.event_properties || typeof payload.event_properties !== "object") {
    findings.push({ code: "payload_shape", detail: "payload needs event_properties" });
    return findings;
  }
  const props = payload.event_properties;
  const eventType = payload.event_type ?? "";
  const kind = eventType === "canon:page" ? "page" : eventType === "canon:identify" ? "user" : "element";
  const notation = typeof props.canon_element === "string" ? props.canon_element : null;
  const excluded = new Map(derived.refusals.map((row) => [row.name, row]));
  const allowed = new Map();
  const pool = kind === "page" ? derived.page : kind === "user" ? derived.user : derived.element;
  for (const prop of pool) {
    if (kind === "element" && notation && prop.notation !== notation) continue;
    allowed.set(prop.name, prop);
  }
  for (const [key, value] of Object.entries(props)) {
    if (IDENTITY_KEYS.includes(key)) continue;
    if (excluded.has(key)) {
      findings.push({ code: "excluded_emitted", name: key, notation: excluded.get(key).notation });
      continue;
    }
    const prop = allowed.get(key);
    if (!prop) {
      const other = derived.properties.find((row) => row.name === key);
      findings.push({
        code: other ? "scope_mismatch" : "unknown_property",
        name: key,
        scope: other?.scope ?? null,
        event: kind,
      });
      continue;
    }
    if (prop.privacy === "masked") {
      if (value !== "[masked]") findings.push({ code: "mask_leaked", name: key, detail: "masked properties travel as [masked]" });
      continue;
    }
    const coerced = coerce(prop.type, value);
    if (!coerced.ok) findings.push({ code: "type_coercion", name: key, detail: coerced.reason });
    else if (personalData(value)) findings.push({ code: "privacy_leak", name: key });
  }
  return findings;
}
