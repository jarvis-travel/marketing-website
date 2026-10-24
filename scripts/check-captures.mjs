#!/usr/bin/env node
// Guard: the "Make this day lighter" scene ships the picture someone checked:
// the applied result, not the preview with its opening-hours caveat (JAR-3110).
//
// web-app's capture run still shoots the preview, and its recorded answer
// carries "Couldn't check opening hours for ..." (until JAR-3563 lands). The
// build only checks that each capture exists under its name, so the next
// refresh-and-copy would put the caveat back on the Features page with every
// check green. A checksum is blunt on purpose, as in check-og-card.mjs: any
// change to these files has to come past this line, and whoever makes it has to
// look at the new picture first.
//
// To update after a deliberate refresh:
//   1. look at every new day-lighter file: Friday in Tivoli rated balanced, the
//      "Friday is lighter now" note with Undo, and no "Couldn't check" line
//   2. run `npm run lint:captures -- --update` and commit the new digests
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PINS = resolve(ROOT, 'src/app/data/appCaptures.pins.json');

const pins = JSON.parse(readFileSync(PINS, 'utf8'));
const paths = Object.keys(pins.files);
const digest = (path) => createHash('sha256').update(readFileSync(resolve(ROOT, path))).digest('hex');

if (process.argv.includes('--update')) {
  for (const path of paths) pins.files[path] = digest(path);
  writeFileSync(PINS, `${JSON.stringify(pins, null, 2)}\n`);
  console.log(`check-captures: pinned ${paths.length} file(s)`);
  process.exit(0);
}

const problems = [];
for (const path of paths) {
  if (!existsSync(resolve(ROOT, path))) {
    problems.push(`${path} is missing.`);
    continue;
  }
  const actual = digest(path);
  if (actual !== pins.files[path]) {
    problems.push(`${path} is not the picture that was checked `
      + `(pinned ${pins.files[path].slice(0, 12)}, now ${actual.slice(0, 12)}).`);
  }
}

if (problems.length) {
  console.error('check-captures FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`\n${pins.note}\n`);
  console.error('Look at each new picture first. If it shows the applied result and no');
  console.error('"Couldn\'t check opening hours" line, run: npm run lint:captures -- --update');
  process.exit(1);
}

console.log(`check-captures: ${paths.length} day-lighter capture(s) are the pictures checked by eye.`);
