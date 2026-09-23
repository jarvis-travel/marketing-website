#!/usr/bin/env node
// Guard: this site can serve the images every JarvisTravel email loads.
//
// The emails do not carry their images; they hot-link them, by absolute URL, at
// the apex. Measured 2026-09-22: `jarvistravel.com` and `www` are served by the
// WAITLIST site, which holds these files in its own `public/email/`, and
// `mktg.jarvistravel.com/email/hero-phone-fi.png` answered `200 text/html` —
// the SPA shell, not a PNG.
//
// So on the day this site takes over the apex, every masthead and every hero in
// every template resolves to an HTML page, and 88 templates lose their images at
// once. That is the regression this guard exists to prevent: it fails when a
// file the live templates reference is not here to be served (JAR-1879).
//
// The list is derived, not invented. From a design-library checkout, which
// mirrors every published template:
//
//   git grep -ohE 'https://(www\.)?jarvistravel\.com/email/[A-Za-z0-9._-]+' \
//     -- email/snapshots email/broadcasts | sort | uniq -c
//
// Re-run that after any template change and update REQUIRED to match.
//
// Deliberately NOT a checksum, unlike check-og-card.mjs. That card is one
// binary with a fixed design, and the failure it guards was a wrong image. These
// ten change whenever design-library rebuilds a hero, and the failure here is an
// ABSENT image, so pinning bytes would tax every routine update without
// catching anything this does not.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'public/email');

// filename -> how many published templates reference it, so a reader can see
// the blast radius of removing one.
const REQUIRED = {
  'logo-lockup-light.png': 88,
  'logo-mark-light.png': 88,
  'hero-phone-fi.png': 6,
  'hero-phone-planner.png': 5,
  'hero-phone-group.png': 3,
  'hero-phone-budget.png': 2,
  'hero-duo-home.png': 2,
  'hero-laptop-home.png': 1,
  'hero-phone-journal.png': 1,
  'hero-phone-recap.png': 1,
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const problems = [];

if (!existsSync(DIR)) {
  problems.push('public/email/ does not exist. Every email that this site serves loses its images.');
} else {
  for (const [name, refs] of Object.entries(REQUIRED)) {
    const file = join(DIR, name);
    if (!existsSync(file)) {
      problems.push(`${name} is missing — ${refs} published template(s) load it.`);
      continue;
    }
    const bytes = readFileSync(file);
    if (bytes.length === 0) {
      problems.push(`${name} is empty — ${refs} published template(s) load it.`);
    } else if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) {
      problems.push(`${name} is not a PNG. Mail clients render it as a broken image.`);
    }
  }

  // `public/` is copied verbatim into `dist/`, so anything left beside the
  // images is published on the marketing domain. A README here did exactly
  // that in the sibling repo before it was caught.
  for (const name of readdirSync(DIR)) {
    if (name.startsWith('.') || statSync(join(DIR, name)).isDirectory()) continue;
    if (!(name in REQUIRED)) {
      problems.push(`${name} is not referenced by any template, and public/ is published `
        + `verbatim, so it would be served at jarvistravel.com/email/${name}. `
        + `Remove it, or add it to REQUIRED if a template now uses it.`);
    }
  }
}

if (problems.length) {
  console.error('check-email-assets FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nSource of truth: design-library/email/heroes/ (heroes) and the serving');
  console.error('contract in design-library/email/URL-CONTRACT.md.');
  process.exit(1);
}

const count = Object.keys(REQUIRED).length;
const refs = Object.values(REQUIRED).reduce((a, b) => a + b, 0);
console.log(`check-email-assets: ${count} image(s) present and readable as PNG, `
  + `carrying ${refs} references from the published templates.`);
