#!/usr/bin/env node
// Pricing guard, in two halves (JAR-660).
//
//   node scripts/check-prices.mjs           # always: no price literals in components
//   STRIPE_READ_API_KEY=rk_... node scripts/check-prices.mjs         # + reconcile with Stripe
//   STRIPE_READ_API_KEY=rk_... node scripts/check-prices.mjs --write # + rewrite pricing.ts
//   STRIPE_LIVE_READ_API_KEY=rk_live_... node scripts/check-prices.mjs --live  # + reconcile with LIVE
//
// Half one — no literals. Every dollar amount on this site renders from
// src/app/data/pricing.ts. The page used to carry them inline, which is how it
// advertised $24.95 for a Trip Pass we would never have charged, for weeks,
// with nothing failing. This half always runs and needs no credential.
//
// Half two — Stripe agrees. A shared constant nobody verifies drifts exactly
// as fast as a literal did, so the constants are reconciled against Stripe by
// lookup_key. Needs a read-only key. Without one it says so loudly and skips,
// rather than passing quietly and implying it checked.
//
// Fail closed: an unreadable file, an unparseable module or a Stripe error is
// a failure, never a pass.

import { classifyAccountError } from './lib/account-error.mjs';
import { modeOf, refuseUnexpectedMode } from './lib/account-mode.mjs';
import { comparePrice } from './lib/price-compare.mjs';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, sep } from 'node:path';

const ROOT = process.cwd();
const PRICING_FILE = join(ROOT, 'src/app/data/pricing.ts');
const COMPONENT_DIRS = ['src/app/pages', 'src/app/components', 'src/app'];
const WRITE = process.argv.includes('--write');
// Skipping the Stripe half has to be asked for. See the STRIPE_READ_API_KEY branch.
const ALLOW_SKIP = process.argv.includes('--allow-skip');
// Deploy-time mode: a network/API outage warns instead of failing the deploy
// (pr-checks stays strict). A verified mismatch still fails in both modes.
const NETWORK_WARN = process.argv.includes('--network-warn');

const fail = (msg) => {
  console.error(`prices: ${msg}`);
  process.exit(1);
};

// ── half one: no dollar literals outside the pricing module ─────────────────

// $24.99, $99, $1,195.00 — any currency-shaped literal. Deliberately naive:
// a false positive is a five-second conversation, a false negative is a wrong
// price on the public site.
const MONEY = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

// The "doing it right" escape hatch: formatPrice(2499) renders $24.99 with no
// $ literal in the file — the natural next move for a dev reintroducing a
// hardcoded amount (review deleg_dd2f886e). Flag it too.
const HARDCODED_FORMAT = /formatPrice\s*\(\s*['"\d]/;

function sourceFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return out; // directory does not exist in this checkout
  }
  for (const entry of entries) {
    const rel = join(dir, entry);
    const abs = join(ROOT, rel);
    if (statSync(abs).isDirectory()) {
      out.push(...sourceFiles(rel));
    } else if (['.ts', '.tsx'].includes(extname(entry))) {
      out.push(rel);
    }
  }
  return out;
}

const scanned = new Set();
const literalHits = [];

for (const dir of COMPONENT_DIRS) {
  for (const rel of sourceFiles(dir)) {
    if (scanned.has(rel)) continue;
    scanned.add(rel);
    // Normalise separators: join() yields backslashes on Windows, so comparing
    // against a forward-slash literal silently failed to exclude the file.
    if (rel.split(sep).join('/') === 'src/app/data/pricing.ts') continue; // the one place amounts belong

    const text = readFileSync(join(ROOT, rel), 'utf8');
    let inBlockComment = false;
    text.split('\n').forEach((line, i) => {
      // Comments explaining the history are allowed to name old prices.
      // Stateful: a multi-line /* ... */ block is stripped across lines, not
      // just per-line (review deleg_dd2f886e — a $24.95 in a narrative block
      // comment was a false positive).
      let code = line;
      if (inBlockComment) {
        const end = code.indexOf('*/');
        if (end === -1) return; // still inside the block
        code = code.slice(end + 2);
        inBlockComment = false;
      }
      const start = code.indexOf('/*');
      if (start !== -1) {
        const end = code.indexOf('*/', start + 2);
        if (end === -1) {
          code = code.slice(0, start);
          inBlockComment = true;
        } else {
          code = code.slice(0, start) + code.slice(end + 2);
        }
      }
      code = code.replace(/\/\/.*$/, '');
      for (const hit of code.match(MONEY) ?? []) {
        literalHits.push(`${rel}:${i + 1}  ${hit}  ${line.trim().slice(0, 80)}`);
      }
      if (HARDCODED_FORMAT.test(code)) {
        literalHits.push(`${rel}:${i + 1}  formatPrice(<literal>)  ${line.trim().slice(0, 80)}`);
      }
    });
  }
}

if (literalHits.length) {
  console.error('prices: dollar amounts hardcoded outside src/app/data/pricing.ts\n');
  for (const hit of literalHits) console.error(`  - ${hit}`);
  console.error('\nRender them with priceOf(<lookup key>) instead. The site advertised');
  console.error('$24.95 for a $24.99 Trip Pass because the number lived in a component.');
  process.exit(1);
}

console.log(`prices: ok — no amount literals in ${scanned.size} component files`);

// ── half two: the constants match Stripe ────────────────────────────────────

// The one Stripe account this catalogue belongs to: the org's JarvisTravel
// sandbox, decided on JAR-660 (2026-08-09) after the catalogue was found
// stranded in a personal account the org cannot see or manage. A sandbox is
// its own account id, so at live launch the catalogue is minted in the org's
// live account and this pin moves in that same deliberate act — this guard
// fails loudly if the edit is forgotten.
//
// This is not paranoia: a second account once held prices under the same
// lookup keys at the same amounts, and nothing here could tell them apart,
// because everything below resolves by lookup key (JAR-659). Right prices,
// wrong Stripe, green check.
// The org has ONE Stripe account; test and live are modes of it, not separate
// accounts. This pin was wrong from the commit that introduced it (JAR-1207):
// the catalogue has always lived here, so no key we can issue could satisfy the
// old value and the guard could not pass at all.
// Reconciling against LIVE is a decision, never a default. Without this the
// only way to end up reading live is by accident, which is the whole finding.
const ALLOW_LIVE = process.argv.includes('--allow-live');
// The live run (JAR-1739). Production charges live prices, and live is a
// separate catalogue, so CI reconciles both. The live run reads its own secret
// and REQUIRES a live key: --allow-live only permits one, so a test key in the
// live secret would check the test catalogue and report it as live.
const LIVE = process.argv.includes('--live');

const EXPECTED_ACCOUNT = 'acct_1ToBJsPDaNqc0Lek';

// The three keys this catalogue is defined as having. Asserted as an exact set
// below, so a key *deleted* from pricing.ts fails here rather than at runtime
// when priceOf() reaches into undefined.
const EXPECTED_KEYS = ['jt_trip_pass', 'jt_explore_annual', 'jt_explore_monthly'];

const KEY = LIVE ? process.env.STRIPE_LIVE_READ_API_KEY : process.env.STRIPE_READ_API_KEY;
const KEY_NAME = LIVE ? 'STRIPE_LIVE_READ_API_KEY' : 'STRIPE_READ_API_KEY';
const KEY_MODE = LIVE ? 'LIVE mode' : 'test mode';
if (LIVE && WRITE) {
  fail('--live only checks. pricing.ts is regenerated from the test catalogue, never from live.');
}
if (!KEY) {
  // Fail closed. A guard whose whole promise is "fail when it drifts" must not
  // report success when it did not check — and it did exactly that in CI,
  // because the repo secret was never configured: every PR got a green
  // "SKIPPED the Stripe reconciliation" and nobody looked again.
  //
  // Local runs without a key are legitimate, so they can opt out explicitly.
  // CI cannot: there is no reading of an unset secret that means "verified".
  if (!ALLOW_SKIP) {
    console.error(`prices: ${KEY_NAME} is not set, so the Stripe reconciliation did not run.`);
    console.error('');
    console.error(`  In CI: configure the ${KEY_NAME} repo secret (restricted, read-only, ${KEY_MODE}).`);
    console.error('  Locally: pass --allow-skip to run only the literal scan.');
    console.error('');
    console.error('Exiting non-zero rather than passing as if the amounts had been checked.');
    process.exit(1);
  }
  console.log(`prices: SKIPPED the Stripe reconciliation — ${KEY_NAME} is not set (--allow-skip).`);
  console.log('        The literal scan above still ran. Amounts were NOT verified against Stripe.');
  process.exit(0);
}
if (KEY.includes('_live_') && WRITE) {
  fail('refusing to write from a live key — use a restricted test key');
}
// Check-only mode still accepts a live restricted key, but while the pin
// names the sandbox, a live key fails the account assert below — correctly:
// there is no live catalogue yet. Launch mints one in the org's live account
// and moves EXPECTED_ACCOUNT, and from then on live check-only verification
// works as designed (review deleg_dd2f886e F1). Writing is still banned —
// regenerate only from test.

let module_;
try {
  module_ = readFileSync(PRICING_FILE, 'utf8');
} catch (err) {
  fail(`cannot read ${PRICING_FILE}: ${err.message}`);
}

// Parse the generated block rather than importing TS from node.
const BLOCK = /\/\/ BEGIN GENERATED PRICES[\s\S]*?\/\/ END GENERATED PRICES/;
const block = module_.match(BLOCK);
if (!block) fail('pricing.ts has no BEGIN/END GENERATED PRICES block to reconcile');

// Parsing has to be all-or-nothing. Anything this regex fails to understand is
// an amount rendered on the site that nothing compared against Stripe, and the
// old `local.size === 0` check only caught the case where *every* entry broke.
// One malformed entry — reordered fields, a numeric separator like 2_499 — was
// silently dropped and the guard still reported ok.
const ENTRY =
  /(\w+):\s*\{\s*lookupKey:\s*'([^']+)',\s*amountCents:\s*(\d+),\s*currency:\s*'([^']+)',\s*interval:\s*(null|'[^']+')\s*\}/g;

const local = new Map();
for (const m of block[0].matchAll(ENTRY)) {
  const [, propName, lookupKey, amount, currency, interval] = m;
  // Key by the property name, and require the lookupKey to agree with it.
  // Keying by the lookupKey value let a typo'd entry — jt_trip_pass pointing at
  // 'jt_explore_annual' — collapse two entries into one. Both survivors matched
  // Stripe, the guard passed, and the site rendered an unverified $24.99.
  if (propName !== lookupKey) {
    fail(`pricing.ts: entry '${propName}' has lookupKey '${lookupKey}' — they must be identical`);
  }
  if (local.has(propName)) fail(`pricing.ts: '${propName}' is defined more than once`);
  local.set(propName, {
    amountCents: Number(amount),
    currency,
    interval: interval.replace(/'/g, ''),
  });
}

// Every top-level `name: {` in the block must have been understood above.
const declared = [...block[0].matchAll(/^\s{2}(\w+):\s*\{/gm)].map((m) => m[1]);
const unparsed = declared.filter((name) => !local.has(name));
if (unparsed.length) {
  fail(
    `pricing.ts: could not parse ${unparsed.join(', ')} — the guard would have skipped ` +
      'them and reported ok. Fix the entry, or the parser if the shape changed.',
  );
}

// And the set has to be exactly what we expect: a *deleted* key used to pass,
// because the remaining entries still matched Stripe. priceOf() then hit
// undefined.amountCents and took the pricing page down at runtime.
const missing = EXPECTED_KEYS.filter((k) => !local.has(k));
const extra = [...local.keys()].filter((k) => !EXPECTED_KEYS.includes(k));
if (missing.length || extra.length) {
  fail(
    'pricing.ts does not define exactly the expected catalogue' +
      (missing.length ? `\n  missing: ${missing.join(', ')}` : '') +
      (extra.length ? `\n  unexpected: ${extra.join(', ')}` : '') +
      '\n  If the catalogue really changed, update EXPECTED_KEYS and PriceLookupKey together.',
  );
}

// Fetch with a 10s timeout and 2 retries with backoff. A Stripe incident or
// blackholed connection must not hang a job or fail every PR/deploy on a
// transient (review deleg_dd2f886e Sec-M2 / Design-F5). With --network-warn
// (deploy time) an unreachable Stripe warns and exits 0 — pr-checks stays
// strict, so drift still fails the PR; a deploy is not blocked by an outage
// for a copy-fix unrelated to pricing.
async function stripeFetch(path) {
  const attempts = 3;
  for (let i = 0; i < attempts; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(`https://api.stripe.com${path}`, {
        headers: { Authorization: `Bearer ${KEY}` },
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Stripe transient error ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
        continue;
      }
      if (NETWORK_WARN) {
        console.error(
          `prices: WARNING — could not verify against Stripe (${err.message}). ` +
            'Deploy continues; pr-checks will fail on the next push.',
        );
        process.exit(0);
      }
      fail(`cannot reach Stripe (${err.message}) after ${attempts} attempts`);
    }
  }
  fail('unreachable');
}

async function assertAccount() {
  const res = await stripeFetch('/v1/account');
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message ?? String(res.status);
    // Stripe names the key's own account in the permission error, so when that
    // account is ALREADY the wrong one, say both things now. Reporting only the
    // missing permission sends the reader to the dashboard to grant it, and
    // buys a second failing run that finally names the real problem — and CI
    // round-trips here are minutes each.
    const { verdict, named } = classifyAccountError(message, EXPECTED_ACCOUNT);

    // A permission denial NAMES the key's own account, which is the single fact
    // this request exists to establish. The old code extracted it, used it only
    // to write a nicer error, and failed anyway -- discarding the answer it had
    // just been given, and putting the accounts_kyc_basic_read grant on the
    // critical path for information Stripe had already volunteered (JAR-1207).
    //
    // Stated tradeoff rather than an accident: this reads Stripe's error TEXT,
    // which is more brittle than a response field. This file already parses
    // that same message today, so it is not new exposure -- and if Stripe
    // rewords it, `named` goes undefined and we fall through to the failure
    // below rather than guessing. Fail-closed is what makes it acceptable.
    if (verdict === 'confirmed') {
      // Mode comes from the key prefix, not from the API: /v1/account is what
      // carries `livemode` and it is exactly what we could not read. Labelled
      // as derived so nobody reads it as confirmed by Stripe.
      const { mode, source } = modeOf({ key: KEY });
      const refusal = refuseUnexpectedMode({ mode, source, allowLive: ALLOW_LIVE || LIVE, requireLive: LIVE });
      if (refusal) fail(refusal);
      console.log(`prices: reading ${named} (${mode} mode, inferred from ${source})`);
      console.log('        Account confirmed from Stripe\'s permission error — /v1/account is');
      console.log('        not readable with this key and does not need to be.');
      return;
    }

    if (verdict === 'wrong') {
      fail(`that key belongs to ${named}, not ${EXPECTED_ACCOUNT}.\n` +
        `       No permission grant fixes this. Issue a restricted, read-only ${LIVE ? 'LIVE' : 'TEST'}\n` +
        `       key from ${EXPECTED_ACCOUNT} and replace the ${KEY_NAME} secret.`);
    }

    // Neither readable nor self-identifying. Not knowing which account we are
    // reading is itself the failure -- never assume it is the right one.
    fail(`cannot read /v1/account (${message}), and the error does not name an\n` +
      `       account either, so this check cannot confirm it is reading\n` +
      `       ${EXPECTED_ACCOUNT}. If the key is expired or revoked, replace it;\n` +
      `       if Stripe reworded the permission error, update the parse.`);
  }
  if (body.id !== EXPECTED_ACCOUNT) {
    fail(`key belongs to ${body.id}, expected ${EXPECTED_ACCOUNT} — comparing against the wrong Stripe account`);
  }
  const { mode, source } = modeOf({ livemode: body.livemode, key: KEY });
  const refusal = refuseUnexpectedMode({ mode, source, allowLive: ALLOW_LIVE || LIVE, requireLive: LIVE });
  if (refusal) fail(refusal);
  console.log(`prices: reading ${body.id} (${mode} mode, reported by ${source})`);
}

async function stripePrices() {
  // Page through: Stripe mints a new active Price on every change, so the
  // active catalogue grows monotonically — a single limit=100 page truncates
  // the comparison (review deleg_dd2f886e B&L-F6 / Design-F7).
  const out = [];
  let startingAfter;
  for (;;) {
    const q = new URLSearchParams({ active: 'true', limit: '100' });
    if (startingAfter) q.set('starting_after', startingAfter);
    const res = await stripeFetch(`/v1/prices?${q}`);
    const body = await res.json();
    if (!res.ok) fail(`Stripe error (${res.status}): ${body?.error?.message ?? 'unknown'}`);
    out.push(...(body.data ?? []));
    if (!body.has_more || !body.data?.length) break;
    startingAfter = body.data[body.data.length - 1].id;
  }
  return out;
}

await assertAccount();

const remote = new Map();
for (const price of await stripePrices()) {
  if (price.lookup_key) remote.set(price.lookup_key, price);
}

const mismatches = [];

// The per-price rules live in scripts/lib/price-compare.mjs so they can be
// exercised against fixtures. They used to run only when a live Stripe call
// succeeded, which meant no test could reach them.
for (const [key, want] of local) {
  mismatches.push(...comparePrice(key, want, remote.get(key)));
}

if (WRITE) {
  // Everything below is interpolated into a committed .ts file, so every field
  // is validated before it gets there. Values arriving from an API are not
  // trusted source code: a leaked restricted key plus `npm run sync:prices`
  // would otherwise be enough to write arbitrary TypeScript into the repo via
  // a currency of `usd' }, evil: {`. The guard would then pass, because it
  // checks that the file agrees with Stripe, not that Stripe is sane.
  const STRIPE_INTERVALS = ['day', 'week', 'month', 'year'];
  const lines = [...local.keys()].map((key) => {
    const got = remote.get(key);
    if (!got) fail(`cannot rewrite: Stripe has no active price with lookup_key ${key}`);

    if (!/^[a-z0-9_]+$/.test(got.lookup_key ?? '')) {
      fail(`cannot rewrite: Stripe lookup_key ${JSON.stringify(got.lookup_key)} is not [a-z0-9_]`);
    }
    if (!Number.isSafeInteger(got.unit_amount) || got.unit_amount <= 0) {
      fail(`cannot rewrite: ${key} has unit_amount ${JSON.stringify(got.unit_amount)}`);
    }
    // The Price model has no interval_count, so a quarterly price is
    // unrepresentable — writing one yields a file that still fails the guard
    // (review deleg_dd2f886e B&L-F4 / Design-F3). Refuse instead of repairing
    // into a permanently red state.
    if ((got.recurring?.interval_count ?? 1) !== 1) {
      fail(
        `cannot rewrite: ${key} bills every ${got.recurring.interval_count} ${got.recurring.interval}s ` +
          '— the site renders a simple "per <interval>" and the Price type cannot express a count',
      );
    }
    if (got.currency !== 'usd') {
      fail(`cannot rewrite: ${key} is ${JSON.stringify(got.currency)}, expected usd`);
    }
    const rawInterval = got.recurring?.interval ?? null;
    if (rawInterval !== null && !STRIPE_INTERVALS.includes(rawInterval)) {
      fail(`cannot rewrite: ${key} has interval ${JSON.stringify(rawInterval)}`);
    }

    const interval = rawInterval ? `'${rawInterval}'` : 'null';
    return `  ${key}: { lookupKey: '${key}', amountCents: ${got.unit_amount}, currency: '${got.currency}', interval: ${interval} },`;
  });
  const rebuilt = [
    '// BEGIN GENERATED PRICES — npm run sync:prices',
    'export const PRICES: Readonly<Record<PriceLookupKey, Price>> = {',
    ...lines,
    '};',
    '// END GENERATED PRICES',
  ].join('\n');
  writeFileSync(PRICING_FILE, module_.replace(BLOCK, rebuilt));
  console.log(`prices: rewrote ${local.size} prices in pricing.ts from Stripe`);
  process.exit(0);
}

if (mismatches.length) {
  console.error('\nprices: the site and Stripe disagree\n');
  for (const m of mismatches) console.error(`  - ${m}`);
  console.error('\nStripe is the source of truth. Run `npm run sync:prices` to take its answer,');
  console.error('or fix the price in Stripe if the site is what is right.');
  process.exit(1);
}

console.log(`prices: ok — ${local.size} prices match Stripe`);
