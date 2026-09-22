#!/usr/bin/env node
// Absolute-claim guard: fails if forward-looking or unverifiable claims about
// data, security or competitors reappear in user-visible strings.
//
// Why this exists. Outside privacy counsel reviewed "No ads. No data selling.
// Ever." and told us three things (Q6, 23 Jul 2026):
//
//   1. "Ever" is a promise binding future management. Under FTC Act §5 it is a
//      representation we cannot guarantee, and it bought us nothing.
//   2. Several absolutes rested on processor contracts we had not signed. Four
//      of nine sub-processor DPAs are still open today.
//   3. "We never share your personal information" is simply false. We do share
//      it, with the services that run the product. A false claim shown at the
//      point of consent is a misrepresentation, not marketing puffery.
//
// The claim had reached 80 places across five repos, Resend and our own docs,
// because nothing was watching for it (claim sweep, 19 Aug 2026). Whatever
// wording replaces it will spread the same way, so the guard is the fix and
// the copy edit is only the cleanup.
//
// Shape deliberately mirrors check-plan-not-book.mjs: same fold, same segment
// extraction, same fail-closed allowlist, same CLI/import split. Two guards
// that behave differently are two guards nobody trusts.
//
// Allowlist: .absolute-claims-allow.txt (one regex per line, matched against
// the flagged SEGMENT, case-insensitive). A malformed pattern fails the run.

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SCAN_DIRS = ['src', 'public'];
// Files served to visitors that no directory walk reaches, because they sit in
// the repo ROOT (JAR-963).
//
// index.html is the document every page is built from. Its <title>, meta
// description and OG tags are the first copy a search result or a shared link
// shows anyone, and often the last copy anybody re-reads. A banned claim there
// passed this guard with exit 0; verified by putting one there and watching the
// check succeed.
const SCAN_FILES = ['index.html'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.css', '.md', '.txt']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.cache', '.next', 'coverage']);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// This guard's own test necessarily contains the banned lexicon as fixtures.
// Excluded by EXACT path, never via the allowlist: allowlist patterns carry no
// file scoping, so allowlisting "Ever." there would switch the gate off
// everywhere. One named file is auditable; a global pattern is not.
const SELF_TEST_FILES = new Set([
  'scripts/__tests__/check-absolute-claims.test.mjs',
  'scripts/check-absolute-claims.mjs',
]);

const BANNED = [
  // --- forward-looking absolutes (FTC Act §5) ---
  { re: /\bever[.!]/i, why: 'forward-looking absolute ("Ever.") binds future management' },
  { re: /\b(no|zero)\s+(ads|spam|tracking),?\s+ever\b/i, why: 'forward-looking absolute' },
  { re: /\bnever\s+(sell|sells|sold|selling)\b/i, why: 'absolute data claim; say "we don\'t sell" in the present tense' },
  { re: /\bnever\s+(share|shares|shared|sharing)\b/i, why: 'false: we do share data with the services that run the product' },
  { re: /\bnever\s+(track|tracks|tracked|tracking)\s+(you|your)\b/i, why: 'absolute; state present practice instead' },
  { re: /\b(forever|in perpetuity)\b/i, why: 'perpetual promise' },
  { re: /\bguarantee(d|s)?\b/i, why: 'guarantee language; state what the product does instead' },

  // "always X" is a promise about the future, which is the same thing rule 9
  // bans "Ever." and "forever" for: it binds management that has not happened
  // yet. The copy skill has banned the word since the JAR-896 sweep and NO
  // guard implemented it, so the rule was advice and the lexicon was the
  // enforcement, and the two had quietly diverged (JAR-964).
  //
  // Constructions, not the bare adverb. "This always runs first" in a string
  // literal is not a claim, and a guard that flags it is a guard someone turns
  // off. Approved shape, brand owner, 2026-08-21.
  //
  // "be" and "been" are deliberately NOT in the list. A live broadcast says
  // "think of a place you've always BEEN curious about", which is the reader's
  // own past and not a promise anybody is making. `will always` below catches
  // the promise form ("it will always be there") without that cost.
  { re: /\balways\s+(?:remain|remains|stay|stays|current|free|available|up[- ]to[- ]date|on|yours|works?|working|private|secure|encrypted|protected|safe|accurate|in\s+sync)\b/i, why: 'forward-looking promise; "always X" binds future management, say what is true today' },
  { re: /\bwill\s+always\b/i, why: 'forward-looking promise; state present practice instead' },

  // --- AI claims we cannot make (claim sweep §6.2) ---
  { re: /\bnever\s+trains?\b/i, why: 'false: a claim about our own training practice' },
  { re: /\btrains?\s+on\s+(your|it|the)\b/i, why: 'training claim; say "Jarvis is sent your trip, not your identity"' },
  { re: /does not use your personal data/i, why: 'false: Jarvis is sent trip context and free text' },
  { re: /\banonymi[sz]ed\b/i, why: 'counsel: the operation is pseudonymisation, not anonymisation' },

  // --- attested statuses we do not hold ---
  { re: /\b(bank[- ]level|military[- ]grade|256[- ]bit)\b/i, why: 'security specific we do not attest' },
  { re: /\bend[- ]to[- ]end encryption\b/i, why: 'we do not offer E2E encryption' },
  { re: /\b(PCI[- ]?DSS|SOC ?2|ISO ?27001|HIPAA)\b/i, why: 'attested status held by a processor, not by us' },
  { re: /\bfully compliant\b/i, why: 'compliance is not a status we can assert' },

  // --- competitor claims (Lanham Act §43(a)) ---
  { re: /\bmost (travel|free)\s+(apps|companies|planners|tools)\b/i, why: 'factual assertion about competitors needs substantiation' },
  { re: /\bother travel (apps|companies|planners)\b/i, why: 'factual assertion about competitors needs substantiation' },
];

// Cross-script homoglyphs. NFKC does not fold these, so they need a map, and
// the lowercase counterpart of every uppercase entry must be present or the
// fold is one-sided (the bug that let "вook" through the sibling guard).
const CONFUSABLES = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
  'і': 'i', 'ѕ': 's', 'ј': 'j', 'ԁ': 'd', 'һ': 'h', 'в': 'b', 'к': 'k',
  'т': 't', 'м': 'm', 'н': 'h',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
  'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y',
  'α': 'a', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ο': 'o', 'ρ': 'p', 'τ': 't',
  'υ': 'u', 'ν': 'v', 'χ': 'x',
  'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K',
  'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X',
  'ɡ': 'g', 'ı': 'i',
};
const ZERO_WIDTH = /[​‌‍⁠﻿­]/g;

const fold = (s) =>
  [...s.normalize('NFKC').replace(ZERO_WIDTH, '')]
    .map((c) => CONFUSABLES[c] ?? c)
    .join('');

// Lazy, and that matters: importing this module for its lexicon must do no
// filesystem work. The sibling guard learned that the hard way (JAR-600).
const loadAllow = () => {
  const allowPath = join(ROOT, '.absolute-claims-allow.txt');
  const allow = [];
  if (!existsSync(allowPath)) return allow;
  for (const raw of readFileSync(allowPath, 'utf8').split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    try {
      allow.push(new RegExp(l, 'i'));
    } catch (e) {
      console.error(`absolute-claims check FAILED — invalid allowlist pattern: ${l}\n  ${e.message}`);
      console.error('A broken allowlist must not silently disable the compliance gate.');
      process.exit(1);
    }
  }
  return allow;
};

const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*|\{\/\*|#)/.test(line);

// A line that is nothing but prose. This is how multi-line JSX text looks, and
// a legal guard that cannot see the most natural way to write a paragraph is
// worth very little.
const isBareProseLine = (line) => {
  const t = line.trim();
  if (t.length === 0) return false;
  const withoutContractions = t.replace(/([A-Za-z])['’]([A-Za-z])/g, '$1$2');
  if (/[<>{}'"`=;()[\]]/.test(withoutContractions)) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/,$/.test(t)) return false;
  if (/^[A-Za-z_$][\w$]*\s*:/.test(t)) return false;
  return t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length >= 2;
};

// A module specifier is a path, not copy.
const stripModuleSpecifier = (line) =>
  line
    .replace(/(^\s*(?:import|export)\b[^'"]*\bfrom\s*)(['"])[^'"]*\2/, '$1$2$2')
    .replace(/(^\s*import\s*)(['"])[^'"]*\2/, '$1$2$2')
    .replace(/(\brequire\s*\(\s*)(['"])[^'"]*\2/g, '$1$2$2');

// Humanly-visible segments: quoted strings and JSX text. For .md/.txt/.html
// the whole line is copy, so it is passed through as one segment.
const PROSE_EXTS = new Set(['.md', '.txt', '.html']);
const segments = (line, ext) => {
  if (PROSE_EXTS.has(ext)) return [line];
  const out = [];
  line = stripModuleSpecifier(line);
  const quoted = line.match(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g) || [];
  for (const q of quoted) out.push(q.slice(1, -1));
  const jsx = line.match(/>([^<>{}]+)</g) || [];
  for (const j of jsx) out.push(j.slice(1, -1));
  const tail = line.match(/\}\s*([A-Za-z][^<>{}]*)</g) || [];
  for (const t of tail) out.push(t.replace(/^\}\s*/, '').slice(0, -1));
  if (isBareProseLine(line)) out.push(line.trim());
  return out;
};

// A promise wrapped across a line break matched nothing, because every pattern
// ran against one line at a time. Plain-text email mirrors are hard-wrapped at
// about 80 columns, which is exactly where a sentence splits — "…the same
// living plan, always" / "current." was in this repo's own mirror while the
// same sentence was caught in the HTML beside it (JAR-1728). CI's
// failure-phrase scan had the same miss (JAR-1133).
//
// So the file is read a second time as ONE string: each line's segments, with
// comment lines left out as above, joined by a single space and every run of
// whitespace collapsed. A match that fits inside one line belongs to the pass
// above, which reports it with the line's own text; this pass reports only
// what spans a break, at the line where the match starts.
//
// The allowlist still applies per line: any line the match touches can excuse
// it, which is what allowlisting a sentence has always meant. Matching the
// allowlist against the joined string instead would let one allowlisted phrase
// anywhere in a file silence a real hit two hundred lines away.
const wrappedHits = (text, ext, allow) => {
  const pieces = [];
  text.split('\n').forEach((rawLine, i) => {
    const line = fold(rawLine);
    if (isCommentLine(line)) return;
    for (const seg of segments(line, ext)) {
      const t = seg.replace(/\s+/g, ' ').trim();
      if (t) pieces.push({ text: t, line: i + 1 });
    }
  });

  let flat = '';
  const lineAt = []; // lineAt[n] is the source line of flat[n]
  for (const piece of pieces) {
    if (flat) {
      flat += ' ';
      lineAt.push(piece.line);
    }
    flat += piece.text;
    for (let n = 0; n < piece.text.length; n++) lineAt.push(piece.line);
  }

  const out = [];
  for (const { re, why } of BANNED) {
    const all = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of flat.matchAll(all)) {
      const from = lineAt[m.index];
      const to = lineAt[Math.min(m.index + m[0].length - 1, lineAt.length - 1)];
      if (from === undefined || from === to) continue; // one line: the pass above owns it
      // Excused two ways, and both are needed. A pattern written for one of the
      // lines still works, which is what allowlisting a sentence has always
      // meant — and a pattern written for the whole sentence works too, since a
      // sentence broken by a wrap matches no single line, so a per-line-only
      // test would leave a wrapped claim impossible to allowlist at all.
      const touched = pieces.filter((piece) => piece.line >= from && piece.line <= to);
      if (allow.some((a) => a.test(m[0]))) continue;
      if (touched.some((piece) => allow.some((a) => a.test(piece.text)))) continue;
      out.push({ line: from, why, text: m[0].trim().slice(0, 100) });
    }
  }
  return out;
};

const warnings = [];
const walk = (d, out = []) => {
  let entries;
  try {
    entries = readdirSync(d);
  } catch (e) {
    warnings.push(`unreadable dir ${d}: ${e.message}`);
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(d, name);
    let st;
    try {
      st = lstatSync(p); // lstat: never follow symlinks
    } catch (e) {
      warnings.push(`unreadable ${p}: ${e.message}`);
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

export { fold, BANNED, segments, isCommentLine, CONFUSABLES, SCAN_DIRS, SCAN_FILES, wrappedHits };

const isCLI = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (!isCLI) {
  // Imported for its helpers (tests). Nothing else to do.
} else {
  const allow = loadAllow();
  const hits = [];
  // Named root files first, then everything the directory walk finds. One list,
  // so a file cannot be scanned by one code path and skipped by the other.
  const files = [
    ...SCAN_FILES.map((f) => join(ROOT, f)).filter((f) => existsSync(f)),
    ...SCAN_DIRS.flatMap((dir) => (existsSync(join(ROOT, dir)) ? walk(join(ROOT, dir)) : [])),
  ];

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (SELF_TEST_FILES.has(rel)) continue;
    const ext = file.slice(file.lastIndexOf('.'));
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      warnings.push(`unreadable ${file}: ${e.message}`);
      continue;
    }
    text.split('\n').forEach((rawLine, i) => {
      const line = fold(rawLine);
      if (isCommentLine(line)) return; // comments document, they don't advertise
      for (const seg of segments(line, ext)) {
        for (const { re, why } of BANNED) {
          if (re.test(seg) && !allow.some((a) => a.test(seg))) {
            hits.push({ file: rel, line: i + 1, why, text: seg.trim().slice(0, 100) });
          }
        }
      }
    });

    for (const h of wrappedHits(text, ext, allow)) {
      hits.push({ file: rel, line: h.line, why: h.why, text: h.text });
    }
  }

  for (const w of warnings) console.warn(`absolute-claims warning: ${w}`);
  if (hits.length) {
    console.error(`absolute-claims check FAILED — ${hits.length} hit(s):\n`);
    for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.why}]\n    "${h.text}"\n`);
    console.error('State present practice, not a perpetual promise: "No ads. No data selling." /');
    console.error('"We don\'t sell your personal information." For a legitimate exception, add a');
    console.error('narrow regex to .absolute-claims-allow.txt and say why in a comment.');
    process.exit(1);
  }
  console.log('absolute-claims check passed — no absolute or unverifiable claims in copy.');
}
