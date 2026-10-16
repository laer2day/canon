import canonFile from "../../spec/canons/meridian.json";
import homeFile from "../../spec/surfaces/meridian-home.json";
import {
  audit,
  emissionFor,
  resolveLabels,
  type CanonFile,
  type Check,
  type Emission,
  type InteractionType,
  type SurfaceId,
  type SurfacePart,
} from "@/lib/check";

export type { Check, InteractionType, SurfaceId };

export type LocaleId = "en" | "fr" | "ar" | "ja";
export type Dir = "ltr" | "rtl";
export type ActorId = "human" | "agent-ui" | "agent-tool" | "agent-headless";
export type ComponentType = "button" | "link" | "nav" | "card" | "form" | "list-item";
export type NamedBy = "visible" | "aria" | "labelledby";

export const SPEC_VERSION = "0.2";
export const CANON = canonFile as CanonFile;
export const CANON_VERSION = CANON.canon;
export const PREFIX = CANON.prefix;
export const CANON_PRETTY = JSON.stringify(CANON, null, 2);
export const FORM_LABEL_ID = "request-demo-title";

const HOME = homeFile as { id: string; parts: SurfacePart[] };

export type Labels = { en: string; fr?: string; ar?: string; ja?: string };

export type Locale = {
  id: LocaleId;
  tag: string;
  name: string;
  native: string;
  dir: Dir;
  fallback: LocaleId | null;
};

const LOCALE_CHROME: Record<LocaleId, { name: string; native: string }> = {
  en: { name: "English", native: "English" },
  fr: { name: "French", native: "Français" },
  ar: { name: "Arabic", native: "العربية" },
  ja: { name: "Japanese", native: "日本語" },
};

function asLocale(tag: string): LocaleId {
  if (tag === "en" || tag === "fr" || tag === "ar" || tag === "ja") return tag;
  throw new Error(`Unsupported locale: ${tag}`);
}

export const LOCALE_ORDER: LocaleId[] = CANON.locales.map((locale) => asLocale(locale.tag));

export const LOCALES: Record<LocaleId, Locale> = Object.fromEntries(
  CANON.locales.map((locale) => {
    const id = asLocale(locale.tag);
    const chrome = LOCALE_CHROME[id];
    return [id, { id, tag: locale.tag, name: chrome.name, native: chrome.native, dir: locale.dir, fallback: locale.fallback ? asLocale(locale.fallback) : null }];
  }),
) as Record<LocaleId, Locale>;

export type ResolvedText = {
  label: string;
  localeId: LocaleId;
  lang: string;
  dir: Dir;
  requested: LocaleId;
  fellBack: boolean;
};

function resolveText(labels: Labels, requested: LocaleId): ResolvedText {
  const resolved = resolveLabels(CANON, labels, requested);
  return {
    label: resolved.label,
    localeId: asLocale(resolved.lang),
    lang: resolved.lang,
    dir: resolved.dir,
    requested,
    fellBack: resolved.fellBack,
  };
}

export type InstanceRecord = {
  id: string;
  names: Labels;
  detail?: Labels;
  stability: "record" | "slug";
};

export type Concept = {
  notation: string;
  cardinality: "singleton" | "repeating";
  namedBy: NamedBy;
  component: ComponentType;
  element: "a" | "button" | "nav" | "form";
  role: string;
  ephemeral: boolean;
  deprecated: boolean;
  replacedBy?: string;
  labels: Labels;
  instances?: InstanceRecord[];
};

export type Placement = {
  notation: string;
  instanceId: string | null;
  place: string;
  rank?: number;
  names?: Labels;
  element: "a" | "button" | "nav" | "form";
  role: string;
  component: ComponentType;
};

function asElement(value: string | undefined): Placement["element"] {
  if (value === "a" || value === "button" || value === "nav" || value === "form") return value;
  return "a";
}

function asComponent(value: string | undefined): ComponentType {
  if (value === "button" || value === "link" || value === "nav" || value === "card" || value === "form" || value === "list-item") return value;
  return "link";
}

export const PLACEMENTS: Placement[] = HOME.parts.map((part) => ({
  notation: part.notation,
  instanceId: part.instance,
  place: part.place ?? "page",
  rank: part.rank,
  names: part.names as Labels | undefined,
  element: asElement(part.element),
  role: part.role ?? "link",
  component: asComponent(part.component),
}));

function presentation(notation: string): Pick<Placement, "element" | "role" | "component"> {
  return PLACEMENTS.find((part) => part.notation === notation) ?? { element: "a", role: "link", component: "link" };
}

export const CONCEPTS: Concept[] = CANON.concepts.map((concept) => {
  const face = presentation(concept.notation);
  return {
    notation: concept.notation,
    cardinality: concept.cardinality,
    namedBy: concept.namedBy ?? "visible",
    component: face.component,
    element: face.element,
    role: face.role,
    ephemeral: Boolean(concept.ephemeral),
    deprecated: Boolean(concept.deprecated),
    replacedBy: concept.replacedBy,
    labels: concept.prefLabel as Labels,
    instances: concept.instances?.map((instance) => ({
      id: instance.id,
      stability: instance.stability,
      names: instance.name as Labels,
      detail: instance.detail as Labels | undefined,
    })),
  };
});

export function placementKey(placement: Placement): string {
  if (placement.instanceId) return `${placement.notation}#${placement.instanceId}`;
  if (placement.rank != null) return `${placement.notation}@${placement.rank}`;
  return placement.notation;
}

export function getConcept(notation: string): Concept {
  const found = CONCEPTS.find((concept) => concept.notation === notation);
  if (!found) throw new Error(`Unknown notation: ${notation}`);
  return found;
}

export function getPlacement(key: string): Placement {
  const found = PLACEMENTS.find((placement) => placementKey(placement) === key);
  if (!found) throw new Error(`Unknown placement: ${key}`);
  return found;
}

export type ResolvedPart = {
  key: string;
  concept: Concept;
  placement: Placement;
  instance: InstanceRecord | null;
  name: ResolvedText;
  typeLabel: ResolvedText;
  detail: ResolvedText | null;
  reference: string;
  visible: string | null;
};

export function resolvePart(key: string, localeId: LocaleId): ResolvedPart {
  const placement = getPlacement(key);
  const concept = getConcept(placement.notation);
  const instance = placement.instanceId ? (concept.instances?.find((item) => item.id === placement.instanceId) ?? null) : null;
  const name = resolveText(concept.cardinality === "singleton" ? concept.labels : instance ? instance.names : (placement.names ?? concept.labels), localeId);
  return {
    key,
    concept,
    placement,
    instance,
    name,
    typeLabel: resolveText(concept.labels, localeId),
    detail: instance?.detail ? resolveText(instance.detail, localeId) : null,
    reference: placement.instanceId ? `${concept.notation}#${placement.instanceId}` : concept.notation,
    visible: concept.namedBy === "aria" ? null : name.label,
  };
}

function toEmission(part: ResolvedPart, localeId: LocaleId, surface: SurfaceId, interactionType: InteractionType | null, localeKnown: boolean): Emission {
  const concept = CANON.concepts.find((item) => item.notation === part.concept.notation);
  if (!concept) throw new Error(`Missing canon concept ${part.concept.notation}`);
  return emissionFor({
    canon: CANON,
    concept,
    instance: part.placement.instanceId,
    rank: part.placement.rank ?? null,
    names: part.placement.names,
    extra: part.detail ? [part.detail.label] : [],
    locale: localeId,
    surface,
    interactionType,
    description: surface === "headless" ? descriptionFor(part, localeKnown) : null,
    labelledBy: part.concept.namedBy === "labelledby" ? FORM_LABEL_ID : null,
  });
}

export function descriptionFor(part: ResolvedPart, localeKnown: boolean): string {
  const labels = part.instance ? part.instance.names : part.concept.labels;
  if (!localeKnown) return labels.en;
  return part.instance ? part.name.label : part.typeLabel.label;
}

export const PAGE_COPY: Record<LocaleId, { headline: string; dek: string; email: string; results: string; rank: string }> = {
  en: {
    headline: "Assurance on every release.",
    dek: "Starter, Growth, and Enterprise are instances of one plan.",
    email: "Work email",
    results: "Recent results",
    rank: "rank",
  },
  fr: {
    headline: "L’assurance, sur chaque livraison.",
    dek: "Essentiel, Croissance et Entreprise sont des instances d’une seule offre.",
    email: "E-mail professionnel",
    results: "Résultats récents",
    rank: "rang",
  },
  ar: {
    headline: "ضمان في كل إصدار.",
    dek: "الأساسي والنمو والمؤسسة حالات لمفهوم خطة واحد.",
    email: "البريد المهني",
    results: "نتائج حديثة",
    rank: "ترتيب",
  },
  ja: {
    headline: "すべてのリリースに保証を。",
    dek: "スターター、グロース、Enterpriseは、一つのプランのインスタンスです。",
    email: "仕事用メール",
    results: "最近の結果",
    rank: "順位",
  },
};

export type Actor = {
  id: ActorId;
  label: string;
  short: string;
  how: string;
  sees: string;
  interactionType: InteractionType;
  headless: boolean;
};

export const ACTORS: Actor[] = [
  {
    id: "human",
    label: "Human",
    short: "Human",
    how: "Clicks or taps a decorated element",
    sees: "A report of interaction, then the attribute is cleared",
    interactionType: "interaction",
    headless: false,
  },
  {
    id: "agent-ui",
    label: "Agent via UI",
    short: "Agent, UI",
    how: "Clicks or taps like a human",
    sees: "The same element interaction, flagged by agent identification",
    interactionType: "interaction",
    headless: false,
  },
  {
    id: "agent-tool",
    label: "Agent via tool, UI-routed",
    short: "Tool, via UI",
    how: "A WebMCP tool clicks the decorated element",
    sees: "interactionType mcp-tool-call, cleared after the call unless you leave it stuck",
    interactionType: "mcp-tool-call",
    headless: false,
  },
  {
    id: "agent-headless",
    label: "Agent via tool, headless",
    short: "Tool, headless",
    how: "A tool calls logic directly. The UI is never touched.",
    sees: "A canonical event. The description is a label. There is no accessible name.",
    interactionType: "mcp-tool-call",
    headless: true,
  },
];

export function getActor(id: ActorId): Actor {
  const found = ACTORS.find((actor) => actor.id === id);
  if (!found) throw new Error(`Unknown actor: ${id}`);
  return found;
}

export type Surface = { id: SurfaceId; label: string; file: string };

export const SURFACES: Surface[] = [
  { id: "web", label: "Web", file: "data-element · data-instance · visible name" },
  { id: "ios", label: "iOS", file: "accessibilityIdentifier · instanceIdentifier" },
  { id: "android", label: "Android", file: "testTag · InstanceIdentifier" },
  { id: "headless", label: "Headless", file: "tool identity · capability description" },
];

export type Capability = { name: string; notation: string };

export const CAPABILITIES: Capability[] = (CANON.capabilities ?? []).map((capability) => ({
  name: capability.name,
  notation: capability.notation,
}));

export function capabilityFor(notation: string): Capability | null {
  return CAPABILITIES.find((capability) => capability.notation === notation) ?? null;
}

export function canonDom(part: ResolvedPart, localeId: LocaleId, interactionType: InteractionType | null): Record<string, string> {
  const emission = toEmission(part, localeId, "web", interactionType, true);
  const attrs: Record<string, string> = { "data-element": emission.notation };
  if (emission.instance) attrs["data-instance"] = emission.instance;
  if (emission.rank != null) attrs["data-rank"] = String(emission.rank);
  if (emission.interactionType) attrs["data-interaction-type"] = emission.interactionType;
  if (emission.ariaLabel) attrs["aria-label"] = emission.ariaLabel;
  if (emission.labelledBy) attrs["aria-labelledby"] = emission.labelledBy;
  if (emission.lang) attrs.lang = emission.lang;
  if (emission.dir) attrs.dir = emission.dir;
  return attrs;
}

export function emitCode(options: {
  surface: SurfaceId;
  part: ResolvedPart;
  localeId: LocaleId;
  interactionType: InteractionType | null;
  localeKnown: boolean;
}): string {
  const { surface, part, localeId, interactionType, localeKnown } = options;
  const emission = toEmission(part, localeId, surface, surface === "headless" ? "mcp-tool-call" : interactionType, localeKnown);
  const instanceLine = emission.instance ? emission.instance : part.concept.ephemeral ? "omitted · ephemeral" : "omitted · singleton";

  if (surface === "web") {
    const attrs = [
      `   data-element="${emission.notation}"`,
      emission.instance ? `   data-instance="${emission.instance}"` : null,
      emission.rank != null ? `   data-rank="${emission.rank}"` : null,
      emission.interactionType ? `   data-interaction-type="${emission.interactionType}"` : null,
      emission.ariaLabel ? `   aria-label="${emission.ariaLabel}"` : null,
      emission.labelledBy ? `   aria-labelledby="${emission.labelledBy}"` : null,
      emission.lang ? `   lang="${emission.lang}"` : null,
      emission.dir ? `   dir="${emission.dir}"` : null,
    ].filter((line): line is string => line !== null);
    return [`<!-- surface canon ${CANON_VERSION} -->`, `<${part.concept.element}`, ...attrs, ">", emission.visible ? `  ${emission.visible}` : "", `</${part.concept.element}>`]
      .filter((line) => line !== "")
      .join("\n");
  }

  if (surface === "ios") {
    const lines = [
      `accessibilityIdentifier = "${emission.notation}"`,
      emission.instance ? `accessibilityCustomContent("instanceIdentifier", "${emission.instance}")` : `// instanceIdentifier ${instanceLine}`,
      emission.rank != null ? `// rank = ${emission.rank}` : null,
      emission.ariaLabel ? `accessibilityLabel = "${emission.ariaLabel}"` : "// accessibilityLabel omitted; visible text is the name",
      emission.lang ? `accessibilityLanguage = "${emission.lang}"` : "// accessibilityLanguage omitted; matches the platform locale",
      emission.interactionType ? `accessibilityCustomContent("interactionType", "${emission.interactionType}")` : "// interactionType omitted until an actor reports it",
    ].filter((line): line is string => line !== null);
    return lines.join("\n");
  }

  if (surface === "android") {
    const body = [
      emission.instance ? `    set(InstanceIdentifier, "${emission.instance}")` : `    // InstanceIdentifier ${instanceLine}`,
      emission.rank != null ? `    // rank = ${emission.rank}` : null,
      emission.ariaLabel ? `    contentDescription = "${emission.ariaLabel}"` : "    // contentDescription omitted; visible text is the name",
      emission.lang ? `    // locale override ${emission.lang}` : null,
      emission.interactionType ? `    set(InteractionType, "${emission.interactionType}")` : "    // InteractionType omitted until an actor reports it",
    ].filter((line): line is string => line !== null);
    return [`Modifier.testTag("${emission.notation}")`, "semantics {", ...body, "}"].join("\n");
  }

  const capability = capabilityFor(part.concept.notation);
  if (!capability) {
    return ["// No capability for this notation.", "// Headless has no accessibility tree.", `// Identity remains ${part.reference}`].join("\n");
  }
  const instanceProp = part.placement.instanceId
    ? ` "instance": { "const": "${part.placement.instanceId}" }`
    : capability.name === "open_plan"
      ? ` "instance": { "type": "string" }`
      : "";
  return [
    "registerTool({",
    `  name: "${capability.name}",`,
    `  description: "${emission.description}",`,
    `  notation: "${part.concept.notation}",`,
    `  interactionType: "mcp-tool-call",`,
    `  inputSchema: { "type": "object", "properties": {${instanceProp}} }`,
    "})",
    localeKnown ? `// Agent locale ${part.name.lang}. Description is a label.` : "// Agent locale unknown. Description is the default-locale label, not the notation.",
  ].join("\n");
}

export function conformance(part: ResolvedPart, localeId: LocaleId, surface: SurfaceId, interactionType: InteractionType | null, localeKnown: boolean): Check[] {
  const emission = toEmission(part, localeId, surface, surface === "headless" ? "mcp-tool-call" : interactionType, localeKnown);
  return audit(CANON, emission, HOME.parts);
}

export const IDENTITY_RULES: { title: string; body: string }[] = [
  {
    title: "Notation",
    body: "Lowercase ASCII, dot-namespaced, at most 50 characters, and prefixed by the surface. Published notations are immutable. meridian.link.demo is deprecated in the canon and is not emitted.",
  },
  {
    title: "Preferred label",
    body: "Exactly one per BCP 47 tag. It names the type. Product, Pricing, and Customers are not three types. They are instances of meridian.link.nav.",
  },
  {
    title: "Instance",
    body: "notation#id, with no dots in the id, taken from a record. On the web the attribute is data-instance. data-id is left alone, because many surfaces already use it for something else.",
  },
  {
    title: "Omissions",
    body: "Ephemeral rows omit the id and carry rank. Personal records omit it. A title slug is allowed only when no record exists, and is marked less stable.",
  },
];

export const CARDINALITY_RULES: { title: string; body: string }[] = [
  {
    title: "Singleton",
    body: "Once per page. The check counts occurrences. Get a Demo is one concept and one occurrence, so it has no instance. A second copy fails conformance.",
  },
  {
    title: "Repeating",
    body: "The instance name is the accessible name. Plan is the type. Growth is sku-growth. Navigation link is the type. Product is route-product.",
  },
  {
    title: "Visible text",
    body: "The accessible name must contain the visible label. If the visible text already is that name, aria-label is omitted. A landmark with no visible name may use aria-label.",
  },
  {
    title: "Empty names",
    body: "Fallback must not produce an empty name, and it must not fall back to the notation. sku-enterprise has no Japanese name, so the element says Enterprise and sets lang=en.",
  },
];

export const EMISSION_ROWS: { surface: string; notation: string; instance: string; name: string; lang: string; interaction: string }[] = [
  {
    surface: "Web",
    notation: "data-element",
    instance: "data-instance",
    name: "visible text, or aria-label if there is none",
    lang: "lang and dir only when they differ from the page",
    interaction: "data-interaction-type while a report is current",
  },
  {
    surface: "iOS",
    notation: "accessibilityIdentifier",
    instance: "custom content instanceIdentifier",
    name: "visible label; accessibilityLabel only if it differs",
    lang: "accessibilityLanguage only on a mismatch",
    interaction: "custom content interactionType, then removed on reset",
  },
  {
    surface: "Android",
    notation: "testTag",
    instance: "semantics InstanceIdentifier",
    name: "visible text; contentDescription only if it differs",
    lang: "locale override only on a mismatch",
    interaction: "semantics InteractionType, then removed on reset",
  },
  {
    surface: "Headless",
    notation: "tool notation",
    instance: "argument, when the concept repeats",
    name: "capability description, never the notation",
    lang: "default locale when the agent locale is unknown",
    interaction: "mcp-tool-call",
  },
];

export const CONSUMER_RULES: { title: string; must: string; mustNot: string }[] = [
  {
    title: "Assistive technology",
    must: "Read the accessible name, and honor lang or dir when the element sets them.",
    mustNot: "Speak the notation.",
  },
  {
    title: "Analytics",
    must: "Group by notation. Keep the instance as its own property.",
    mustNot: "Use the label, the visible text, or data-id as the key.",
  },
  {
    title: "Test frameworks",
    must: "Select by notation. Use the instance id only to tell repeats apart.",
    mustNot: "Select by copy, CSS structure, or position.",
  },
  {
    title: "Agents",
    must: "Call the capability for the notation. Read the description as human text.",
    mustNot: "Put the notation in the description, or invent an id for an ephemeral or personal row.",
  },
];
