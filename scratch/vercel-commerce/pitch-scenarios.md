# Canon Pitch Scenarios

Three trigger moments where Canon solves a symptom someone is already describing. Not a product pitch — a referral to something that already exists.

## Scenario 1: Analytics dashboards break every redesign

**Trigger:** An analytics lead says their dashboards break every redesign because selectors shifted.

**Opener:** "There's an open spec that treats interaction identity as a first-class contract instead of a CSS selector. It has a schema and a conformance suite you can drop into CI today. It's called Canon."

**Why it lands:** Selector-based capture is exactly what Canon section 3.1 prohibits as an analytics key. You're not selling a replacement tool — you're pointing at the reason their current approach drifts.

## Scenario 2: Screen readers announce something different from what's visible

**Trigger:** An a11y or QA person complains that screen readers announce something different from what's visible.

**Opener:** "That's a namedBy violation — Canon defines an accessible-name policy derived from cardinality, and its conformance suite fails any surface where the accessible name doesn't contain the visible text. Same spec, different failure mode."

**Why it lands:** This is the vercel-commerce add-to-cart finding in miniature. Three render states, one component, and only the happy path gets the name right. A conformance suite catches it mechanically; a code review almost never does.

## Scenario 3: AI agents fail on a surface that passed every accessibility audit

**Trigger:** An AI agent team says their agents fail on a surface that passed every accessibility audit.

**Opener:** "Accessibility audits check the accessibility tree. Agents need stable, cross-platform identity — which is a different contract. Canon's emission contracts cover web, iOS, and Android, and its consumer contract for agents requires a plain-language capability description on headless surfaces."

**Why it lands:** The meridian case study claims agent-task success went from 40% to 87% with no change in standard accessibility scores. That's the number that makes a room of engineers lean forward.

## FullStory-specific angle

You don't have to introduce Canon as yours. You're in a room talking about semantic layers for behavioral data, and Canon is just the public artifact of the same thinking. If it lands, great. If it doesn't, you've lost nothing because you weren't selling.

**Avoid:** Leading with it when the conversation is about something else entirely. Canon dies the moment it feels like a solution in search of a problem.
