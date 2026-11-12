/* canon-posthog.js: the web client of the Canon PostHog plugin (draft, non-normative).
 *
 * Privacy-first PostHog analytics for a canon-governed web surface. No build step, no dependencies, ES2019.
 * Everything site-specific (project key, first-party host, event-name overrides) is configuration.
 * Nothing in this file names a site, a person, a project or a key.
 *
 * Load it, then start it (or let it autostart from data- attributes on its own script tag):
 *
 *   <script defer src="/canon-posthog.js"
 *           data-key="<project key>" data-api-host="https://<first-party proxy host>"></script>
 *
 *   or: CanonPostHog.start({ key, apiHost, ...options })   (with data-autostart="false" on the tag)
 *
 * What it guarantees (see README.md for the evidence class of each claim about posthog-js):
 *  - No cookies: persistence is sessionStorage or memory, never cookie or localStorage+cookie.
 *  - Replay masks every input. Anonymous visitors never become person profiles.
 *  - Refuses to start when apiHost is a PostHog-owned host: events must go through a first-party proxy that strips
 *    the visitor IP (proxy/README.md). Override only with allowDirectHost: true, and then the IP rule is yours to keep.
 *  - Opt-out: ?<optOutParam>=1 stores an opt-out in this browser; ?<optOutParam>=0 clears it.
 *  - Respects Do Not Track and Global Privacy Control unless respectDoNotTrack is false.
 *  - Never calls the posthog-js snippet placeholder for capture. Calls are queued here until posthog-js hands back
 *    its loaded instance (the `loaded` callback); if it never loads, the queue is dropped and counted in status(),
 *    not silently pushed into a placeholder array that nothing reads.
 *  - Event properties carry canon identities (notation, instance, type, prefix, declared canon), never label text,
 *    visible text, form values, email addresses or phone numbers (spec section 6 and section 11).
 */
(function (w, d) {
  'use strict';
  if (w.CanonPostHog && w.CanonPostHog.version) return;

  var VERSION = '0.1.0';
  var script = d.currentScript || null;
  var PRIVATE_PERSISTENCE = { sessionStorage: 1, memory: 1 };
  var DIRECT_HOST = /(^|\.)posthog\.com$/i;

  var NAMES = {
    landing: 'canon:landing',
    click: 'canon:click',
    outbound: 'canon:outbound',
    contact: 'canon:contact',
    download: 'canon:download',
    sectionView: 'canon:section-view',
    scrollDepth: 'canon:scroll-depth',
    pageTime: 'canon:page-time',
    articleRead: 'canon:article-read',
    copy: 'canon:copy',
    print: 'canon:print',
  };

  var DEFAULTS = {
    key: null,
    apiHost: null,
    uiHost: null,
    allowDirectHost: false,
    optOutParam: 'canon-optout',
    optOutStorageKey: 'canon.optout',
    sessionFlagKey: 'canon.session',
    respectDoNotTrack: true,
    persistence: 'sessionStorage',
    replay: true,
    loadTimeoutMs: 15000,
    queueLimit: 100,
    downloadPattern: /\.(pdf|docx?|pptx?|xlsx?|zip|csv)$/i,
    sectionSelector: '[data-canon-section]',
    sectionKey: 'data-canon-section',
    sectionVisibleMs: 1000,
    scrollMarks: [25, 50, 75, 90, 100],
    article: null,          // function () -> { id, root } | null; default: the page's single <article>, keyed by path
    utmKeys: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'],
    names: {},              // per-kind override: string, or function (ctx) -> string; return '' or null to skip
    transform: null,        // function (kind, ctx, props) -> props (add or rename properties; return null to skip)
    baseProperties: null,   // function () -> object merged into every event
    onReady: null,          // function (api) called once after start (whether or not posthog-js loads)
    posthog: {},            // extra posthog-js options; the privacy keys below always win
  };

  var state = {
    started: false, status: 'idle', reason: '', instance: null,
    queue: [], dropped: 0, sent: 0, config: null,
  };

  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b || {}) if (b[k] !== undefined) o[k] = b[k]; return o; }
  function storage(kind) { try { var s = w[kind]; s.setItem('canon.t', '1'); s.removeItem('canon.t'); return s; } catch { return null; } }
  function attr(el, n) { return el && el.getAttribute ? el.getAttribute(n) : null; }
  function cut(s, n) { return String(s == null ? '' : s).slice(0, n || 120); }

  function fromScriptTag() {
    if (!script) return {};
    var c = {};
    var map = { key: 'data-key', apiHost: 'data-api-host', uiHost: 'data-ui-host', optOutParam: 'data-opt-out-param' };
    for (var k in map) { var v = attr(script, map[k]); if (v) c[k] = v; }
    var dnt = attr(script, 'data-respect-dnt'); if (dnt) c.respectDoNotTrack = dnt !== 'false';
    var rp = attr(script, 'data-replay'); if (rp) c.replay = rp !== 'false';
    return c;
  }

  /* The declared canon (spec section 7; the watermark in SURFACE-CONTRACT.md). */
  function declaredCanon() {
    var m = d.querySelector('meta[name="canon"]');
    var v = m ? m.getAttribute('content') || '' : '';
    var at = v.lastIndexOf('@');
    return { declaration: v, prefix: at > 0 ? v.slice(0, at) : '', version: at >= 0 ? v.slice(at + 1) : v };
  }

  /* Opt-out and browser privacy signals, decided before anything loads. */
  function blocked(cfg, qs) {
    var ls = storage('localStorage');
    if (ls && qs.has(cfg.optOutParam)) {
      if (qs.get(cfg.optOutParam) === '0') ls.removeItem(cfg.optOutStorageKey); else ls.setItem(cfg.optOutStorageKey, '1');
    }
    if (ls && ls.getItem(cfg.optOutStorageKey)) return 'opted-out';
    if (!ls && qs.get(cfg.optOutParam) && qs.get(cfg.optOutParam) !== '0') return 'opted-out';
    if (cfg.respectDoNotTrack) {
      var n = w.navigator || {};
      if (n.globalPrivacyControl === true) return 'global-privacy-control';
      if (n.doNotTrack === '1' || n.doNotTrack === 'yes' || w.doNotTrack === '1' || n.msDoNotTrack === '1') return 'do-not-track';
    }
    return '';
  }

  function hostOf(u) { try { return new URL(u, w.location.href).hostname; } catch { return ''; } }

  /* posthog-js options: the caller's extras first, then the privacy keys, which cannot be overridden. */
  function posthogOptions(cfg) {
    var extra = cfg.posthog || {};
    var opts = merge({
      capture_pageview: 'history_change',
      capture_pageleave: true,
      autocapture: true,
      disable_surveys: true,
    }, extra);
    opts.api_host = cfg.apiHost;
    if (cfg.uiHost) opts.ui_host = cfg.uiHost;
    opts.persistence = PRIVATE_PERSISTENCE[cfg.persistence] ? cfg.persistence : 'sessionStorage';
    opts.person_profiles = 'identified_only';
    opts.disable_session_recording = !cfg.replay;
    opts.session_recording = merge(extra.session_recording || {}, { maskAllInputs: true });
    opts.property_denylist = (extra.property_denylist || []).concat(['$ip']);
    var userLoaded = extra.loaded;
    opts.loaded = function (inst) { onLoaded(inst); if (typeof userLoaded === 'function') try { userLoaded(inst); } catch { /* caller's hook */ } };
    return opts;
  }

  /* The official posthog-js array snippet (MIT, posthog-js). It creates a placeholder that records calls until
   * array.js replaces it. This module only uses the placeholder for init; every other call waits for `loaded`. */
  function installSnippet() {
    /* eslint-disable */
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag isFeatureEnabled reloadFeatureFlags identify setPersonProperties group reset get_distinct_id get_session_id get_session_replay_url set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException opt_in_capturing opt_out_capturing has_opted_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(d,w.posthog||[]);
    /* eslint-enable */
  }

  function isLive(inst) { return !!(inst && inst.__loaded && typeof inst.capture === 'function' && !Array.isArray(inst)); }

  function onLoaded(inst) {
    if (!isLive(inst)) { fail('placeholder'); return; }
    state.instance = inst;
    state.status = 'live';
    var q = state.queue; state.queue = [];
    for (var i = 0; i < q.length; i++) call(q[i][0], q[i][1]);
  }

  function fail(reason) {
    if (state.status === 'live') return;
    state.status = 'not-loaded';
    state.reason = reason;
    state.dropped += state.queue.length;
    state.queue = [];
  }

  function call(method, args) {
    if (state.status === 'live') {
      try { state.instance[method].apply(state.instance, args); if (method === 'capture') state.sent++; } catch { state.dropped++; }
      return;
    }
    if (state.status === 'loading' && state.queue.length < state.config.queueLimit) state.queue.push([method, args]);
    else state.dropped++;
  }

  function base() {
    var c = declaredCanon(), cfg = state.config;
    var p = { canon: c.declaration || undefined };
    var extra = typeof cfg.baseProperties === 'function' ? cfg.baseProperties() : null;
    return merge(p, extra || {});
  }

  function nameFor(kind, ctx) {
    var n = state.config.names[kind];
    if (typeof n === 'function') return n(ctx);
    if (typeof n === 'string') return n;
    return NAMES[kind];
  }

  /* One place that turns (kind, context, properties) into a capture. */
  function emit(kind, ctx, props, opts) {
    if (!state.started || state.status === 'blocked') return;
    var cfg = state.config;
    var data = merge(base(), props || {});
    if (typeof cfg.transform === 'function') { data = cfg.transform(kind, ctx || {}, data); if (!data) return; }
    var name = nameFor(kind, ctx || {});
    if (!name) return;
    call('capture', opts ? [name, data, opts] : [name, data]);
  }

  /* Canon identity of an interactive part (spec section 3 emission, section 11 analytics consumer). */
  function identity(el) {
    var host = el.closest ? el.closest('[data-element]') : null;
    if (!host) return {};
    var notation = attr(host, 'data-element') || '';
    var segs = notation.split('.');
    var out = { canon_element: notation, canon_prefix: segs[0] || '', canon_type: segs.length > 2 ? segs[1] : '' };
    var inst = attr(host, 'data-instance'); if (inst) out.canon_instance = inst;
    return out;
  }

  function sectionOf(el) {
    var cfg = state.config, s = el.closest ? el.closest(cfg.sectionSelector) : null;
    if (!s) return undefined;
    return typeof cfg.sectionKey === 'function' ? cfg.sectionKey(s) : (attr(s, cfg.sectionKey) || s.id || undefined);
  }

  function onClick(ev) {
    var t = ev.target, el = t && t.closest ? t.closest('a,button,[data-element]') : null;
    if (!el) return;
    var href = attr(el, 'href') || '';
    var url = null; try { url = href ? new URL(href, w.location.href) : null; } catch { url = null; }
    var ctx = { el: el, href: href, url: url };
    var props = identity(el);
    var section = sectionOf(el); if (section) props.section = section;
    if (/^mailto:/i.test(href)) { ctx.channel = 'email'; props.channel = 'email'; return emit('contact', ctx, props); }
    if (/^tel:/i.test(href)) { ctx.channel = 'phone'; props.channel = 'phone'; return emit('contact', ctx, props); }
    if (url && /^https?:$/.test(url.protocol) && url.hostname && url.hostname !== w.location.hostname) {
      ctx.host = props.host = url.hostname.replace(/^www\./, '');
      props.url = cut(url.hostname + url.pathname);
      if (state.config.downloadPattern.test(url.pathname)) props.file = cut(url.pathname);
      return emit('outbound', ctx, props);
    }
    if (url && state.config.downloadPattern.test(url.pathname)) { ctx.file = props.file = cut(url.pathname); return emit('download', ctx, props); }
    // A part with a canon notation is always a click; anything else only when the surface names it (names.click).
    if (props.canon_element || typeof state.config.names.click === 'function') emit('click', ctx, props);
  }

  function onCopy() {
    var sel = String(w.getSelection ? w.getSelection() : '');
    var kind = /@/.test(sel) ? 'email' : /\d{3}\D{0,2}\d{3}\D?\d{4}/.test(sel) ? 'phone' : 'text';
    emit('copy', { kind: kind }, { kind: kind, length: sel.length });   // never the copied text
  }

  function landing(qs) {
    var ss = storage('sessionStorage'), cfg = state.config;
    if (!ss || ss.getItem(cfg.sessionFlagKey)) return;
    ss.setItem(cfg.sessionFlagKey, '1');
    var ctx = { entry_page: w.location.pathname };
    var ref = null; try { ref = d.referrer ? new URL(d.referrer) : null; } catch { ref = null; }
    if (ref && ref.hostname !== w.location.hostname) { ctx.ref_host = ref.hostname; ctx.ref_path = cut(ref.pathname); }
    cfg.utmKeys.forEach(function (k) { var v = qs.get(k); if (v) ctx[k] = cut(v, 80); });
    var vw = w.innerWidth || 0;
    ctx.viewport = vw < 768 ? 'mobile' : vw < 1100 ? 'tablet' : 'desktop';
    if (typeof cfg.transform === 'function') { var t = cfg.transform('session', {}, merge({}, ctx)); if (t) ctx = t; }
    call('register_for_session', [ctx]);
    emit('landing', {}, ctx);
  }

  var maxDepth = 0;
  function depth() {
    var h = d.documentElement, scrollable = h.scrollHeight - w.innerHeight;
    return scrollable <= 0 ? 100 : Math.min(100, Math.round((w.scrollY || h.scrollTop) / scrollable * 100));
  }
  function watchScroll() {
    var hit = {}, ticking = false, marks = state.config.scrollMarks;
    function on() {
      var p = depth(); if (p > maxDepth) maxDepth = p;
      marks.forEach(function (m) { if (p >= m && !hit[m]) { hit[m] = 1; emit('scrollDepth', { depth: m }, { depth: m }); } });
    }
    w.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      (w.requestAnimationFrame || setTimeout)(function () { ticking = false; on(); });
    }, { passive: true });
  }

  function watchSections() {
    if (!('IntersectionObserver' in w)) return;
    var cfg = state.config, seen = {}, timers = {};
    var io = new w.IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var id = typeof cfg.sectionKey === 'function' ? cfg.sectionKey(e.target) : (attr(e.target, cfg.sectionKey) || e.target.id);
        if (!id || seen[id]) return;
        if (e.isIntersecting) timers[id] = setTimeout(function () { seen[id] = 1; emit('sectionView', { section: id, el: e.target }, { section: id }); io.unobserve(e.target); }, cfg.sectionVisibleMs);
        else clearTimeout(timers[id]);
      });
    }, { threshold: 0.5 });
    d.querySelectorAll(cfg.sectionSelector).forEach(function (el) { io.observe(el); });
  }

  /* Engaged time (visible and active in the last 30 s), page time on hide, article read at 75 % plus half the
   * estimated reading time. */
  function watchTime() {
    var cfg = state.config, engaged = 0, last = Date.now(), lastActive = Date.now(), sent = false;
    var art = typeof cfg.article === 'function' ? cfg.article() : defaultArticle();
    var words = art && art.root ? (art.root.innerText || '').split(/\s+/).length : 0, readSent = false;
    ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (t) {
      w.addEventListener(t, function () { lastActive = Date.now(); }, { passive: true });
    });
    setInterval(function () {
      var now = Date.now();
      if (d.visibilityState === 'visible' && now - lastActive < 30000) engaged += now - last;
      last = now;
      if (art && !readSent) {
        var need = Math.max(20, Math.min(240, words / 250 * 60 * 0.5));
        if (maxDepth >= 75 && engaged / 1000 >= need) {
          readSent = true;
          emit('articleRead', { article: art.id }, { article: art.id, words: words, seconds: Math.round(engaged / 1000) });
        }
      }
    }, 1000);
    function bucket(s) { return s < 10 ? '0-10s' : s < 30 ? '10-30s' : s < 60 ? '30-60s' : s < 180 ? '1-3m' : s < 600 ? '3-10m' : '10m+'; }
    function pageTime() {
      if (sent) return; sent = true;
      var s = Math.round(engaged / 1000);
      emit('pageTime', {}, { seconds: s, bucket: bucket(s), max_scroll: maxDepth }, { transport: 'sendBeacon' });
    }
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') pageTime(); });
    w.addEventListener('pagehide', pageTime);
  }
  function defaultArticle() {
    var a = d.querySelectorAll('article');
    return a.length === 1 ? { id: w.location.pathname, root: a[0] } : null;
  }

  var api = {
    version: VERSION,
    start: start,
    /* Capture a surface-specific event through the same queue, privacy rules and base properties. */
    capture: function (name, props, opts) {
      if (!state.started || state.status === 'blocked' || !name) return;
      call('capture', opts ? [name, merge(base(), props || {}), opts] : [name, merge(base(), props || {})]);
    },
    status: function () {
      return { status: state.status, reason: state.reason, queued: state.queue.length, sent: state.sent, dropped: state.dropped };
    },
  };

  function start(options) {
    if (state.started) return api;
    var cfg = merge(merge(DEFAULTS, fromScriptTag()), options || {});
    cfg.names = merge({}, cfg.names || {});
    state.config = cfg;
    state.started = true;
    var qs = new URLSearchParams(w.location.search);
    var why = blocked(cfg, qs);
    if (!why && !cfg.key) why = 'no-key';
    if (!why && !cfg.apiHost) why = 'no-api-host';
    if (!why && DIRECT_HOST.test(hostOf(cfg.apiHost)) && !cfg.allowDirectHost) why = 'direct-host-refused';
    if (why) { state.status = 'blocked'; state.reason = why; }
    else {
      state.status = 'loading';
      installSnippet();
      if (isLive(w.posthog)) onLoaded(w.posthog);   // posthog-js already loaded by something else on the page
      else w.posthog.init(cfg.key, posthogOptions(cfg));
      setTimeout(function () { if (state.status === 'loading') fail('timeout'); }, cfg.loadTimeoutMs);
      landing(qs);
      d.addEventListener('click', onClick, true);
      d.addEventListener('copy', onCopy);
      w.addEventListener('beforeprint', function () { emit('print', {}, {}); });
      watchScroll();
      watchSections();
      watchTime();
    }
    if (typeof cfg.onReady === 'function') try { cfg.onReady(api); } catch { /* caller's hook */ }
    return api;
  }

  w.CanonPostHog = api;
  if (script && attr(script, 'data-autostart') !== 'false' && attr(script, 'data-key')) start();
})(window, document);
