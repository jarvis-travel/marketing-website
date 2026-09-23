#!/usr/bin/env node
// Test the workflow-step guard.
//
// The second case is the shape this repo actually shipped: a checks job that is
// a plain sequence. It looks completely ordinary, which is the problem — it was
// read and reviewed repeatedly while eleven of its guards reported nothing
// (JAR-1885). The guard has to call that ordinary-looking job broken, so it is
// a fixture here rather than an afterthought.

import { readFileSync } from 'node:fs';
import { findings } from '../check-workflow-steps.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const OK = `${'if'}: \${{ !cancelled() && steps.setup.outcome == 'success' }}`;
const preamble = `
name: fixture
on: { push: {} }
jobs:
  checks:
    runs-on: spare
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Install dependencies
        id: setup
        run: npm i
`;
const wf = (...guards) => preamble + guards.map((g) => `      ${g}\n`).join('');

test('the workflow this repo actually runs reports every guard', () => {
  const real = new URL('../../.github/workflows/pr-checks.yml', import.meta.url).pathname;
  const found = findings(readFileSync(real, 'utf8'));
  assert(found.length === 0, `pr-checks.yml would hide results:\n       ${found.join('\n       ')}`);
});

test('a plain sequence is reported, every hidden guard named', () => {
  const found = findings(wf(
    '- name: Assert the secret\n        run: test -n "$KEY"',
    '- name: Fonts guard\n        run: npm run lint:fonts',
    '- name: Lint\n        run: npm run lint',
  ));
  // Four, not three: the install step is unconditional and nothing waits on it
  // either, so it hides the guards after it exactly as they hide each other.
  assert(found.length === 4, `expected every run step, got ${found.length}: ${found.join(' | ')}`);
  assert(found.every((f) => /no 'if'/.test(f)), `wrong reason: ${found.join(' | ')}`);
  for (const name of ['Install dependencies', 'Assert the secret', 'Fonts guard', 'Lint']) {
    assert(found.some((f) => f.includes(name)), `no finding names ${name}: ${found.join(' | ')}`);
  }
});

test('a condition on the whole sequence is not independence', () => {
  // success() is the DEFAULT — spelling it out changes nothing, and reads like
  // a decision. The named prerequisite is the part that matters.
  const found = findings(wf(
    "- name: Fonts guard\n        if: success()\n        run: npm run lint:fonts",
  ));
  assert(found.some((f) => /!cancelled\(\)/.test(f)), `did not flag success(): ${found.join(' | ')}`);
  assert(found.some((f) => /names no prerequisite/.test(f)), `did not ask which step it needs: ${found.join(' | ')}`);
});

test('waiting on a step that comes LATER is caught', () => {
  // The trap this case exists for: Actions does not error on an unknown step
  // id. The expression is empty, the condition is false, and the guard quietly
  // never runs again — green, and measuring nothing.
  const found = findings(wf(
    "- name: Unsplash key is not in the bundle\n        if: ${{ !cancelled() && steps.build.outcome == 'success' }}\n        run: npm run lint:unsplash-key",
    "- name: Build\n        id: build\n        " + OK + "\n        run: npm run build",
  ));
  assert(found.some((f) => /waits on steps\.build, which no earlier step defines/.test(f)), `not caught: ${found.join(' | ')}`);
});

test('a guard that cannot fail the job is reported', () => {
  const found = findings(wf(
    "- name: Fonts guard\n        " + OK + "\n        continue-on-error: true\n        run: npm run lint:fonts",
  ));
  assert(found.some((f) => /continue-on-error/.test(f)), `not caught: ${found.join(' | ')}`);
});

test('an unconditional run step in the setup prefix is caught unless something waits on it', () => {
  const found = findings(`
name: fixture
on: { push: {} }
jobs:
  checks:
    runs-on: spare
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Install dependencies
        run: npm i
      - name: Fonts guard
        ${OK}
        run: npm run lint:fonts
`);
  assert(found.some((f) => /Install dependencies.*give it an id/s.test(f)), `not caught: ${found.join(' | ')}`);
});

test('the prefix may hold actions, and a conditioned job passes clean', () => {
  const found = findings(wf(
    "- name: Fonts guard\n        " + OK + "\n        run: npm run lint:fonts",
    "- name: Lint\n        " + OK + "\n        run: npm run lint",
  ));
  assert(found.length === 0, `false positives on a correct job: ${found.join(' | ')}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
