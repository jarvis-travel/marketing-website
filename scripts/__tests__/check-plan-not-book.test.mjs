#!/usr/bin/env node
// Test which directories and extensions the plan-not-book guard actually reads.
//
// The guard's matching is already hardened (NFKC folding, zero-width stripping,
// a confusables map) and reviewed. What was never checked is its *reach*: it
// scanned `src` only, with no `.txt` in its extension set, so everything under
// `public/` was invisible to it.
//
// That is not hypothetical. public/llms.txt advertised "aggregate pricing
// across booking platforms" for months, served verbatim to every crawler and
// agent that asked, while CI reported the guard passing on every commit
// (JAR-20). A guard that cannot see published copy is not guarding it.
//
// So these cases assert coverage, not regexes: drop banned language into a
// published file and the guard must fail on it.

import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../..', import.meta.url).pathname;
const SCRIPT = resolve(ROOT, 'scripts/check-plan-not-book.mjs');

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

/** Run the real guard; report whether it flagged anything, and what it said. */
function runGuard() {
  try {
    execFileSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    return { flagged: false, output: '' };
  } catch (e) {
    return { flagged: true, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/**
 * Write banned copy to a published path, run the guard, always clean up.
 * The filename is obvious on sight so a crashed run leaves no mystery behind.
 */
function guardSees(relPath, content = 'Book your flights and hotels with us today.\n') {
  const abs = resolve(ROOT, relPath);
  if (existsSync(abs)) {
    throw new Error(`fixture path ${relPath} already exists; refusing to overwrite`);
  }
  try {
    writeFileSync(abs, content);
    return runGuard();
  } finally {
    rmSync(abs, { force: true });
  }
}

// The repository itself must be clean, or every case below is meaningless.
test('the committed tree passes', () => {
  const { flagged, output } = runGuard();
  if (flagged) {
    throw new Error(`guard already failing before any fixture:\n${output}`);
  }
});

test('reads .txt under public/ (the llms.txt blind spot)', () => {
  const { flagged, output } = guardSees('public/__plan-not-book-fixture.txt');
  if (!flagged) {
    throw new Error('banned language in public/*.txt was not seen');
  }
  if (!/__plan-not-book-fixture\.txt/.test(output)) {
    throw new Error(`guard failed but did not name the file:\n${output}`);
  }
});

test('reads .md under public/', () => {
  const { flagged } = guardSees('public/__plan-not-book-fixture.md');
  if (!flagged) {
    throw new Error('banned language in public/*.md was not seen');
  }
});

// The original coverage must not regress while widening it.
test('still reads src/', () => {
  const { flagged } = guardSees('src/__plan-not-book-fixture.ts');
  if (!flagged) {
    throw new Error('banned language in src/ was not seen');
  }
});

// JAR-3521. A line opening with "*", "{/*", "//", "/*" or "<!--" was read as a
// code comment in every file type, so a Markdown bullet and an HTML comment's
// copy were skipped. In a prose file (.md, .txt, .html) every line is copy now.
test('reads a "*" bullet in a prose file (was skipped as a comment)', () => {
  const { flagged } = guardSees('public/__pnb-bullet-fixture.md', '* Book your flights and hotels with us today.\n');
  if (!flagged) {
    throw new Error('a "*" bullet in .md was skipped as a comment');
  }
});

test('reads inside an HTML comment in a prose .html file', () => {
  const { flagged } = guardSees('public/__pnb-html-fixture.html', '<!-- Book your flights and hotels with us today. -->\n');
  if (!flagged) {
    throw new Error('an HTML comment in .html was skipped');
  }
});

// The other half: a "//" line in code is still a comment, so the gate did not
// widen into code.
test('still skips a code comment in src/', () => {
  const { flagged } = guardSees('src/__pnb-code-comment-fixture.ts', '// Book your flights and hotels with us today.\n');
  if (flagged) {
    throw new Error('a "//" comment in code was read as copy; the prose gate widened too far');
  }
});

// Cleanup is the whole safety story here, since the fixtures live in the real
// tree rather than a temp dir.
test('leaves no fixture behind', () => {
  for (const p of [
    'public/__plan-not-book-fixture.txt',
    'public/__plan-not-book-fixture.md',
    'src/__plan-not-book-fixture.ts',
    'public/__pnb-bullet-fixture.md',
    'public/__pnb-html-fixture.html',
    'src/__pnb-code-comment-fixture.ts',
  ]) {
    if (existsSync(resolve(ROOT, p))) {
      throw new Error(`fixture survived the run: ${p}`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
