#!/usr/bin/env node
// Plan-not-book guard: fails if travel-booking language reappears in source.
//
// JarvisTravel's legal posture (see the CA Seller of Travel registration
// analysis) is that it plans and never books/arranges travel. Under CA Bus. &
// Prof. Code § 17550.1, *advertising* the ability to arrange air/sea
// transportation is itself a trigger — so banned language in UI copy is a
// legal exposure even though the product never transacts travel.
//
// Evasion hardening (PR #21 review, H1): every line is folded before matching —
// NFKC normalization (fullwidth/compatibility forms), zero-width and soft-
// hyphen stripping (b​ook), and a Cyrillic/Greek confusables map (bооk with
// Cyrillic о). NFKC alone does NOT fold cross-script homoglyphs, hence the map.
//
// Allowlist: .plan-not-book-allow.txt (one regex per line, # comments).
// A flagged line is skipped when any allow pattern matches it (also folded).
// A malformed allowlist pattern fails the run (fail closed, never open).

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
// `public` is scanned as well as `src`: files there are served verbatim to
// crawlers, agents and anyone who asks for them, so they are copy in every
// sense that matters legally. public/llms.txt described "aggregate pricing
// across booking platforms" for months precisely because this guard could not
// see it (JAR-20).
const SCAN_DIRS = ['src', 'public'];
// .txt included for the same reason: llms.txt and robots.txt are published
// copy, not configuration.
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.md', '.txt']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.cache', '.next', 'coverage']);
const MAX_FILE_BYTES = 2 * 1024 * 1024; // generated/binary blobs are not copy

// Word-boundaried so bookmark/notebook/Facebook never match.
const BANNED = [
  { re: /\b(book|books|booked|booking|bookings|rebook|re-book)\b/i, why: 'travel-booking verb' },
  { re: /\bconcierge\s+(booking|contact)\b/i, why: 'concierge-arrangement claim' },
  { re: /\bone[- ]stop\s+shop\b/i, why: 'one-stop-shop claim' },
  { re: /\bsecure\s+(your\s+)?(flights?|hotels?|trips?)\b/i, why: 'secures-travel claim' },
  { re: /\barrang\w*\s+(your\s+)?(flights?|hotels?|travel|transport\w*)\b/i, why: 'arranges-travel claim' },
  { re: /\bemergency\s+assistance\b/i, why: 'travel-agent-style assistance claim' },
];

// Cross-script homoglyphs that render like Latin letters (Unicode confusables,
// trimmed to letters that can spell the banned lexicon). NFKC does not fold
// these — they need an explicit map.
const CONFUSABLES = {
  // Cyrillic lowercase / uppercase
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c',
  'у': 'y', 'х': 'x', 'і': 'i', 'ѕ': 's', 'ј': 'j', 'в': 'b', 'н': 'h', 'к': 'k',
  'ԁ': 'd', 'һ': 'h', 'А': 'A', 'В': 'B', 'Е': 'E',
  'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P',
  'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y',
  // Greek lowercase / uppercase
  'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o',
  'ρ': 'p', 'τ': 't', 'υ': 'u', 'ν': 'v', 'χ': 'x',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H',
  'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O',
  'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
  // Latin lookalikes
  'ɡ': 'g', 'ı': 'i',
};
// ZWSP, ZWNJ, ZWJ, word joiner, BOM, soft hyphen — invisible word-breakers.
const ZERO_WIDTH = /[​‌‍⁠﻿­]/g;

const fold = (s) =>
  [...s.normalize('NFKC').replace(ZERO_WIDTH, '')]
    .map((c) => CONFUSABLES[c] ?? c)
    .join('');

// --- allowlist: fail closed on malformed patterns (review M2) ---
const allowPath = join(ROOT, '.plan-not-book-allow.txt');
const allow = [];
if (existsSync(allowPath)) {
  for (const raw of readFileSync(allowPath, 'utf8').split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    try {
      allow.push(new RegExp(l, 'i'));
    } catch (e) {
      console.error(`plan-not-book check FAILED — invalid allowlist pattern: ${l}\n  ${e.message}`);
      console.error('A broken allowlist must not silently disable the compliance gate.');
      process.exit(1);
    }
  }
}

// Only code has comment lines; every line of a prose file is copy. In .md a "*"
// opens a bullet, and .txt and .html (where "<!--" opens an HTML comment) are
// copy throughout, so their lines are all read (JAR-3521).
//
// "*" stays in the code rule here, unlike check-absolute-claims.mjs: this guard
// matches per line with no block-comment open-tracker, so a bare "*" is its only
// handling for a JSDoc "* …" continuation line. Dropping it (to stop a CSS
// "* { … }" selector hiding copy, as the sibling does) would read every JSDoc
// continuation as copy. Porting the sibling's open-tracker is a separate change
// (JAR-3665).
const PROSE_EXTS = new Set(['.md', '.txt', '.html']);
const isCommentLine = (line, ext) => !PROSE_EXTS.has(ext) && /^\s*(\/\/|\/\*|\*|\{\/\*|<!--)/.test(line);

const warnings = [];
// Files or directories that existed but could not be read. These FAIL the run:
// a corpus the guard cannot read must not report "clean" (mirrors
// check-absolute-claims.mjs, Ryan fleet review). An oversized skip is a bounded,
// deliberate skip and stays a warning.
const readFailures = [];
const walk = (d, out = []) => {
  let entries;
  try {
    entries = readdirSync(d);
  } catch (e) {
    readFailures.push(`unreadable dir ${d}: ${e.message}`);
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(d, name);
    let st;
    try {
      st = lstatSync(p); // lstat: never follow symlinks (loop/escape protection)
    } catch (e) {
      readFailures.push(`unreadable ${p}: ${e.message}`);
      continue;
    }
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(p.slice(p.lastIndexOf('.')))) {
      if (st.size > MAX_FILE_BYTES) {
        warnings.push(`skipped oversized file ${p} (${st.size} bytes)`);
        continue;
      }
      out.push(p);
    }
  }
  return out;
};

const hits = [];
let scanned = 0;
for (const dir of SCAN_DIRS) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const file of walk(join(ROOT, dir))) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      readFailures.push(`unreadable ${relative(ROOT, file)}: ${e.message}`);
      continue;
    }
    scanned++;
    const ext = file.slice(file.lastIndexOf('.'));
    text.split('\n').forEach((rawLine, i) => {
      const line = fold(rawLine);
      if (isCommentLine(line, ext)) return; // comments document, they don't advertise
      for (const { re, why } of BANNED) {
        if (re.test(line) && !allow.some((a) => a.test(line))) {
          hits.push({ file: relative(ROOT, file), line: i + 1, why, text: line.trim().slice(0, 120) });
        }
      }
    });
  }
}

for (const w of warnings) console.warn(`plan-not-book warning: ${w}`);

// Fail closed before reporting clean: a corpus the guard could not read, or an
// empty one from a rename / moved directory / partial checkout, each produces
// zero hits and must not exit 0 (mirrors check-absolute-claims.mjs, Ryan fleet
// review F1/F2).
if (readFailures.length) {
  for (const w of readFailures) console.error(`plan-not-book READ FAILURE — ${w}`);
  console.error(`plan-not-book check FAILED — ${readFailures.length} file(s)/dir(s) could not be read; a corpus it cannot read is not a clean one.`);
  process.exit(1);
}
if (scanned === 0) {
  console.error(`plan-not-book check FAILED — scanned 0 files under ${SCAN_DIRS.join(', ')}.`);
  console.error('A rename, a moved directory, or a partial checkout reads as a clean sweep; refusing instead.');
  process.exit(1);
}

if (hits.length) {
  console.error(`plan-not-book check FAILED — ${hits.length} banned-language hit(s):\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.why}]\n    ${h.text}\n`);
  console.error('Fix the copy (prefer plan/open-on-provider language) or, for a legitimate');
  console.error('exception (see the cleanup spec §2), add a narrow regex to .plan-not-book-allow.txt.');
  process.exit(1);
}
console.log(`plan-not-book check passed — no banned travel-booking language found (${scanned} file(s) scanned).`);
