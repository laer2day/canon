# Vercel Commerce — First Canon Generation Pass

Scratch workspace. Not for main. Draft only.

Source: https://github.com/vercel/commerce @ 3761e52e60df9c6a316e067dbfd7032e494d3634

## What this is

A first-pass Canon draft produced by reading the Vercel Commerce source (not a live DOM snapshot). Fourteen concepts covering the storefront: nav, product page, and cart modal.

## Surfaces read

- `components/cart/add-to-cart.tsx` — SubmitButton three-state render
- `components/product/variant-selector.tsx` — option value buttons
- `components/layout/navbar/index.tsx` — logo, CMS menu, search, cart
- `components/cart/modal.tsx` — open/close/delete/quantity/checkout
- `app/product/[handle]/page.tsx` — gallery, related products, JSON-LD
- `lib/shopify/fragments/product.ts` — GraphQL fields available as instance sources

## Generator flags

1. **NAMEDBY_CONFLICT** on `product.add-to-cart`: the disabled "Please select an option" state sets `aria-label` while visible text still says "Add To Cart". Canon section 3 prohibits aria-label/visible-text divergence. Active state is clean (`aria-label="Add to cart"` matches visible text).

2. **STABILITY_DOWNGRADE** on `product.variant-option`: stable variant IDs (`gid://shopify/ProductVariant/...`) live in the Shopify data layer and never reach the DOM. No `data-instance` source exists today. Default would be slug stability on option value text.

## Dynamic instances

- `nav.menu-link` — Shopify menu `next-js-frontend-header-menu`, runtime-fetched
- `product.related-link` — `getProductRecommendations(product.id)`, runtime-fetched

These are marked repeating with no static instance list. Conformance cannot verify instance coverage for them.

## Ephemeral

All five cart concepts flagged `ephemeral: true`. Cart contents are session data and must never appear in labels or instance names per the privacy rule.

## Next steps

- Run a live Subtext `view-snapshot` against a deployed instance for DOM-grounded generation
- Cross-reference against a Sightmap corpus if one exists for this surface
- Feed flags into the generator defaults (cardinality from DOM frequency, namedBy from visible text presence, instances from detected record IDs)
