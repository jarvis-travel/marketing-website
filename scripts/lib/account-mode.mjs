// ============================================================================
// Which Stripe mode is this key reading, and is it the one this check is for.
//
// Extracted so it can be tested by CALLING it, not by grepping check-prices.mjs
// for the shape of a branch — the same reason `account-error.mjs` exists. A
// source-grep proves a branch is written, never that it decides correctly, and
// this file's whole subject is a decision that was never made: the mode was
// read, formatted, printed, and then not acted on.
//
// WHY THIS BECAME A DEFECT ON 2026-09-01 AND WAS NOT ONE BEFORE. Until live
// mode was enabled for the org, "the key might be a live key" was unreachable,
// so printing the mode and asserting it were the same thing in practice. They
// are not any more. check-prices.mjs reconciles the marketing site's displayed
// prices against whatever catalogue the key points at, so with a live key a
// GREEN check silently changes meaning from "the site matches the test
// catalogue we are iterating on" to "the site matches live" — same colour,
// different claim, and nothing in the output distinguishes them.
// ============================================================================

/** Restricted and secret live-key prefixes. Stripe's test keys use `_test_`. */
export const LIVE_KEY_RE = /^(rk|sk)_live_/;

/**
 * What mode are we reading, and how confidently do we know it.
 *
 * TWO SOURCES, BECAUSE check-prices.mjs HAS TWO PATHS. When `/v1/account` is
 * readable, `livemode` is the account's own answer. When it is not — the
 * restricted key lacks `accounts_kyc_basic_read`, and the check deliberately
 * proceeds from Stripe's permission error instead — the only signal left is the
 * key prefix. Asserting on one path and not the other would leave a live key
 * that CANNOT read /v1/account passing straight through, which is the more
 * likely shape of the accident, not the less.
 *
 * `livemode` absent (undefined/null) means "the account did not tell us", which
 * is different from `false`. Truthiness would collapse them.
 *
 * @param {{livemode?: boolean|null, key?: string|null}} seen
 * @returns {{mode: 'LIVE'|'test', source: 'the account' | 'the key prefix'}}
 */
export function modeOf({ livemode, key }) {
  if (livemode === true || livemode === false) {
    return { mode: livemode ? 'LIVE' : 'test', source: 'the account' };
  }
  return {
    mode: LIVE_KEY_RE.test(String(key ?? '')) ? 'LIVE' : 'test',
    source: 'the key prefix',
  };
}

/**
 * The refusal message for a mode this check is not for, or null to proceed.
 *
 * `requireLive` is the live run's side of the same question (JAR-1739): a TEST
 * key in the live secret would reconcile the site against the test catalogue
 * and report it as live, the same green-for-the-wrong-claim this file exists to
 * stop, in the other direction.
 *
 * NAMES FOUND VS EXPECTED, AND SAYS IT IS NOT A CREDENTIAL PROBLEM. A mode
 * mismatch reading like a bad key sends the reader to rotate a secret that is
 * working perfectly — a different fix, in a different place, for a problem they
 * do not have.
 *
 * @param {{mode: string, source: string, allowLive?: boolean}} seen
 * @returns {string|null}
 */
export function refuseUnexpectedMode({ mode, source, allowLive = false, requireLive = false }) {
  if (requireLive) {
    if (mode === 'LIVE') return null;
    return (
      `this key reads Stripe's TEST catalogue (mode reported by ${source}); ` +
      `this check is for LIVE mode.\n` +
      `       The key is valid — this is NOT a credential problem, and rotating ` +
      `it will not help.\n` +
      `       Production charges live prices, so a green result here would ` +
      `mean "the site matches\n` +
      `       test" while everyone reading it believes it means live. Put a ` +
      `restricted, read-only\n` +
      `       LIVE-mode key in STRIPE_LIVE_READ_API_KEY.`
    );
  }
  if (mode !== 'LIVE') return null;
  if (allowLive) return null;
  return (
    `this key reads Stripe's LIVE catalogue (mode reported by ${source}); ` +
    `this check is for TEST mode.\n` +
    `       The key is valid — this is NOT a credential problem, and rotating ` +
    `it will not help.\n` +
    `       CI reconciles the site against the test catalogue, so a green ` +
    `result here would\n` +
    `       mean "the site matches LIVE" while everyone reading it believes ` +
    `it means the\n` +
    `       opposite. Use a test-mode key, or pass --allow-live to reconcile ` +
    `against live\n` +
    `       deliberately.`
  );
}
