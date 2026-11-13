# Canon glossary, in plain words

**Status:** Draft, non-normative. It explains the words Canon uses. It does not change the specification (draft 0.3), the schema or any CardinalCollege. Where this glossary and the specification disagree, the specification wins.

**Who this is for:** anyone who has to read a CardinalCollege, a plugin or a check and has never needed to know what a "notation" is. You do not need a technical background. Each term is defined in one or two plain sentences, then said more precisely if precision matters.

## The idea in one paragraph

An interactive thing on a digital product, such as a "Get a Demo" button, should have **one name that everything agrees on**: the person using it, a screen reader, the analytics tool, the tests, and an agent. The CardinalCollege is where that name is written down once. Every surface (the website, the iOS app, the Android app) then uses that one name, and anything specific to a tool is worked out from it, not written by hand beside it.

## Surfaces and CardinalColleges

**Surface.** One place where people (or agents) meet the product: the website, the iOS app, the Android app, or a set of tools an agent can call. The same product usually has several surfaces.

**CardinalCollege.** The single written-down list of everything on a product that has an agreed name, with the rules for each. It is a file (today, `spec/cardinal-colleges/<name>.json`). When two surfaces disagree about what a thing is, **the CardinalCollege decides, and the surfaces conform to it**. A surface never settles the question by changing the CardinalCollege to match itself.

## What a thing is called

**Cardinal.** A universal identity for a thing that can exist in multiple locations and across multiple surfaces. Anywhere it exists, it is the same thing. "The Get a Demo button" is a cardinal.

**Notation.** The cardinal's name as a computer reads it: a short, fixed piece of text such as `meridian.button.get-demo`. It is lowercase, has no spaces, and starts with a prefix that belongs to the product so that two products can never clash. **A notation is never changed once it is published.** If a better name is wanted, the old one is retired and points to a new one; it is not edited. A notation is a name for machines. It is not what a person reads.

**Label.** The words a person reads, in each language the product supports: "Get a Demo" in English, "Obtenir une démo" in French. A label can be reworded or translated without changing the cardinal. A label is never used to look a thing up; only the notation is.

**Instance.** One particular copy of something that appears many times. If a page has three plan cards (Starter, Growth, Enterprise), there is **one cardinal** (the plan card) and **three instances**. Each instance is identified by a stable record number or code from the business's own data, not by the words on the card and not by where it sits on the page.

**Cardinality.** *Not the same word as cardinal; do not confuse them.* The specification uses "cardinality" for a simple rule: a thing is either a **singleton** (it appears once per page or screen) or **repeating** (it appears more than once). A singleton has no instances. A repeating thing needs them.

## Where it is written

**Element location.** A place in a product's source code where an interactive element is written. It is identified by the file and the line where the element's opening tag starts. It is a pointer into the source, used to find things. It is not a name.

**Binding.** Where a cardinal is actually written onto a surface, for example the attribute on a web page or the identifier in an app. Bindings are kept in a **separate file for each surface, outside the specification**.

---

## A worked example

This uses the example CardinalCollege in `spec/cardinal-colleges/meridian.json`, which is a made-up product used for illustration. Its prefix is `meridian`.

**A singleton.** The "Get a Demo" button appears once on the home page.
- **Cardinal**: the demo button.
- **Notation:** `meridian.button.get-demo`.
- **Labels:** "Get a Demo" in English, "Obtenir une démo" in French.
- **Instance:** none, because it appears once.

**A repeating thing.** The home page shows three plan cards.
- **Cardinal:** the plan card. **Notation:** `meridian.card.plan`. **Label:** "Plan" in English, "Offre" in French.
- **Instances:** three, each with its own record code.

| Instance code | English name | French name |
|---|---|---|
| `sku-starter` | Starter | Essentiel |
| `sku-growth` | Growth | Croissance |
| `sku-enterprise` | Enterprise | Entreprise |

- The full reference to one card is the notation, a `#`, and the instance code: `meridian.card.plan#sku-growth`.
- The three cards are **one cardinal, three instances**. They are not three cardinals.
- If the French name "Croissance" were reworded tomorrow, the notation and the instance code would not change. Only the name would.
- **If the website and a mobile app disagreed** about whether "Growth" is a plan card or a different kind of thing, the CardinalCollege would say which, and both surfaces would change to match it.

## What this glossary does not claim

- It does not describe how bindings or element locations are stored. That is a decision for a later document.
- It is a draft. Check any term against the specification before relying on it for a precise question.
