#!/usr/bin/env node
// Guard: this site can serve the images every JarvisTravel email loads.
//
// The emails do not carry their images; they hot-link them, by absolute URL at
// the apex. Measured 2026-11-24: `jarvistravel.com/email/logo-lockup-light.png`
// answers `200 image/png` out of this repo's `dist/`, while any path that is not
// a file (`jarvistravel.com/email/bf-receipt.jpg` before it shipped) answers
// `200 text/html` — the SPA shell, which a mail client renders as a broken
// image. So a missing file does not look missing from the outside.
//
// That is the regression this guard exists to prevent: it fails when a file the
// live emails reference is not here to be served (JAR-1879), and when the file
// is not decodable as the format its name promises (JAR-4571).
//
// Most of the list is derived, not invented. From a design-library checkout,
// which mirrors every published template:
//
//   git grep -ohE 'https://(www\.)?jarvistravel\.com/email/[A-Za-z0-9._-]+' \
//     -- email/snapshots email/broadcasts | sort | uniq -c
//
// Re-run that after any template change and update REQUIRED to match. The
// broadcast JPEGs can never come from that command — they belong to broadcasts
// that have not been sent yet — so they are listed by hand under a ticket; see
// BROADCAST_IMAGES below.
//
// Deliberately NOT a checksum, unlike check-og-card.mjs. That card is one
// binary with a fixed design, and the failure it guarded was a wrong image. The
// hero set changes whenever design-library rebuilds a hero, and the failure here
// is an ABSENT or undecodable image, so pinning bytes would tax every routine
// update without catching anything this does not.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, 'public/email');

// filename -> how many emails reference it, so a reader can see the blast
// radius of removing one.
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
  // JAR-4571: Black Friday (sent Nov 27 2026) and Cyber Monday (Nov 30 2026)
  // broadcasts, one pair each, built by ~/code/reels/email/bf-cm.mjs. Their
  // filenames are already inside HTML published in Resend, so a rename breaks
  // those sends the way a hero rename breaks a template. A delivered broadcast
  // still loads them from here: do NOT remove these on the send date.
  'bf-receipt.jpg': 1,
  'bf-stamps.jpg': 1,
  'cm-board.jpg': 1,
  'cm-tags.jpg': 1,
};

// The entries the design-library command above cannot produce: hand-listed
// under a ticket, and counted against scheduled broadcasts rather than
// published templates.
const BROADCAST_IMAGES = new Set(['bf-receipt.jpg', 'bf-stamps.jpg', 'cm-board.jpg', 'cm-tags.jpg']);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);
const JPEG_EOI = Buffer.from([0xff, 0xd9]);
// Some encoders pad a few bytes after EOI; anything longer is not a JPEG tail.
const JPEG_EOI_SLACK = 16;

/** The JPEG marker byte that may follow SOI: APPn, DQT, SOFn, DHT, or COM. */
function isJpegMarkerAfterSoi(byte) {
  return (byte >= 0xe0 && byte <= 0xef) // APP0..APP15
    || byte === 0xdb // DQT
    || (byte >= 0xc0 && byte <= 0xcf) // SOF0..SOF15
    || byte === 0xfe; // COM
}

/**
 * Why `bytes` is not a PNG/JPEG, or null when it is one.
 *
 * The three-byte `FF D8 FF` test alone is not enough: it is also what a JPEG
 * header pasted in front of an HTML document looks like, and the guard exists
 * precisely to refuse an HTML page served where an image belongs. Require a real
 * segment marker after SOI and the EOI trailer, so a truncated re-export fails
 * here rather than in a subscriber's inbox.
 */
function formatProblem(bytes, format) {
  if (bytes.length === 0) return 'is empty';
  if (format === 'PNG') {
    return bytes.subarray(0, 8).equals(PNG_MAGIC) ? null : 'is not a PNG';
  }
  if (!bytes.subarray(0, 3).equals(JPEG_SOI)) return 'is not a JPEG';
  if (!isJpegMarkerAfterSoi(bytes[3])) {
    return 'is not a JPEG — the bytes after its start marker are not a JPEG segment';
  }
  const tailStart = Math.max(0, bytes.length - JPEG_EOI_SLACK);
  if (bytes.lastIndexOf(JPEG_EOI) < tailStart) {
    return 'is truncated — it has no JPEG end marker';
  }
  return null;
}

const FORMATS = { '.png': 'PNG', '.jpg': 'JPEG', '.jpeg': 'JPEG' };
const formatOf = (name) => FORMATS[extname(name).toLowerCase()];

const refLabel = (name, refs) => (BROADCAST_IMAGES.has(name)
  ? `${refs} scheduled broadcast(s) load it`
  : `${refs} published template(s) load it`);

const problems = [];

if (!existsSync(DIR)) {
  problems.push('public/email/ does not exist. Every email that this site serves loses its images.');
} else {
  for (const [name, refs] of Object.entries(REQUIRED)) {
    const file = join(DIR, name);
    if (!existsSync(file)) {
      problems.push(`${name} is missing — ${refLabel(name, refs)}.`);
      continue;
    }
    const format = formatOf(name);
    if (!format) {
      problems.push(`${name} has no format this guard checks (.png, .jpg).`);
      continue;
    }
    let bytes;
    try {
      bytes = readFileSync(file);
    } catch (e) {
      problems.push(`${name} cannot be read (${e.code || e.message}) — mail clients receive no image.`);
      continue;
    }
    const why = formatProblem(bytes, format);
    if (why) {
      problems.push(`${name} ${why} — ${refLabel(name, refs)}. `
        + `Mail clients render it as a broken image.`);
    }
  }

  // `public/` is copied verbatim into `dist/`, so anything left beside the
  // images is published on the marketing domain. A README here did exactly
  // that in the sibling repo before it was caught. `withFileTypes` rather than
  // `statSync`: a broken symlink would otherwise throw instead of being named.
  for (const entry of readdirSync(DIR, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.isDirectory()) continue;
    if (!Object.hasOwn(REQUIRED, entry.name)) {
      problems.push(`${entry.name} is not referenced by any email, and public/ is published `
        + `verbatim, so it would be served at jarvistravel.com/email/${entry.name}. `
        + `Remove it, or add it to REQUIRED if a template or broadcast now uses it.`);
    }
  }
}

if (problems.length) {
  console.error('check-email-assets FAILED:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('\nSource of truth: design-library/email/heroes/ (heroes) and the serving');
  console.error('contract in design-library/email/URL-CONTRACT.md; the broadcast images');
  console.error('are hand-listed in BROADCAST_IMAGES with the ticket that added them.');
  process.exit(1);
}

const count = Object.keys(REQUIRED).length;
const refs = Object.values(REQUIRED).reduce((a, b) => a + b, 0);
console.log(`check-email-assets: ${count} image(s) present and readable as the format their `
  + `name promises, carrying ${refs} references from published templates and scheduled broadcasts.`);
