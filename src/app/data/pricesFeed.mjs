// ============================================================================
// PRICES FEED — the site's prices, read at runtime from /prices.json (JAR-4286).
//
// Core serves the amounts (JAR-4285); jarvistravel.com answers /prices.json from
// its own nginx cache, so the visitor's browser only ever talks to its own
// origin. This module is the one that reads that body. It does TWO jobs and
// nothing else, both pure (no fetch, no React, no clock of its own):
//
//   parsePricesFeed(raw, allowedKeys) — validate an untrusted body, or reject it
//   offerIsLive(offerEndsAt, now)     — is the Nov offer still on at `now`?
//
// SECURITY (Brent, 2026-11-10: "data on the website coming from core is a path
// to core — make sure the implementation is secure and ideal"). The body is
// untrusted: it is whatever the cache returned, which on a miss, a 503, or
// before JAR-4285 deploys is the SPA's index.html, not JSON at all. So the rule
// is fail-closed and total: ANY shape that is not exactly a well-formed price
// list returns null, and the page then shows every plan WITHOUT amounts (never a
// typed fallback price, never a partly-priced page). Nothing from the body is
// ever rendered as text or a link — the page formats the integer amounts itself
// and takes its Start-planning links from local lookup keys. So this validator
// only has to decide "are these amounts safe to format", and it is strict:
//   - a `plans` array of 1..10 entries, no duplicate lookup keys
//   - lookup_key ∈ allowedKeys (the published Stripe-lookup-key contract)
//   - every *_cents an integer in [1, 100000]
//   - currency exactly "usd"
//   - interval ∈ {month, year, one_time}
//   - offer_ends_at a valid ISO-8601 instant, or absent
//   - no unknown keys (an added field must not ride through)
// ============================================================================

const MIN_CENTS = 1;
const MAX_CENTS = 100000;
const MAX_PLANS = 10;
const CURRENCY = 'usd';
const INTERVALS = new Set(['month', 'year', 'one_time']);

// The fields a plan may carry. An unknown key is rejected rather than ignored:
// a body that grows a field (a Stripe id, say) must not slip through a lax
// validator and reach the page (JAR-4285 keeps internal ids off this route, and
// this is the matching guard on the reading side).
const PLAN_KEYS = new Set([
  'lookup_key',
  'amount_cents',
  'first_year_cents',
  'regular_cents',
  'currency',
  'interval',
  'offer_ends_at',
]);

/** A positive integer count of cents within the allowed range. */
function isCents(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= MIN_CENTS && v <= MAX_CENTS;
}

/** A string that round-trips as an ISO-8601 instant. `new Date` is far too
 *  lax on its own ("Nov 30" parses), so the value must also match the shape
 *  core writes (JAR-4283's offer_ends_at is an RFC3339 UTC instant). */
function isIsoInstant(v) {
  if (typeof v !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

/**
 * Validate one plan entry. Returns the normalized plan (camelCase, with absent
 * optional fields as null) or null if anything is off.
 */
function parsePlan(raw, allowedKeys) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;

  for (const k of Object.keys(raw)) {
    if (!PLAN_KEYS.has(k)) return null; // unknown field — reject the whole body
  }

  const { lookup_key, amount_cents, currency, interval } = raw;
  if (typeof lookup_key !== 'string' || !allowedKeys.has(lookup_key)) return null;
  if (!isCents(amount_cents)) return null;
  if (currency !== CURRENCY) return null;
  if (typeof interval !== 'string' || !INTERVALS.has(interval)) return null;

  // first_year_cents and regular_cents are the offer plan's struck/first-year
  // amounts: present only while the offer is on, each a cents value when present.
  const firstYearCents = 'first_year_cents' in raw ? raw.first_year_cents : null;
  if (firstYearCents !== null && !isCents(firstYearCents)) return null;

  const regularCents = 'regular_cents' in raw ? raw.regular_cents : null;
  if (regularCents !== null && !isCents(regularCents)) return null;

  const offerEndsAt = 'offer_ends_at' in raw ? raw.offer_ends_at : null;
  if (offerEndsAt !== null && !isIsoInstant(offerEndsAt)) return null;

  // A first-year price only makes sense below the amount it discounts, and only
  // alongside an end: a first_year with no offer_ends_at would show a cut price
  // that never expires. Tie them together so a malformed offer shows no offer.
  if (firstYearCents !== null && (offerEndsAt === null || firstYearCents >= amount_cents)) return null;

  return { lookupKey: lookup_key, amountCents: amount_cents, firstYearCents, regularCents, currency, interval, offerEndsAt };
}

/**
 * Validate an untrusted /prices.json body. `allowedKeys` is a Set of the
 * published Stripe lookup keys. Returns { plans } with normalized entries, or
 * null for anything that is not exactly a well-formed price list (which the page
 * reads as "show no amounts").
 */
export function parsePricesFeed(raw, allowedKeys) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { plans } = raw;
  if (!Array.isArray(plans) || plans.length < 1 || plans.length > MAX_PLANS) return null;

  const seen = new Set();
  const out = [];
  for (const entry of plans) {
    const plan = parsePlan(entry, allowedKeys);
    if (plan === null) return null;
    if (seen.has(plan.lookupKey)) return null; // a duplicate key is a malformed list
    seen.add(plan.lookupKey);
    out.push(plan);
  }
  return { plans: out };
}

/**
 * Is the offer still on at `now`? True only when `offerEndsAt` is a valid ISO
 * instant strictly in the future. The offer ends on the clock, not on the
 * cache: a stale cached body that still carries offer_ends_at goes dark the
 * instant it passes, so "first year / Ends Nov 30" never outlives the offer.
 */
export function offerIsLive(offerEndsAt, now) {
  if (!isIsoInstant(offerEndsAt)) return false;
  return Date.parse(offerEndsAt) > now.getTime();
}
