#!/usr/bin/env node
// Test the day-lighter capture guard.
//
// The case that matters is the refresh JAR-3110 is afraid of: a file swapped
// under its own name. It is the same size class and the same name, so only the
// digest can tell, and a one-byte change has to fail.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const CHECK = new URL('../check-captures.mjs', import.meta.url).pathname;
const FILE = 'src/assets/captures/desktop/day-lighter-light-720.png';
const PICTURE = Buffer.from('the applied result');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

/** A repo skeleton with one capture, pinned to `pinned` (the true digest by default). */
function withRepo(fn, pinned = createHash('sha256').update(PICTURE).digest('hex')) {
  const dir = mkdtempSync(join(tmpdir(), 'captures-'));
  try {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    mkdirSync(join(dir, 'src/app/data'), { recursive: true });
    mkdirSync(join(dir, 'src/assets/captures/desktop'), { recursive: true });
    writeFileSync(join(dir, FILE), PICTURE);
    writeFileSync(join(dir, 'src/app/data/appCaptures.pins.json'),
      JSON.stringify({ note: 'fixture note', files: { [FILE]: pinned } }));
    return fn(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The guard resolves paths from its own location, so it runs from a copy
// inside the fixture rather than from this repo.
function run(dir, args = '') {
  const copy = join(dir, 'scripts/check-captures.mjs');
  execSync(`cp ${CHECK} ${copy}`);
  try { return { code: 0, out: execSync(`node ${copy} ${args}`, { encoding: 'utf8', stdio: 'pipe' }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

console.log('day-lighter captures');

test('the pinned picture passes', () => {
  withRepo((dir) => {
    const { code, out } = run(dir);
    assert(code === 0, `expected pass, got ${code}:\n${out}`);
    assert(/1 day-lighter capture/.test(out), `expected a count in the output:\n${out}`);
  });
});

test('a picture swapped under its own name fails, down to one byte', () => {
  withRepo((dir) => {
    const bytes = readFileSync(join(dir, FILE));
    bytes[0] ^= 1;
    writeFileSync(join(dir, FILE), bytes);
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/is not the picture that was checked/.test(out), `expected it to name the file:\n${out}`);
    assert(/lint:captures -- --update/.test(out), `expected it to say how to re-pin:\n${out}`);
  });
});

test('a missing picture fails', () => {
  withRepo((dir) => {
    unlinkSync(join(dir, FILE));
    const { code, out } = run(dir);
    assert(code === 1, `expected failure, got ${code}`);
    assert(/is missing/.test(out), `expected it to say the file is missing:\n${out}`);
  });
});

test('--update re-pins, and the check then passes', () => {
  withRepo((dir) => {
    assert(run(dir).code === 1, 'expected the stale pin to fail first');
    assert(run(dir, '--update').code === 0, 'expected --update to succeed');
    const { code, out } = run(dir);
    assert(code === 0, `expected pass after re-pinning, got ${code}:\n${out}`);
  }, 'stale');
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
