#!/usr/bin/env node
// Shared copy-guard case runner (JAR-3766).
//
// The copy guards (check-absolute-claims.mjs, check-plan-not-book.mjs) are
// hand-copied across marketing-website, web-app and design-library and keep
// drifting on WHICH LINES ARE PROSE (block comments, template edges). This
// runner feeds one canonical suite of cases (cases.json, byte-identical in
// every repo) through this repo's OWN guards and asserts each flags exactly the
// lines the suite says. A repo whose extraction — or whose rule set — diverges
// fails on a case another repo already proves.
//
// It shells out to the guard CLIs (as the per-guard self-tests already do) so
// the guards keep their own extraction; nothing here is shared guard code, only
// shared cases. A case is a source snippet, its file kind, and the lines the
// guard must flag (empty = must pass clean) — "which lines are prose", made
// executable.

import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '..');

// guard key -> CLI path. Each repo points these at its own guards.
export const GUARDS = {
  'absolute-claims': join(SCRIPTS, 'check-absolute-claims.mjs'),
  'plan-not-book': join(SCRIPTS, 'check-plan-not-book.mjs'),
};

// Parse `  <file>:<line>  [<why>]` finding lines from a guard's output.
function parseFlaggedLines(output) {
  const lines = new Set();
  for (const raw of output.split('\n')) {
    const m = raw.match(/^\s+\S.*?:(\d+)\s+\[.+\]\s*$/);
    if (m) lines.add(Number(m[1]));
  }
  return [...lines].sort((a, b) => a - b);
}

// A guard's infrastructure failure (a missing scan root, an empty corpus, an
// unreadable file) exits non-zero with NO findings — it must never be read as
// "clean". The guards fail closed on these; so does the runner.
const INFRA_FAILURE = /(scan root\(s\) not found|scanned 0 files|READ FAILURE|invalid allowlist pattern)/;

// Run one snippet through one guard in an isolated temp corpus and return the
// sorted set of lines the guard flagged. The corpus satisfies BOTH guards'
// required scan roots: index.html (a file root absolute-claims requires) plus
// src/ and public/. The snippet goes to its case file (default src/Copy.tsx);
// a benign, clean index.html is written only when the case isn't itself that
// file, so it never adds a spurious hit.
export function flaggedLines(guardPath, snippet, file) {
  const dir = mkdtempSync(join(tmpdir(), 'copyguard-'));
  try {
    mkdirSync(join(dir, 'src'), { recursive: true });
    mkdirSync(join(dir, 'public'), { recursive: true });
    const rel = file || 'src/Copy.tsx';
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    writeFileSync(join(dir, rel), snippet);
    if (rel !== 'index.html') writeFileSync(join(dir, 'index.html'), '<!doctype html>\n<title>fixture</title>\n');
    let output = '';
    try {
      output = execFileSync('node', [guardPath], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      output = (e.stdout || '') + (e.stderr || '');
    }
    if (INFRA_FAILURE.test(output)) {
      throw new Error(`guard infra failure running a case (corpus setup bug), not a result:\n${output}`);
    }
    return parseFlaggedLines(output);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const sameLines = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Run every case; return { passed, failed, failures: [{guard, name, expected, actual}] }.
export function runCases(casesPath = join(HERE, 'cases.json'), guards = GUARDS) {
  const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
  let passed = 0;
  const failures = [];
  for (const guardKey of Object.keys(cases)) {
    const guardPath = guards[guardKey];
    if (!guardPath) throw new Error(`cases.json names an unknown guard: ${guardKey}`);
    for (const c of cases[guardKey]) {
      const expected = [...(c.expectLines || [])].sort((a, b) => a - b);
      const actual = flaggedLines(guardPath, c.snippet, c.file);
      if (sameLines(expected, actual)) passed++;
      else failures.push({ guard: guardKey, name: c.name, expected, actual });
    }
  }
  return { passed, failed: failures.length, failures };
}

// CLI: run the suite, print a report, exit 1 on any divergence.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const { passed, failed, failures } = runCases();
  for (const f of failures) {
    console.error(`  FAIL [${f.guard}] ${f.name}`);
    console.error(`       expected flagged lines ${JSON.stringify(f.expected)}, guard flagged ${JSON.stringify(f.actual)}`);
    console.error('       this repo\'s guard diverges from the canonical suite — reconcile its extraction/rules, or update cases.json in marketing-website first.');
  }
  console.log(`copy-guard cases: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
