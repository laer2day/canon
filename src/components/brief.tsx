import type { ReactNode } from "react";
import { ACTORS, CANON_PRETTY, CARDINALITY_RULES, CONSUMER_RULES, EMISSION_ROWS, IDENTITY_RULES } from "@/lib/canon";

export function Brief() {
  return (
    <>
      <Section
        id="identity"
        index="02"
        title="Three layers"
        lede="A concept, a label, and an instance are not the same string. The studio’s rail is the reference. The page is only the visible text."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {IDENTITY_RULES.map((rule) => (
            <li key={rule.title} className="border-t border-line pt-3">
              <h3 className="font-serif text-xl text-bone">{rule.title}</h3>
              <p className="mt-2 text-mute">{rule.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-prose text-mute">
          <span className="font-mono text-sm text-brass">meridian.link.demo</span> is deprecated in this canon. It is not renamed, and the notation is not given to anything else. The live control is meridian.button.get-demo.
        </p>
      </Section>

      <Section
        id="cardinality"
        index="03"
        title="Cardinality decides the accessible name"
        lede="Scoped to the page or screen, not the whole product. Headless surfaces have no accessibility tree, so the capability description does this job for agents."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          {CARDINALITY_RULES.map((rule) => (
            <li key={rule.title} className="border-t border-line pt-3">
              <h3 className="font-serif text-xl text-bone">{rule.title}</h3>
              <p className="mt-2 text-mute">{rule.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="emission"
        index="04"
        title="What each surface emits"
        lede="The same triple — notation, instance when there is one, and a localized name — on every carrier. interactionType is self-reported by the actor. Consumers may ignore it."
      >
        <ul className="border-t border-line">
          {EMISSION_ROWS.map((row) => (
            <li key={row.surface} className="grid gap-1 border-b border-line py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6">
              <h3 className="font-serif text-lg text-bone">{row.surface}</h3>
              <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
                <dt className="text-mute">notation</dt>
                <dd className="text-bone">{row.notation}</dd>
                <dt className="text-mute">instance</dt>
                <dd className="text-bone">{row.instance}</dd>
                <dt className="text-mute">name</dt>
                <dd className="text-bone">{row.name}</dd>
                <dt className="text-mute">language</dt>
                <dd className="text-bone">{row.lang}</dd>
                <dt className="text-mute">interaction</dt>
                <dd className="text-bone">{row.interaction}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="actors"
        index="05"
        title="Who reports the interaction"
        lede="A human click and a tool call can share a notation and an instance. They differ in interactionType. The surface records what the actor reports. It does not prove it."
      >
        <ul className="border-t border-line">
          {ACTORS.map((actor) => (
            <li key={actor.id} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6">
              <h3 className="font-serif text-lg text-bone">{actor.label}</h3>
              <div>
                <p className="text-bone">{actor.how}</p>
                <p className="mt-1 font-mono text-xs text-brass">{actor.interactionType}</p>
                <p className="mt-1 text-sm text-mute">{actor.sees}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="conformance"
        index="06"
        title="Conformance is a suite, not a runtime"
        lede="A surface conforms when the emitted identities match the canon version: grammar, instance rules, accessible names, language, direction, and privacy. The checks in the studio are one reading of that suite. Teams may write their own."
      >
        <pre className="max-w-full overflow-x-auto bg-ink-2 p-4 font-mono text-xs leading-relaxed text-bone">{CANON_PRETTY}</pre>
        <p className="mt-4 max-w-prose text-mute">
          That JSON is the canon, not a rendering of it. The schema is spec/canon.schema.json. The suite is spec/conformance. A check in this panel is the same function the suite runs, so a mismatched name, a second singleton, a deprecated notation, or a notation used as a description can fail.
        </p>
      </Section>

      <Section
        id="annex"
        index="07"
        title="Annex, non-normative"
        lede="A production marketing site decorated to this method. In a blind computer-use eval, task success rose from 6 of 15 to 13 of 15. Standard accessibility scores did not move."
      >
        <EvalRow label="Production" tasks={6} pct="40%" />
        <EvalRow label="Decorated" tasks={13} pct="87%" />
        <p className="mt-3 text-sm text-mute">Lighthouse accessibility stayed at 83 on both. The gain is invisible to that audit. The annex is not part of conformance.</p>
      </Section>

      <Section
        id="consumers"
        index="08"
        title="What a consumer must honor"
        lede="The minimum contract. Anything beyond it is that consumer’s business."
      >
        <ul className="border-t border-line">
          {CONSUMER_RULES.map((rule) => (
            <li key={rule.title} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6">
              <h3 className="font-serif text-lg text-bone">{rule.title}</h3>
              <div>
                <p className="text-bone">{rule.must}</p>
                <p className="mt-1 text-sm text-mute">{rule.mustNot}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="governance"
        index="09"
        title="Who may change it"
        lede="Version 0.2 does not appoint a permanent host. It does say who is not in charge."
      >
        <ul className="grid gap-4 sm:grid-cols-2">
          <li className="border-t border-line pt-3">
            <h3 className="font-serif text-xl text-bone">Prefix owner</h3>
            <p className="mt-2 text-mute">Approves changes to that canon. A published notation may be deprecated. It is not renamed and not reused.</p>
          </li>
          <li className="border-t border-line pt-3">
            <h3 className="font-serif text-xl text-bone">No vendor steward</h3>
            <p className="mt-2 text-mute">Analytics, test, and agent vendors may consume the canon. None of them own the specification. The text changes only by a new version.</p>
          </li>
        </ul>
      </Section>
    </>
  );
}

function Section({
  id,
  index,
  title,
  lede,
  children,
}: {
  id: string;
  index: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line py-14" aria-labelledby={`${id}-title`}>
      <div className="mb-8 max-w-3xl">
        <p className="font-mono text-xs tracking-wide text-brass">{index}</p>
        <h2 id={`${id}-title`} className="mt-1 font-serif text-3xl text-bone sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 text-mute">{lede}</p>
      </div>
      {children}
    </section>
  );
}

function EvalRow({ label, tasks, pct }: { label: string; tasks: number; pct: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-bone">{label}</span>
        <span className="font-mono text-sm text-brass tabular-nums">
          {tasks} of 15 · {pct}
        </span>
      </div>
      <div className="h-2 bg-ink-3" role="img" aria-label={`${label}: ${tasks} of 15 tasks, ${pct}`}>
        <div className="h-full bg-brass-deep" style={{ width: pct }} />
      </div>
    </div>
  );
}
