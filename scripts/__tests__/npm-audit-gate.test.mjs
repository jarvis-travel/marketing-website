#!/usr/bin/env node
// Self-test for npm-audit-gate.mjs (JAR-1734). Two layers:
//   - evaluate(): the pure verdict, driven with synthetic audit JSON (no npm).
//   - end-to-end: the real CLI path — runAudit() + the main-entry guard — run as
//     a subprocess with a fake `npm` on PATH, so a silently no-oping guard or a
//     broken npm invocation is caught (JAR-1734 review, M1).
// Each case fails if its matching rule is removed (mutation-checkable).
import { evaluate } from '../npm-audit-gate.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, chmodSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
const eq = (got, want, msg) => {
  if (got === want) { passed++; console.log(`  ok   ${msg}`); }
  else { failed++; console.error(`  FAIL ${msg}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};
const has = (lines, needle, msg) => {
  if (lines.some((l) => l.includes(needle))) { passed++; console.log(`  ok   ${msg}`); }
  else { failed++; console.error(`  FAIL ${msg}: no line contains ${JSON.stringify(needle)} in ${JSON.stringify(lines)}`); }
};

const TODAY = '2026-09-16';

const withAdvisory = (severity, ghsa) => ({
  metadata: { vulnerabilities: { critical: severity === 'critical' ? 1 : 0, high: severity === 'high' ? 1 : 0, moderate: severity === 'moderate' ? 1 : 0, low: 0, total: 1 } },
  vulnerabilities: {
    pkg: { severity, via: [{ severity, url: `https://github.com/advisories/${ghsa}`, title: `${severity} advisory` }] },
  },
});
const clean = { metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } }, vulnerabilities: {} };

const VITE = 'GHSA-fx2h-pf6j-xcff';
const exc = (over = {}) => ({ id: VITE, expires: '2027-01-01', why: 'dev-only, tracked', ...over });

// --- Property 3: a keyhole, not an off switch ------------------------------
eq(evaluate(clean, [], TODAY).code, 0, 'clean audit passes');
eq(evaluate(withAdvisory('high', VITE), [], TODAY).code, 1, 'an un-excepted high blocks');
eq(evaluate(withAdvisory('critical', 'GHSA-crit-0000'), [], TODAY).code, 1, 'an un-excepted critical blocks');
eq(evaluate(withAdvisory('moderate', 'GHSA-mod-0000'), [], TODAY).code, 0, 'a moderate advisory is below the gate');

// The exception works when it should: firing, excepted, unexpired.
eq(evaluate(withAdvisory('high', VITE), [exc()], TODAY).code, 0, 'an excepted, firing, unexpired high passes');

// --- Decision A: expired / no-longer-firing WARN, never change the code -----
const stale = evaluate(clean, [exc()], TODAY);
eq(stale.code, 0, 'an exception that no longer fires does not block (decision A)');
has(stale.lines, 'no longer appears', 'a no-longer-firing exception is flagged');

const expired = evaluate(withAdvisory('high', VITE), [exc({ expires: '2026-01-01' })], TODAY);
eq(expired.code, 0, 'an expired, still-firing exception does not block (decision A)');
has(expired.lines, 'expired 2026-01-01', 'an expired exception is flagged');

// --- Malformed entries are a gate-config bug: they block (JAR-1734 review) --
eq(evaluate(withAdvisory('high', VITE), [exc({ expires: 'soon' })], TODAY).code, 1, 'a non-date expires blocks');
eq(evaluate(withAdvisory('high', VITE), [exc({ expires: '2026-13-01' })], TODAY).code, 1, 'an impossible date (month 13) blocks');
eq(evaluate(withAdvisory('high', VITE), [exc({ expires: '2026-02-30' })], TODAY).code, 1, 'an impossible date (Feb 30) blocks');
eq(evaluate(withAdvisory('high', VITE), [exc({ why: '' })], TODAY).code, 1, 'an exception with no reason blocks');
// ...and a malformed entry excepts nothing, so its advisory still falls to the keyhole.
has(evaluate(withAdvisory('high', VITE), [exc({ why: '' })], TODAY).lines, 'BLOCKED', 'a malformed exception does not suppress its advisory');

// --- Fail closed, never fail open (JAR-1734 review round 5) -----------------
// An advisory with neither a GHSA url nor a source can't be keyed, but a
// high/critical must still block — keyed by package name, never dropped.
const unkeyable = { metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } }, vulnerabilities: { widget: { severity: 'high', via: [{ severity: 'high', title: 'mystery high' }] } } };
const rUnkeyable = evaluate(unkeyable, [], TODAY);
eq(rUnkeyable.code, 1, 'an unidentifiable high blocks (keyed by package), not skipped');
has(rUnkeyable.lines, 'pkg:widget', 'the unidentifiable high is keyed by its package');

// npm 6's shape has `advisories`, not `vulnerabilities`; a missing vulnerabilities
// object must fail closed, not read as clean.
const npm6 = { metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } }, advisories: { 1234: { severity: 'high' } } };
eq(evaluate(npm6, [], TODAY).code, 1, 'an audit with no vulnerabilities object fails closed');

// A legacy npmjs.com advisory url is not GHSA-shaped; the id must come from
// `source` as npm:<n> so the documented npm:<n> exception form can match.
const legacyVia = { metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } }, vulnerabilities: { oldpkg: { severity: 'high', via: [{ severity: 'high', url: 'https://npmjs.com/advisories/1234', source: 1234, title: 'legacy' }] } } };
eq(evaluate(legacyVia, [{ id: 'npm:1234', expires: '2027-01-01', why: 'dev-only, tracked' }], TODAY).code, 0, 'a legacy npmjs.com advisory keys as npm:<source>, so its npm:<n> exception matches');
has(evaluate(legacyVia, [], TODAY).lines, 'npm:1234', 'a legacy npmjs.com advisory is keyed npm:<source>, not a bare number');

// A high entry whose advisory sits under a renamed key (so `via` is empty) has no
// via we can read; the per-entry check (b) fails closed, naming the package.
const drifted = { metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } }, vulnerabilities: { pkg: { severity: 'high', advisories: [{ severity: 'high', title: 'renamed key' }] } } };
const rDrift = evaluate(drifted, [], TODAY);
eq(rDrift.code, 1, 'a renamed-key advisory (no readable via) fails closed');
has(rDrift.lines, 'no readable via', 'the renamed-key failure names the package');

// The cross-check needs npm's numeric counts to vouch for an empty parse. If
// metadata carries no vulnerabilities counts, a drifted report (renamed key here,
// so `via` is empty) would otherwise slip through — fail closed on missing or
// non-numeric counts (JAR-1734 review round 7).
const noCounts = { metadata: {}, vulnerabilities: { pkg: { severity: 'high', advisories: [{ severity: 'high', title: 'renamed key, no counts' }] } } };
eq(evaluate(noCounts, [], TODAY).code, 1, 'metadata without numeric high/critical counts fails closed');

// r6 stays covered: entries explained only by transitive-edge strings (nothing
// fires) while metadata counts highs — the count cross-check catches it.
const transitiveOnly = { metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 0, low: 0, total: 2 } }, vulnerabilities: { a: { severity: 'high', via: ['b'] }, b: { severity: 'high', via: ['a'] } } };
eq(evaluate(transitiveOnly, [], TODAY).code, 1, 'entries with only transitive-edge vias (nothing fires) fail closed via the count cross-check');
has(evaluate(transitiveOnly, [], TODAY).lines, 'metadata counts', "the count cross-check names npm's totals");

// (a): npm counts more highs than there are high entries, but a firing entry keeps
// the r6 cross-check from tripping — the structural count check catches it (r8).
const countMismatch = { metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 0, low: 0, total: 2 } }, vulnerabilities: { vite: { severity: 'high', via: [{ severity: 'high', url: `https://github.com/advisories/${VITE}`, title: 'vite' }] } } };
eq(evaluate(countMismatch, [exc()], TODAY).code, 1, 'metadata counting more highs than entries fails closed (structural)');

// (b): a partial drift — one entry (evil) has no readable via — fails closed even
// when its sibling (vite) is a valid, excepted advisory (r8).
const partialDrift = { metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 0, low: 0, total: 2 } }, vulnerabilities: { vite: { severity: 'high', via: [{ severity: 'high', url: `https://github.com/advisories/${VITE}`, title: 'vite' }] }, evil: { severity: 'high', via: [{ kind: 'malware' }] } } };
const rPartial = evaluate(partialDrift, [exc()], TODAY);
eq(rPartial.code, 1, 'a partial drift fails closed even with an excepted sibling');
has(rPartial.lines, 'evil', 'the partial-drift failure names the unreadable package');

// L: a pkg:<name> exception is the gate's own fallback key for an unidentifiable
// advisory (M1), not a real id; it must be refused so a high can't be excepted by
// package name (r8).
const unkeyableFires = { metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } }, vulnerabilities: { evil: { severity: 'high', via: [{ severity: 'high', title: 'unidentifiable' }] } } };
const rPkgExc = evaluate(unkeyableFires, [{ id: 'pkg:evil', expires: '2027-01-01', why: 'nice try' }], TODAY);
eq(rPkgExc.code, 1, 'a pkg:<name> exception is refused, so the unidentifiable high still blocks');
has(rPkgExc.lines, 'INVALID EXCEPTION', 'the pkg: exception is flagged invalid');

// --- End-to-end: the guard actually runs, blocks, and fails closed ---------
const GATE = fileURLToPath(new URL('../npm-audit-gate.mjs', import.meta.url));

function runGate(auditText, npmExit, { gatePath = GATE, prefix = 'npm-gate-e2e-' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const jsonFile = join(dir, 'audit.json');
  writeFileSync(jsonFile, auditText);
  const shim = join(dir, 'npm');
  // The gate calls `npm audit --json`; this shim answers as npm would, emitting
  // the JSON on stdout and (like real npm) exiting non-zero when vulns exist.
  writeFileSync(shim, `#!/bin/sh\ncat "$GATE_TEST_JSON"\nexit \${GATE_TEST_EXIT:-0}\n`);
  chmodSync(shim, 0o755);
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, GATE_TEST_JSON: jsonFile, GATE_TEST_EXIT: String(npmExit) };
  try {
    const stdout = execFileSync(process.execPath, [gatePath], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

const e2eClean = runGate(JSON.stringify(clean), 0);
eq(e2eClean.status, 0, 'e2e: a clean audit exits 0 (the guard ran)');
has([e2eClean.stdout], 'pass', 'e2e: a clean audit prints pass');

// A synthetic id that no repo's real EXCEPTIONS list carries — the e2e cases run
// the actual gate with its shipped exceptions, so a real advisory id here would
// be (correctly) suppressed wherever it is excepted.
const UNEXCEPTED = 'GHSA-e2e-unexcepted-0000';
const e2eHigh = runGate(JSON.stringify(withAdvisory('high', UNEXCEPTED)), 1);
eq(e2eHigh.status, 1, 'e2e: an un-excepted high exits 1');
has([e2eHigh.stdout], 'BLOCKED', 'e2e: an un-excepted high prints BLOCKED');

const e2eJunk = runGate('this is not json', 1);
eq(e2eJunk.status, 1, 'e2e: unparseable audit output fails closed (exit 1)');
has([e2eJunk.stderr], 'failing closed', 'e2e: fail-closed says so on stderr');

// Registry unreachable: npm prints JSON that parses but is not an audit. Its
// reason is in a TOP-LEVEL `message`; error.summary/detail are empty. The gate
// must fail closed AND surface that message, not the empty error object (the
// exact shape, captured with npm_config_registry=http://127.0.0.1:9/, JAR-1734
// review rounds 2–3).
const e2eErr = runGate(
  JSON.stringify({
    message: 'request to http://127.0.0.1:9/-/npm/v1/security/advisories/bulk failed, reason: connect ECONNREFUSED 127.0.0.1:9',
    error: { summary: '', detail: '' },
  }),
  1,
);
eq(e2eErr.status, 1, 'e2e: an npm error-JSON result fails closed (exit 1)');
has([e2eErr.stderr], 'ECONNREFUSED', "e2e: the fail-closed cause names npm's reason (top-level message)");

// The module must import cleanly when process.argv[1] is absent (a test runner,
// `node -e`): the guard calls pathToFileURL(process.argv[1]), which throws on
// undefined unless Boolean(process.argv[1]) short-circuits first (JAR-1734
// review, round 2). `node -e` leaves argv[1] undefined.
let importOk = true;
let importErr = '';
try {
  execFileSync(
    process.execPath,
    ['-e', `import(${JSON.stringify(pathToFileURL(GATE).href)}).then(() => process.exit(0), (e) => { console.error(String(e)); process.exit(3); })`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
} catch (e) {
  importOk = false;
  importErr = String(e.stderr || e.message);
}
eq(importOk, true, `e2e: imports cleanly when argv[1] is absent${importOk ? '' : ': ' + importErr}`);

// The main-entry guard must fire even when the script's own path needs
// URL-encoding — the exact case the old `file://${process.argv[1]}` guard
// missed, skipping the gate silently (JAR-1734 review, M1). Run a copy from a
// directory whose name has a space; assert it actually produced a verdict.
// realpathSync so the dir's own /var->/private symlink (macOS tmp) isn't what's
// under test — only the space is, which is what argv[1] carries in the wild.
const spacedDir = realpathSync(mkdtempSync(join(tmpdir(), 'npm gate spaced ')));
const spacedGate = join(spacedDir, 'gate.mjs');
copyFileSync(GATE, spacedGate);
const e2eSpaced = runGate(JSON.stringify(clean), 0, { gatePath: spacedGate, prefix: 'npm gate shim ' });
eq(e2eSpaced.status, 0, 'e2e: runs from a spaced path (exit 0)');
has([e2eSpaced.stdout], 'pass', 'e2e: a spaced path still produces a verdict (guard fired)');

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
