# Canon plugin: PostHog (privacy-first web analytics)

**Status:** Draft, non-normative. Does not change the specification (draft 0.2) or `canon.schema.json`.
**Applies to:** canon-governed web surfaces that want PostHog product analytics without cookies and without sending
visitor IP addresses to PostHog.
**Manifest:** [plugin.json](plugin.json) (each claim about PostHog carries its evidence class).
**Contract:** [../CONTRACT.md](../CONTRACT.md).

Canon names the part. PostHog counts it. This plugin derives PostHog event names and event properties from the
identities a surface already emits (`data-element`, `data-instance`, `<meta name="canon">`), so nothing is named twice.

| Piece | Path | What it is |
|---|---|---|
| Web client | [client/canon-posthog.js](client/canon-posthog.js) | loads posthog-js with privacy defaults that cannot be overridden, and emits the event taxonomy below |
| Proxy pattern | [proxy/README.md](proxy/README.md), [proxy/strip-ip-proxy.mjs](proxy/strip-ip-proxy.mjs) | a first-party endpoint that forwards to PostHog without the visitor IP |
| Static check | [check.mjs](check.mjs) | drift check over a built site: exit 0 / 1 / 2 per the contract |
| Tests | `scripts/posthog-plugin.test.mjs` | check, proxy and client; every rule is shown to fail on a bad input |

Nothing in this directory holds a project key, a hostname, a project id or any organisation's data. Those are
configuration on the adopting surface.

## 1. Rules

1. **Visitor IPs never reach PostHog.** posthog-js talks only to a first-party host you run (section 4). The client
   refuses to start when `apiHost` is a PostHog-owned host, unless the surface sets `allowDirectHost: true` and takes
   the rule on itself.
2. **No cookies.** posthog-js persistence is `sessionStorage` (default) or `memory`. Any other value, from any option,
   is replaced.
3. **Replay masks every input** (`session_recording.maskAllInputs: true`, forced). Replay can be turned off with
   `replay: false`.
4. **Anonymous visitors stay anonymous** (`person_profiles: 'identified_only'`, forced). The client never calls
   `identify`.
5. **The visitor can opt out.** `?canon-optout=1` stores an opt-out in this browser and loads nothing;
   `?canon-optout=0` clears it. The parameter name is configurable.
6. **Do Not Track and Global Privacy Control are respected** by default (`respectDoNotTrack: false` turns it off).
7. **No personal data in events** (spec section 6). Click properties are canon identities, never label text, visible
   text, form values, copied text, email addresses or phone numbers. A `mailto:` or `tel:` click is recorded as a
   channel (`email`, `phone`), never the address.
8. **Group by notation** (spec section 11). Clicks carry the notation as `canon_element` and the instance as a separate
   `canon_instance`. Neither the label nor `data-id` is a key.
9. **No silent loss.** Calls queue inside the client until posthog-js hands back its live instance through the
   documented `loaded` callback. The snippet placeholder is used only for `init`. If posthog-js never loads (blocked,
   offline, CSP), the queue is dropped after `loadTimeoutMs` and counted: `CanonPostHog.status()` returns
   `{ status, reason, queued, sent, dropped }`.

## 2. Install

Copy `client/canon-posthog.js` into the surface's static files (no package is published, spec section 9). Then either
let it start itself from its script tag:

```html
<script defer src="/canon-posthog.js" data-key="<project key>" data-api-host="https://<your first-party host>"></script>
```

or start it with options from a script that runs after it (both `defer`, in this order):

```html
<script defer src="/canon-posthog.js" data-autostart="false"></script>
<script defer src="/analytics-config.js"></script>   <!-- calls CanonPostHog.start({...}) -->
```

The project key (`phc_...`) is a public, write-only ingestion key. A personal API key (`phx_...`) is a secret and never
belongs in a page; the static check fails on one.

Content Security Policy: allow the first-party host in `script-src` and `connect-src`, and `blob:` in `worker-src` if
replay is on.

## 3. Event taxonomy

Every event carries `canon` (the surface's declared `prefix@version`) plus whatever `baseProperties()` returns.

| Kind | Default name | When | Properties | From the canon? |
|---|---|---|---|---|
| `click` | `canon:click` | a click on a part with `data-element` | `canon_element`, `canon_instance` (repeating parts), `canon_type` (middle segment), `canon_prefix`, `section` | yes: notation, instance, type, prefix |
| `outbound` | `canon:outbound` | a link to another host | `host`, `url` (host + path, no query), `file` if a document, plus the click identity if the link has one | identity if present |
| `contact` | `canon:contact` | a `mailto:` or `tel:` link | `channel` (`email` or `phone`), plus identity if present. Never the address | identity if present |
| `download` | `canon:download` | a same-host link to a document (`downloadPattern`) | `file` (path), plus identity | identity if present |
| `sectionView` | `canon:section-view` | a section at least half visible for `sectionVisibleMs` | `section` | no: page structure (`sectionSelector`, `sectionKey`) |
| `scrollDepth` | `canon:scroll-depth` | first time past each of `scrollMarks` | `depth` | no |
| `pageTime` | `canon:page-time` | page hidden or left (sent by beacon) | `seconds` (engaged), `bucket`, `max_scroll` | no |
| `articleRead` | `canon:article-read` | article scrolled to 75 % with half its reading time engaged | `article`, `words`, `seconds` | no (`article()` option) |
| `landing` | `canon:landing` | first page of a tab session | `entry_page`, `ref_host`, `ref_path`, UTM keys, `viewport`; also registered for the session | no |
| `copy` | `canon:copy` | text copied | `kind` (`email`, `phone`, `text`), `length`. Never the text | no |
| `print` | `canon:print` | the page is printed | none | no |

posthog-js's own `$pageview` (on history change), `$pageleave` and autocapture stay on by default and can be changed
through the `posthog` option (not the privacy keys).

A surface that already has event names keeps them: `names` maps a kind to a string, or to a function of the context
(`{ el, href, url, host, channel, file, section, article }`) that returns a name, or `''` to skip the event.
`transform(kind, ctx, props)` adds or renames properties (`kind` is also `'session'` for the session-registered
properties). A part with no notation is a click only when `names.click` is a function. `CanonPostHog.capture(name,
props)` sends a surface-specific event through the same queue and rules.

## 4. Proxy: what reaches PostHog

See [proxy/README.md](proxy/README.md). In short: a host you own terminates TLS and forwards to PostHog with an
allowlist of request headers (no `X-Forwarded-For` or any client-address header), deletes `$ip` from every event,
sets `$geoip_disable` (PostHog would otherwise geolocate the proxy), and writes no access log. PostHog still sees the
**proxy's** address as the connection source; turn on PostHog's project setting to discard client IP data if that
should not be stored either (`documented`, not verified here). If the surface wants location, the proxy can look the
visitor IP up locally and add coarse properties (city, region, country) before forwarding, then drop the IP.

## 5. Check

```bash
node spec/plugins/posthog/check.mjs --canon <canon.json> --dist <built site>
```

Static layer only (no network). It reads every built page and reports `module_missing`, `direct_host`,
`personal_key`, `cookie_persistence`, `unknown_notation` and `deprecated_emitted`. Exit 2 (did not run) on a missing
or unreadable canon, a missing directory or no pages.

**What it cannot see:** runtime-created elements, options passed to `CanonPostHog.start` from an external script,
whether the first-party host really strips the IP (test the proxy, section 4), and anything in PostHog itself. There is
no live layer.

## 6. What is not claimed

- That posthog-js honours each option exactly as documented. The client sets them; the manifest marks each as
  `documented`. Only the proxy's IP removal and the client's queue, opt-out and refusal logic are `tested` here, and
  the client tests run against a simulated browser, not posthog-js itself.
- That this taxonomy is complete for every surface. It is the part derivable from a canon plus common page signals.
