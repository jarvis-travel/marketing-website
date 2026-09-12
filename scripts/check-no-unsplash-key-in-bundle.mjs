#!/usr/bin/env node
// Prove the Unsplash access key is not in what we ship.
//
// The app keeps the key on a server and never sends it to a browser. This site
// has no server, so the equivalent guarantee is that the key is used only at
// BUILD time, by scripts/fetch-unsplash-manifest.mjs, and that nothing reaching
// dist/ carries it. That is a claim about a build output, so it is checked
// against one.
//
// THE THREAT MODEL HERE IS MEASURED, NOT ASSUMED, and the first version of this
// file had it wrong. It scanned dist/ for the variable NAME, on the theory that
// a name in the bundle means a value in the bundle on the next build. Built and
// tested against a real bundle, with the values deliberately planted:
//
//   import.meta.env.UNSPLASH_ACCESS_KEY        name absent, value absent
//   import.meta.env.VITE_UNSPLASH_ACCESS_KEY   VALUE PRESENT
//   a hardcoded literal                        VALUE PRESENT
//
// Vite only exposes variables prefixed `VITE_`; everything else is replaced
// with `undefined` and the name vanishes. So the name scan can never fire on
// the one shape that actually leaks, and the guard passed a bundle with a
// planted secret in it. A guard that cannot fail on the case it exists for is
// decoration.
//
// Three checks now, each for a shape the measurement showed is real:
//
//   1. CLIENT SOURCE must not read any Unsplash variable through
//      import.meta.env at all. A `VITE_`-prefixed one is inlined; a bare one is
//      undefined and therefore a bug pretending to be a key. Catchable with no
//      key present, which is what makes it useful on a developer's machine.
//   2. dist/ must not contain the LIVE VALUE of any env var whose name mentions
//      Unsplash — the check that matters in CI, where the secret exists.
//   3. dist/ must not contain the variable names, which is cheap and catches a
//      literal that someone typed out.
//
// Scanning nothing is not a pass: run before a build, or after dist/ moved,
// this would otherwise report "no key in 0 files" and exit 0.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIST = join(ROOT, process.argv[2] || 'dist');

// The variable the core proxy reads (services/trip-core/internal/images/
// service.go). Named here so the two stay recognisably the same secret.
const KEY_NAME = 'UNSPLASH_ACCESS_KEY';
const SECRET_NAME = 'UNSPLASH_SECRET_KEY';

// Text the browser could receive. Images and fonts are not scanned: a key
// cannot be read out of them by the page, and a base64 sweep of every asset
// would be a different, much slower guard for a threat nobody has.
const TEXT = /\.(js|mjs|cjs|ts|tsx|css|html|json|map|txt|svg|webmanifest)$/i;

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, out);
    else if (TEXT.test(p)) out.push(p);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error(`unsplash-key check could not run: ${relative(ROOT, DIST)} does not exist. Build first — a guard with nothing to read is not a pass.`);
  process.exit(2);
}

const files = walk(DIST);
if (files.length === 0) {
  console.error(`unsplash-key check could not run: no text files under ${relative(ROOT, DIST)}. Scanning nothing is not a pass.`);
  process.exit(2);
}

// The live values, when this environment has them. EVERY env var whose name
// mentions Unsplash, not just the two we name: `VITE_UNSPLASH_ACCESS_KEY` is
// the shape that actually reaches a bundle, and it is not either of them.
// Short or empty values are ignored — an empty string matches every file, and a
// one-character placeholder nearly does.
const values = Object.entries(process.env)
  .filter(([name]) => /UNSPLASH/i.test(name))
  .map(([, v]) => (v || '').trim())
  .filter((v) => v.length >= 12);

const hits = [];

// CHECK 1: client source must not read an Unsplash variable through
// import.meta.env. This is the one that works without a key, and the one the
// measurement says is load-bearing — a `VITE_`-prefixed read is inlined into
// the bundle verbatim.
const SRC = join(ROOT, 'src');
if (existsSync(SRC)) {
  const IMPORT_META_UNSPLASH = /import\s*\.\s*meta\s*\.\s*env\s*\.\s*([A-Za-z0-9_]*UNSPLASH[A-Za-z0-9_]*)/gi;
  for (const f of walk(SRC)) {
    let body;
    try { body = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of body.matchAll(IMPORT_META_UNSPLASH)) {
      hits.push(`${relative(ROOT, f)}: client code reads import.meta.env.${m[1]} — the key must never be readable from the browser bundle`);
    }
  }
}
for (const f of files) {
  let body;
  try { body = readFileSync(f, 'utf8'); } catch (e) {
    console.error(`unsplash-key check could not read ${relative(ROOT, f)}: ${e.message}. That is not a pass.`);
    process.exit(2);
  }
  for (const name of [KEY_NAME, SECRET_NAME]) {
    if (body.includes(name)) hits.push(`${relative(ROOT, f)}: contains the string ${name}`);
  }
  // The value is never printed, only located. A guard that echoes the secret it
  // found to a CI log has published it to the place it was protecting it from.
  for (const v of values) {
    if (body.includes(v)) hits.push(`${relative(ROOT, f)}: contains the LIVE value of an Unsplash key (not shown)`);
  }
}

if (hits.length) {
  console.error('unsplash-key check FAILED: the Unsplash key must never reach a browser.\n');
  for (const h of hits) console.error(`  ${h}`);
  console.error('\nThe key belongs to scripts/fetch-unsplash-manifest.mjs, which runs in CI and writes a manifest. Client code reads the manifest, never the key.');
  process.exit(1);
}

console.log(
  `unsplash-key check passed: ${files.length} shipped file(s) carry no Unsplash key name or value, ` +
  `and no client source reads one through import.meta.env` +
  `${values.length ? '' : ' (no live Unsplash value set here, so the value sweep had nothing to look for)'}.`,
);
