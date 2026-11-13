#!/usr/bin/env node
// Canon PostHog plugin: static drift check (draft, non-normative). No network.
//
//   node spec/plugins/posthog/check.mjs --canon <canon.json> --dist <built site directory>
//
// Reads every .html file under --dist and reports drift between what the plugin derives and what the surface ships:
//   module_missing      a page does not load the plugin client (a script whose src ends in canon-posthog.js)
//   direct_host         a script points posthog-js at a PostHog-owned host, so visitor IPs would reach PostHog
//   personal_key        a PostHog personal API key (phx_...) is in the page: a secret, never a client value
//   cookie_persistence  an inline script sets cookie-based posthog-js persistence
//   unknown_notation    a data-element value is not a cardinal in the CardinalCollege, so its events would carry an
//                       identity the CardinalCollege does not define
//   deprecated_emitted  a deprecated notation is emitted (its events would split history)
// Exit 0: ran, no drift. Exit 1: ran, drift found. Exit 2: did not run (missing or unreadable input). 2 is never a pass.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

function arg(name) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; }
function notRun(msg) { process.stderr.write(`posthog check did not run: ${msg}\n`); process.exit(2); }

const canonPath = arg('canon');
const dist = arg('dist');
if (!canonPath || !dist) notRun('usage: --canon <canon.json> --dist <dir>');
let canon;
try { canon = JSON.parse(readFileSync(canonPath, 'utf8')); } catch (e) { notRun(`cannot read canon ${canonPath}: ${e.message}`); }
if (Object.hasOwn(canon, 'concepts') || Object.hasOwn(canon, 'canon')) notRun(`canon ${canonPath} uses a pre-0.3 key (concepts or top-level canon); a CardinalCollege uses cardinals and version`);
if (!Array.isArray(canon?.cardinals) || !canon.cardinals.length) notRun(`canon ${canonPath} has no cardinals`);
if (typeof canon.version !== 'string' || !canon.version) notRun(`canon ${canonPath} has no version`);
if (!existsSync(dist) || !statSync(dist).isDirectory()) notRun(`no directory at ${dist}`);
const walk = (dir) => readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
const pages = walk(dist).filter((f) => f.endsWith('.html')).sort();
if (!pages.length) notRun(`no .html files under ${dist}`);

const cardinals = new Map(canon.cardinals.map((c) => [c.notation, c]));
const TAG = /<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const attr = (attrs, name) => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`));
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
};
const DIRECT = /^https?:\/\/([a-z0-9-]+\.)*posthog\.com(\/|$)/i;

const findings = [];
for (const file of pages) {
  const page = relative(dist, file);
  const html = readFileSync(file, 'utf8');
  let module = false;
  for (const m of html.matchAll(TAG)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    if (tag === 'script') {
      const src = attr(attrs, 'src') || '';
      if (/(^|\/)canon-posthog(\.min)?\.js(\?|$)/.test(src)) module = true;
      for (const a of ['src', 'data-api-host', 'data-posthog-host']) {
        const v = attr(attrs, a);
        if (v && DIRECT.test(v)) findings.push({ page, code: 'direct_host', detail: `${a}="${v}"` });
      }
    }
    const notation = attr(attrs, 'data-element');
    if (notation !== null) {
      const c = cardinals.get(notation);
      if (!c) findings.push({ page, code: 'unknown_notation', detail: notation });
      else if (c.deprecated) findings.push({ page, code: 'deprecated_emitted', detail: notation });
    }
  }
  if (!module) findings.push({ page, code: 'module_missing', detail: 'no <script src=".../canon-posthog.js">' });
  if (/\bphx_[A-Za-z0-9]{8,}/.test(html)) findings.push({ page, code: 'personal_key', detail: 'phx_ key in page' });
  for (const s of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/persistence\s*:\s*['"](cookie|localStorage\+cookie)['"]/.test(s[1])) findings.push({ page, code: 'cookie_persistence', detail: 'inline posthog-js config' });
    if (/api_host\s*:\s*['"]https?:\/\/([a-z0-9-]+\.)*posthog\.com/i.test(s[1])) findings.push({ page, code: 'direct_host', detail: 'inline api_host' });
  }
}

process.stdout.write(JSON.stringify({ plugin: 'posthog', layer: 'static', canon: `${canon.prefix}@${canon.version}`, pages: pages.length, pass: findings.length === 0, findings }, null, 2) + '\n');
process.exit(findings.length ? 1 : 0);
