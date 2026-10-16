# Semantic Surface Taxonomy Specification

**Status:** Draft  
**Version:** 0.2  
**Date:** 16 October 2026

## Abstract

This specification defines a vendor-neutral method for digital surfaces (web, mobile, and headless) to name and describe their interactive parts so that humans, assistive technologies, analytics systems, test frameworks, and agents resolve the same identities. It is a methodology and a thin format, not a library or runtime. Conformance is defined by the rules below and demonstrated by the accompanying conformance suite. No shared code is required.

## 1. Identity model

Three layers are distinguished.

### 1.1 Concept

A concept is identified by a **notation**.

- Notations are lowercase, ASCII, dot-namespaced segments (example: `acme.button.get-demo`).
- Maximum length: 50 characters.
- Every notation begins with a surface-owned prefix so independently authored canons cannot collide.
- Once published, a notation is immutable. It may be deprecated but is never renamed or reused.
- Deprecation names a successor in `replacedBy`. The successor must exist and must not itself be deprecated. History stays on the old notation.

### 1.2 Label

Each concept carries multilingual **preferred labels** (exactly one per BCP 47 language tag the canon supplies, and always one in the canon’s default locale). Labels are the type-level human-readable names. They are never used as machine keys.

Repeated parts of one type share one notation. Three navigation links are instances of one concept, not three concepts.

### 1.3 Instance

A specific occurrence of a concept is identified by an **instance identifier**.

- Instance identifiers follow the same ASCII character rules as notations but contain no dots.
- The full reference is `notation#instance` (example: `acme.card.plan#enterprise`).
- An instance identifier must be unique only within its concept on a given surface.
- Instance identifiers are taken from a stable source-of-truth record (CMS entry ID, SKU, route identifier, or equivalent). They are never derived from rendered content or visual position. A title slug is permitted only when no record identifier exists and is marked less stable.
- An instance identifier is never reassigned to a different entity. The same entity carries the same instance identifier on every surface that presents it.
- Ephemeral items (search-result rows, transient lists) omit the instance identifier; rank or position is carried as a property instead.
- User-owned records (saved addresses, orders, personal lists) omit the instance identifier under the privacy rule (Section 6).

Instance content (the specific name shown to the user) is kept separate from both the notation and the type label.

## 2. Accessible-name policy

Accessible-name computation is derived from the cardinality declared on the concept. Cardinality is scoped to a page or screen, not to the entire surface. A surface that emits a singleton more than once on that page does not conform.

- A concept declared **singleton** (once per page/screen) has no instances. Its preferred label is the accessible name.
- A concept declared **repeating** requires an instance name. That instance name is the accessible name.

The policy defers to platform accessibility standards: WCAG 2.5.3 or the platform’s equivalent guidance. The accessible name must contain the visible label text. Where a conflict would arise, the visible label text takes precedence.

If the visible text is already the accessible name, the surface does not also set `aria-label`, `accessibilityLabel`, or `contentDescription`. Those properties are set only when the accessible name is not carried by visible text, such as a landmark with no visible name. When they are set, they contain the visible label text.

Headless surfaces have no accessibility tree and therefore no accessible name. For those surfaces the capability description supplies the equivalent information to agents. The description is a preferred label or an instance name. It is never the notation. When the agent locale is unknown, the description is the label in the canon’s default locale.

## 3. Emission contract

Every surface emits the following for each interactive part, resolved for the active locale:

| Surface | Notation | Instance | Accessible name / equivalent | Language / direction | interactionType |
|---------|----------|----------|------------------------------|----------------------|-----------------|
| Web | `data-element` | `data-instance` | visible text, or `aria-label` when there is no visible name | `lang` and `dir` only when they differ from the page | `data-interaction-type` while a report is current |
| iOS | `accessibilityIdentifier` | custom content `instanceIdentifier` | visible label; `accessibilityLabel` only when it differs | `accessibilityLanguage` only on a mismatch | custom content `interactionType`, removed on reset |
| Android | `testTag` | semantics property `InstanceIdentifier` | visible text; `contentDescription` only when it differs | a locale override only on a mismatch | semantics property `InteractionType`, removed on reset |
| Headless | tool notation | argument, when the concept repeats | capability description | default locale when the agent locale is unknown | `mcp-tool-call` |

`interactionType` is `interaction` or `mcp-tool-call`. It is written when an actor reports an action and removed when that actor resets it. It is not a static property of the element. A missing value means no report is current. The surface does not verify the report. Consumers may ignore it.

### 3.1 `data-id` is not reused

Many surfaces already use `data-id` as a component identifier or an analytics identifier. This specification does not use `data-id`. The notation is `data-element`. The instance identifier is `data-instance`. An adopter that cannot add `data-instance` may choose another attribute, but must not store the instance identifier in `data-id`.

### 3.2 Mobile properties

On iOS the instance identifier is the explicit accessibility custom content key `instanceIdentifier`. It is not derived from the label, the frame, or `accessibilityIdentifier`. `accessibilityIdentifier` is only the notation.

On Android the instance identifier is the explicit semantics property `InstanceIdentifier`. `testTag` is only the notation.

`interactionType` uses the same pattern: iOS custom content `interactionType`, Android semantics property `InteractionType`. Both are absent when no report is current.

## 4. Canon format

A canon is a JSON document (YAML is equivalent) that declares the canon version, prefix, default locale, locales and fallbacks, concepts, notations, cardinality, preferred labels, instance records, deprecations, and capabilities. [spec/canon.schema.json](canon.schema.json) is normative. A canon that does not validate against that schema does not conform. CI may validate a canon with any JSON Schema implementation. No runner is required.

Supported locales, fallback chains, and directionality are declared in the canon.

## 5. Locale resolution

At runtime the surface selects the preferred label (and accessible name) for the active BCP 47 locale, falling back along the declared chain. A missing label must not produce an empty accessible name, and the fallback value must not be the notation.

`lang` and `dir` are emitted on a part only when they differ from the page or the platform locale. When they match, the page locale applies and the attributes are omitted.

## 6. Privacy

Labels, instance content, and properties must not contain personal data. The conformance check scans those strings. Surfaces that need to associate personal context do so outside the semantic surface.

## 7. Versioning

The specification and each canon carry version identifiers. A surface declares the canon version it emits. The declared version must equal the canon’s version. Consumers may reject or adapt to unknown versions.

## 8. Conformance

A surface conforms when:

- Every interactive part emits a notation that satisfies the grammar and is present in the declared canon.
- No deprecated notation is emitted. No notation is renamed or reused.
- A singleton occurs once on the page and has no instance identifier.
- Instance identifiers, when present, satisfy the source, lifetime, and omission rules.
- The accessible name is non-empty, contains the visible label text, and is not duplicated in `aria-label` when the visible text already is that name.
- Language and direction are indicated on the part only when they differ from the page, and then they match the resolved locale.
- No personal data appears in labels, instance content, or properties.
- A headless description is human text in a known or default locale, not a notation.
- The surface’s declared canon version equals the canon.
- The emitted identities match the conformance suite for that canon version.

The suite is in [spec/conformance/](conformance/). Fixtures are surface fragments plus a locale. Expected files record the resolution: notation, instance identifier when present, accessible name, language, and direction. Failure fixtures record which rule must fail. The suite is a specification artifact, not a runtime dependency. Teams may implement their own validators against it.

## 9. Distribution

The specification, JSON Schema, conformance suite, and non-normative case study are published as static documents under the MIT license. No package is published. Reference examples are explicitly non-normative.

The first non-normative annex is the marketing-site case study: a production surface decorated to this specification in which agent-task success rose from 40 % to 87 % while standard accessibility scores remained unchanged.

## 10. Governance

- The owner of a prefix approves changes to that canon.
- A published notation may be deprecated. It is not renamed and not reused. `replacedBy` names the successor and does not move history.
- This specification changes only by a new version of this document.
- No analytics, testing, or agent vendor is the steward.
- Version 0.2 does not appoint a permanent host. Until a later version names an independent domain or community group, these static documents are the draft.

## 11. Consumers

Each consumer honors a minimum contract and no more.

| Consumer | Must | Must not |
|----------|------|----------|
| Assistive technology | Use the accessible name. Honor `lang` and `dir` when set. | Speak the notation. |
| Analytics | Group by notation. Keep the instance as a separate property. | Use the label, the visible text, or `data-id` as the key. |
| Test frameworks | Select by notation. Use the instance id only to disambiguate repeats. | Select by copy, CSS structure, or position. |
| Agents | Call the capability for the notation. Read the description as human text. | Put the notation in the description, or invent an instance id for an ephemeral or personal record. |

## 12. Non-normative notes

- Generators, validators, and surface bindings are local artifacts a team may produce after adopting the specification. They are not required for conformance.
- The methodology is intended to be followed by both humans and LLMs when authoring or reviewing a canon.
- The example canon and the studio that renders it are not normative.
