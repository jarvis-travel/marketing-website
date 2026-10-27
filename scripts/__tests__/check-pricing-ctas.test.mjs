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
const JOIN_CTA = `import { appJoinUrl } from '../data/appLink';
export default function P() {
  return <a href={appJoinUrl()} className="px-8 py-3.5">Start planning</a>;
}`;

// The link helper, which the guard reads to see where every Start planning and the
// Sign in link really land (JAR-3180). Valid by default, like the CTAs.
const GOOD_APP_LINK = `const APP_ORIGIN = 'https://app.example';
export function appSignInUrl() {
  return \`\${APP_ORIGIN}/auth/sign-in\`;
}
export function appJoinUrl(plan) {
  const signUp = \`\${APP_ORIGIN}/auth/sign-up\`;
  return plan ? \`\${signUp}?plan=\${encodeURIComponent(plan)}\` : signUp;
}`;

function withRepo({ page, pricing = PRICES, nav = JOIN_CTA, home = JOIN_CTA, features = JOIN_CTA, contact = JOIN_CTA, about = JOIN_CTA, appLink = GOOD_APP_LINK }, fn) {
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
    writeFileSync(join(dir, 'src/app/pages/AboutPage.tsx'), about);
    writeFileSync(join(dir, 'src/app/data/appLink.ts'), appLink);
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
  Start planning
</a>`;

// The sign-in line for people who already have an account, which the pricing
// page must carry, pointed at sign-in rather than the sign-up every Start planning
// opens (JAR-3180).
const SIGN_IN_LINE = `<p>Already have an account? <a href={appSignInUrl()}>Sign in</a></p>`;

const GOOD_PAGE = `import { appJoinUrl, appSignInUrl } from '../data/appLink';
export function PricingPage() {
  return (
    <div>
      <a href={appJoinUrl('jt_trip_pass')} className="px-8 py-3.5">Start planning</a>
      <a href={appJoinUrl('jt_explore_annual')} className="px-8 py-3.5">Start planning</a>
      ${SIGN_IN_LINE}
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
        <span>Start planning</span>
      </a>
      ${SIGN_IN_LINE}
    </div>
  );
}`,
  }, (dir) => {
    const r = run(dir);
    assert(r.code === 0, `guard should accept the real CTA: ${r.out}`);
    assert(/signup CTAs OK/.test(r.out), `unexpected output: ${r.out}`);
  });
});

test('refuses a Start planning reverted to /contact', () => {
  withRepo({
    page: `import { Link } from 'react-router-dom';
export function PricingPage() {
  return (
    <div>
      <Link to="/contact" className="px-8 py-3.5">Start planning</Link>
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
test('refuses a page with no Start planning CTA at all', () => {
  withRepo({
    page: `export function PricingPage() {
  return <div>Nothing to see here</div>;
}`,
  }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a page with no CTA (vacuous check)');
    assert(/no "Start planning" CTA found/.test(r.out), `wrong reason: ${r.out}`);
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
          <span>Start planning</span>
        </article>
      </a>
      ${SIGN_IN_LINE}
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
      <a href="https://app.jarvistravel.com/auth/sign-up?plan=jt_trip_pass" className="px-8 py-3.5">Start planning</a>
    </div>
  );
}`,
  }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a hand-written href bypassing appJoinUrl');
    assert(/instead of appJoinUrl/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// JAR-3180: appJoinUrl's plan became optional, because the other pages'
// "Start planning" buttons call it with none. So a pricing CTA that drops its
// plan now compiles, opens sign-up, and loses the plan the visitor just picked.
// Only this guard can see it.
test('refuses a pricing Start planning that drops the plan', () => {
  withRepo({ page: GOOD_PAGE.replace("appJoinUrl('jt_explore_annual')", 'appJoinUrl()') }, (d) => {
    const r = run(d);
    assert(r.code === 1, 'guard passed a pricing Start planning with no plan');
    assert(/appJoinUrl\(\) with no plan/.test(r.out), `wrong reason: ${r.out}`);
  });
});

// ── The OTHER half of the split ────────────────────────────────────
//
// The guard asserts both directions, and both are mutated below. If only one
// reddens, the guard encodes a preference rather than a contract: it would
// stop a revert while permitting a silent migration, and a migration has to
// be deliberate.

test('refuses an off-pricing Start planning that carries a plan', () => {
  // No plan was chosen on these pages, so a plan here would hand the app a
  // choice the visitor never made.
  withRepo(
    {
      page: GOOD_PAGE,
      nav: `export default function N() {
  return <a href={appJoinUrl('jt_explore_annual')} className="px-5 py-2.5">Start planning</a>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted an off-pricing Start planning carrying a plan');
      assert(/Navigation\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      // Names what it found, not just the function: appJoinUrl and appJoinUrl()
      // are the same word, and the plan is the whole difference.
      assert(/targets appJoinUrl\('jt_explore_annual'\)/.test(r.out), `the error does not name what it found: ${r.out}`);
      assert(/JAR-3180/.test(r.out), `the error does not point at the decision: ${r.out}`);
      // The message must tell the migrator what to do, not merely refuse.
      assert(/OFF_PRICING/.test(r.out), `the error does not say how to make it deliberate: ${r.out}`);
    },
  );
});

test('refuses an off-pricing Start planning left on sign-in, the superseded decision', () => {
  // JAR-1692 sent every Start planning to sign-in while sign-up was closed. Brent
  // opened sign-up on 2026-10-14 (JAR-3180), so a Start planning still on sign-in
  // makes a new visitor find the sign-up link themselves.
  withRepo(
    {
      page: GOOD_PAGE,
      home: `export default function H() {
  return <a href={appSignInUrl()} className="px-8 py-4">Start planning</a>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted a Start planning still on sign-in');
      assert(/HomePage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/targets appSignInUrl\(\), not appJoinUrl\(\)/.test(r.out), `the error does not name what it found: ${r.out}`);
    },
  );
});

test('refuses an off-pricing Start planning still sent to /pricing, the reversed decision', () => {
  withRepo(
    {
      page: GOOD_PAGE,
      features: `export default function F() {
  return <Link to="/pricing" className="px-8 py-4">Start planning</Link>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted a Start planning still on /pricing');
      assert(/FeaturesPage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/targets \/pricing/.test(r.out), `the error does not name what it found: ${r.out}`);
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
  return <Link to="/signup" className="px-8 py-4">Start planning</Link>;
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

test('refuses an off-pricing Start planning left on /contact', () => {
  // The loop this guard's current decision closes: Contact's own Start planning linked
  // to /contact, the page it sits on.
  withRepo(
    {
      page: GOOD_PAGE,
      contact: `export default function C() {
  return <a href="/contact" className="px-8 py-4">Start planning</a>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard permitted a Start planning left on /contact');
      assert(/ContactPage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
      assert(/targets \/contact/.test(r.out), `the error does not name what it found: ${r.out}`);
    },
  );
});

test('watches the About page too (JAR-3673): a Start planning that misses sign-up is caught', () => {
  // #119 added an About page with a Start planning CTA; it joined OFF_PRICING in
  // this change so the guard watches it, not nothing.
  withRepo(
    {
      page: GOOD_PAGE,
      about: `export default function A() {
  return <a href="/contact" className="px-10 py-4">Start planning</a>;
}`,
    },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'guard did not watch the About page CTA');
      assert(/AboutPage\.tsx/.test(r.out), `wrong file named: ${r.out}`);
    },
  );
});

// F1: a file with a correct "Start planning" CTA and a SECOND one reverted to the
// old label must fail. The label-keyed checks only see "Start planning", so the
// reverted sibling, and its destination, would otherwise ship green.
test('refuses a file whose second CTA was reverted to "Join Now"', () => {
  const twoCtas = `import { appJoinUrl } from '../data/appLink';
export default function P() {
  return (<div>
    <a href={appJoinUrl()} className="px-8 py-3.5">Start planning</a>
    <a href={appJoinUrl()} className="px-8 py-3.5">Join Now</a>
  </div>);
}`;
  withRepo({ page: GOOD_PAGE, nav: twoCtas }, (dir) => {
    const r = run(dir);
    assert(r.code === 1 && /Navigation\.tsx.*Join Now/s.test(r.out),
      `a partial revert to "Join Now" shipped green: ${r.out}`);
  });
});

// JAR-3673: the CTA now reads "Start planning" in sentence case, the same words
// a section heading uses (Contact's "Start planning" h2). A heading is not a CTA,
// so the guard must read it past, not choke on it for lacking an anchor — and a
// heading must not satisfy the vacuity check that a real CTA exists.
test('reads a "Start planning" heading past as not-a-CTA, beside a real CTA', () => {
  const headingPlusCta = `import { appJoinUrl } from '../data/appLink';
export default function C() {
  return (<section>
    <h2>Start planning</h2>
    <a href={appJoinUrl()} className="px-8 py-3.5">Start planning</a>
  </section>);
}`;
  withRepo({ page: GOOD_PAGE, contact: headingPlusCta }, (dir) => {
    const r = run(dir);
    assert(r.code === 0, `a heading beside a valid CTA was rejected: ${r.out}`);
  });
});

test('refuses a file whose only "Start planning" is a heading — no anchored CTA', () => {
  // The heading must not satisfy vacuity: a file that lost its button but kept a
  // same-worded heading is still watching nothing.
  withRepo(
    { page: GOOD_PAGE, about: 'export default function A() { return <h2>Start planning</h2>; }' },
    (dir) => {
      const r = run(dir);
      assert(r.code === 1, 'a lone heading satisfied the CTA vacuity check');
      assert(/AboutPage\.tsx.*watching nothing/s.test(r.out), `wrong reason: ${r.out}`);
    },
  );
});

test('refuses a file whose Start planning disappeared — a guard watching nothing', () => {
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

// ── Where the helpers really point, and the pricing sign-in line (JAR-3180) ──

test('refuses a link helper whose Start planning opens sign-in, the superseded decision', () => {
  // This case used to refuse sign-up, while every Start planning went to sign-in
  // (JAR-1692). Inverted with the decision: every CTA reads right in its file,
  // and every visitor still lands on sign-in. The drift only the helper can show.
  withRepo({ page: GOOD_PAGE, appLink: GOOD_APP_LINK.replace('/auth/sign-up', '/auth/sign-in') }, (dir) => {
    const r = run(dir);
    assert(r.code === 1, 'guard passed a Start planning helper building a sign-in link');
    assert(/appJoinUrl\(\) builds an app link to \/auth\/sign-in, not \/auth\/sign-up/.test(r.out), `wrong reason: ${r.out}`);
  });
});

test('refuses a link helper whose Sign in opens sign-up', () => {
  // The other helper. Someone who already has an account would be sent to
  // make a second one.
  withRepo({ page: GOOD_PAGE, appLink: GOOD_APP_LINK.replace('/auth/sign-in', '/auth/sign-up') }, (dir) => {
    const r = run(dir);
    assert(r.code === 1, 'guard passed a Sign in helper building a sign-up link');
    assert(/appSignInUrl\(\) builds an app link to \/auth\/sign-up, not \/auth\/sign-in/.test(r.out), `wrong reason: ${r.out}`);
  });
});

test('refuses a link helper that builds no app link at all', () => {
  withRepo({ page: GOOD_PAGE, appLink: "export function appSignInUrl() { return 'https://app.example/auth/sign-in'; }" }, (dir) => {
    const r = run(dir);
    assert(r.code === 1, 'guard passed a helper it cannot read (vacuous check)');
    assert(/builds no app link/.test(r.out), `wrong reason: ${r.out}`);
  });
});

test('refuses a pricing page with no sign-in link for existing accounts', () => {
  withRepo({ page: GOOD_PAGE.replace(SIGN_IN_LINE, '') }, (dir) => {
    const r = run(dir);
    assert(r.code === 1, 'guard passed a pricing page with no sign-in line');
    assert(/no "Sign in" CTA found/.test(r.out), `wrong reason: ${r.out}`);
  });
});

test('refuses a pricing "Sign in" link that opens sign-up', () => {
  // Present is not enough: the line has to go to sign-in. appJoinUrl() is the
  // likely slip now that it is the call every other link on the site uses.
  withRepo({ page: GOOD_PAGE.replace('<a href={appSignInUrl()}>Sign in</a>', '<a href={appJoinUrl()}>Sign in</a>') }, (dir) => {
    const r = run(dir);
    assert(r.code === 1, 'guard passed a Sign in link pointed at sign-up');
    assert(/"Sign in" link targets appJoinUrl\(\), not appSignInUrl\(\)/.test(r.out), `wrong reason: ${r.out}`);
  });
});

test("accepts the shipped routing: every Start planning to the app's sign-up, pricing's with the plan, Sign in to sign-in", () => {
  // The control for every case above. Without it, a guard that failed everything
  // would satisfy every mutation case in this file.
  withRepo({ page: GOOD_PAGE }, (dir) => {
    const r = run(dir);
    assert(r.code === 0, `guard failed the shipped split: ${r.out}`);
    assert(/signup CTAs OK/.test(r.out), `unexpected output: ${r.out}`);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
