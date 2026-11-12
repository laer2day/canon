// Reference first-party proxy for the Canon PostHog plugin (draft, non-normative).
//
// Sits behind your TLS terminator on a host you own and forwards PostHog traffic so the visitor IP never reaches
// PostHog:
//   - forwards only an allowlist of request headers: X-Forwarded-For, X-Real-IP, Forwarded, CF-Connecting-IP,
//     True-Client-IP and every other client-address header are dropped;
//   - on capture calls, decodes the body (gzip-js, base64, form-encoded or plain JSON), deletes any `$ip` property,
//     sets `$geoip_disable` (PostHog would otherwise geolocate this proxy), and drops the `ip` query flag;
//   - writes no access log.
// Node 18+, no dependencies. Configuration comes from the environment, never from this file:
//   UPSTREAM        PostHog ingestion host, e.g. the US or EU cloud ingestion URL from PostHog's proxy docs (required)
//   ASSET_UPSTREAM  PostHog assets host for /static/* (required)
//   PORT            default 3101;  BIND  default 127.0.0.1
// Run: UPSTREAM=... ASSET_UPSTREAM=... node strip-ip-proxy.mjs
import { createServer } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const PASS_REQUEST_HEADERS = new Set([
  'accept', 'accept-language', 'content-type', 'content-encoding', 'user-agent', 'origin', 'referer',
  'access-control-request-method', 'access-control-request-headers', 'if-none-match',
]);
const DROP_RESPONSE_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-length', 'content-encoding']);
// posthog-js event endpoints (documented paths; others such as flags, replay and assets pass through untouched)
export const CAPTURE_PATH = /^\/(e|i\/v0\/e|batch|capture|track|engage)\/?$/;

export function cleanHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) if (PASS_REQUEST_HEADERS.has(k.toLowerCase()) && v != null) out[k.toLowerCase()] = v;
  return out;
}

export function decodeBody(raw, query, contentType = '') {
  let body = raw;
  if (query.get('compression') === 'gzip-js' || (body[0] === 0x1f && body[1] === 0x8b)) body = gunzipSync(body);
  let text = body.toString('utf8');
  if (contentType.includes('application/x-www-form-urlencoded') || text.startsWith('data=')) {
    text = new URLSearchParams(text).get('data') ?? '';
    if (!text.trimStart().startsWith('{') && !text.trimStart().startsWith('[')) text = Buffer.from(text, 'base64').toString('utf8');
  } else if (query.get('compression') === 'base64') {
    text = Buffer.from(text, 'base64').toString('utf8');
  }
  return JSON.parse(text);
}

// Remove every visitor-address property from one event or a batch, and stop PostHog geolocating the proxy.
export function scrub(payload) {
  const events = Array.isArray(payload) ? payload : Array.isArray(payload?.batch) ? payload.batch : [payload];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    delete ev.ip;
    for (const bag of [ev.properties, ev.$set, ev.$set_once, ev.properties?.$set, ev.properties?.$set_once]) {
      if (bag && typeof bag === 'object') delete bag.$ip;
    }
    ev.properties = ev.properties && typeof ev.properties === 'object' ? ev.properties : {};
    ev.properties.$geoip_disable = true;
  }
  return payload;
}

export function createProxy({ upstream, assetUpstream, fetchImpl = fetch } = {}) {
  if (!upstream || !assetUpstream) throw new Error('UPSTREAM and ASSET_UPSTREAM are required');
  return createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      let body = Buffer.concat(chunks);
      const url = new URL(req.url, 'http://proxy.invalid');
      const headers = cleanHeaders(req.headers);
      const query = url.searchParams;
      if (req.method === 'POST' && CAPTURE_PATH.test(url.pathname) && body.length) {
        try {
          body = Buffer.from(JSON.stringify(scrub(decodeBody(body, query, headers['content-type']))));
          headers['content-type'] = 'application/json';
          delete headers['content-encoding'];
          query.delete('compression');
        } catch {
          // Unreadable body: forwarded as is. It still carries no client-address header; the connection is ours.
        }
      }
      query.delete('ip');
      const base = url.pathname.startsWith('/static/') ? assetUpstream : upstream;
      const target = base.replace(/\/$/, '') + url.pathname + (query.size ? `?${query}` : '');
      const r = await fetchImpl(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
        redirect: 'manual',
      });
      const out = Buffer.from(await r.arrayBuffer());
      const rh = {};
      r.headers.forEach((v, k) => { if (!DROP_RESPONSE_HEADERS.has(k)) rh[k] = v; });
      rh['content-length'] = String(out.length);
      res.writeHead(r.status, rh);
      res.end(out);
    } catch {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end('upstream error');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createProxy({ upstream: process.env.UPSTREAM, assetUpstream: process.env.ASSET_UPSTREAM });
  server.listen(Number(process.env.PORT || 3101), process.env.BIND || '127.0.0.1');
}
