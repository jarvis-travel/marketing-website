#!/usr/bin/env node
// Contract test for the /prices.json validator (JAR-4286). The body is
// untrusted (whatever the cache returned, including the SPA's index.html before
// JAR-4285 ships), so the validator is fail-closed: anything that is not exactly
// a well-formed price list returns null and the page shows no amounts.
//
// Method: one VALID baseline, asserted accepted first, then each bad case is the
// baseline with exactly ONE field broken. So breaking one guard in the validator
// reddens only that case, never the whole file (JAR-4286 "Done when").
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePricesFeed, offerIsLive, formatMoney, savingPercent } from '../../src/app/data/pricesFeed.mjs';

const contract = JSON.parse(
  readFileSync(new URL('../../contracts/stripe-lookup-keys.json', import.meta.url), 'utf8'),
);
const KEYS = new Set(contract.lookup_keys);

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n      ${e.message}`);
  }
}

// A valid baseline: the four published plans, the Nov offer plan carrying its
// first-year / struck / end fields. Deep-cloned per case so a mutation touches
// one plan only.
const baseline = () => ({
  plans: [
    { lookup_key: 'jt_trip_pass', amount_cents: 1999, currency: 'usd', interval: 'one_time' },
    { lookup_key: 'jt_explore_monthly', amount_cents: 1195, currency: 'usd', interval: 'month' },
    { lookup_key: 'jt_explore_annual', amount_cents: 9900, currency: 'usd', interval: 'year' },
    {
      // The self-contained offer plan: amount_cents is the renewal ($59.99/yr),
      // first_year_cents the discounted first year ($29.99), regular_cents the
      // struck regular annual ($99). So the page reads one plan for the whole
      // annual offer display (JAR-4285 response type).
      lookup_key: 'jt_explore_annual_nov2026',
      amount_cents: 5999,
      currency: 'usd',
      interval: 'year',
      first_year_cents: 2999,
      regular_cents: 9900,
      offer_ends_at: '2026-11-30T23:59:59Z',
    },
  ],
});

// The Nov offer plan is index 3 — the one that carries the optional fields.
const OFFER = 3;

// ---- the baseline is accepted (so every rejection below is attributable) ----

test('accepts the valid baseline and normalizes to camelCase', () => {
  const feed = parsePricesFeed(baseline(), KEYS);
  assert.notEqual(feed, null, 'valid baseline must not be rejected');
  assert.equal(feed.plans.length, 4);
  const pass = feed.plans[0];
  assert.deepEqual(pass, {
    lookupKey: 'jt_trip_pass',
    amountCents: 1999,
    firstYearCents: null,
    regularCents: null,
    currency: 'usd',
    interval: 'one_time',
    offerEndsAt: null,
  });
  const offer = feed.plans[OFFER];
  assert.equal(offer.amountCents, 5999, 'offer amount is the renewal');
  assert.equal(offer.firstYearCents, 2999, 'discounted first year');
  assert.equal(offer.regularCents, 9900, 'struck regular annual');
  assert.equal(offer.offerEndsAt, '2026-11-30T23:59:59Z');
});

// ---- each bad case: baseline + one broken field → null ----

// A tiny helper: clone the baseline, run `mutate` on it, expect rejection.
const rejects = (label, mutate) =>
  test(label, () => {
    const body = baseline();
    mutate(body);
    assert.equal(parsePricesFeed(body, KEYS), null, `${label} must be rejected`);
  });

test('rejects a non-object body (the SPA index.html string)', () => {
  assert.equal(parsePricesFeed('<!doctype html><html>...', KEYS), null);
});
test('rejects a top-level array', () => {
  assert.equal(parsePricesFeed(baseline().plans, KEYS), null);
});
test('rejects null', () => {
  assert.equal(parsePricesFeed(null, KEYS), null);
});

rejects('rejects a missing plans array', (b) => { delete b.plans; });
rejects('rejects an empty plans array', (b) => { b.plans = []; });
rejects('rejects more than 10 plans', (b) => {
  b.plans = Array.from({ length: 11 }, (_, i) => ({ ...baseline().plans[0], lookup_key: `k${i}` }));
});

rejects('rejects a float amount_cents', (b) => { b.plans[1].amount_cents = 11.95; });
rejects('rejects amount_cents below 1', (b) => { b.plans[1].amount_cents = 0; });
rejects('rejects amount_cents above 100000', (b) => { b.plans[1].amount_cents = 100001; });
rejects('rejects a negative amount_cents', (b) => { b.plans[1].amount_cents = -1999; });
rejects('rejects a string amount_cents', (b) => { b.plans[1].amount_cents = '1195'; });

rejects('rejects a lookup_key not in the contract', (b) => { b.plans[1].lookup_key = 'jt_bogus'; });
rejects('rejects a non-string lookup_key', (b) => { b.plans[1].lookup_key = 1195; });
rejects('rejects a currency other than usd', (b) => { b.plans[1].currency = 'eur'; });
rejects('rejects an interval not in {month,year,one_time}', (b) => { b.plans[1].interval = 'week'; });

rejects('rejects a non-ISO offer_ends_at ("Nov 30" parses as a Date but is not ISO)', (b) => {
  b.plans[OFFER].offer_ends_at = 'Nov 30';
});
rejects('rejects a date-only offer_ends_at (no time component)', (b) => {
  b.plans[OFFER].offer_ends_at = '2026-11-30';
});
rejects('rejects a float first_year_cents', (b) => { b.plans[OFFER].first_year_cents = 59.99; });
rejects('rejects first_year_cents >= amount_cents (not a discount)', (b) => {
  b.plans[OFFER].first_year_cents = 9900;
});
rejects('rejects first_year_cents with no offer_ends_at (a cut price that never ends)', (b) => {
  delete b.plans[OFFER].offer_ends_at;
});

rejects('rejects an unknown field riding through (a leaked stripe id)', (b) => {
  b.plans[1].stripe_price_id = 'price_123';
});
rejects('rejects a duplicate lookup_key', (b) => {
  b.plans[2].lookup_key = 'jt_explore_monthly';
});

// ---- offerIsLive: the clock, not the cache, ends the offer ----

test('offerIsLive: true before the end, false at/after it, false for junk', () => {
  const ends = '2026-11-30T23:59:59Z';
  assert.equal(offerIsLive(ends, new Date('2026-11-20T00:00:00Z')), true);
  assert.equal(offerIsLive(ends, new Date('2026-12-01T00:00:00Z')), false);
  assert.equal(offerIsLive(ends, new Date(ends)), false, 'exactly at the end is over');
  assert.equal(offerIsLive('Nov 30', new Date('2026-11-20T00:00:00Z')), false);
  assert.equal(offerIsLive(null, new Date('2026-11-20T00:00:00Z')), false);
});

// ---- formatMoney: whole dollars drop the cents ----

test('formatMoney renders whole dollars without cents, otherwise two places', () => {
  assert.equal(formatMoney(9900), '$99');
  assert.equal(formatMoney(1999), '$19.99');
  assert.equal(formatMoney(1195), '$11.95');
  assert.equal(formatMoney(2999), '$29.99');
  assert.equal(formatMoney(5999), '$59.99');
});

// ---- savingPercent: the "Save N%" figure, derived from the amounts ----

test('savingPercent: 31% regular annual, 58% off the renewal, null when dishonest', () => {
  assert.equal(savingPercent(9900, 1195), 31); // regular annual vs monthly
  assert.equal(savingPercent(5999, 1195), 58); // Nov renewal vs monthly
  assert.equal(savingPercent(9900, 0), null, 'no monthly amount to compare');
  assert.equal(savingPercent(9900, undefined), null, 'monthly plan absent');
  assert.equal(savingPercent(20000, 1195), null, 'a year dearer than 12 months is no saving');
});

console.log(`\nprices-feed: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
