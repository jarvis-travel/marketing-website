#!/usr/bin/env node
// Test what the pricing guard SAYS when it cannot read /v1/account.
//
// The account pin exists because a catalogue was once minted into a personal
// Stripe account the org cannot see or manage, under the same lookup keys at
// the same amounts — right prices, wrong Stripe, green check (JAR-659/660).
//
// When the CI key is both under-scoped AND for the wrong account, Stripe's
// permission error is the only thing that answers "which account is this key
// for" — it names the account inline. Reporting just the missing permission
// sends the reader to the dashboard to grant it and buys a second failing run
// that finally names the real problem. Each round trip is minutes of CI, and
// this exact pair is what marketing#36 hit.
//
// So this asserts the message, not the fetch: given a permission error naming a
// foreign account, the guard must say BOTH things at once.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { NAMED_ACCOUNT_RE, classifyAccountError } from '../lib/account-error.mjs';
import { modeOf, refuseUnexpectedMode } from '../lib/account-mode.mjs';
import { comparePrice } from '../lib/price-compare.mjs';

const ROOT = new URL('../..', import.meta.url).pathname;
const SCRIPT = resolve(ROOT, 'scripts/check-prices.mjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

const source = readFileSync(SCRIPT, 'utf8');

/** The account this repo's catalogue is pinned to, read from the guard itself
 *  so the test cannot drift from the pin it is describing. */
const EXPECTED_ACCOUNT = source.match(/const EXPECTED_ACCOUNT = '(acct_[A-Za-z0-9]+)'/)?.[1];

// The guard's own classifier, imported and CALLED rather than grepped. It used
// to live inline in check-prices.mjs, which runs its whole check at import
// time, so this file could only read it as text -- and a source-grep proves a
// branch exists, never that it decides correctly. That is precisely how a pin
// naming a non-existent account survived here (JAR-1207).

// The verbatim shape Stripe returns for an under-scoped restricted key.
const STRIPE_PERMISSION_ERROR =
  "Permission denied. The provided key 'rk_test_XXXX' does not have the required " +
  "permissions for this endpoint on account 'acct_1ToBJsPDaNqc0Lek'. Enabling " +
  '"Basic Business Contact Information Read" (\'accounts_kyc_basic_read\') permissions ' +
  'on this key would allow this request to continue.';

// A DIFFERENT account, for the not-pinned branch. Synthetic and obviously so:
// the only real account we have is the one above, and manufacturing a second
// real-looking id invites someone to believe in it. Previously this branch was
// fed the captured error unmodified -- which only worked because the pin named
// an account that does not exist (JAR-1207).
const WRONG_ACCOUNT = 'acct_0000000000NOTOURS';
const WRONG_ACCOUNT_ERROR = STRIPE_PERMISSION_ERROR.replace(
  'acct_1ToBJsPDaNqc0Lek',
  WRONG_ACCOUNT,
);


// ── JAR-1209: the mode was read, printed, and never acted on ────────────────
//
// Imported and CALLED, not grepped. The defect this closes is precisely a
// branch that exists and decides nothing, and a source-grep cannot tell those
// apart — it would have passed against the `console.log` this replaces.
//
// `livemode` is faked here; no live key is needed, and needing one would make
// the case unwritable, which is why the gap survived until live mode existed.

test('the account\'s own livemode is believed when it is present', () => {
  if (modeOf({ livemode: false, key: 'rk_test_x' }).mode !== 'test') throw new Error('livemode false must read as test');
  // THE DISCRIMINATING CASE. `livemode: false` with a LIVE key prefix is the
  // only input where reading livemode by truthiness differs from reading it
  // explicitly: truthiness makes `false` fall through to the prefix and answer
  // LIVE, while the account said test. Every other fixture agrees under both,
  // so without this one the explicit `=== true || === false` check could be
  // replaced by `if (livemode)` with the suite still green — verified.
  if (modeOf({ livemode: false, key: 'rk_live_x' }).mode !== 'test') throw new Error('a present livemode:false must win over the key prefix — absent and false are different');
  // LIVE even though the key prefix says test: the account is the better source.
  if (modeOf({ livemode: true, key: 'rk_test_x' }).mode !== 'LIVE') throw new Error('livemode true must read as LIVE regardless of the key prefix');
  if (modeOf({ livemode: true }).source !== 'the account') throw new Error('the source must say it came from the account');
});

test('an ABSENT livemode falls back to the key prefix, and absent is not false', () => {
  // The permission-error path never reads /v1/account, so this is the only
  // signal it has. Truthiness would collapse "did not tell us" into "test".
  if (modeOf({ livemode: undefined, key: 'rk_live_x' }).mode !== 'LIVE') throw new Error('a live prefix with no readable account must read as LIVE');
  if (modeOf({ livemode: null, key: 'sk_live_x' }).mode !== 'LIVE') throw new Error('null livemode is absent, not false');
  if (modeOf({ livemode: undefined, key: 'rk_test_x' }).mode !== 'test') throw new Error('a test prefix with no readable account must read as test');
  if (modeOf({ livemode: undefined, key: 'rk_live_x' }).source !== 'the key prefix') throw new Error('the source must say it was inferred');
  if (modeOf({}).mode !== 'test') throw new Error('knowing nothing must not read as LIVE');
});

test('LIVE is refused, and the refusal is not mistakable for a credential problem', () => {
  const msg = refuseUnexpectedMode({ mode: 'LIVE', source: 'the account' });
  if (!msg) throw new Error('LIVE must be refused, not merely printed');
  if (!/LIVE/.test(msg) || !/TEST/.test(msg)) throw new Error('the refusal must name the mode found AND the one expected');
  // A mode mismatch reading like a bad key sends the reader to rotate a secret
  // that is working perfectly — a different fix, in a different place.
  if (!/NOT a credential problem/.test(msg)) throw new Error('the refusal must not read as a credential problem');
  if (!/--allow-live/.test(msg)) throw new Error('the refusal must name the deliberate opt-in');
});

test('test mode proceeds, and --allow-live is the only way LIVE does', () => {
  if (refuseUnexpectedMode({ mode: 'test', source: 'the account' }) !== null) throw new Error('test mode must proceed');
  if (refuseUnexpectedMode({ mode: 'LIVE', source: 'the account', allowLive: true }) !== null) throw new Error('--allow-live must let a deliberate live reconciliation proceed');
});

// JAR-1739. The live run requires a live key: --allow-live only permits one, so
// a test key in the live secret would reconcile against the test catalogue and
// report it as live.
test('the live run refuses a TEST key, and the refusal is not mistakable for a credential problem', () => {
  const msg = refuseUnexpectedMode({ mode: 'test', source: 'the key prefix', requireLive: true });
  if (msg === null) throw new Error('a test key must be refused when the check is for LIVE');
  if (!/this check is for LIVE mode/.test(msg)) throw new Error(`the refusal must say the check is for LIVE: ${msg}`);
  if (!/NOT a credential problem/.test(msg)) throw new Error('the refusal must say the key itself is fine');
  if (!/STRIPE_LIVE_READ_API_KEY/.test(msg)) throw new Error('the refusal must name the secret to fix');
  if (refuseUnexpectedMode({ mode: 'LIVE', source: 'the account', requireLive: true }) !== null) {
    throw new Error('a LIVE key must proceed when the check is for LIVE');
  }
});

test('BOTH call sites require live on a live run', () => {
  const calls = source.match(/refuseUnexpectedMode\(\{ mode, source, allowLive: ALLOW_LIVE \|\| LIVE, requireLive: LIVE \}\)/g) ?? [];
  if (calls.length !== 2) throw new Error(`${calls.length} call site(s) pass requireLive, expected 2 — a path that skips it lets a test key through the live run`);
});

// Run for real, with no network: both refusals come before any Stripe call.
const run = (args, env) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: ROOT, encoding: 'utf8',
  env: { PATH: process.env.PATH, ...env },
});

test('the live run reads its own secret, and fails closed without it', () => {
  // The test secret is set and the live one is not: a live run that fell back
  // to the test key would go on to reconcile the test catalogue.
  const r = run(['--live'], { STRIPE_READ_API_KEY: 'rk_test_placeholder' });
  if (r.status !== 1) throw new Error(`--live with no live key exited ${r.status}, want 1\n${r.stdout}${r.stderr}`);
  if (!/STRIPE_LIVE_READ_API_KEY is not set/.test(r.stderr)) throw new Error(`the failure must name the live secret:\n${r.stderr}`);
});

test('the live run never writes pricing.ts', () => {
  const r = run(['--live', '--write'], { STRIPE_LIVE_READ_API_KEY: 'rk_live_placeholder' });
  if (r.status !== 1) throw new Error(`--live --write exited ${r.status}, want 1`);
  if (!/--live only checks/.test(r.stderr)) throw new Error(`the refusal must say why:\n${r.stderr}`);
});

test('BOTH call sites assert, not just the readable-account one', () => {
  // The early `return` in the permission-error path is what makes this worth a
  // case: asserting only where /v1/account is readable would let a live key
  // that CANNOT read it pass straight through — the more likely accident, not
  // the less. Counted, so adding a third path without a guard fails here.
  const calls = source.match(/refuseUnexpectedMode\(/g) ?? [];
  if (calls.length !== 2) throw new Error(`${calls.length} call site(s) refuse an unexpected mode, expected 2 — every path that determines a mode must act on it`);
  if (/livemode \? 'LIVE' : 'test'/.test(source)) throw new Error('the un-asserted inline formatting is still present — it must be replaced, not supplemented');
});

console.log('check-prices: account-pin diagnostics');

test('the guard pins an account at all', () => {
  if (!EXPECTED_ACCOUNT) throw new Error('EXPECTED_ACCOUNT is missing — the wrong-Stripe trap is unguarded');
});

test("extracts the key's own account from Stripe's permission error", () => {
  const named = STRIPE_PERMISSION_ERROR.match(NAMED_ACCOUNT_RE)?.[1];
  if (named !== 'acct_1ToBJsPDaNqc0Lek') {
    throw new Error(`extracted ${named ?? 'nothing'}, want acct_1ToBJsPDaNqc0Lek`);
  }
});

// The test this file did not have, and the reason the wrong pin survived from
// the commit that introduced it. Everything else here checks the guard's
// mechanics against a fixture; nothing checked the guard's CONSTANT against
// reality. This is the assertion that goes red if EXPECTED_ACCOUNT drifts.
//
// It reads the pin out of the source and compares it to an account id captured
// from a real Stripe response, so the two cannot be reconciled by editing one
// of them -- which is exactly what the old `.replace()` below used to do.
test('the pin names the same account our captured Stripe error does', () => {
  const named = STRIPE_PERMISSION_ERROR.match(NAMED_ACCOUNT_RE)?.[1];
  if (named !== EXPECTED_ACCOUNT) {
    throw new Error(
      `the guard pins ${EXPECTED_ACCOUNT}, but the account Stripe actually named ` +
        `for our key is ${named}. One of them is wrong, and it is not Stripe.`,
    );
  }
});

test('recognises a different account as NOT the pinned one', () => {
  const named = WRONG_ACCOUNT_ERROR.match(NAMED_ACCOUNT_RE)?.[1];
  if (named !== WRONG_ACCOUNT) throw new Error('extraction broke on the wrong-account fixture');
  if (named === EXPECTED_ACCOUNT) {
    throw new Error('the wrong-account fixture equals the pin, so this test proves nothing');
  }
});

// The three outcomes the guard has to tell apart, exercised by calling it.
// The previous version of this test asserted that a particular EXPRESSION
// appeared in the source. That passes for a branch that is present and wrong,
// and it broke the moment the branch was rewritten without its behaviour
// changing -- a test coupled to the shape of the code rather than its result.

test('a denial naming the pinned account CONFIRMS it — the grant is not needed', () => {
  const { verdict, named } = classifyAccountError(STRIPE_PERMISSION_ERROR, EXPECTED_ACCOUNT);
  if (verdict !== 'confirmed') throw new Error(`verdict was ${verdict}, want confirmed`);
  if (named !== EXPECTED_ACCOUNT) throw new Error(`named ${named}, want ${EXPECTED_ACCOUNT}`);
});

test('a denial naming a different account is a failure no permission fixes', () => {
  const { verdict, named } = classifyAccountError(WRONG_ACCOUNT_ERROR, EXPECTED_ACCOUNT);
  if (verdict !== 'wrong') throw new Error(`verdict was ${verdict}, want wrong`);
  if (named !== WRONG_ACCOUNT) throw new Error(`named ${named}, want ${WRONG_ACCOUNT}`);
});

test('an error naming NO account is unknown, never assumed to be ours', () => {
  // The real message CI is failing on today. An expired key names no account,
  // so there is nothing to confirm and the only safe verdict is unknown.
  const expired = 'Expired API Key provided: rk_test_*****ER0mQf';
  const { verdict, named } = classifyAccountError(expired, EXPECTED_ACCOUNT);
  if (verdict !== 'unknown') throw new Error(`verdict was ${verdict}, want unknown`);
  if (named !== null) throw new Error(`named ${named}, want null`);
});

test('the guard still tells the reader a permission grant is not the fix', () => {
  if (!/No permission grant fixes this/i.test(source)) {
    throw new Error('the wrong-account message no longer says the permission is not the fix');
  }
});

// A name, not a shape — so asserting it in the source is the right tool here.
// The guard read STRIPE_API_KEY. That name IS set -- as a repo secret on this
// repository -- but it holds an EXPIRED key. The org's name for a read-only
// Stripe key is STRIPE_READ_API_KEY.
//
// NOT STRIPE_SECRET_KEY: that name already holds the account's FULL secret
// key, so pointing the guard at it would swap a restricted credential for an
// unrestricted one in CI. That was proposed during review and caught before
// merge; this assertion is what stops it being proposed again.
test('the guard reads the env var this org actually sets', () => {
  if (!/process\.env\.STRIPE_READ_API_KEY/.test(source)) {
    throw new Error('the guard does not read STRIPE_READ_API_KEY');
  }
  if (/STRIPE_API_KEY/.test(source)) {
    throw new Error('STRIPE_API_KEY still appears in check-prices.mjs');
  }
});

test('a matching account produces no extra noise', () => {
  // Uses the captured error AS CAPTURED. It used to be rewritten first --
  //   STRIPE_PERMISSION_ERROR.replace('acct_1ToBJsPDaNqc0Lek', EXPECTED_ACCOUNT)
  // -- which substituted reality with the expectation before comparing them, so
  // the fixture could never contradict the constant. That single line is what
  // let a wrong pin live in this repo from the commit that added it (JAR-1207).
  const named = STRIPE_PERMISSION_ERROR.match(NAMED_ACCOUNT_RE)?.[1];
  if (named !== EXPECTED_ACCOUNT) throw new Error('extraction broke on the matching-account case');
  // The guard's branch is `named !== EXPECTED_ACCOUNT`, so this case adds nothing.
});


// ── JAR-1319: tax_behavior, the one field whose failure lands at CHECKOUT ────
//
// comparePrice is imported and CALLED against fixtures. Until this ticket the
// per-price rules only ran after a successful Stripe call, so no test could
// reach any of them -- the guard's most-cited checks were believed, never
// exercised. Extracting them is what makes the cases below writable at all.

/** A price that agrees with the site on everything. Each case below breaks
 *  exactly one field, so a failure names the rule that caught it. */
const OK_WANT = { amountCents: 9900, currency: 'usd', interval: 'year' };
const OK_GOT = {
  unit_amount: 9900,
  currency: 'usd',
  recurring: { interval: 'year', interval_count: 1 },
  tax_behavior: 'exclusive',
};
const withGot = (o) => ({ ...OK_GOT, ...o });

test('a fully-agreeing price reports nothing — the control', () => {
  // Without this, every case below could pass because comparePrice always
  // returns something, and "it complained" would look like "it caught it".
  const out = comparePrice('jt_explore_annual', OK_WANT, OK_GOT);
  if (out.length !== 0) throw new Error(`expected silence, got: ${out.join(' | ')}`);
});

test('tax_behavior `unspecified` is caught — the state both Explore prices sat in', () => {
  const out = comparePrice('jt_explore_annual', OK_WANT, withGot({ tax_behavior: 'unspecified' }));
  if (out.length !== 1) throw new Error(`expected exactly one mismatch, got ${out.length}: ${out.join(' | ')}`);
  if (!out[0].includes('jt_explore_annual')) throw new Error('the offending lookup_key must be named');
  if (!out[0].includes('unspecified')) throw new Error('the message must say what it found, not only what it wanted');
});

test('tax_behavior ABSENT is caught, and is not read as agreement', () => {
  // The discriminating case. `got.tax_behavior !== 'exclusive'` catches this,
  // but a check written as `got.tax_behavior === 'unspecified'` would not --
  // and Stripe omits the field entirely on some prices rather than sending
  // the string. Undefined must fail closed.
  const bare = withGot({});
  delete bare.tax_behavior;
  const out = comparePrice('jt_trip_pass', { ...OK_WANT, interval: 'null' }, { ...bare, recurring: null });
  if (out.length !== 1) throw new Error(`expected exactly one mismatch, got ${out.length}: ${out.join(' | ')}`);
  if (!out[0].includes('unset')) throw new Error('an absent tax_behavior must report as unset, not as "undefined"');
});

test('`inclusive` is caught too — this is not an unspecified-only check', () => {
  // Brent's ruling is that JarvisTravel prices EXCLUDE tax. An inclusive price
  // would transact happily and quietly pay the tax out of revenue, so it is
  // the case least likely to be noticed in production and most likely to be
  // waved through by a check that only looks for `unspecified`.
  const out = comparePrice('jt_explore_monthly', OK_WANT, withGot({ tax_behavior: 'inclusive' }));
  if (out.length !== 1) throw new Error(`expected exactly one mismatch, got ${out.length}: ${out.join(' | ')}`);
  if (!out[0].includes('inclusive')) throw new Error('must report the inclusive value it found');
});

test('the message says the price cannot be repaired in place', () => {
  // tax_behavior is set-once. A reader who tries to "just fix it in the
  // dashboard" finds no editable field and has to rediscover why; the guard
  // that caught it is the right place to say so.
  const [msg] = comparePrice('jt_explore_annual', OK_WANT, withGot({ tax_behavior: 'unspecified' }));
  if (!/new Price/i.test(msg) || !/lookup_key transfer/i.test(msg)) {
    throw new Error('the remedy (new Price + lookup_key transfer) must be in the message');
  }
});

test('the pre-existing rules still fire after the extraction', () => {
  // The move out of check-prices.mjs was verbatim, and this is what says so.
  // A refactor that dropped a rule would leave every tax case above green.
  const amount = comparePrice('k', OK_WANT, withGot({ unit_amount: 8800 }));
  if (amount.length !== 1 || !amount[0].includes('$88.00')) throw new Error('amount rule lost');
  const currency = comparePrice('k', OK_WANT, withGot({ currency: 'eur' }));
  if (currency.length !== 1 || !currency[0].includes('eur')) throw new Error('currency rule lost');
  const interval = comparePrice('k', OK_WANT, withGot({ recurring: { interval: 'month', interval_count: 1 } }));
  if (interval.length !== 1) throw new Error('interval rule lost');
  const count = comparePrice('k', OK_WANT, withGot({ recurring: { interval: 'year', interval_count: 3 } }));
  if (count.length !== 1) throw new Error('interval_count rule lost');
  const absent = comparePrice('k', OK_WANT, undefined);
  if (absent.length !== 1 || !absent[0].includes('no active Stripe price')) throw new Error('missing-price rule lost');
});

test('a missing price reports ONCE, not once per rule', () => {
  // Early return, not fallthrough: without it an absent price would also be
  // reported as a tax_behavior failure, and the reader would chase the wrong
  // problem first.
  const out = comparePrice('k', OK_WANT, undefined);
  if (out.length !== 1) throw new Error(`expected 1 message, got ${out.length}: ${out.join(' | ')}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
