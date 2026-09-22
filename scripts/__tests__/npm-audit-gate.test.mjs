#!/usr/bin/env node
// Self-test for npm-audit-gate.mjs (JAR-1734). Two layers:
//   - evaluate(): the pure verdict, driven with synthetic audit JSON (no npm).
//   - end-to-end: the real CLI path — runAudit() + the main-entry guard — run as
//     a subprocess with a fake `npm` on PATH, so a silently no-oping guard or a
//     broken npm invocation is caught (JAR-1734 review, M1).
// Each case fails if its matching rule is removed (mutation-checkable).
import { evaluate } from '../npm-audit-gate.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, chmodSync, realpathSync, readFileSync } from 'node:fs';
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

// A drifted report shape our per-advisory parse doesn't recognize (here the
// advisory sits under a renamed key, so `via` is empty) but whose metadata still
// counts a high. Nothing the gate can read accounts for the entry, so it must
// fail closed, not pass as clean. This covers the whole class (a renamed key, a
// via that is not an array, an advisory with no readable severity), not one
// shape (JAR-1734 review round 6, JAR-1882).
const drifted = { metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } }, vulnerabilities: { pkg: { severity: 'high', advisories: [{ severity: 'high', title: 'renamed key' }] } } };
const rDrift = evaluate(drifted, [], TODAY);
eq(rDrift.code, 1, 'a high entry with no advisory the gate can read → fail closed (drifted shape)');
has(rDrift.lines, 'BLOCKED: pkg is high', 'the drift failure names the entry');

// The cross-check needs npm's numeric counts to vouch for an empty parse. If
// metadata carries no vulnerabilities counts, a drifted report (renamed key here,
// so `via` is empty) would otherwise slip through — fail closed on missing or
// non-numeric counts (JAR-1734 review round 7).
const noCounts = { metadata: {}, vulnerabilities: { pkg: { severity: 'high', advisories: [{ severity: 'high', title: 'renamed key, no counts' }] } } };
eq(evaluate(noCounts, [], TODAY).code, 1, 'metadata without numeric high/critical counts fails closed');

// --- A real report, then one drift at a time (JAR-1882) ---------------------
// fixtures/npm-audit-report.json is `npm audit --json --package-lock-only`,
// verbatim, for a lockfile pinning json5 2.2.1, lodash 4.17.20, minimist 1.2.5,
// mkdirp 0.5.1, nanoid 3.1.30 and optimist 0.6.1 (npm 11.13, 2026-09-22; npm
// 10, which CI runs, builds the report with the same code). Seven high/critical
// advisories; mkdirp and optimist are critical only through minimist, which
// their `via` names.
const REPORT = JSON.parse(readFileSync(new URL('./fixtures/npm-audit-report.json', import.meta.url), 'utf8'));
const report = () => structuredClone(REPORT);
const JSON5 = 'GHSA-9c47-m6qq-7p4h';
const REPORTED = [JSON5, 'GHSA-35jh-r3h4-6jhm', 'GHSA-r5fr-rjxr-66jc', 'GHSA-xvch-5gv4-984h', 'GHSA-28wg-ghj8-5hjv', 'GHSA-2v37-7h3g-55p8', 'GHSA-xwg4-73v4-xw9w'];
const exceptAll = (ids = REPORTED) => ids.map((id) => exc({ id }));
const allButJson5 = REPORTED.filter((id) => id !== JSON5);

const rReport = evaluate(report(), [], TODAY);
eq(rReport.code, 1, 'real report: its advisories block');
eq(REPORTED.filter((id) => rReport.lines.some((l) => l.startsWith(`BLOCKED: ${id} `))).length, 7, 'real report: all seven are named');
eq(evaluate(report(), exceptAll(), TODAY).code, 0, 'real report: every advisory excepted, it passes (the shape checks accept what npm writes)');

// A pkg:<name> exception is refused, so an advisory the gate cannot identify
// cannot be waived by naming its package.
const anonymous = report();
delete anonymous.vulnerabilities.json5.via[0].url;
delete anonymous.vulnerabilities.json5.via[0].source;
const rPkgExc = evaluate(anonymous, [...exceptAll(allButJson5), exc({ id: 'pkg:json5' })], TODAY);
eq(rPkgExc.code, 1, 'a pkg:<name> exception is refused, so the unidentifiable advisory still blocks');
has(rPkgExc.lines, 'INVALID EXCEPTION: "pkg:json5"', 'the pkg: exception is named invalid');

// A severity npm did not write in lower case still counts, as the advisory it is.
const shouting = report();
shouting.vulnerabilities.json5.via[0].severity = 'HIGH';
const rShouting = evaluate(shouting, exceptAll(allButJson5), TODAY);
eq(rShouting.code, 1, 'an advisory whose severity is "HIGH" still blocks');
has(rShouting.lines, `BLOCKED: ${JSON5} [high]`, 'and is named as that advisory, not as a shape failure');

// npm counts an entry the report does not list: the entries that parse must not
// vouch for the one that is missing.
const short = report();
delete short.vulnerabilities.json5;
const rShort = evaluate(short, exceptAll(allButJson5), TODAY);
eq(rShort.code, 1, 'a report listing fewer highs than npm counts fails closed');
has(rShort.lines, 'npm counts 3 high but its report lists 2', 'the failure names both counts');

// An entry whose advisory the gate cannot read fails closed beside excepted
// siblings, and so does a chain that does not reach an advisory at its severity.
const unreadable = report();
unreadable.vulnerabilities.json5.via = [{ kind: 'malware' }];
const rUnreadable = evaluate(unreadable, exceptAll(allButJson5), TODAY);
eq(rUnreadable.code, 1, 'a high entry with no readable advisory fails closed beside excepted siblings');
has(rUnreadable.lines, 'BLOCKED: json5 is high', 'the unreadable-advisory failure names the entry');

const bare = report();
bare.vulnerabilities.json5.via = bare.vulnerabilities.json5.via[0];
let rBare;
try {
  rBare = evaluate(bare, exceptAll(allButJson5), TODAY);
} catch (err) {
  rBare = { code: `threw ${err.name}`, lines: [] };
}
eq(rBare.code, 1, 'a via that is not an array fails closed with a verdict, not a throw');
has(rBare.lines, 'BLOCKED: json5 is high', 'the non-array failure names the entry');

const understated = report();
understated.vulnerabilities.mkdirp.via = ['json5'];
const rUnderstated = evaluate(understated, exceptAll(), TODAY);
eq(rUnderstated.code, 1, 'a critical entry whose chain reaches only a high fails closed');
has(rUnderstated.lines, 'BLOCKED: mkdirp is critical', 'the understated-chain failure names the entry');

// An unreadable advisory must not hide behind a chain that accounts for its
// entry: mkdirp is critical through minimist, whose advisory is excepted here.
const hidden = report();
hidden.vulnerabilities.mkdirp.via.push({ kind: 'malware' });
const rHidden = evaluate(hidden, exceptAll(), TODAY);
eq(rHidden.code, 1, 'an unreadable advisory beside an excepted chain fails closed');
has(rHidden.lines, 'BLOCKED: mkdirp is critical and carries an advisory the gate cannot read', 'the hidden-advisory failure names the entry');

const circular = report();
circular.vulnerabilities.mkdirp.via = ['optimist'];
circular.vulnerabilities.optimist.via = ['mkdirp'];
eq(evaluate(circular, exceptAll(), TODAY).code, 1, 'entries that only name each other fail closed');

// A severity npm does not write cannot be ranked against the gate, so the gate
// cannot call it below the gate: an unknown level fails closed on any entry,
// not only a high or critical one.
const unknownAdvisory = report();
unknownAdvisory.vulnerabilities['left-pad'] = { name: 'left-pad', severity: 'moderate', via: [{ severity: 'severe', title: 'a level npm does not write', url: 'https://github.com/advisories/GHSA-test-sev0-0000' }] };
const rUnknownAdvisory = evaluate(unknownAdvisory, exceptAll(), TODAY);
eq(rUnknownAdvisory.code, 1, 'an advisory with a severity npm does not write fails closed, even under a moderate entry');
has(rUnknownAdvisory.lines, 'BLOCKED: left-pad is moderate and carries an advisory the gate cannot read', 'the unknown-advisory failure names the entry');

const unknownEntry = report();
unknownEntry.vulnerabilities['left-pad'] = { name: 'left-pad', severity: 'severe', via: [{ severity: 'moderate', title: 'readable', url: 'https://github.com/advisories/GHSA-test-sev1-0000' }] };
const rUnknownEntry = evaluate(unknownEntry, exceptAll(), TODAY);
eq(rUnknownEntry.code, 1, 'an entry with a severity npm does not write fails closed');
has(rUnknownEntry.lines, 'BLOCKED: left-pad has severity "severe"', 'the unknown-entry failure names the entry and its severity');

// npm writes `vulnerabilities` as an object keyed by package. An array is not
// that, even an empty one beside zero counts, so it fails closed.
eq(evaluate({ metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } }, vulnerabilities: [] }, [], TODAY).code, 1,
  'an array where npm writes an object fails closed, even an empty one beside zero counts');

// A pathological via list still gets a verdict. Spreading a million elements
// into Math.max throws a RangeError, where a loop does not.
const crowded = report();
crowded.vulnerabilities['left-pad'] = { name: 'left-pad', severity: 'moderate', via: new Array(1_000_000).fill('minimist') };
let rCrowded;
try {
  rCrowded = evaluate(crowded, exceptAll(), TODAY);
} catch (err) {
  rCrowded = { code: `threw ${err.name}`, lines: [] };
}
eq(rCrowded.code, 0, 'a million-long via list gets a verdict, not a RangeError');

// A report the gate cannot read does not hide a malformed or an expired
// exception: both are about this file, not the report, so both are said.
const rBoth = evaluate(short, [...exceptAll(allButJson5), exc({ why: '' }), exc({ id: 'GHSA-old0-0000-0000', expires: '2026-01-01' })], TODAY);
has(rBoth.lines, 'INVALID EXCEPTION', 'a malformed exception is reported beside a shape failure');
has(rBoth.lines, 'expired 2026-01-01', 'an expired exception is reported beside a shape failure');
has(rBoth.lines, 'npm counts 3 high but its report lists 2', 'and the shape failure is still reported with them');

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
