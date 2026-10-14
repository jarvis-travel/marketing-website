// ============================================================================
// PRICING — the only place on this site that knows what anything costs.
//
// Amounts live in Stripe, in the org's JarvisTravel account
// acct_1ToBJsPDaNqc0Lek. There is no separate sandbox account: test and live
// are MODES of that one account (JAR-1207 — the earlier note here named a
// sandbox account that does not exist). At launch the live catalogue is minted
// in live mode under the same account with the same lookup keys, so the pin
// here and in check-prices.mjs stays put. This file
// mirrors Stripe, keyed by the
// same lookup_key the backend resolves at checkout (core: config/stripe/setup.js,
// migration 063, JAR-658/659). A lookup key is a stable handle: Stripe Prices
// are immutable, so a price change mints a new Price and the key transfers to
// it — and it is per-account-and-mode, so the live catalogue must exist before
// the toggle.
//
// Regenerate rather than hand-edit (both generated blocks, prices and coupon):
//
//   STRIPE_READ_API_KEY=rk_test_... npm run sync:prices      # rewrite from Stripe
//   STRIPE_READ_API_KEY=rk_test_... npm run lint:prices      # verify, change nothing
//
// The literals used to sit in PricingPage.tsx, where the site advertised
// $24.95 for a Trip Pass we would never have charged — for weeks, found by
// hand (JAR-660). Two guards stop that recurring: lint:prices fails when this
// file and Stripe disagree, and check-prices.mjs fails when a dollar amount
// reappears as a literal in a component.
// ============================================================================

/** Stable Stripe lookup keys. Shared contract with core — do not rename. */
export type PriceLookupKey = 'jt_trip_pass' | 'jt_explore_annual' | 'jt_explore_monthly';

export interface Price {
  readonly lookupKey: PriceLookupKey;
  /** Minor units, exactly as Stripe stores them. */
  readonly amountCents: number;
  readonly currency: 'usd';
  /** Billing period, or null for a one-time purchase. */
  readonly interval: 'month' | 'year' | null;
}

// BEGIN GENERATED PRICES — npm run sync:prices
export const PRICES: Readonly<Record<PriceLookupKey, Price>> = {
  jt_trip_pass: { lookupKey: 'jt_trip_pass', amountCents: 2499, currency: 'usd', interval: null },
  jt_explore_annual: { lookupKey: 'jt_explore_annual', amountCents: 9900, currency: 'usd', interval: 'year' },
  jt_explore_monthly: { lookupKey: 'jt_explore_monthly', amountCents: 1195, currency: 'usd', interval: 'month' },
};
// END GENERATED PRICES

/** A Stripe coupon the page takes off a price, mirrored like the prices. */
export interface Coupon {
  readonly id: string;
  /** Minor units off, exactly as Stripe stores amount_off. */
  readonly amountOffCents: number;
  readonly currency: 'usd';
  /**
   * 'once' takes it off the first invoice only, which on a yearly price is the
   * first year. The page's "first year" and "renews at" copy is only true for
   * 'once', so the type admits nothing else: a sync that brought back another
   * duration fails the build instead of shipping a false sentence.
   */
  readonly duration: 'once';
}

// The Early Access coupon (JAR-3180). Brent, 2026-10-14: all users get it for
// now, and the pricing page shows the regular annual price struck through with
// the Early Access price beside it. Reconciled with Stripe by check-prices.mjs,
// like PRICES.
// BEGIN GENERATED COUPON (npm run sync:prices)
export const EARLY_ACCESS_COUPON: Coupon = { id: 'ea_annual', amountOffCents: 2000, currency: 'usd', duration: 'once' };
// END GENERATED COUPON

/**
 * The plan the Early Access coupon applies to. That is core's rule, not
 * Stripe's: core applies ea_annual at checkout to Explore Annual only. Nothing
 * here can check it against core, so if core changes which plan gets the coupon,
 * change this with it.
 */
export const EARLY_ACCESS_LOOKUP_KEY: PriceLookupKey = 'jt_explore_annual';

/**
 * Format an amount the way the page shows it: no trailing ".00", because
 * "$99" reads as a price and "$99.00" reads as an invoice.
 */
export function formatPrice(cents: number, currency: string = 'usd'): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** The display amount for a plan, e.g. "$24.99" or "$99". */
export function priceOf(key: PriceLookupKey): string {
  const price = PRICES[key];
  return formatPrice(price.amountCents, price.currency);
}

/**
 * The billing period rendered next to an amount, derived from the interval
 * Stripe verifies — "per year", "per month", or "per trip" for a one-time
 * purchase. Deriving kills the parallel "per" namespace: a cadence whose
 * rendered period disagreed with its interval used to compile cleanly and
 * pass every guard while showing "$99 per month" (review deleg_dd2f886e).
 */
export function periodOf(key: PriceLookupKey): string {
  return PRICES[key].interval ?? 'trip';
}

/**
 * The Early Access price for a plan, e.g. "$79": the list price minus the
 * coupon's amount off, both from Stripe. Null for a plan the coupon does not
 * apply to, so a caller renders the regular price there.
 */
export function earlyAccessPriceOf(key: PriceLookupKey): string | null {
  if (key !== EARLY_ACCESS_LOOKUP_KEY) return null;
  const price = PRICES[key];
  return formatPrice(price.amountCents - EARLY_ACCESS_COUPON.amountOffCents, price.currency);
}

/** What paying annually saves against paying monthly, as a whole percent, or
 *  null when the comparison cannot honestly be made.
 *
 *  Replaces a hardcoded "Best value" badge. That claim is only true relative to
 *  something, and stating it without the number invites the reader to wonder
 *  what it beats. Derived from PRICES — which is the generated block, synced
 *  from Stripe — so the figure cannot drift from the amounts rendered beside it.
 *
 *  Returns null rather than guessing when annual is not actually cheaper, which
 *  keeps the badge honest if the catalogue ever changes shape. */
export function annualSavingPercent(): number | null {
  const year = PRICES.jt_explore_annual.amountCents;
  const month = PRICES.jt_explore_monthly.amountCents;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month <= 0) return null;
  const pct = Math.round((1 - year / (month * 12)) * 100);
  return pct > 0 ? pct : null;
}
