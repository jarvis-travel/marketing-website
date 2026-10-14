// One Stripe Price compared against the one entry the site renders for it,
// and the Early Access coupon against the site's mirror of it (JAR-3180).
//
// Extracted from check-prices.mjs so the comparison can be tested against
// fixtures instead of against Stripe. The guard's other decisions already live
// in scripts/lib/ for the same reason (account-error, account-mode); this is
// the last block of real logic that only ran when a network call succeeded,
// which meant every one of its rules was believed rather than exercised.
//
// Returns an array of human-readable mismatch strings — empty means agreement.
// It never throws and never exits: the caller collects across all keys and
// reports once, so a reader sees every disagreement rather than the first.

const money = (c) => `$${(c / 100).toFixed(2)}`;

/**
 * @param key   the lookup_key both sides agree to address the price by
 * @param want  the site's entry, parsed out of pricing.ts
 * @param got   the Stripe Price object, or undefined if no active price carries the key
 */
export function comparePrice(key, want, got) {
  if (!got) return [`${key}: no active Stripe price with that lookup_key`];

  const out = [];

  if (got.unit_amount !== want.amountCents) {
    out.push(`${key}: site says ${money(want.amountCents)}, Stripe says ${money(got.unit_amount)}`);
  }

  // interval_count, not just interval: a quarterly price is interval=month
  // with count=3, and the page would render it as "per month" (L2).
  if ((got.recurring?.interval_count ?? 1) !== 1) {
    out.push(`${key}: Stripe bills every ${got.recurring.interval_count} ${got.recurring.interval}s — the site renders a simple "per ${got.recurring.interval}"`);
  }

  const gotInterval = got.recurring?.interval ?? null;
  if (gotInterval !== (want.interval === 'null' ? null : want.interval)) {
    out.push(`${key}: site says interval ${want.interval}, Stripe says ${gotInterval}`);
  }

  // currency was parsed and then never compared, so a price flipped to another
  // currency in Stripe passed green while the site kept rendering a $ sign.
  if (got.currency !== want.currency) {
    out.push(`${key}: site says ${want.currency}, Stripe says ${got.currency}`);
  }

  // tax_behavior (JAR-1319). Every JarvisTravel price is tax-exclusive: the
  // listed amount is what the customer pays BEFORE tax, which is how the
  // amounts in pricing.ts were decided.
  //
  // This is checked here, in CI, because it is the one field whose failure
  // surfaces at CHECKOUT rather than here — Stripe refuses to put a price with
  // tax_behavior `unspecified` on an automatic-tax invoice at all, so the plan
  // does not mis-charge, it stops selling. Both Explore prices sat `unspecified`
  // from 2026-05 to 2026-09-05 with nothing reporting it.
  //
  // The account-level `defaults.tax_behavior` does NOT cover this. It was
  // already `exclusive` for that entire window; a default applies where a price
  // is silent, it does not make a silent price explicit.
  //
  // And it cannot be repaired in place: tax_behavior is settable once and
  // immutable after, so a wrong price needs a new price id, a lookup_key
  // transfer, and a migration of anyone already subscribed. Catching it before
  // a price is used is the whole value of this check.
  if (got.tax_behavior !== 'exclusive') {
    out.push(`${key}: tax_behavior is ${got.tax_behavior ?? 'unset'}, must be exclusive — ` +
      `Stripe refuses this price on an automatic-tax invoice, so checkout fails for it. ` +
      `It cannot be changed once set: this needs a new Price and a lookup_key transfer`);
  }

  return out;
}

/**
 * The Early Access coupon compared against the site's mirror of it (JAR-3180).
 * The page shows the annual price minus this coupon's amount_off, so the same
 * contract as comparePrice: mismatch strings, empty means agreement.
 *
 * @param want  the site's mirror, parsed out of pricing.ts
 * @param got   the Stripe Coupon object (couponReadProblem has ruled out the rest)
 */
export function compareCoupon(want, got) {
  const id = `coupon ${want.id}`;
  const out = [];

  // amount_off is null on a percent-off coupon, which the page cannot show as
  // "the list price minus a fixed amount" at all.
  if (got.amount_off !== want.amountOffCents) {
    const stripe = got.amount_off == null ? `no fixed amount off (percent_off ${got.percent_off})` : `${money(got.amount_off)} off`;
    out.push(`${id}: site says ${money(want.amountOffCents)} off, Stripe says ${stripe}`);
  }

  if (got.currency !== want.currency) {
    out.push(`${id}: site says ${want.currency}, Stripe says ${got.currency}`);
  }

  // 'once' takes it off the first invoice only, which on a yearly price is the
  // first year. It is what makes the page's "first year, then the regular price"
  // true; 'forever' would make the struck price false every year after.
  if (got.duration !== want.duration) {
    out.push(`${id}: site says duration ${want.duration}, Stripe says ${got.duration}`);
  }

  // valid is Stripe's answer to "can this still be redeemed": false once the
  // coupon is past redeem_by or out of max_redemptions. Absent fails too.
  if (got.valid !== true) {
    out.push(`${id}: Stripe says it is no longer valid, so the page advertises a price nobody is given. ` +
      'Take the offer off the page, or fix the coupon in Stripe');
  }

  return out;
}

/**
 * Why a GET /v1/coupons/<id> answer cannot be compared, or null when it can.
 *
 * Every non-2xx is a failure. The CI keys are restricted, and one without
 * Coupons: Read gets a 403 here while its price reads still work, so treating
 * this as skippable would print ok over a page price nothing checked. Stripe's
 * own message is not echoed: it quotes part of the key.
 */
export function couponReadProblem(status, id, keyName) {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) {
    return `cannot read coupon ${id} (HTTP ${status}): ${keyName} needs the "Coupons: Read" permission. ` +
      'Grant it on that restricted key in the Stripe dashboard. Until then the page\'s Early Access price is unchecked, so this fails.';
  }
  if (status === 404) {
    return `Stripe has no coupon ${id} in this mode, so the page's Early Access price is one nobody is given`;
  }
  return `Stripe error (${status}) reading coupon ${id}`;
}
