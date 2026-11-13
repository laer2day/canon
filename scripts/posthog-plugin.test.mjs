// Canon PostHog plugin: the static check, the reference proxy and the web client. Run by `npm test`.
// Every check here is shown to fail on a known-bad input as well as pass on a good one (AGENTS.md rule 1).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';
import { cleanHeaders, createProxy, scrub } from '../spec/plugins/posthog/proxy/strip-ip-proxy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = join(root, 'spec/plugins/posthog');
const canonPath = join(root, 'spec/cardinal-colleges/meridian.json');
const canon = JSON.parse(readFileSync(canonPath, 'utf8'));
const singleton = canon.cardinals.find((c) => c.cardinality === 'singleton' && !c.deprecated).notation;
const deprecated = canon.cardinals.find((c) => c.deprecated)?.notation;

// ---------- static check ----------
const GOOD = `<!doctype html><html><head><meta name="canon" content="${canon.prefix}@${canon.version}">
<script defer src="/canon-posthog.js" data-key="phc_example" data-api-host="https://t.example.org"></script></head>
<body><a href="/x" data-element="${singleton}">x</a></body></html>`;

function site(html) {
  const dir = mkdtempSync(join(tmpdir(), 'ph-check-'));
  mkdirSync(join(dir, 'a'));
  writeFileSync(join(dir, 'index.html'), GOOD);
  if (html !== undefined) writeFileSync(join(dir, 'a', 'index.html'), html);
  return dir;
}
function check(args) {
  const r = spawnSync(process.execPath, [join(plugin, 'check.mjs'), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout, report: r.stdout ? JSON.parse(r.stdout) : null };
}

describe('posthog static check', () => {
  it('passes a conforming surface (exit 0)', () => {
    const r = check(['--canon', canonPath, '--dist', site()]);
    assert.equal(r.code, 0, r.out);
    assert.equal(r.report.pass, true);
  });
  const bad = {
    module_missing: GOOD.replace('/canon-posthog.js', '/other.js'),
    direct_host: GOOD.replace('https://t.example.org', 'https://us.i.posthog.com'),
    personal_key: GOOD.replace('</body>', '<script>var k="phx_abcdefghijklmnop"</script></body>'),
    cookie_persistence: GOOD.replace('</body>', "<script>posthog.init('k',{persistence:'cookie'})</script></body>"),
    unknown_notation: GOOD.replace(`data-element="${singleton}"`, `data-element="${canon.prefix}.link.not-in-canon"`),
  };
  if (deprecated) bad.deprecated_emitted = GOOD.replace(`data-element="${singleton}"`, `data-element="${deprecated}"`);
  for (const [code, html] of Object.entries(bad)) {
    it(`fails on ${code} (exit 1)`, () => {
      const r = check(['--canon', canonPath, '--dist', site(html)]);
      assert.equal(r.code, 1, r.out);
      assert.ok(r.report.findings.some((f) => f.code === code), r.out);
    });
  }
  it('does not run without arguments (exit 2, never 0)', () => assert.equal(check([]).code, 2));
  it('does not run on a directory with no pages (exit 2)', () => {
    assert.equal(check(['--canon', canonPath, '--dist', mkdtempSync(join(tmpdir(), 'ph-empty-'))]).code, 2);
  });
  it('does not run on an unreadable canon (exit 2)', () => {
    assert.equal(check(['--canon', join(tmpdir(), 'missing.json'), '--dist', site()]).code, 2);
  });
  it('does not run on a pre-0.3 college (exit 2, never 0)', () => {
    const old = { ...canon, canon: canon.version, concepts: canon.cardinals };
    delete old.version;
    delete old.cardinals;
    const file = join(mkdtempSync(join(tmpdir(), 'ph-old-')), 'canon.json');
    writeFileSync(file, JSON.stringify(old));
    assert.equal(check(['--canon', file, '--dist', site()]).code, 2);
  });
});

// ---------- reference proxy ----------
describe('posthog reference proxy', () => {
  it('keeps only allowlisted request headers', () => {
    const h = cleanHeaders({ 'X-Forwarded-For': '203.0.113.9', 'x-real-ip': '203.0.113.9', forwarded: 'for=203.0.113.9', 'cf-connecting-ip': '203.0.113.9', 'Content-Type': 'application/json', 'user-agent': 'ua' });
    assert.deepEqual(h, { 'content-type': 'application/json', 'user-agent': 'ua' });
  });
  it('removes $ip from single events and batches and disables geoip', () => {
    const one = scrub({ event: 'e', properties: { $ip: '203.0.113.9', a: 1 } });
    assert.equal(one.properties.$ip, undefined);
    assert.equal(one.properties.$geoip_disable, true);
    const many = scrub({ batch: [{ event: 'a', properties: { $ip: 'x' } }, { event: 'b', ip: 'x' }] });
    assert.ok(many.batch.every((e) => e.properties.$ip === undefined && e.ip === undefined && e.properties.$geoip_disable));
  });
  it('never forwards the visitor address end to end (gzip body, client-address headers)', async () => {
    const seen = [];
    const upstream = createServer((req, res) => {
      const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => { seen.push({ url: req.url, headers: req.headers, body: Buffer.concat(c).toString() }); res.end('{"status":1}'); });
    }).listen(0, '127.0.0.1');
    await new Promise((r) => upstream.once('listening', r));
    const up = `http://127.0.0.1:${upstream.address().port}`;
    const proxy = createProxy({ upstream: up, assetUpstream: up }).listen(0, '127.0.0.1');
    await new Promise((r) => proxy.once('listening', r));
    const body = gzipSync(JSON.stringify([{ event: '$pageview', properties: { $ip: '203.0.113.9', $current_url: 'https://s.example/' } }]));
    const r = await fetch(`http://127.0.0.1:${proxy.address().port}/e/?compression=gzip-js&ip=1`, {
      method: 'POST', body, headers: { 'content-type': 'text/plain', 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '203.0.113.9', forwarded: 'for=203.0.113.9' },
    });
    assert.equal(r.status, 200);
    proxy.close(); upstream.close();
    assert.equal(seen.length, 1);
    const s = seen[0];
    assert.ok(!JSON.stringify(s.headers).includes('203.0.113.9'), 'a client-address header reached upstream');
    assert.ok(!s.body.includes('203.0.113.9'), 'the visitor IP reached upstream in the body');
    assert.ok(!/[?&]ip=/.test(s.url), 'the ip query flag reached upstream');
    assert.equal(JSON.parse(s.body)[0].properties.$geoip_disable, true);
    // known-bad: the same request sent straight to upstream does carry the address, so the assertions above can fail
    await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
    await fetch(`http://127.0.0.1:${upstream.address().port}/e/`, { method: 'POST', body: '{"properties":{"$ip":"203.0.113.9"}}', headers: { 'x-forwarded-for': '203.0.113.9' } });
    upstream.close();
    assert.ok(JSON.stringify(seen[1].headers).includes('203.0.113.9') && seen[1].body.includes('203.0.113.9'));
  });
});

// ---------- web client ----------
const CLIENT = readFileSync(join(plugin, 'client/canon-posthog.js'), 'utf8');

function browser({ search = '', dnt, gpc, stored = {} } = {}) {
  const store = (init) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
  const listeners = {};
  const timers = [];
  const inserted = [];
  const document = {
    currentScript: null, referrer: '', visibilityState: 'visible', documentElement: { scrollHeight: 1000, scrollTop: 0 },
    querySelector: (s) => (s === 'meta[name="canon"]' ? { getAttribute: () => 'acme@1.0.0' } : null),
    querySelectorAll: () => [],
    addEventListener: (t, f) => ((listeners[t] = listeners[t] || []).push(f)),
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: (el) => inserted.push(el) } }],
  };
  const window = {
    document, location: { href: `https://s.example/p${search}`, search, pathname: '/p', hostname: 's.example' },
    navigator: { doNotTrack: dnt, globalPrivacyControl: gpc }, localStorage: store(stored), sessionStorage: store({}),
    innerWidth: 1200, innerHeight: 800, scrollY: 0,
    addEventListener: (t, f) => ((listeners[t] = listeners[t] || []).push(f)),
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {}, setInterval: () => 0,
    URL, URLSearchParams, Array, Object, Math, Date, String, JSON,
  };
  window.window = window;
  const ctx = vm.createContext(window);
  vm.runInContext(CLIENT, ctx);
  return { window, timers, inserted, listeners, ctx };
}
function fakeInstance() {
  const calls = [];
  return { calls, __loaded: true, capture: (...a) => calls.push(['capture', ...a]), register_for_session: (...a) => calls.push(['register_for_session', ...a]) };
}

describe('posthog web client', () => {
  it('refuses a PostHog-owned api host (visitor IP would reach PostHog)', () => {
    const b = browser();
    b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://us.i.posthog.com' });
    assert.equal(b.window.CanonPostHog.status().reason, 'direct-host-refused');
    assert.equal(b.inserted.length, 0, 'posthog-js must not load');
  });
  it('loads through a first-party host (the refusal above can pass)', () => {
    const b = browser();
    b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
    assert.equal(b.window.CanonPostHog.status().status, 'loading');
    assert.equal(b.inserted[0].src, 'https://t.example.org/static/array.js');
  });
  it('honours the opt-out query parameter, stores it, and clears it with =0', () => {
    const b = browser({ search: '?canon-optout=1' });
    b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
    assert.equal(b.window.CanonPostHog.status().reason, 'opted-out');
    assert.equal(b.window.localStorage.getItem('canon.optout'), '1');
    const c = browser({ search: '?canon-optout=0', stored: { 'canon.optout': '1' } });
    c.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
    assert.equal(c.window.CanonPostHog.status().status, 'loading');
  });
  it('respects Do Not Track and Global Privacy Control unless told not to', () => {
    for (const env of [{ dnt: '1' }, { gpc: true }]) {
      const b = browser(env);
      b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
      assert.equal(b.window.CanonPostHog.status().status, 'blocked');
      const c = browser(env);
      c.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org', respectDoNotTrack: false });
      assert.equal(c.window.CanonPostHog.status().status, 'loading');
    }
  });
  it('forces the privacy options whatever the caller passes', () => {
    const b = browser();
    b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org', persistence: 'cookie',
      posthog: { persistence: 'cookie', person_profiles: 'always', session_recording: { maskAllInputs: false } } });
    const opts = b.window.posthog._i[0][1];
    assert.equal(opts.persistence, 'sessionStorage');
    assert.equal(opts.person_profiles, 'identified_only');
    assert.equal(opts.session_recording.maskAllInputs, true);
    assert.equal(typeof opts.loaded, 'function');
  });
  it('queues until posthog-js hands back the live instance, and never captures on the placeholder', () => {
    const b = browser();
    const api = b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
    const placeholder = b.window.posthog;
    api.capture('custom', { a: 1 });
    assert.ok(!placeholder.some((c) => c[0] === 'capture'), 'capture went to the placeholder');
    const inst = fakeInstance();
    placeholder._i[0][1].loaded(inst);
    const names = inst.calls.filter((c) => c[0] === 'capture').map((c) => c[1]);
    assert.deepEqual(names, ['canon:landing', 'custom']);
    assert.equal(inst.calls.find((c) => c[1] === 'custom')[2].canon, 'acme@1.0.0');
    assert.equal(api.status().status, 'live');
  });
  it('counts events dropped when posthog-js never loads instead of losing them silently', () => {
    const b = browser();
    const api = b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org', loadTimeoutMs: 5 });
    api.capture('x');
    b.timers.find((t) => t.ms === 5).f();
    const s = api.status();
    assert.equal(s.status, 'not-loaded');
    assert.equal(s.dropped, 3);   // register_for_session + landing + x
    api.capture('y');
    assert.equal(api.status().dropped, 4);
  });
  it('rejects a placeholder passed as the loaded instance', () => {
    const b = browser();
    const api = b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
    b.window.posthog._i[0][1].loaded(b.window.posthog);
    assert.equal(api.status().reason, 'placeholder');
  });
  it('turns a click on a canon part into notation and instance properties, never label text', () => {
    const b = browser();
    const api = b.window.CanonPostHog.start({ key: 'phc_x', apiHost: 'https://t.example.org' });
    const inst = fakeInstance();
    b.window.posthog._i[0][1].loaded(inst);
    const el = { getAttribute: (n) => ({ 'data-element': 'acme.card.plan', 'data-instance': 'growth', href: '/plans/growth' })[n] ?? null, closest(s) { return s === '[data-canon-section]' ? null : this; }, textContent: 'Growth plan for jane@example.com' };
    b.listeners.click[0]({ target: el });
    const ev = inst.calls.at(-1);
    assert.equal(ev[1], 'canon:click');
    assert.equal(ev[2].canon_element, 'acme.card.plan');
    assert.equal(ev[2].canon_instance, 'growth');
    assert.equal(ev[2].canon_type, 'card');
    assert.ok(!JSON.stringify(ev[2]).includes('jane@'), 'visible text leaked into properties');
    const mail = { getAttribute: (n) => ({ href: 'mailto:jane@example.com' })[n] ?? null, closest(s) { return s.includes('a,button') ? this : null; } };
    b.listeners.click[0]({ target: mail });
    const m = inst.calls.at(-1);
    assert.equal(m[1], 'canon:contact');
    assert.equal(m[2].channel, 'email');
    assert.ok(!JSON.stringify(m[2]).includes('jane@'), 'an address leaked into a contact event');
    assert.equal(api.status().dropped, 0);
  });
});
