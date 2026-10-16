export type Dir = "ltr" | "rtl";
export type SurfaceId = "web" | "ios" | "android" | "headless";
export type InteractionType = "interaction" | "mcp-tool-call";
export type NamedBy = "visible" | "aria" | "labelledby";

export type Labels = { en: string; [tag: string]: string | undefined };

export type CanonLocale = { tag: string; dir: Dir; fallback?: string };

export type CanonInstance = {
  id: string;
  stability: "record" | "slug";
  name: Labels;
  detail?: Labels;
};

export type CanonConcept = {
  notation: string;
  cardinality: "singleton" | "repeating";
  namedBy?: NamedBy;
  ephemeral?: boolean;
  deprecated?: boolean;
  replacedBy?: string;
  prefLabel: Labels;
  instances?: CanonInstance[];
};

export type CanonFile = {
  canon: string;
  prefix: string;
  defaultLocale: string;
  locales: CanonLocale[];
  capabilities?: { name: string; notation: string }[];
  concepts: CanonConcept[];
};

export type SurfacePart = {
  notation: string;
  instance: string | null;
  rank?: number;
  place?: string;
  element?: "a" | "button" | "nav" | "form";
  role?: string;
  component?: string;
  names?: Labels;
};

export type Emission = {
  notation: string;
  instance: string | null;
  rank: number | null;
  visible: string | null;
  accessibleName: string | null;
  ariaLabel: string | null;
  labelledBy: string | null;
  lang: string | null;
  dir: Dir | null;
  pageLang: string;
  pageDir: Dir;
  nameLang: string;
  nameDir: Dir;
  interactionType: InteractionType | null;
  version: string;
  description: string | null;
  surface: SurfaceId;
  extra: string[];
};

export type Check = { id: string; pass: boolean; detail: string };

const SEGMENT = /^[a-z][a-z0-9-]*$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/;

export function notationOk(notation: string, prefix: string): boolean {
  if (notation.length === 0 || notation.length > 50) return false;
  const parts = notation.split(".");
  if (parts.length < 2 || parts[0] !== prefix) return false;
  return parts.every((part) => SEGMENT.test(part));
}

export function instanceOk(id: string): boolean {
  return id.length > 0 && id.length <= 50 && SEGMENT.test(id);
}

export function conceptOf(canon: CanonFile, notation: string): CanonConcept | undefined {
  return canon.concepts.find((concept) => concept.notation === notation);
}

export type ResolvedName = {
  label: string;
  lang: string;
  dir: Dir;
  requested: string;
  fellBack: boolean;
};

export function resolveLabels(canon: CanonFile, labels: Labels, requested: string): ResolvedName {
  const seen = new Set<string>();
  let cursor: string | undefined = requested;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const locale = canon.locales.find((item) => item.tag === cursor);
    const label = labels[cursor];
    if (label && locale) {
      return { label, lang: locale.tag, dir: locale.dir, requested, fellBack: cursor !== requested };
    }
    cursor = locale?.fallback;
  }
  const fallback = canon.locales.find((item) => item.tag === canon.defaultLocale) ?? canon.locales[0];
  return {
    label: labels[canon.defaultLocale] ?? "",
    lang: fallback?.tag ?? canon.defaultLocale,
    dir: fallback?.dir ?? "ltr",
    requested,
    fellBack: requested !== (fallback?.tag ?? canon.defaultLocale),
  };
}

export function policySource(concept: CanonConcept, instanceId: string | null, names?: Labels): Labels {
  if (concept.cardinality === "singleton") return concept.prefLabel;
  if (instanceId) {
    const instance = concept.instances?.find((item) => item.id === instanceId);
    if (!instance) return { en: "" };
    return instance.name;
  }
  return names ?? concept.prefLabel;
}

export function validateCanon(canon: CanonFile): string[] {
  const errors: string[] = [];
  if (!canon.canon) errors.push("Canon version is missing.");
  if (!canon.locales.some((locale) => locale.tag === canon.defaultLocale)) {
    errors.push("Default locale is not declared.");
  }
  const seen = new Set<string>();
  for (const concept of canon.concepts) {
    if (seen.has(concept.notation)) errors.push(`Duplicate notation ${concept.notation}.`);
    seen.add(concept.notation);
    if (!notationOk(concept.notation, canon.prefix)) errors.push(`Illegal notation ${concept.notation}.`);
    if (!concept.prefLabel?.en) errors.push(`${concept.notation} has no default-locale label.`);
    if (concept.cardinality === "singleton" && concept.instances?.length) {
      errors.push(`${concept.notation} is singleton and must not declare instances.`);
    }
    if (concept.cardinality === "repeating" && !concept.ephemeral && !concept.instances?.length && !concept.deprecated) {
      errors.push(`${concept.notation} repeats and has no instances.`);
    }
    const ids = new Set<string>();
    for (const instance of concept.instances ?? []) {
      if (!instanceOk(instance.id)) errors.push(`Illegal instance ${concept.notation}#${instance.id}.`);
      if (ids.has(instance.id)) errors.push(`Reused instance ${instance.id} on ${concept.notation}.`);
      ids.add(instance.id);
      if (!instance.name.en) errors.push(`${concept.notation}#${instance.id} has no default-locale name.`);
    }
    if (concept.deprecated && !concept.replacedBy) errors.push(`${concept.notation} is deprecated without replacedBy.`);
  }
  for (const concept of canon.concepts) {
    if (!concept.deprecated || !concept.replacedBy) continue;
    const next = conceptOf(canon, concept.replacedBy);
    if (!next) errors.push(`${concept.notation} replacedBy ${concept.replacedBy} does not exist.`);
    else if (next.deprecated) errors.push(`${concept.notation} is replaced by a deprecated notation.`);
    if (concept.replacedBy === concept.notation) errors.push(`${concept.notation} replaces itself.`);
  }
  for (const capability of canon.capabilities ?? []) {
    if (!conceptOf(canon, capability.notation)) errors.push(`Capability ${capability.name} points at an unknown notation.`);
  }
  return errors;
}

export function personalData(value: string): boolean {
  return EMAIL.test(value) || PHONE.test(value);
}

export function audit(canon: CanonFile, emission: Emission, parts: SurfacePart[]): Check[] {
  const concept = conceptOf(canon, emission.notation);
  const checks: Check[] = [];
  const legal = notationOk(emission.notation, canon.prefix);
  checks.push({
    id: "notation",
    pass: legal && Boolean(concept),
    detail: legal && concept ? `${emission.notation} · ${emission.notation.length}/50` : "Notation fails grammar, prefix, length, or is not in the canon.",
  });

  const deprecatedHit = parts.some((part) => conceptOf(canon, part.notation)?.deprecated);
  checks.push({
    id: "deprecated",
    pass: !concept?.deprecated && !deprecatedHit,
    detail: concept?.deprecated
      ? `${emission.notation} is deprecated. It is not renamed and must not be emitted.`
      : deprecatedHit
        ? "A deprecated notation is on the page."
        : "Deprecated notations are absent. None were reused.",
  });

  if (!concept) {
    checks.push({ id: "instance", pass: false, detail: "No concept to check." });
  } else if (concept.cardinality === "singleton") {
    const count = parts.filter((part) => part.notation === concept.notation).length;
    checks.push({
      id: "instance",
      pass: count === 1 && emission.instance == null,
      detail: count === 1 ? "Singleton. One occurrence. No instance identifier." : `Singleton occurs ${count} times on this page.`,
    });
  } else if (concept.ephemeral) {
    checks.push({
      id: "instance",
      pass: emission.instance == null && emission.rank != null,
      detail:
        emission.instance == null && emission.rank != null
          ? `Ephemeral. No instance id. Rank ${emission.rank} is a property.`
          : "Ephemeral parts omit the instance id and carry rank.",
    });
  } else {
    const id = emission.instance ?? "";
    const known = concept.instances?.some((item) => item.id === id) ?? false;
    checks.push({
      id: "instance",
      pass: instanceOk(id) && known,
      detail: instanceOk(id) && known ? `${concept.notation}#${id} · from a record` : "Instance id is missing, illegal, or not in the canon.",
    });
  }

  if (emission.surface === "headless") {
    const description = emission.description ?? "";
    const machineKey = description === emission.notation || notationOk(description, canon.prefix);
    checks.push({
      id: "name",
      pass: description.length > 0 && !machineKey && emission.accessibleName == null && emission.ariaLabel == null,
      detail: machineKey
        ? "Description is a notation. Agents need a label, not a machine key."
        : description
          ? `No accessibility tree. Description “${description}”.`
          : "Headless description is empty.",
    });
  } else {
    const name = emission.accessibleName ?? "";
    const visible = emission.visible;
    const contains = visible == null || (visible.length > 0 && name.includes(visible));
    const redundant = Boolean(visible && name === visible && emission.ariaLabel);
    const ariaOk = emission.ariaLabel == null || (visible == null ? emission.ariaLabel === name : emission.ariaLabel.includes(visible));
    checks.push({
      id: "name",
      pass: name.length > 0 && contains && !redundant && ariaOk,
      detail: redundant
        ? "aria-label repeats the visible text. Omit it."
        : !contains
          ? `Accessible name “${name}” does not contain the visible text “${visible}”.`
          : !ariaOk
            ? "The accessible-name property does not contain the visible text."
            : visible
              ? `“${name}” contains the visible text. No redundant aria-label.`
              : `No visible name. aria-label “${name}”.`,
    });
    const langOk = emission.nameLang === emission.pageLang ? emission.lang == null : emission.lang === emission.nameLang;
    const dirOk = emission.nameDir === emission.pageDir ? emission.dir == null : emission.dir === emission.nameDir;
    checks.push({
      id: "lang",
      pass: langOk && dirOk,
      detail:
        emission.lang || emission.dir
          ? `${emission.lang ?? emission.pageLang} · ${emission.dir ?? emission.pageDir} overrides the page.`
          : `Page locale ${emission.pageLang} · ${emission.pageDir}. No override on the element.`,
    });
  }

  checks.push({
    id: "version",
    pass: emission.version.length > 0 && emission.version === canon.canon,
    detail: emission.version === canon.canon ? `Surface declares canon ${emission.version}.` : `Surface says ${emission.version || "nothing"}. Canon is ${canon.canon}.`,
  });

  const scanned = [emission.visible, emission.accessibleName, emission.ariaLabel, emission.description, emission.instance, ...emission.extra].filter(
    (item): item is string => Boolean(item),
  );
  const leak = scanned.find((item) => personalData(item));
  checks.push({
    id: "privacy",
    pass: !leak,
    detail: leak ? `Personal data in “${leak}”.` : "Label, instance content, and properties carry no personal data.",
  });

  if (emission.interactionType != null) {
    checks.push({
      id: "interaction",
      pass: emission.interactionType === "interaction" || emission.interactionType === "mcp-tool-call",
      detail: `${emission.interactionType} is self-reported and not verified.`,
    });
  }

  return checks;
}

export function emissionFor(options: {
  canon: CanonFile;
  concept: CanonConcept;
  instance: string | null;
  rank?: number | null;
  names?: Labels;
  extra?: string[];
  locale: string;
  surface: SurfaceId;
  interactionType: InteractionType | null;
  description: string | null;
  labelledBy?: string | null;
}): Emission {
  const name = resolveLabels(options.canon, policySource(options.concept, options.instance, options.names), options.locale);
  const page = options.canon.locales.find((item) => item.tag === options.locale) ?? options.canon.locales[0];
  const pageLang = page?.tag ?? options.locale;
  const pageDir = page?.dir ?? "ltr";
  const headless = options.surface === "headless";
  const namedBy = options.concept.namedBy ?? "visible";
  const visible = headless || namedBy === "aria" ? null : name.label;
  return {
    notation: options.concept.notation,
    instance: options.instance,
    rank: options.rank ?? null,
    visible,
    accessibleName: headless ? null : name.label,
    ariaLabel: !headless && namedBy === "aria" ? name.label : null,
    labelledBy: !headless && namedBy === "labelledby" ? (options.labelledBy ?? null) : null,
    lang: !headless && name.lang !== pageLang ? name.lang : null,
    dir: !headless && name.dir !== pageDir ? name.dir : null,
    pageLang,
    pageDir,
    nameLang: name.lang,
    nameDir: name.dir,
    interactionType: options.interactionType,
    version: options.canon.canon,
    description: options.description,
    surface: options.surface,
    extra: options.extra ?? [],
  };
}

export function failedIds(checks: Check[]): string[] {
  return checks.filter((check) => !check.pass).map((check) => check.id);
}

