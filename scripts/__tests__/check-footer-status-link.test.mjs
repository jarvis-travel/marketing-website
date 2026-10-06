#!/usr/bin/env node
// Asserts the footer carries the external Status link (JAR-2647). The repo has
// no component-render harness, so this reads Footer.tsx the same way the other
// scripts/__tests__ guards read source: the Status entry must use the external
// `href` shape (status.jarvistravel.com), and the render must open an `href`
// entry in a new tab with rel="noopener noreferrer" rather than a router Link.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SRC = new URL('../../src/app/components/Footer.tsx', import.meta.url).pathname;
const src = readFileSync(SRC, 'utf8');

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

test('FOOTER_LINKS has a Status entry pointing at the status page', () => {
  assert.match(
    src,
    /\{\s*name:\s*'Status',\s*href:\s*'https:\/\/status\.jarvistravel\.com\/'\s*\}/,
    'expected a { name: \'Status\', href: \'https://status.jarvistravel.com/\' } entry in FOOTER_LINKS',
  );
});

test('an href entry renders as an external anchor in a new tab', () => {
  // The link map must branch on `href` and feed it to an <a> that opens in a
  // new tab; without this an external URL would be handed to a router <Link>.
  assert.match(src, /'href'\s+in\s+link/, 'expected the render to branch on an href entry');
  // Pin target + rel to THIS anchor as a contiguous block. A loose check would
  // pass on the SOCIAL icons, which carry the same target/rel on href={s.href}.
  assert.match(
    src,
    /href=\{link\.href\}\s+target="_blank"\s+rel="noopener noreferrer"/,
    'expected the link.href anchor itself to carry target="_blank" rel="noopener noreferrer"',
  );
});

console.log(`\ncheck-footer-status-link: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
