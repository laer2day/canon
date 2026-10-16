import { useMemo, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import {
  ACTORS,
  CANON_VERSION,
  CAPABILITIES,
  FORM_LABEL_ID,
  LOCALES,
  LOCALE_ORDER,
  PAGE_COPY,
  PLACEMENTS,
  SURFACES,
  canonDom,
  capabilityFor,
  conformance,
  descriptionFor,
  emitCode,
  getActor,
  placementKey,
  resolvePart,
  type ActorId,
  type InteractionType,
  type LocaleId,
  type SurfaceId,
} from "@/lib/canon";

type LogItem = {
  id: number;
  actor: string;
  interactionType: InteractionType;
  reference: string;
  via: string;
  label: string;
  lang: string;
  stale: boolean;
  note?: string;
};

const BRAND = "Meridian";
const DEFAULT_KEY = "meridian.button.get-demo";

export function Studio() {
  const [localeId, setLocaleId] = useState<LocaleId>("en");
  const [surface, setSurface] = useState<SurfaceId>("web");
  const [actorId, setActorId] = useState<ActorId>("human");
  const [resetAfter, setResetAfter] = useState(true);
  const [reported, setReported] = useState<{ key: string; type: InteractionType } | null>(null);
  const [localeKnown, setLocaleKnown] = useState(true);
  const [selectedKey, setSelectedKey] = useState(DEFAULT_KEY);
  const [log, setLog] = useState<LogItem[]>([]);
  const [seq, setSeq] = useState(1);
  const [copied, setCopied] = useState(false);

  const locale = LOCALES[localeId];
  const actor = getActor(actorId);
  const part = resolvePart(selectedKey, localeId);
  const reportedType = reported?.key === selectedKey ? reported.type : null;
  const checks = conformance(part, localeId, surface, reportedType, localeKnown);

  const page = PAGE_COPY[localeId];
  const code = useMemo(
    () =>
      emitCode({
        surface,
        part,
        localeId,
        interactionType: surface === "headless" ? "mcp-tool-call" : reportedType,
        localeKnown,
      }),
    [surface, part, localeId, reportedType, localeKnown],
  );

  function selectSurface(next: SurfaceId) {
    setSurface(next);
    if (next === "headless") setActorId("agent-headless");
    else if (actorId === "agent-headless") setActorId("agent-tool");
  }

  function selectActor(next: ActorId) {
    const nextActor = getActor(next);
    if (nextActor.headless) setSurface("headless");
    else if (surface === "headless") setSurface("web");
    setActorId(next);
  }

  function push(item: Omit<LogItem, "id">) {
    setLog((current) => [{ ...item, id: seq }, ...current].slice(0, 8));
    setSeq((n) => n + 1);
  }

  function activate(key: string, via: string) {
    const target = resolvePart(key, localeId);
    const stale = reported?.type === "mcp-tool-call" && actor.interactionType === "interaction";
    const interactionType: InteractionType = stale ? "mcp-tool-call" : actor.interactionType;
    const retain = actor.id === "agent-tool" ? !resetAfter : stale;
    setReported(retain ? { key, type: interactionType } : null);
    setSelectedKey(key);
    push({
      actor: actor.label,
      interactionType,
      reference: target.reference,
      via,
      label: target.name.label,
      lang: target.name.lang,
      stale,
      note: stale
        ? "Inherited a stale mcp-tool-call. The surface does not verify it."
        : actor.id === "agent-tool" && resetAfter
          ? "Reported, then cleared. The attribute is not left on the element."
          : undefined,
    });
  }

  function submitForm() {
    const target = resolvePart("meridian.form.request-demo", localeId);
    const cleared = reported?.type === "mcp-tool-call" && actor.interactionType === "interaction";
    if (actor.id === "agent-tool" && !resetAfter) setReported({ key: target.key, type: "mcp-tool-call" });
    else setReported(null);
    setSelectedKey(target.key);
    push({
      actor: actor.label,
      interactionType: actor.interactionType,
      reference: target.reference,
      via: "form layer on submit",
      label: target.name.label,
      lang: target.name.lang,
      stale: false,
      note: cleared ? "Explicit write. Cleared the stale value." : "The button click path was not required.",
    });
  }

  function callTool(notation: string) {
    const capability = capabilityFor(notation);
    if (!capability) return;
    const selected = resolvePart(selectedKey, localeId);
    const match = PLACEMENTS.find((item) => item.notation === notation);
    if (!match && selected.concept.notation !== notation) return;
    const key = selected.concept.notation === notation ? selected.key : placementKey(match!);
    const target = resolvePart(key, localeId);
    const description = descriptionFor(target, localeKnown);
    setSelectedKey(key);
    push({
      actor: "Agent via tool, headless",
      interactionType: "mcp-tool-call",
      reference: target.reference,
      via: `canonical event · ${capability.name}`,
      label: description,
      lang: localeKnown ? target.name.lang : LOCALES.en.tag,
      stale: false,
      note: localeKnown
        ? "UI untouched. No accessible name on a headless call."
        : "Locale unknown. The description is the default-locale label, not the notation.",
    });
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id="studio" className="scroll-mt-6 py-10" aria-labelledby="studio-title">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs tracking-wide text-brass">01</p>
          <h2 id="studio-title" className="font-serif text-3xl text-bone sm:text-4xl">
            Studio
          </h2>
        </div>
        <p className="max-w-md text-sm text-mute">
          Spec {CANON_VERSION}. The canon is the JSON document. This page only emits it.
        </p>
      </div>

      <div className="studio-grid">
        <div className="flex min-w-0 flex-col gap-6">
          <fieldset>
            <legend className="mb-2 font-mono text-xs tracking-wide text-mute">Locale</legend>
            <div className="flex flex-wrap gap-2">
              {LOCALE_ORDER.map((id) => (
                <Dial key={id} pressed={localeId === id} onClick={() => setLocaleId(id)}>
                  {LOCALES[id].native}
                </Dial>
              ))}
            </div>
            <p className="mt-2 font-mono text-xs text-mute">
              {locale.tag} · {locale.dir} · fallback {locale.fallback ?? "none"}
            </p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-mono text-xs tracking-wide text-mute">Surface</legend>
            <div className="flex flex-wrap gap-2">
              {SURFACES.map((item) => (
                <Dial key={item.id} pressed={surface === item.id} onClick={() => selectSurface(item.id)}>
                  {item.label}
                </Dial>
              ))}
            </div>
            <p className="mt-2 font-mono text-xs text-mute">{SURFACES.find((item) => item.id === surface)?.file}</p>
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-mono text-xs tracking-wide text-mute">Actor</legend>
            <div className="flex flex-wrap gap-2">
              {ACTORS.map((item) => (
                <Dial key={item.id} pressed={actorId === item.id} onClick={() => selectActor(item.id)}>
                  {item.short}
                </Dial>
              ))}
            </div>
            <p className="mt-2 text-sm text-mute">{actor.how}</p>
          </fieldset>

          {surface !== "headless" ? (
            <fieldset>
              <legend className="mb-2 font-mono text-xs tracking-wide text-mute">After a tool call</legend>
              <Dial pressed={resetAfter} onClick={() => setResetAfter((value) => !value)}>
                {resetAfter ? "Reset interaction type" : "Leave it stuck"}
              </Dial>
              <p className={clsx("mt-2 text-sm", resetAfter ? "text-mute" : "text-warn")}>
                {resetAfter
                  ? "The tool reports mcp-tool-call, then removes the attribute."
                  : "The next human click inherits mcp-tool-call. The surface does not check it."}
              </p>
              {reported ? (
                <button
                  type="button"
                  className="mt-2 min-h-11 font-mono text-xs text-brass underline-offset-2 hover:underline"
                  onClick={() => setReported(null)}
                >
                  Clear stuck value
                </button>
              ) : null}
            </fieldset>
          ) : (
            <fieldset>
              <legend className="mb-2 font-mono text-xs tracking-wide text-mute">Agent locale</legend>
              <Dial pressed={localeKnown} onClick={() => setLocaleKnown((value) => !value)}>
                {localeKnown ? "Locale known" : "Locale unknown"}
              </Dial>
              <p className="mt-2 text-sm text-mute">
                {localeKnown
                  ? "The capability description is a label. There is still no accessible name."
                  : "The description stays the default-locale label. It does not become the notation."}
              </p>
            </fieldset>
          )}
        </div>

        <div className="min-w-0">
          <div className="notation-rail mb-3" aria-label="References">
            {PLACEMENTS.map((placement) => {
              const key = placementKey(placement);
              const short = placement.instanceId
                ? `${placement.notation.split(".").slice(-1)[0]}#${placement.instanceId}`
                : placement.rank != null
                  ? `result@${placement.rank}`
                  : placement.notation.split(".").slice(-2).join(".");
              return (
                <button
                  key={key}
                  type="button"
                  title={key}
                  aria-pressed={selectedKey === key}
                  onClick={() => setSelectedKey(key)}
                  className={clsx(
                    "min-h-11 shrink-0 whitespace-nowrap px-2.5 font-mono text-xs transition-colors",
                    selectedKey === key ? "bg-brass text-ink" : "bg-ink-2 text-bone hover:bg-ink-3",
                  )}
                >
                  {short}
                </button>
              );
            })}
          </div>

          {surface !== "headless" ? (
            <p className="mb-2 font-mono text-xs text-mute">
              canon {CANON_VERSION}
              {reported ? (
                <>
                  {" "}
                  · data-interaction-type=
                  <span className={reported.type === "mcp-tool-call" && actor.interactionType === "interaction" ? "text-warn" : "text-brass"}>
                    {reported.type}
                  </span>{" "}
                  on {reported.key}
                </>
              ) : (
                " · interaction type unset"
              )}
              {locale.dir === "rtl" ? " · dir=rtl on the page" : ""}
            </p>
          ) : (
            <p className="mb-2 font-mono text-xs text-mute">No rendered UI. No accessibility tree. The agent calls a tool.</p>
          )}

          {surface === "headless" ? (
            <HeadlessTools
              localeId={localeId}
              localeKnown={localeKnown}
              selectedNotation={part.concept.notation}
              onCall={callTool}
            />
          ) : (
            <div
              className={clsx(
                surface !== "web" && "mx-auto max-w-sm bg-ink-2 p-3",
                surface === "ios" ? "rounded-3xl" : surface === "android" ? "rounded-xl" : "",
              )}
            >
              {surface !== "web" ? (
                <p className="mb-2 px-1 font-mono text-xs text-mute">
                  {surface === "ios" ? "accessibilityIdentifier is the notation" : "testTag is the notation"}
                </p>
              ) : null}
              <div className={clsx(surface === "web" && "sheet-shadow")}>
                <SurfacePage
                  localeId={localeId}
                  headline={page.headline}
                  dek={page.dek}
                  emailLabel={page.email}
                  resultsLabel={page.results}
                  rankLabel={page.rank}
                  reported={reported}
                  selectedKey={selectedKey}
                  onActivate={activate}
                  onInspect={setSelectedKey}
                  onSubmit={submitForm}
                />
              </div>
            </div>
          )}

          <div className="mt-4" aria-live="polite">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="font-mono text-xs tracking-wide text-mute">Events</h3>
              <span className="font-mono text-xs text-mute tabular-nums">{log.length}</span>
            </div>
            {log.length === 0 ? (
              <p className="border-t border-line py-3 text-sm text-mute">No events yet. Activate the surface, or call a tool.</p>
            ) : (
              <ol className="border-t border-line">
                {log.map((item) => (
                  <li key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 border-b border-line py-2">
                    <span className="font-mono text-xs text-mute tabular-nums">{String(item.id).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-bone break-all">
                        <span className={item.stale ? "text-warn" : "text-brass"}>{item.interactionType}</span>
                        {" · "}
                        {item.reference}
                      </p>
                      <p className="text-sm text-mute">
                        {item.actor} · {item.via} · {item.label} · {item.lang}
                      </p>
                      {item.note ? <p className="text-sm text-warn">{item.note}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <aside className="min-w-0 bg-ink-2 p-4" aria-label="Emission">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-mono text-xs tracking-wide text-mute">Emission</h3>
              <p className="font-mono text-sm text-brass break-all">{part.reference}</p>
            </div>
            <button type="button" onClick={copyCode} className="min-h-11 shrink-0 font-mono text-xs text-bone hover:text-brass">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <dl className="mb-4 grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-mute">cardinality</dt>
            <dd className="text-bone">{part.concept.cardinality}</dd>
            <dt className="text-mute">notation</dt>
            <dd className="text-bone break-all">{part.concept.notation}</dd>
            <dt className="text-mute">instance</dt>
            <dd className="text-bone break-all">
              {part.placement.instanceId ?? (part.concept.ephemeral ? "omitted" : "none")}
            </dd>
            <dt className="text-mute">type label</dt>
            <dd className="text-bone">{part.typeLabel.label}</dd>
            <dt className="text-mute">{surface === "headless" ? "description" : "accessible name"}</dt>
            <dd className="text-bone">{surface === "headless" ? descriptionFor(part, localeKnown) : part.name.label}</dd>
            <dt className="text-mute">lang / dir</dt>
            <dd className="text-bone">
              {part.name.lang} · {part.name.dir}
            </dd>
          </dl>

          <ul className="mb-4 flex flex-col gap-2">
            {checks.map((check) => (
              <li key={check.id} className="flex gap-2 text-sm">
                <span className={clsx("font-mono text-xs", check.pass ? "text-brass" : "text-warn")}>{check.pass ? "Pass" : "Fail"}</span>
                <span className="text-mute">{check.detail}</span>
              </li>
            ))}
          </ul>

          {part.concept.element === "a" && part.concept.role === "button" ? (
            <p className="mb-3 text-sm text-mute">The HTML element is an anchor. The canon role is button. Consumers share the notation, not the tag.</p>
          ) : null}

          <pre className="max-w-full overflow-x-auto bg-ink p-3 font-mono text-xs leading-relaxed text-bone">{code}</pre>
          <p className="mt-3 text-sm text-mute">{actor.sees} The surface does not verify interactionType.</p>
          <p className="sr-only" aria-live="polite">
            {part.reference}, {part.name.label}, {surface}
          </p>
        </aside>
      </div>
    </section>
  );
}

function Dial({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={clsx(
        "min-h-11 px-3 py-2 text-left font-mono text-sm transition-colors",
        pressed ? "bg-brass-deep text-ink" : "bg-transparent text-bone ring-1 ring-line ring-inset hover:ring-brass",
      )}
    >
      {children}
    </button>
  );
}

function HeadlessTools({
  localeId,
  localeKnown,
  selectedNotation,
  onCall,
}: {
  localeId: LocaleId;
  localeKnown: boolean;
  selectedNotation: string;
  onCall: (notation: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2 border border-line bg-ink-2 p-3">
      {CAPABILITIES.map((capability) => {
        const sample = PLACEMENTS.find((item) => item.notation === capability.notation);
        const resolved = sample ? resolvePart(placementKey(sample), localeId) : null;
        const description = resolved ? (localeKnown ? resolved.typeLabel.label : resolved.concept.labels.en) : capability.name;
        const active = selectedNotation === capability.notation;
        return (
          <li key={capability.name} className={clsx("flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between", active ? "bg-ink-3" : "bg-ink")}>
            <div className="min-w-0">
              <p className="font-mono text-sm text-brass">{capability.name}</p>
              <p className="text-sm text-bone">{description}</p>
              <p className="font-mono text-xs text-mute break-all">{capability.notation}</p>
            </div>
            <button type="button" onClick={() => onCall(capability.notation)} className="min-h-11 shrink-0 bg-brass-deep px-4 font-mono text-sm text-ink">
              Call tool
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SurfacePage({
  localeId,
  headline,
  dek,
  emailLabel,
  resultsLabel,
  rankLabel,
  reported,
  selectedKey,
  onActivate,
  onInspect,
  onSubmit,
}: {
  localeId: LocaleId;
  headline: string;
  dek: string;
  emailLabel: string;
  resultsLabel: string;
  rankLabel: string;
  reported: { key: string; type: InteractionType } | null;
  selectedKey: string;
  onActivate: (key: string, via: string) => void;
  onInspect: (key: string) => void;
  onSubmit: () => void;
}) {
  const locale = LOCALES[localeId];
  const plans = ["sku-starter", "sku-growth", "sku-enterprise"] as const;

  function partFor(key: string) {
    return resolvePart(key, localeId);
  }

  function propsFor(key: string) {
    const type = reported?.key === key ? reported.type : null;
    return canonDom(partFor(key), localeId, type);
  }

  function marker(key: string) {
    return selectedKey === key ? "outline outline-2 outline-offset-2 outline-brass" : "";
  }

  const planType = partFor("meridian.card.plan#sku-starter").typeLabel;

  return (
    <div lang={locale.tag} dir={locale.dir} data-canon-version={CANON_VERSION} className="bg-paper px-4 py-5 text-paper-ink @container sm:px-6">
      <nav
        {...propsFor("meridian.nav.primary")}
        onClick={() => onInspect("meridian.nav.primary")}
        className={clsx("mb-8 flex flex-wrap items-center gap-x-4 gap-y-2", marker("meridian.nav.primary"))}
      >
        <span className="font-serif text-lg">{BRAND}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {(["route-product", "route-pricing", "route-customers"] as const).map((id) => {
            const key = `meridian.link.nav#${id}`;
            return (
            <a
              key={key}
              href={`#${id}`}
              {...propsFor(key)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onActivate(key, "nav");
              }}
              className={clsx("inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline", marker(key))}
            >
              {partFor(key).name.label}
            </a>
            );
          })}
        </div>
      </nav>

      <div className="mb-8 max-w-xl">
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{headline}</h1>
        <p className="mt-3 text-base text-paper-mute">{dek}</p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <a
            href="#get-demo"
            {...propsFor("meridian.button.get-demo")}
            onClick={(event) => {
              event.preventDefault();
              onActivate("meridian.button.get-demo", "hero");
            }}
            className={clsx("inline-flex min-h-11 items-center bg-ink px-4 text-paper", marker("meridian.button.get-demo"))}
          >
            {partFor("meridian.button.get-demo").name.label}
          </a>
          <a
            href="#overview"
            {...propsFor("meridian.link.overview")}
            onClick={(event) => {
              event.preventDefault();
              onActivate("meridian.link.overview", "hero");
            }}
            className={clsx("inline-flex min-h-11 items-center text-sm underline underline-offset-4", marker("meridian.link.overview"))}
          >
            {partFor("meridian.link.overview").name.label}
          </a>
        </div>
      </div>

      <h2 className="mb-3 font-serif text-xl" lang={planType.lang} dir={planType.dir}>
        {planType.label}
      </h2>
      <div className="paper-cards mb-8">
        {plans.map((id) => {
          const key = `meridian.card.plan#${id}`;
          const resolved = partFor(key);
          return (
            <article key={id} className="border border-paper-line p-3">
              <a
                href={`#${id}`}
                {...propsFor(key)}
                onClick={(event) => {
                  event.preventDefault();
                  onActivate(key, "plans");
                }}
                className={clsx("inline-flex min-h-11 items-center font-serif text-lg underline-offset-2 hover:underline", marker(key))}
              >
                {resolved.name.label}
              </a>
              {resolved.detail ? (
                <p className="mt-1 text-sm text-paper-mute" lang={resolved.detail.lang} dir={resolved.detail.dir}>
                  {resolved.detail.label}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <h2 className="mb-2 font-serif text-xl">{resultsLabel}</h2>
      <ul className="mb-8 border-t border-paper-line">
        {([1, 2] as const).map((rank) => {
          const key = `meridian.list.result@${rank}`;
          const resolved = partFor(key);
          return (
            <li key={rank} className="flex items-center justify-between gap-3 border-b border-paper-line">
              <a
                href={`#result-${rank}`}
                {...propsFor(key)}
                onClick={(event) => {
                  event.preventDefault();
                  onActivate(key, "results");
                }}
                className={clsx("inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline", marker(key))}
              >
                {resolved.name.label}
              </a>
              <span className="font-mono text-xs text-paper-mute tabular-nums">
                {rankLabel} {rank}
              </span>
            </li>
          );
        })}
      </ul>

      <form
        {...propsFor("meridian.form.request-demo")}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        onClick={() => onInspect("meridian.form.request-demo")}
        className={clsx("border-t border-paper-line pt-5", marker("meridian.form.request-demo"))}
      >
        <p id={FORM_LABEL_ID} className="font-serif text-xl">
          {partFor("meridian.form.request-demo").name.label}
        </p>
        <label className="mt-3 block text-sm text-paper-mute">
          {emailLabel}
          <input
            type="email"
            name="email"
            autoComplete="off"
            placeholder="you@meridian.dev"
            onClick={(event) => event.stopPropagation()}
            className="mt-1 block min-h-11 w-full border border-paper-line bg-paper px-3 text-base text-paper-ink"
          />
        </label>
        <button
          type="submit"
          {...propsFor("meridian.button.submit")}
          onClick={(event) => event.stopPropagation()}
          className={clsx("mt-3 inline-flex min-h-11 items-center bg-ink px-4 text-paper", marker("meridian.button.submit"))}
        >
          {partFor("meridian.button.submit").name.label}
        </button>
      </form>

      <p className="mt-6">
        <a
          href="#enterprise"
          {...propsFor("meridian.link.enterprise")}
          onClick={(event) => {
            event.preventDefault();
            onActivate("meridian.link.enterprise", "footer");
          }}
          className={clsx("inline-flex min-h-11 items-center text-sm underline underline-offset-4", marker("meridian.link.enterprise"))}
        >
          {partFor("meridian.link.enterprise").name.label}
        </a>
      </p>
    </div>
  );
}
