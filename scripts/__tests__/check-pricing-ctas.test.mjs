#!/usr/bin/env node
// Contract test for the pricing-CTA guard (JAR-1184 review F2).
//
// Until this file, the guard was wired into two workflows but NEVER EXECUTED
// by CI: `test:scripts` enumerates suites explicitly and this suite was
// missing, so every mutation the PR description claimed (revert to /contact,
// a drifted key, a missing PRICES block) was unverifiable. It also pins the
// backward-scan's exact boundaries - the `<a` prefix matches `<article` too,
// which is the known sharp edge (review F3) - so a formatter rearranging the
// page cannot silently change what the guard reads.
//
// Each case builds a throwaway repo skeleton: PricingPage.tsx + pricing.ts,
// then runs the guard against it via its CLI (same path CI uses).
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const GUARD = new URL('../check-pricing-ctas.mjs', import.meta.url).pathname;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (e) {
    failed++;
    console.error(`  \u2717 ${name}\n      ${e.message}`);
  }
}

const PRICES = `export const PRICES = {
  jt_trip_pass: { amount: 4900, interval: 'one_time' },
  jt_explore_annual: { amount: 9500, interval: 'year' },
  jt_explore_monthly: { amount: 1195, interval: 'month' },
} as const;`;

// The off-pricing CTAs the guard now also reads. Valid by default so the cases
// above keep testing what they tested — a fixture that fails for a reason the
// case is not about proves nothing. Each is overridable per case.
const PRICING_CTA = `export default function P() {
  return <Link to="/pricing" className="px-8 py-3.5">Join Now</Link>;
}`;

function withRepo({ page, pricing = PRICES, nav = PRICING_CTA, home = PRICING_CTA, features = PRICING_CTA, contact = PRICING_CTA }, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ctaguard-'));
  try {
    mkdirSync(join(dir, 'src/app/pages'), { recursive: true });
    mkdirSync(join(dir, 'src/app/data'), { recursive: true });
    mkdirSync(join(dir, 'src/app/components'), { recursive: true });
    writeFileSync(join(dir, 'src/app/pages/PricingPage.tsx'), page);
    writeFileSync(join(dir, 'src/app/data/pricing.ts'), pricing);
    writeFileSync(join(dir, 'src/app/components/Navigation.tsx'), nav);
    writeFileSync(join(dir, 'src/app/pages/HomePage.tsx'), home);
    writeFileSync(join(dir, 'src/app/pages/FeaturesPage.tsx'), features);
    writeFileSync(join(dir, 'src/app/pages/ContactPage.tsx'), contact);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(dir) {
  try {
    const out = execSync(`node ${GUARD}`, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const cta = (target) => `<a
  href={${target}}
  className="mt-auto self-start px-8 py-3.5 rounded-full font-semibold border"
>
  Join Now
</a>`;

const GOOD_PAGE = `import { appJoinUrl } from '../data/appLink';
export function PricingPage() {
  return (
    <div>
      <a href={appJoinUrl('jt_trip_pass')} className="px-8 py-3.5">Join Now</a>
      <a href={appJoinUrl('jt_explore_annual')} className="px-8 py-3.5">Join Now</a>
    </div>
  );
}`;

test('accepts the shipped page: both CTAs via appJoinUrl with declared keys', () => {
  withRepo({ page: GOOD_PAGE }, (d) => {
    const r = run(d);
    assert(r.code === 0, `guard failed a correct page: ${r.out}`);
    assert(/signup CTAs OK/.test(r.out), `unexpected output: ${r.out}`);
  });
});

// MUTATION 1: the regression the guard exists for - a CTA reverted to
// /contact. Building, rendering, and screenshotting all stay green.
// Review F3. The scan took the LAST opener before the label; an inline anchor
// that opened and closed in between — a "see plans" aside inside the card —
// became "the CTA" and its href was read instead of the real one. The CTA
// below is a correct appJoinUrl link; the guard used to flag it anyway.
test('is not fooled by a closed inline anchor between the CTA opener and its label', () => {
  withRepo({
    page: `import { appJoinUrl } from '../data/appLink';
export function PricingPage() {
  return (
    <div>
      <a
        href={appJoinUrl('jt_trip_pass')}
        className="px-8 py-3.5"
      >
        <small><a href="/pricing#faq">see plans</a></small>
        <span>Join Now</span>
      </a>
    </div>
  );
}`,
  }, (dir) => {
    const r = run(dir);
    assert(r.code === 0, `guard should accept the real CTA: ${r.out}`);
    assert(/signup CTAs OK/.test(r.out), `unexpected output: ${r.out}`);
  });
});

test('refuses a Join Now reverted to /contact', () => {
  withRepo({
    page: `import { Link } from 'react-router-dom';
export function PricingPage() {
  return (
    <div>
      <Link to="/contact" className="px-8 py-3.5">Join Now</Link>
    </div>
  );
}`,
  }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a CTA reverted to /contact');
    assert(/instead of appJoinUrl/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// MUTATION 2: a literal key the catalogue does not declare - the drift case.
test('refuses a lookup key PRICES does not declare', () => {
  withRepo({
    page: GOOD_PAGE.replace("appJoinUrl('jt_explore_annual')", "appJoinUrl('jt_explore_annual_plus')"),
  }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a key that is not in PRICES');
    assert(/names a lookup key PRICES does not declare/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// MUTATION 3: the vacuous pass - no catalogue, nothing to check against.
test('fails closed when PRICES declares no lookup keys', () => {
  withRepo({ page: GOOD_PAGE, pricing: 'export const PRICES = {} as const;' }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed with an empty catalogue (vacuous check)');
    assert(/no lookup keys found/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// MUTATION 4: the page losing its CTAs entirely must not read as clean.
test('refuses a page with no Join Now CTA at all', () => {
  withRepo({
    page: `export function PricingPage() {
  return <div>Nothing to see here</div>;
}`,
  }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a page with no CTA (vacuous check)');
    assert(/no "Join Now" CTA found/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// BOUNDARY (review F3): `<article` between the anchor open and the label must
// not be read as the anchor's open tag. Locked so a future tightening or a
// formatter cannot change what the backward scan reads without this going red.
test('accepts a card-wrapped CTA (<article is not an anchor opener)', () => {
  withRepo({
    page: `import { appJoinUrl } from '../data/appLink';
export function PricingPage() {
  return (
    <div>
      <a
        href={appJoinUrl('jt_trip_pass')}
        className="px-8 py-3.5"
      >
        <article className="card">
          <span>Join Now</span>
        </article>
      </a>
    </div>
  );
}`,
  }, (d) => {
    const r = run(d);
    // The boundary-checked scan skips `<article` (not an anchor) and reads the
    // real `<a` opener with its appJoinUrl target: the card-wrapped CTA is
    // CORRECT and must pass. Pinning this the other way round - before the
    // tightening, the scan flagged it as a false positive.
    assert(r.code === 0, `guard flagged a card-wrapped CTA: ${r.out}`);
  });
});

// DIRECT-KEY: a hand-written href with a valid key bypassing appJoinUrl.
test('refuses a hand-written signup href that bypasses appJoinUrl', () => {
  withRepo({
    page: `export function PricingPage() {
  return (
    <div>
      <a href="https://app.jarvistravel.com/auth/sign-up?plan=jt_trip_pass" className="px-8 py-3.5">Join Now</a>
    </div>
  );
}`,
  }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a hand-written href bypassing appJoinUrl');
    assert(/instead of appJoinUrl/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// ── The OTHER half of the split ────────────────────────────────────
//
// The guard now asserts both directions, and both are mutated below. If only
// one reddens, the guard encodes a preference rather than a contract: it would
// stop a revert while permitting a silent migration, and a migration has to
// be deliberate.

test('refuses an off-pricing CTA migrated to the app', () => {
  withRepo(
    {
      page: GOOD_PAGE,
      nav: `export default function N() {
  return <a href={appJoinUrl('jt_explore_annual')} className="px-5 py-2.5">Join Now</a>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted a silent migration off /pricing');
      assert(/Navigation\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/JAR-1630/.test(r.out), `the error does not point at the decision: ${r.out}`);
      // The message must tell the migrator what to do, not merely refuse.
      assert(/OFF_PRICING/.test(r.out), `the error does not say how to make it deliberate: ${r.out}`);
    },
  );
});

test('refuses an off-pricing CTA pointed at any third destination', () => {
  // Not just app-vs-pricing: "/signup" is neither, and a guard that only knew
  // the two known answers would pass it.
  withRepo(
    {
      page: GOOD_PAGE,
      home: `export default function H() {
  return <Link to="/signup" className="px-8 py-4">Join Now</Link>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted a CTA to a third destination');
      assert(/HomePage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/\/signup/.test(r.out), `the error does not name what it found: ${r.out}`);
    },
  );
});

test('refuses an off-pricing Join Now left on /contact', () => {
  // The loop this guard's current decision closes: Contact's own Join Now linked
  // to /contact, the page it sits on.
  withRepo(
    {
      page: GOOD_PAGE,
      contact: `export default function C() {
  return <a href="/contact" className="px-8 py-4">Join Now</a>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted a Join Now left on /contact');
      assert(/ContactPage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/targets \/contact/.test(r.out), `the error does not name what it found: ${r.out}`);
    },
  );
});

test('refuses a file whose Join Now disappeared — a guard watching nothing', () => {
  // The vacuity case. Deleting the CTA rather than migrating it would otherwise
  // pass silently: zero labels means zero violations.
  withRepo(
    { page: GOOD_PAGE, features: 'export default function F() { return <div>no cta here</div>; }' },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard passed a file with no CTA at all');
      assert(/FeaturesPage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/watching nothing/.test(r.out), `unexpected reason: ${r.out}`);
    },
  );
});

test('accepts the shipped split: pricing into the app, the rest on /pricing', () => {
  // The control for all three above. Without it, a guard that failed everything
  // would satisfy every mutation case in this file.
  withRepo({ page: GOOD_PAGE }, (dir) => {
    const r = run(dir);
    assert(r.code === 0, `guard failed the shipped split: ${r.out}`);
    assert(/signup CTAs OK/.test(r.out), `unexpected output: ${r.out}`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
