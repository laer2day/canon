import { createFileRoute } from "@tanstack/react-router";
import { Brief } from "@/components/brief";
import { Studio } from "@/components/studio";

export const Route = createFileRoute("/")({ component: Home });

const NAV = [
  { href: "#studio", label: "Studio" },
  { href: "#identity", label: "Identity" },
  { href: "#cardinality", label: "Cardinality" },
  { href: "#emission", label: "Emission" },
  { href: "#actors", label: "Actors" },
  { href: "#conformance", label: "Conform" },
  { href: "#annex", label: "Annex" },
  { href: "#consumers", label: "Consumers" },
  { href: "#governance", label: "Governance" },
];

function Home() {
  return (
    <div className="min-h-screen bg-ink text-bone">
      <div className="h-1 bg-brass-deep" />
      <a className="skip-link" href="#studio">
        Skip to studio
      </a>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-line py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-serif text-2xl italic text-bone">Canon</p>
              <p className="font-mono text-xs tracking-wide text-mute">Semantic surface taxonomy</p>
            </div>
            <p className="font-mono text-xs text-mute">Draft 0.2 · 16 October 2026</p>
          </div>
          <nav aria-label="Sections" className="flex flex-wrap gap-x-1">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="inline-flex min-h-11 items-center px-2 font-mono text-xs text-mute hover:text-bone">
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        <section className="py-10 sm:py-14" aria-labelledby="thesis">
          <p className="font-mono text-xs tracking-wide text-brass">Spec 0.2</p>
          <h1 id="thesis" className="mt-2 max-w-4xl font-serif text-4xl leading-tight text-bone sm:text-6xl">
            Notation, label, instance.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-mute">
            A notation names the concept. A preferred label names it for people, in one language at a time. An instance identifier names a single occurrence. Web, iOS, Android, and headless emit that triple. No vendor owns it, and no package is required.
          </p>
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="border-t border-line pt-3">
              <dt className="font-serif text-lg text-bone">Concept</dt>
              <dd className="mt-1 text-sm text-mute">meridian.card.plan. Prefixed, dotted, immutable, at most 50 characters.</dd>
            </div>
            <div className="border-t border-line pt-3">
              <dt className="font-serif text-lg text-bone">Label</dt>
              <dd className="mt-1 text-sm text-mute">Plan, Offre, خطة, プラン. One preferred label per language. Never the key.</dd>
            </div>
            <div className="border-t border-line pt-3">
              <dt className="font-serif text-lg text-bone">Instance</dt>
              <dd className="mt-1 text-sm text-mute">meridian.card.plan#sku-growth. data-instance, not data-id. The accessible name, when the concept repeats.</dd>
            </div>
          </dl>
        </section>

        <Studio />
        <Brief />

        <footer className="border-t border-line py-10">
          <p className="max-w-prose text-mute">
            This is a reading of draft 0.1, not the specification itself. Meridian is fictional. Bindings in the emission panel are local examples. Conformance does not depend on them.
          </p>
          <p className="mt-3 font-mono text-xs text-mute">Missing labels fall back. They never leave the accessible name empty.</p>
        </footer>
      </div>
    </div>
  );
}
