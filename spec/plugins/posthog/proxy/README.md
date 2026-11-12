# First-party PostHog proxy that strips visitor IPs (pattern)

**Status:** Draft, non-normative. Part of the [PostHog plugin](../README.md).

## Shape

```
browser ──HTTPS──> analytics.<your-domain>  (TLS terminator: Caddy, nginx, a load balancer)
                       │  no access log
                       ▼
                   strip-ip-proxy  (127.0.0.1 only)
                       │  allowlisted headers, $ip deleted, $geoip_disable set
                       ▼
                   PostHog ingestion host (UPSTREAM) and assets host (ASSET_UPSTREAM, /static/*)
```

## Requirements for any implementation

1. **Forward an allowlist of request headers, not a denylist.** `X-Forwarded-For`, `X-Real-IP`, `Forwarded`,
   `CF-Connecting-IP`, `True-Client-IP`, `Fastly-Client-IP` and any header a CDN adds later must not reach PostHog.
   [strip-ip-proxy.mjs](strip-ip-proxy.mjs) forwards only `accept`, `accept-language`, `content-type`,
   `content-encoding`, `user-agent`, `origin`, `referer`, the CORS preflight headers and `if-none-match`.
2. **Scrub capture bodies.** posthog-js may send gzip (`compression=gzip-js`), base64, form-encoded (`data=`) or plain
   JSON, as one event or a batch. Decode, delete `$ip` (and a top-level `ip`), set `properties.$geoip_disable = true`,
   drop the `ip` query flag, re-send as JSON.
3. **Write no access log** that holds client addresses, at the terminator or the proxy. Caddy logs nothing unless a
   `log` directive is set; nginx needs `access_log off;` for this server.
4. **Bind the proxy to localhost** and let the terminator be the only public listener.
5. **Do not rewrite other paths** (feature flags, replay, assets). They carry no client address once the headers are
   allowlisted.
6. **Test it.** Send a request with client-address headers and an `$ip` property, and assert neither arrives upstream;
   then send the same request straight to the fake upstream and see the assertion fail. `scripts/posthog-plugin.test.mjs`
   does both.

## Terminator snippets

Caddy:

```
analytics.example.org {
	reverse_proxy 127.0.0.1:3101
}
```

nginx:

```
server {
  server_name analytics.example.org;
  access_log off;
  location / { proxy_pass http://127.0.0.1:3101; }   # no proxy_set_header X-Forwarded-For
}
```

Run the reference proxy with the PostHog hosts for your region from PostHog's reverse-proxy documentation:

```bash
UPSTREAM=<ingestion host> ASSET_UPSTREAM=<assets host> PORT=3101 node strip-ip-proxy.mjs
```

## Optional: coarse location without the IP

To keep country or city reporting, look the visitor IP up locally in the proxy (an offline database) and add coarse
properties (`$geoip_country_code`, `$geoip_city_name`, ...) before forwarding; keep `$geoip_disable` set and never
forward or store the IP. The reference proxy does not do this, so it has no database dependency.
