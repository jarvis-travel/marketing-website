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

import { writeFileSync, rmSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
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

// JAR-3665. "*" is no longer a comment opener in the code rule (a bare "*" at
// line start is a CSS universal selector, not a comment), and a commentLines()
// open-tracker now covers a block comment's 2nd+ lines, so the two copy guards
// mirror. These pin the three shapes that change.

// The open-tracker: a banned phrase on a block comment's plain continuation
// line (no "*") is a comment, not copy. Without the tracker that line, which no
// longer starts with a comment opener, would fall into the corpus.
test('skips a banned phrase on a block comment’s later line (open-tracker)', () => {
  const { flagged } = guardSees(
    'src/__pnb-block-body-fixture.ts',
    '/* A note\n   book your flights and hotels here\n*/\nexport const L = \'Explore one trip\';\n',
  );
  if (flagged) {
    throw new Error('a block comment’s continuation line was read as copy; the open-tracker is missing');
  }
});

// Dropping "*" closes the bypass: a CSS "* { … }" universal selector carrying
// banned copy is read, not skipped as a comment. The output must name the
// fixture — a crash (any non-zero exit) would otherwise read as a "hit" and pass
// this test on nothing (the F1-style check, applied to a positive case).
test('reads a CSS "* { }" universal selector carrying banned copy', () => {
  const { flagged, output } = guardSees(
    'src/__pnb-universal-fixture.css',
    "* { content: 'Book your flights and hotels'; }\n",
  );
  if (!flagged || !/__pnb-universal-fixture\.css/.test(output)) {
    throw new Error(`a CSS "* { }" selector hid banned copy as a comment, or the guard crashed:\n${output}`);
  }
});

// No regression from dropping "*": a real JSDoc "* …" continuation is still a
// comment, via the block its "/*" opened, so it is not read as copy.
test('still skips a JSDoc "* …" continuation line', () => {
  const { flagged } = guardSees(
    'src/__pnb-jsdoc-fixture.ts',
    '/**\n * Book your flights and hotels.\n */\nconst x = 1;\n',
  );
  if (flagged) {
    throw new Error('a JSDoc "*" continuation was read as copy; dropping "*" regressed real comments');
  }
});

// The tracker closes the block: copy after "*/" on the NEXT line is read.
test('reads copy after a block comment closes on the next line', () => {
  const { flagged, output } = guardSees(
    'src/__pnb-after-close-fixture.ts',
    "/* A note */\nexport const L = 'Book your flights and hotels today.';\n",
  );
  if (!flagged || !/__pnb-after-close-fixture\.ts/.test(output)) {
    throw new Error(`copy after a closed block comment was skipped, or the guard crashed:\n${output}`);
  }
});

// And copy after "*/" on the SAME line as the close is read too — the closing
// line is no longer returned as wholly comment (JAR-3665 review, M2).
test('reads copy after a block comment closes on the same line', () => {
  const { flagged, output } = guardSees(
    'src/__pnb-same-line-close-fixture.ts',
    "/* A note\n   still a note. */ export const CTA = 'Book your flights today';\n",
  );
  if (!flagged || !/__pnb-same-line-close-fixture\.ts/.test(output)) {
    throw new Error(`copy after "*/" on the closing line was skipped, or the guard crashed:\n${output}`);
  }
});

// A "/*" with no "*/" (a template literal can carry one) parks the tracker to
// end of file; without a guard that masks every banned line after it and the run
// exits 0. The run must fail closed instead, naming the unreadable file (JAR-3665
// review, HIGH). fold() runs first, so a fullwidth "／＊" would park it too.
test('fails closed on an unterminated block comment rather than masking the rest', () => {
  const { flagged, output } = guardSees(
    'src/__pnb-unterminated-fixture.ts',
    "export const hint = `\n/*\n`;\nexport const L = 'Book your flights and hotels today';\n",
  );
  if (!flagged || !/unterminated block comment/.test(output)) {
    throw new Error(`a parked-open file reported clean instead of failing closed:\n${output}`);
  }
});

// The one failure a text guard must refuse: "I read nothing." An empty corpus
// (a rename, a moved directory, a partial checkout) produces zero hits and must
// fail closed, not report a clean sweep (Ryan fleet review F1, mirrored from
// check-absolute-claims.mjs).
test('an empty corpus fails closed rather than passing as clean (F1)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pnb-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true }); // present but empty
    mkdirSync(join(dir, 'public'), { recursive: true }); // present but empty
    let out, code = 0;
    try {
      out = execFileSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      code = e.status;
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    if (!(code === 1 && /scanned 0 files/.test(out))) {
      throw new Error(`an empty scan must fail, not pass; got code ${code}:\n${out}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A missing configured root is a broken checkout, not an empty one. The
// zero-file guard cannot see it while the other root still contributes files,
// so a renamed public/ read as a clean sweep (JAR-3521 review).
test('a missing scan root fails closed even when the other root has copy', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pnb-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'Copy.tsx'), `export const L = 'Explore one trip';`);
    // no public/
    let out, code = 0;
    try {
      out = execFileSync('node', [SCRIPT], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      code = e.status;
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    if (!(code === 1 && /scan root\(s\) not found: public/.test(out))) {
      throw new Error(`an absent scan root must fail the run; got code ${code}:\n${out}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
    'src/__pnb-block-body-fixture.ts',
    'src/__pnb-universal-fixture.css',
    'src/__pnb-jsdoc-fixture.ts',
    'src/__pnb-after-close-fixture.ts',
    'src/__pnb-same-line-close-fixture.ts',
    'src/__pnb-unterminated-fixture.ts',
  ]) {
    if (existsSync(resolve(ROOT, p))) {
      throw new Error(`fixture survived the run: ${p}`);
    }
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
