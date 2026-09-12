#!/usr/bin/env node
// Test the shipped-bundle key guard.
//
// The PASS cases carry as much weight as the failures. A guard that fires on a
// clean build gets switched off, and a guard that cannot run is worse than one
// that fails — so "no dist" and "empty dist" are CANNOT TELL (2), never 0.

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const CHECK = new URL('../check-no-unsplash-key-in-bundle.mjs', import.meta.url).pathname;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failed++; console.error(`  FAIL ${name}\n       ${e.message}`); }
}

/** Run the guard over a temp dist/ made of `files`, with `env` overrides. */
function guard(files, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'unsplashkey-'));
  try {
    for (const [p, body] of Object.entries(files)) {
      mkdirSync(join(dir, dirname(p)), { recursive: true });
      writeFileSync(join(dir, p), body);
    }
    try {
      return { code: 0, out: execFileSync('node', [CHECK], {
        cwd: dir, encoding: 'utf8', stdio: 'pipe',
        env: { ...process.env, UNSPLASH_ACCESS_KEY: '', UNSPLASH_SECRET_KEY: '', ...env },
      }) };
    } catch (e) {
      return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function expectCode(r, code) { if (r.code !== code) throw new Error(`exit ${r.code}, want ${code}\n${r.out}`); }

// A real-shaped bundle with no key in it.
const CLEAN = { 'dist/index.html': '<!doctype html><div id=root></div>\n', 'dist/assets/app.js': 'const a=1;export{a};\n' };

test('a clean bundle passes', () => {
  expectCode(guard(CLEAN), 0);
});

test('the KEY NAME in a bundle fails, even with no key set here', () => {
  // The name is what a developer's machine can catch: naming the variable in
  // client code is how the value gets inlined on the next build that has one.
  const r = guard({ ...CLEAN, 'dist/assets/app.js': 'const k=import.meta.env.UNSPLASH_ACCESS_KEY;\n' });
  expectCode(r, 1);
  if (!r.out.includes('assets/app.js')) throw new Error(`did not name the file\n${r.out}`);
});

test('the SECRET key name fails too', () => {
  expectCode(guard({ ...CLEAN, 'dist/assets/app.js': '// UNSPLASH_SECRET_KEY\n' }), 1);
});

test('a live key VALUE in a bundle fails, and is never echoed', () => {
  const value = 'zzzz-not-a-real-key-0123456789';
  const r = guard({ ...CLEAN, 'dist/assets/app.js': `const k="${value}";\n` }, { UNSPLASH_ACCESS_KEY: value });
  expectCode(r, 1);
  if (r.out.includes(value)) {
    throw new Error('the guard printed the secret it found — that publishes it to the CI log it was protecting it from');
  }
  if (!r.out.includes('not shown')) throw new Error(`did not say it withheld the value\n${r.out}`);
});

test('a short or empty key is ignored rather than matching everything', () => {
  // An empty string is a substring of every file; a one-character placeholder
  // nearly is. Either would fail every build for no reason.
  expectCode(guard(CLEAN, { UNSPLASH_ACCESS_KEY: '' }), 0);
  expectCode(guard(CLEAN, { UNSPLASH_ACCESS_KEY: 'x' }), 0);
});

test('the key name in a NON-shipped file is not a bundle leak', () => {
  // scripts/ and the manifest generator legitimately name the variable. Only
  // dist/ is scanned, because only dist/ reaches a browser.
  expectCode(guard({ ...CLEAN, 'scripts/fetch.mjs': 'process.env.UNSPLASH_ACCESS_KEY\n' }), 0);
});

// ── the check the measurement added ───────────────────────────────────────
// The first version of this guard scanned dist/ for the variable NAME. Built
// against a real bundle with the values planted, that turned out to catch
// nothing: Vite replaces a non-`VITE_` env read with `undefined`, name and all,
// so the only shapes that reach dist/ are a `VITE_`-prefixed read and a
// hardcoded literal. The guard passed a bundle with a planted secret in it.

test('client source reading a VITE_-prefixed Unsplash var fails', () => {
  const r = guard({ ...CLEAN, 'src/x.ts': 'export const k = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;\n' });
  expectCode(r, 1);
  if (!r.out.includes('VITE_UNSPLASH_ACCESS_KEY')) throw new Error(`did not name the variable\n${r.out}`);
});

test('client source reading a BARE Unsplash var fails too', () => {
  // It is inlined as `undefined` rather than leaking, so this is a bug wearing
  // a key's clothes: code that believes it has a key and does not. Refusing it
  // costs nothing and removes the shape someone would "fix" by adding VITE_.
  expectCode(guard({ ...CLEAN, 'src/x.ts': 'const k = import.meta.env.UNSPLASH_ACCESS_KEY;\n' }), 1);
});

test('whitespace inside the member expression does not evade the source check', () => {
  expectCode(guard({ ...CLEAN, 'src/x.ts': 'const k = import.meta . env . VITE_UNSPLASH_KEY;\n' }), 1);
});

test('src/ that mentions Unsplash without reading a variable passes', () => {
  // The data module and the credit component talk about Unsplash constantly.
  expectCode(guard({ ...CLEAN, 'src/x.ts': '// Unsplash requires attribution. See UNSPLASH docs.\n' }), 0);
});

test('a VITE_ value in dist is caught even when no source reads it', () => {
  // A hardcoded literal has no import.meta.env read to find, so only the value
  // sweep can see it — and that sweep has to look at every env var whose name
  // mentions Unsplash, not just the two the app names.
  const value = 'zzzz-vite-secret-0123456789';
  const r = guard({ ...CLEAN, 'dist/assets/app.js': `const k="${value}";\n` }, { VITE_UNSPLASH_ACCESS_KEY: value });
  expectCode(r, 1);
  if (r.out.includes(value)) throw new Error('the guard printed the secret it found');
});

test('no dist/ is CANNOT TELL (2), not a pass', () => {
  expectCode(guard({ 'src/main.tsx': 'export {}\n' }), 2);
});

test('an empty dist/ is CANNOT TELL (2), not a pass', () => {
  const r = guard({ 'dist/logo.png': 'not text' });
  expectCode(r, 2);
  if (!r.out.includes('Scanning nothing is not a pass')) throw new Error(`wrong reason\n${r.out}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
