#!/usr/bin/env node
// Test the absolute-claim CI guard.
//
// Every case here is a line that actually shipped, or the corrected wording
// that replaced it. A guard whose test uses invented fixtures proves it can
// match a regex; this one proves it would have caught the real thing.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CHECK_SCRIPT = new URL('../check-absolute-claims.mjs', import.meta.url).pathname;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}\n       ${e.message}`);
  }
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'absclaims-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    // Every configured scan root must exist or the guard refuses to report a
    // pass (a renamed public/ used to read as an empty one). A case that wants
    // one absent builds its tree with inBareTempDir instead.
    mkdirSync(join(dir, 'public'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html><body>Explore</body></html>');
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Returns { code, out }. The guard exits 1 on a hit, 0 when clean.
function runCheck(dir, source, file = 'src/Copy.tsx') {
  writeFileSync(join(dir, file), source);
  try {
    const out = execSync(`node ${CHECK_SCRIPT}`, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

const flags = (src, file) => withTempDir((d) => runCheck(d, src, file).code === 1);
const clean = (src, file) => withTempDir((d) => runCheck(d, src, file).code === 0);

// Spawn the guard in dir without writing any scannable file first, so a test can
// present it an empty or unreadable corpus. Returns { code, out }.
function runIn(dir) {
  try {
    const out = execSync(`node ${CHECK_SCRIPT}`, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function inBareTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'absclaims-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('absolute-claim guard');

// --- the claims that actually shipped ---------------------------------
test('catches "No ads. No data selling. Ever." (waitlist, 42 Resend templates)', () => {
  assert(flags(`export const L = 'No ads. No data selling. Ever.';`), 'not caught');
});

test('catches "We never share your personal information" (SignUpScreen terms summary)', () => {
  assert(flags(`const t = ['We never share your personal information'];`), 'not caught');
});

test('catches "We never sell your data." (Data Security page)', () => {
  assert(flags(`const C = ['We never sell your data.'];`), 'not caught');
});

test('catches the AI training claim (Welcome Flow 3, published)', () => {
  assert(flags(`const s = 'Our AI works on your data to help you. It never trains on it.';`), 'not caught');
});

test('catches "does not use your personal data" (waitlist landing)', () => {
  assert(flags(`const s = 'Responsible AI that does not use your personal data.';`), 'not caught');
});

test('catches the competitor assertion (Incentives broadcast, Lanham §43(a))', () => {
  assert(flags(`const row = 'Most travel apps sell your data to advertisers';`), 'not caught');
});

test('catches an attested status we do not hold', () => {
  assert(flags(`const b = 'PCI DSS Compliant';`), 'not caught');
  assert(flags(`const b = 'bank-level encryption';`), 'not caught');
});

test('catches "anonymized", which counsel says is pseudonymisation', () => {
  assert(flags(`const s = 'It learns from anonymized trip patterns.';`), 'not caught');
});

// --- the corrected wording must pass ----------------------------------
test('passes the corrected footer line', () => {
  assert(clean(`export const L = 'No ads. No data selling.';`), 'false positive');
});

test('passes present-tense practice', () => {
  assert(clean(`const s = 'We don\\u2019t sell your personal information.';`), 'false positive');
  assert(clean(`const s = 'Jarvis is sent your trip, not your identity.';`), 'false positive');
});

// --- a claim on the opening or closing line of a multi-line template ---------
//
// The scan ran per line, and a template literal's opening line carries the
// backtick and the assignment while its closing line carries the backtick and
// the semicolon, both of which isBareProseLine screens out, so a claim written
// there escaped. Email and broadcast copy is written in exactly this shape
// (JAR-3706 item 1). Interior lines were already caught; they still are.
test('catches a claim on a multi-line template literal opening line', () => {
  assert(flags('export const s = `Never miss a deal.\nMore to come.`;'), 'opening-line claim passed');
});

test('catches a claim on a multi-line template literal closing line', () => {
  assert(flags('export const s = `Plan your trip.\nNever miss a deal.`;'), 'closing-line claim passed');
});

test('still catches a claim on an interior template line', () => {
  assert(flags('export const s = `\nNever miss a deal.\n`;'), 'interior-line claim passed');
});

test('a multi-line template of clean copy, with a code expression, passes', () => {
  assert(clean('export const s = `Plan ${count} trips.\nWelcome back, traveler.`;'), 'false positive on a clean template');
  // an identifier like neverSell inside ${…} is code, not copy
  assert(clean('export const s = `Total ${neverSell ? 1 : 0} today.\nmore here.`;'), 'expression identifier read as copy');
});

// --- a promise that wrapped across a line break -----------------------
//
// Every pattern ran against one line at a time, so a sentence split by a hard
// wrap matched nothing: in JSX, where a paragraph is written over several
// lines, and in plain-text email mirrors, which wrap at about 80 columns. The
// live example was design-library's mirror — "…the same living plan, always" /
// "current." — caught in the HTML beside it and not in the text (JAR-1728).
// CI's failure-phrase scan had the same class of miss (JAR-1133).
test('catches a promise wrapped across a line break', () => {
  assert(
    flags('<p>\n  Everyone sees the same living plan, always\n  current for everyone.\n</p>'),
    'a wrapped "always current" passed — the scan is still per line',
  );
});

test('the allowlist still excuses a wrapped sentence', () => {
  withTempDir((d) => {
    writeFileSync(join(d, '.absolute-claims-allow.txt'), 'always\\s+current\n');
    const r = runCheck(d, '<p>\n  the same living plan, always\n  current for everyone.\n</p>');
    assert(r.code === 0, 'the allowlist did not excuse a wrapped sentence');
  });
});

test('a wrapped promise is reported once, not twice', () => {
  withTempDir((d) => {
    const r = runCheck(d, '<p>\n  the same living plan, always\n  current for everyone.\n</p>');
    const hits = (r.out.match(/forward-looking promise/g) || []).length;
    assert(hits === 1, `reported ${hits} time(s), want 1 — the two passes are double-counting`);
  });
});

test('a break between two sentences is not a promise', () => {
  // The joined pass must not invent a claim from the end of one sentence and
  // the start of the next.
  assert(
    clean('<p>\n  We keep your plan current today.\n  Always read the details.\n</p>'),
    'two sentences either side of a break were read as one claim',
  );
});

// --- scope: what the guard must NOT flag ------------------------------
test('the §17550 not-a-seller-of-travel line is allowlisted, not banned', () => {
  // Without the allowlist it is a "never sells" hit; the allowlist is what
  // distinguishes a legal-status claim about travel from a data claim.
  withTempDir((d) => {
    writeFileSync(join(d, '.absolute-claims-allow.txt'), 'never sells travel\n');
    const r = runCheck(d, `const s = 'JarvisTravel plans; it never sells travel.';`);
    assert(r.code === 0, 'allowlist did not admit the §17550 line');
  });
});

test('ordinary English about other apps is not a competitor claim', () => {
  assert(clean(`const s = 'leaves keys belonging to other apps on the same origin alone';`), 'false positive');
});

test('comments document, they do not advertise', () => {
  assert(clean(`// historically this said "No ads. No data selling. Ever."\nconst x = 1;`), 'comment was flagged');
});

test('identifiers and imports are out of scope', () => {
  assert(clean(`import { neverSell } from './never-sell';\nconst neverShared = 1;`), 'identifier flagged');
});

// --- evasion ----------------------------------------------------------
test('a zero-width space does not smuggle the claim through', () => {
  assert(flags(`const L = 'No ads. No data selling. Ev​er.';`), 'zero-width evaded the fold');
});

test('a Cyrillic homoglyph does not smuggle the claim through', () => {
  // "Еver" with Cyrillic Е (U+0415).
  assert(flags(`const L = 'No ads. No data selling. Еver.';`), 'homoglyph evaded the fold');
});

// --- scan scope -------------------------------------------------------
//
// A guard is only as wide as the files it opens, and that width is invisible:
// it reports "passed" identically whether the file was clean or never read.
// Reproduced before fixing — a banned claim in root index.html exited 0
// (JAR-963).

test('a claim in root index.html is caught', () => {
  withTempDir((d) => {
    const r = runCheck(d, '<meta name="description" content="We never sell your data.">', 'index.html');
    assert(
      r.code === 1 && /index\.html/.test(r.out),
      'index.html is not scanned. It carries the title, meta description and OG tags — ' +
        'the first copy a search result or a shared link shows anyone'
    );
  });
});

test('a claim in public/ is caught', () => {
  withTempDir((d) => {
    mkdirSync(join(d, 'public'), { recursive: true });
    const r = runCheck(d, 'We never sell your data.', 'public/llms.txt');
    assert(r.code === 1 && /public\/llms\.txt/.test(r.out), 'public/ is not scanned');
  });
});

// The other half. Without this, a guard that flagged every root file would
// pass the case above.
test('a clean root index.html still passes', () => {
  withTempDir((d) => {
    const r = runCheck(d, '<meta name="description" content="No ads. No data selling.">', 'index.html');
    assert(r.code === 0, `clean index.html was flagged:\n${r.out}`);
  });
});

// --- fail closed ------------------------------------------------------
test('a malformed allowlist fails the run rather than disabling the gate', () => {
  withTempDir((d) => {
    writeFileSync(join(d, '.absolute-claims-allow.txt'), '[unclosed\n');
    const r = runCheck(d, `const x = 1;`);
    assert(r.code === 1 && /invalid allowlist pattern/.test(r.out), 'did not fail closed');
  });
});

// The one failure a text guard must refuse: "I read nothing." An empty corpus
// (a rename, a moved directory, a partial checkout) produces zero hits and used
// to exit 0 — a clean sweep over nothing (Ryan fleet review F1).
test('an empty corpus fails closed rather than passing as clean (F1)', () => {
  inBareTempDir((d) => {
    // The shape a rename, a moved directory or a partial checkout produces: no
    // src/, no public/, no index.html. The missing-root guard now refuses this
    // before the zero-file guard can fire, so the assertion is on the property
    // that matters: an empty corpus never reports a pass. Each guard's own
    // message is pinned by the tests around this one.
    const r = runIn(d);
    assert(r.code === 1 && /scan root\(s\) not found|scanned 0 files/.test(r.out),
      `an empty scan must fail, not pass; got code ${r.code}:\n${r.out}`);
  });
});

// A missing configured root is a broken checkout, not an empty one: the zero-file
// guard cannot see it because the other roots still contribute files, so a
// renamed public/ (where llms.txt and every page's copy lives) read as a clean
// sweep (JAR-3521 review).
test('a missing scan root fails closed even when other roots have copy', () => {
  inBareTempDir((d) => {
    mkdirSync(join(d, 'src'), { recursive: true });
    writeFileSync(join(d, 'src', 'Copy.tsx'), `const x = 1;`); // clean, readable copy
    // no public/, no index.html
    const r = runIn(d);
    assert(r.code === 1 && /scan root\(s\) not found: index\.html, public/.test(r.out),
      `an absent scan root must fail the run; got code ${r.code}:\n${r.out}`);
  });
});

// An unreadable corpus member is also not a clean one: it must fail, even beside
// files that read cleanly (Ryan fleet review F2). A directory where a scanned
// root file is expected makes readFileSync throw deterministically.
test('a corpus member that cannot be read fails closed, even beside clean copy (F2)', () => {
  inBareTempDir((d) => {
    mkdirSync(join(d, 'src'), { recursive: true });
    mkdirSync(join(d, 'public'), { recursive: true });
    writeFileSync(join(d, 'src', 'Copy.tsx'), `const x = 1;`); // clean and scannable
    mkdirSync(join(d, 'index.html')); // a directory where a scanned file is expected → EISDIR on read
    const r = runIn(d);
    assert(r.code === 1 && /could not be read|READ FAILURE/.test(r.out),
      `an unreadable corpus member must fail the run; got code ${r.code}:\n${r.out}`);
  });
});

// --- "always" (JAR-964) -----------------------------------------------
//
// Rule 9 of the copy skill has banned "always" since the JAR-896 sweep and NO
// guard implemented it, so the rule was advice and the lexicon was the
// enforcement, and the two had quietly diverged. "always X" is a promise about
// the future, which is what "Ever." and "forever" are banned for.
//
// Constructions rather than the bare adverb (brand owner, 2026-08-21): a guard
// that flags "this always runs first" inside a string literal is a guard
// someone switches off.

test('a forward-looking "always" promise is caught', () => {
  assert(flags(`export const L = 'Your plan is always current.';`), '"always current" not caught');
  assert(flags(`export const L = 'Always free, always yours.';`), '"always free" not caught');
  assert(flags(`export const L = 'It will always be there.';`), '"will always" not caught');
});

// The other half, and the reason this is a construction list. Without it a bare
// \balways\b passes this file and then starts flagging ordinary code.
test('"always" about behaviour is not a promise about the future', () => {
  assert(clean(`export const L = 'This always runs before the sync.';`), 'a behaviour statement was flagged');
  assert(clean(`export const L = 'Always ask before sharing';`), 'a settings label was flagged');
});

// --- no "never" in copy (copy rule 11) --------------------------------
//
// Brent's rule (2026-09-30): no "never" in anything a visitor reads, data claim
// or not. Both of these were on this site until that day.

const writeAt = (d, file, src) => {
  mkdirSync(join(d, dirname(file)), { recursive: true });
  return runCheck(d, src, file);
};
const COUNSEL_QUOTE = `export const T = 'JarvisTravel never handles or directs the funds.';`;

test('catches a bare "never" in copy', () => {
  assert(flags(`export const L = 'Every suggestion is there because it fits your trip, never because a hotel or tour paid us.';`), '"never because" not caught');
  assert(flags(`export const L = 'JarvisTravel plans; it never sells travel.';`), '"it never sells travel" not caught');
  withTempDir((d) => {
    const r = writeAt(d, 'public/llms.txt', 'Every suggestion is there because it fits the trip, never because a hotel or tour paid for the placement.');
    assert(r.code === 1, 'not caught in llms.txt');
  });
});

test('passes the present-tense rewrite', () => {
  assert(clean(`export const L = 'Every suggestion is there because it fits your trip, not because a hotel or tour paid us.';`), 'false positive');
});

// Counsel's legal text quotes "never" and changes only through counsel, so the
// rule skips that one file by exact path, and only that rule skips it.
test(`counsel's legal text keeps its "never"`, () => {
  withTempDir((d) => {
    const r = writeAt(d, 'src/app/pages/legal/content.ts', COUNSEL_QUOTE);
    assert(r.code === 0, `counsel's text was flagged:\n${r.out}`);
  });
});

test('the skip is that one file: the same line beside it is caught', () => {
  withTempDir((d) => {
    const r = writeAt(d, 'src/app/pages/legal/terms.ts', COUNSEL_QUOTE);
    assert(r.code === 1, 'a "never" in another file in the legal folder passed');
  });
});

test(`every other rule still reads counsel's text`, () => {
  withTempDir((d) => {
    const r = writeAt(d, 'src/app/pages/legal/content.ts', `export const T = 'Bank-level security for your data.';`);
    assert(r.code === 1, 'the legal file is skipped by every rule, not just "never"');
  });
});

test('an AGENTS.md keeps its "never": it documents the code and is not served', () => {
  withTempDir((d) => {
    assert(writeAt(d, 'src/app/AGENTS.md', 'Never import from a sibling app.').code === 0, 'AGENTS.md was flagged');
  });
  withTempDir((d) => {
    assert(writeAt(d, 'src/app/Notes.md', 'Never import from a sibling app.').code === 1, 'any other Markdown passed');
  });
});

// --- block comments ------------------------------------------------------
//
// Only the line a block comment opens on looks like a comment, so its later
// lines read as prose. "Colour follows the surface, never #fff" reached this
// guard from the second line of a JSX comment in Navigation.tsx.

test(`a block comment's later lines are not copy`, () => {
  assert(clean(`{/* The lockup is inlined.\n    Colour follows the surface, never #fff.\n */}`), 'a JSX comment line was flagged');
  assert(clean(`/* The mark stands free,\n   never on a tile. */`, 'src/Page.css'), 'a CSS comment line was flagged');
});

test('copy after a block comment closes is read', () => {
  assert(flags(`/* A note\n   about the line below. */\nexport const L = 'We never sell your data.';`), 'copy after a closed comment was skipped');
  assert(flags(`/* A note on one line. */\nexport const L = 'It never sells travel.';`), 'copy after a one-line comment was skipped');
});

// A block comment that OPENS MID-LINE is the one shape the "*" rule still reads
// as copy: commentLines opens a block only when "/*" starts the line, so the
// continuation lands in the corpus and is flagged. That direction is deliberate:
// it can only ADD a hit, never hide one. Opening on a mid-line "/*" instead
// would swallow any file whose glob contains one (src/index.css's
// @source "./**/*.{js,ts,jsx,tsx}"), so the shape is pinned here rather than
// "fixed" (JAR-3521 review).
test('a block comment opened mid-line has its "*" continuation read as copy', () => {
  const src = `const x = 1; /* Colour follows the surface\n * never #fff\n */\nexport default x;\n`;
  const r = withTempDir((d) => runCheck(d, src, 'src/Copy.ts'));
  assert(r.code === 1 && /Copy\.ts:2/.test(r.out),
    `a mid-line block comment's continuation must be read; got code ${r.code}:\n${r.out}`);
});

// --- Markdown and text headings and bullets are copy (JAR-3521) ----------
//
// isCommentLine read a line opening with "#", "*", "//", "/*" or "{/*" as a
// comment in EVERY file type, so a Markdown "#" heading or "*" bullet, and
// every line of a .txt or .html file, was skipped by every rule.
// public/llms.txt's six "#" headings went unchecked. Comment lines are code
// only now.

// The assertion is on the reported file:line, not just the exit code: a crash
// also exits 1, so "code === 1" alone cannot tell "the heading was read and
// flagged" from "the guard blew up" (Ryan fleet review LOW).
test('a "#" heading in a prose file is read AND reported, in each prose extension', () => {
  for (const file of ['src/Notes.md', 'public/llms.txt', 'index.html']) {
    withTempDir((d) => {
      const r = writeAt(d, file, '# We never sell your data.');
      const at = new RegExp(`${file.split('/').pop().replace('.', '\\.')}:1\\b`);
      assert(r.code === 1 && at.test(r.out), `a "#" heading in ${file} was not read-and-reported (code ${r.code}):\n${r.out}`);
    });
  }
});

test('a "*" bullet in a prose file is read AND reported', () => {
  for (const file of ['src/Notes.md', 'public/llms.txt']) {
    withTempDir((d) => {
      const r = writeAt(d, file, '* We never sell your data.');
      const at = new RegExp(`${file.split('/').pop().replace('.', '\\.')}:1\\b`);
      assert(r.code === 1 && at.test(r.out), `a "*" bullet in ${file} was not read-and-reported (code ${r.code}):\n${r.out}`);
    });
  }
});

// The other half: the comment forms still skip in code, so the gate did not
// widen. A CSS "#id" selector is read now (no "#" in the code rule), and so is a
// CSS "* { … }" universal selector (no "*" either) — both are one character
// apart from the heading/bullet forms, and neither is a comment (JAR-3521).
test('a code comment is still skipped; CSS "#id" and "* { }" selectors are not comments', () => {
  assert(clean('// We never sell your data.\nconst x = 1;', 'src/Copy.tsx'), 'a // comment in code was read');
  assert(clean('#hero { color: red; }', 'src/Page.css'), 'a CSS #id selector line was mishandled');
  // A universal selector carrying banned copy must be read, not skipped as a comment.
  assert(flags(`* { content: 'We never sell your data.'; }`, 'src/Page.css'), 'a CSS "* { }" selector line was skipped as a comment');
  // A real JSDoc "*" continuation is still a comment, via the block its "/*" opened.
  assert(clean('/**\n * We never sell your data.\n */\nconst x = 1;', 'src/Doc.ts'), 'a JSDoc "*" continuation was read as copy');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
