#!/usr/bin/env node
// Contract test for the lookup-keys guard (JAR-1197). Each case builds a
// throwaway repo skeleton — contracts/stripe-lookup-keys.json + a pricing.ts
// carrying a PRICES block — and runs the guard against it via its CLI, the same
// path CI uses. Mirrors check-pricing-ctas.test.mjs. The rename cases keep the
// key COUNT at three so they exercise the set-mismatch branch rather than the
// vacuity floor; a separate case covers the floor.
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const GUARD = new URL('../check-lookup-keys.mjs', import.meta.url).pathname;

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

const canonicalJSON = (keys) => JSON.stringify({ note: 'test', lookup_keys: keys }, null, 2);
const pricingTS = (keys) => `export type PriceLookupKey = ${keys.map((k) => `'${k}'`).join(' | ')};
// BEGIN GENERATED PRICES
export const PRICES = {
${keys.map((k) => `  ${k}: { lookupKey: '${k}', amountCents: 100, currency: 'usd', interval: null },`).join('\n')}
};
// END GENERATED PRICES`;

function run({ canonical, pricing }) {
  const dir = mkdtempSync(join(tmpdir(), 'lkguard-'));
  try {
    mkdirSync(join(dir, 'contracts'), { recursive: true });
    mkdirSync(join(dir, 'src/app/data'), { recursive: true });
    writeFileSync(join(dir, 'contracts/stripe-lookup-keys.json'), canonical);
    writeFileSync(join(dir, 'src/app/data/pricing.ts'), pricing);
    try {
      const out = execSync(`node ${GUARD}`, { cwd: dir, encoding: 'utf8' });
      return { code: 0, out };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const THREE = ['jt_trip_pass', 'jt_explore_annual', 'jt_explore_monthly'];

test('passes when pricing.ts carries exactly the canonical set', () => {
  const r = run({ canonical: canonicalJSON(THREE), pricing: pricingTS(THREE) });
  assert.equal(r.code, 0, `expected pass, got:\n${r.out}`);
});

// The November annual (JAR-4251) is the first key with digits in it. The
// extractor used to match jt_[a-z_]+ and read the key as absent, which failed
// with "missing from pricing.ts" while the key was right there — a misleading
// failure that costs a debugging round trip. Pinned so a narrowed regex fails
// here, naming the extractor, rather than in CI naming the wrong file.
test('extracts a key carrying digits (jt_explore_annual_nov2026)', () => {
  const FOUR = ['jt_trip_pass', 'jt_explore_annual', 'jt_explore_annual_nov2026', 'jt_explore_monthly'];
  const r = run({ canonical: canonicalJSON(FOUR), pricing: pricingTS(FOUR) });
  assert.equal(r.code, 0, `expected pass, got:\n${r.out}`);
});

test('fails naming a canonical key pricing.ts lacks (rename, count stays 3)', () => {
  const r = run({
    canonical: canonicalJSON(['jt_trip_pass', 'jt_explore_annual', 'jt_explore_plus']),
    pricing: pricingTS(THREE),
  });
  assert.equal(r.code, 1, 'expected failure');
  assert.match(r.out, /missing from pricing\.ts: jt_explore_plus/, `wrong reason:\n${r.out}`);
});

test('fails naming a pricing.ts key not in the canonical (rename, count stays 3)', () => {
  const r = run({
    canonical: canonicalJSON(THREE),
    pricing: pricingTS(['jt_trip_pass', 'jt_explore_annual', 'jt_explore_weekly']),
  });
  assert.equal(r.code, 1, 'expected failure');
  assert.match(r.out, /not in the canonical: jt_explore_weekly/, `wrong reason:\n${r.out}`);
});

test('fails closed when the canonical shrinks below the launch catalogue', () => {
  const r = run({ canonical: canonicalJSON(['jt_trip_pass']), pricing: pricingTS(['jt_trip_pass']) });
  assert.equal(r.code, 1, 'expected failure');
  assert.match(r.out, /want >=3/, `wrong reason:\n${r.out}`);
});

console.log(`\ncheck-lookup-keys: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
