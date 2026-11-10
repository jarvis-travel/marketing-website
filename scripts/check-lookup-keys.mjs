// The price lookup_keys are the contract this repo shares with core and web-app
// (JAR-1197). The canonical set is generated in core (config/stripe/lookup-keys.json)
// and published here, at contracts/stripe-lookup-keys.json, because marketing-website
// is the one public repo every consumer's CI can fetch without a credential.
//
// This guard asserts marketing's own list — the PRICES keys in
// src/app/data/pricing.ts — is exactly the published canonical set. A key added
// to the catalogue in core without updating pricing.ts (or the reverse) fails
// this PR rather than the pricing page at runtime. core's own CI asserts the
// published copy still equals core's canonical, closing the loop.
//
// No credential and no network: this reads two files in the repo. `--allow-skip`
// is intentionally absent — unlike check-prices.mjs's Stripe reconciliation,
// there is nothing here that can only run in CI.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CANONICAL = join(ROOT, 'contracts/stripe-lookup-keys.json');
const PRICING = join(ROOT, 'src/app/data/pricing.ts');

function fail(msg) {
  console.error(`lookup-keys: ${msg}`);
  process.exit(1);
}

// Canonical set.
let canonical;
try {
  canonical = JSON.parse(readFileSync(CANONICAL, 'utf8')).lookup_keys;
} catch (e) {
  fail(`could not read contracts/stripe-lookup-keys.json: ${e.message}`);
}
if (!Array.isArray(canonical) || canonical.length < 3) {
  fail(
    `contracts/stripe-lookup-keys.json has ${Array.isArray(canonical) ? canonical.length : 0} lookup_keys (want >=3) — ` +
      'the launch catalogue has three, so a shorter list means the published copy is wrong and this guard would pass vacuously.',
  );
}

// The keys marketing actually ships: the PRICES object in pricing.ts, read from
// between the generated markers so a stray jt_ token elsewhere cannot widen it.
const src = readFileSync(PRICING, 'utf8');
const block = src.match(/BEGIN GENERATED PRICES[\s\S]*?END GENERATED PRICES/);
if (!block) fail('src/app/data/pricing.ts has no BEGIN/END GENERATED PRICES block to read.');
const marketingKeys = [...block[0].matchAll(/^\s*(jt_[a-z0-9_]+):/gm)].map((m) => m[1]);
if (marketingKeys.length < 3) {
  fail(
    `extracted ${marketingKeys.length} keys from the pricing.ts PRICES block (want >=3) — ` +
      'the extractor stopped matching, which would let this guard pass vacuously.',
  );
}

const canonSet = new Set(canonical);
const mktSet = new Set(marketingKeys);
const missing = [...canonSet].filter((k) => !mktSet.has(k));
const extra = [...mktSet].filter((k) => !canonSet.has(k));
if (missing.length || extra.length) {
  fail(
    'src/app/data/pricing.ts does not carry exactly the canonical lookup_keys' +
      (missing.length ? `\n  in the canonical, missing from pricing.ts: ${missing.join(', ')}` : '') +
      (extra.length ? `\n  in pricing.ts, not in the canonical: ${extra.join(', ')}` : '') +
      '\n  The canonical is contracts/stripe-lookup-keys.json (published from core/config/stripe/lookup-keys.json).' +
      '\n  Change the key set in core first, re-publish the copy here, then update pricing.ts.',
  );
}

console.log(`lookup-keys: pricing.ts matches the canonical (${[...canonSet].sort().join(', ')})`);
