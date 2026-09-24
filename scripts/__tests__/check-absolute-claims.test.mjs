#!/usr/bin/env node
// Test the absolute-claim CI guard.
//
// Every case here is a line that actually shipped, or the corrected wording
// that replaced it. A guard whose test uses invented fixtures proves it can
// match a regex; this one proves it would have caught the real thing.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
