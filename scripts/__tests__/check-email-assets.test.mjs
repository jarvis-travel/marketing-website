#!/usr/bin/env node
// Test the email-asset guard.
//
// The first case is the state this repo was ACTUALLY in before JAR-1879: no
// public/email/ at all, while 88 published templates hot-linked images from the
// apex this site is about to take over. A guard that only checked the files it
// found would have called that clean, so it is the first fixture.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const CHECK = new URL('../check-email-assets.mjs', import.meta.url).pathname;

const REQUIRED = [
  'logo-lockup-light.png', 'logo-mark-light.png', 'hero-phone-fi.png',
  'hero-phone-planner.png', 'hero-phone-group.png', 'hero-phone-budget.png',
  'hero-duo-home.png', 'hero-laptop-home.png', 'hero-phone-journal.png',
  'hero-phone-recap.png',
];

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fixture'),
]);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

/** A repo skeleton carrying whatever public/email/ the case needs. */
function withRepo({ files = REQUIRED, extra = {}, omitDir = false }, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'emailassets-'));
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    if (!omitDir) {
      mkdirSync(join(dir, 'public/email'), { recursive: true });
      for (const f of files) writeFileSync(join(dir, 'public/email', f), PNG);
      for (const [f, body] of Object.entries(extra)) {
        writeFileSync(join(dir, 'public/email', f), body);
      }
    } else {
      mkdirSync(join(dir, 'public'), { recursive: true });
    }
    return fn(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The guard resolves paths from its own location, so it has to be run from a
// copy inside the fixture rather than from this repo.
function run(dir) {
  const copy = join(dir, 'scripts/check-email-assets.mjs');
  execSync(`cp ${CHECK} ${copy}`);
  try { return { code: 0, out: execSync(`node ${copy}`, { encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('email assets');

test('the pre-JAR-1879 state fails: no public/email at all', () => {
  withRepo({ omitDir: true }, (dir) => {
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/does not exist/.test(out), `expected it to say the directory is missing:\n${out}`);
  });
});

test('every referenced image present passes', () => {
  withRepo({}, (dir) => {
    const { code, out } = run(dir);
    assert(code === 0, `expected pass, got ${code}:\n${out}`);
    assert(/10 image\(s\) present/.test(out), `expected a count in the output:\n${out}`);
  });
});

test('one missing hero fails, and names how many templates load it', () => {
  withRepo({ files: REQUIRED.filter((f) => f !== 'hero-phone-fi.png') }, (dir) => {
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/hero-phone-fi\.png is missing/.test(out), `expected it named:\n${out}`);
    assert(/6 published template/.test(out), `expected the reference count:\n${out}`);
  });
});

test('a missing masthead fails — the one every template loads', () => {
  withRepo({ files: REQUIRED.filter((f) => f !== 'logo-lockup-light.png') }, (dir) => {
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/88 published template/.test(out), `expected the 88 to be stated:\n${out}`);
  });
});

test('a file that is not a PNG fails, even with the right name', () => {
  withRepo({ files: REQUIRED.filter((f) => f !== 'hero-duo-home.png'),
    extra: { 'hero-duo-home.png': Buffer.from('<!doctype html><html>SPA shell</html>') } }, (dir) => {
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/is not a PNG/.test(out), `expected the type to be caught:\n${out}`);
  });
});

test('an empty file fails rather than passing as present', () => {
  withRepo({ files: REQUIRED.filter((f) => f !== 'hero-phone-recap.png'),
    extra: { 'hero-phone-recap.png': Buffer.alloc(0) } }, (dir) => {
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/is empty/.test(out), `expected emptiness to be caught:\n${out}`);
  });
});

test('an unreferenced file fails, because public/ is published verbatim', () => {
  withRepo({ extra: { 'README.md': Buffer.from('# internal notes') } }, (dir) => {
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/README\.md is not referenced/.test(out), `expected the stray file named:\n${out}`);
    assert(/jarvistravel\.com\/email\/README\.md/.test(out),
      `expected it to say where it would be served:\n${out}`);
  });
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
