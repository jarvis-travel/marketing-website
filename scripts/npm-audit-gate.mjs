#!/usr/bin/env node
// npm-audit-gate.mjs — `npm audit` as a BLOCKING gate, with narrowly scoped,
// expiring exceptions. Modeled on core's scripts/govulncheck-gate.sh (JAR-880),
// including its decision A, with the same anti-rot properties (JAR-1734):
//
//   1. An exception that no longer FIRES has outlived its reason. A fixed
//      advisory that stops appearing is flagged loudly — but as a WARNING, not
//      a failure (decision A, below): the advisory DB shifts under us, so "no
//      longer fires" is as likely to mean "the DB moved" as "it's fixed".
//   2. Every exception EXPIRES. Past its date it is flagged loudly so the call
//      gets made again by a person — also a WARNING, not a failure (decision A).
//   3. Anything NOT excepted still fails. A keyhole, not an off switch. This is
//      the one rule that actually protects the supply chain, and nothing else
//      here weakens it.
//
// Decision A (core JAR-880, 2026-08-19): an expired or no-longer-firing
// exception WARNS and never changes the exit code. Treating it as a hard
// failure turns every unrelated PR red the moment the advisory DB shifts, which
// is out of our control. A MALFORMED exception entry is different — a bad date
// or a missing reason is an authoring bug in this file, fully in our control,
// so it blocks.
//
// The same policy runs in core's govulncheck-gate.sh and in this gate's copies
// in web-app, marketing-website and waitlist. Nothing checks that the four
// agree (JAR-1854), so a change to the policy is a change to all four.
//
// Gates at high+critical (npm's --audit-level=high). Exit codes: 0 clean, or
// every firing advisory is excepted (expired/stale exceptions only warn); 1 a
// real high/critical advisory with no valid exception, a malformed exception
// entry, a report the gate cannot fully account for, or npm audit could not run
// (fail closed). There is no exit 2.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Each exception is { id, expires, why }:
//   id      canonical advisory id as this gate prints it — a GHSA id
//           (e.g. 'GHSA-fx2h-pf6j-xcff'), or 'npm:<n>' when npm reports no GHSA
//           advisory url for it. Not a bare number, and never 'pkg:<name>':
//           that is the key for an advisory the gate cannot identify, and it is
//           refused (JAR-1882).
//   expires 'YYYY-MM-DD', compared as a UTC calendar date (see `today` below).
//           Past it the entry WARNS; it does not block (decision A).
//   why     one line: dev-only or unreachable in what we ship, plus a ticket.
// An empty list is the goal.
const EXCEPTIONS = [
  {
    id: 'GHSA-fx2h-pf6j-xcff',
    expires: '2026-12-16',
    // vite server.fs.deny bypass on Windows alternate paths (GHSA-fx2h-pf6j-xcff,
    // <=6.4.2 affected) — dev-server only; a static production build never runs
    // the vite dev server, so visitor exposure is nil. Fixed in vite >= 6.4.3
    // (6.4.3, 7.x or 8.x all clear it): JAR-1765.
    why: 'vite dev-server-only server.fs.deny bypass; unreachable in the static prod build; fixed in vite >= 6.4.3 (6.4.3/7.x/8.x), JAR-1765',
  },
];

// npm's severities, lowest first (arborist's `severities`). The gate blocks from
// high up (npm's --audit-level=high): a severity's rank is its place in
// THRESHOLD, and 0 is below the gate.
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];
const THRESHOLD = SEVERITIES.slice(SEVERITIES.indexOf('high'));

function rank(severity) {
  return THRESHOLD.indexOf(severity) + 1;
}

// npm writes severities in lower case. Read them case-insensitively anyway, and
// only through here, so a "High" still counts and no two checks can disagree
// about what a severity is (JAR-1882).
function severityOf(x) {
  return typeof x?.severity === 'string' ? x.severity.toLowerCase() : '';
}

// An entry's `via`, or nothing when it is not the array npm writes: a string
// would iterate as characters, and an object would throw.
function viasOf(info) {
  return Array.isArray(info?.via) ? info.via : [];
}

// npm's `via` mixes advisory objects with plain strings (a transitive edge);
// only the objects carry a severity and an id. Take the url's id only when it is
// GHSA-shaped — a legacy npmjs.com/advisories/<n> url yields a bare number that
// could never match the documented npm:<n> exception form. Otherwise use npm's
// numeric advisory id, namespaced npm:<n> so it can never be mistaken for — or
// matched against — a GHSA-shaped exception (JAR-1734 review).
function ghsaId(via) {
  const fromUrl = (via.url ?? '').split('/advisories/')[1];
  if (fromUrl && /^GHSA-/i.test(fromUrl)) return fromUrl;
  if (via.source !== null && via.source !== undefined && via.source !== '') return `npm:${via.source}`;
  return '';
}

// null if the entry is well-formed, else a one-line reason it is not. Rejects an
// impossible date (e.g. 2026-13-01, 2026-02-30) by round-tripping through Date:
// a rollover or NaN means the calendar date does not exist (JAR-1734 review).
function validateException(e) {
  if (!e || typeof e !== 'object') return 'not an object';
  if (typeof e.id !== 'string' || !e.id.trim()) return 'missing id';
  // pkg:<name> is the key the gate gives an advisory it cannot identify.
  // Excepting it would waive every such advisory in that package, today's and
  // any later one, which is an off switch, not a keyhole (JAR-1882).
  if (/^pkg:/i.test(e.id.trim())) {
    return 'pkg:<name> keys an advisory the gate cannot identify, and cannot be excepted: it would waive every such advisory in the package';
  }
  if (typeof e.why !== 'string' || !e.why.trim()) return 'missing reason (why)';
  if (typeof e.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.expires)) {
    return 'expires must be YYYY-MM-DD';
  }
  const d = new Date(`${e.expires}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== e.expires) {
    return `expires ${e.expires} is not a real calendar date`;
  }
  return null;
}

// Pure, so the self-test can exercise it without running npm. `today` is a
// 'YYYY-MM-DD' UTC calendar date. Returns { code, lines }.
export function evaluate(audit, exceptions, today) {
  const lines = [];
  let code = 0;

  // Fail closed on an unrecognized shape: if `vulnerabilities` is not an object
  // (npm 6's `advisories` shape, or a truncated/garbled report), we can't know
  // what fired, so we must not pass as clean (JAR-1734 review).
  if (typeof audit?.vulnerabilities !== 'object' || audit.vulnerabilities === null) {
    return {
      code: 1,
      lines: ['BLOCKED: npm audit output has no `vulnerabilities` object — unrecognized shape, failing closed'],
    };
  }

  const entries = Object.entries(audit.vulnerabilities);

  // Every distinct advisory at or above the threshold, keyed by canonical id.
  const firing = new Map();
  for (const [pkg, info] of entries) {
    for (const via of viasOf(info)) {
      if (typeof via !== 'object' || via === null) continue;
      const severity = severityOf(via);
      if (!rank(severity)) continue;
      // An advisory we can't identify still blocks — keyed by package name, so a
      // high/critical is never silently dropped for want of an id (fail safe).
      const id = ghsaId(via) || `pkg:${pkg}`;
      if (!firing.has(id)) firing.set(id, { severity, title: via.title ?? '' });
    }
  }

  // Cross-check against npm's own summary. metadata.vulnerabilities is a count
  // { critical, high, … }; the cross-check only works when it is present and
  // numeric, so require that first — otherwise the summary can't vouch for a parse
  // that found nothing, and a drifted report with empty metadata slips through
  // (JAR-1734 review r7).
  const counts = audit?.metadata?.vulnerabilities;
  if (typeof counts !== 'object' || counts === null || typeof counts.high !== 'number' || typeof counts.critical !== 'number') {
    return {
      code: 1,
      lines: ['BLOCKED: npm audit metadata has no numeric high/critical counts — unrecognized shape, failing closed'],
    };
  }

  // Every entry npm counted must be one the gate read. npm builds these counts by
  // tallying its own entries by severity (`metadata.vulnerabilities[vuln.severity]++`
  // in arborist's AuditReport.toJSON, npm 10 and 11 alike), so for a report the
  // gate can read they agree exactly. A mismatch means entries are missing or
  // shaped differently, and the ones that parse must not vouch for the rest.
  // This and the check below replace JAR-1734 r6 ("npm counts some, the gate
  // parsed none"), which they cover and which let a partial drift through when
  // one advisory still parsed (JAR-1882).
  const listed = (severity) => entries.filter(([, info]) => severityOf(info) === severity).length;
  const miscounted = THRESHOLD.filter((severity) => listed(severity) !== counts[severity]);
  if (miscounted.length) {
    return {
      code: 1,
      lines: miscounted.map(
        (severity) => `BLOCKED: npm counts ${counts[severity]} ${severity} but its report lists ${listed(severity)}: unrecognized shape, failing closed`,
      ),
    };
  }

  // Every high or critical entry must be one the gate can read in full. Each of
  // its advisories must carry a severity npm writes, and its own severity must
  // be accounted for by an advisory the gate parsed, at that severity or above:
  // one of its own, or one reached through the packages it names in `via`. That
  // is how npm derives an entry's severity: the highest of its advisories, where
  // a dependency's advisory reaches a dependent as the dependency's name, at
  // that advisory's severity (arborist's Vuln and metavuln-calculator). So in a
  // report the gate can read, every entry passes both. One that does not
  // carries an advisory the gate cannot read, and it must not pass beside an
  // excepted sibling (JAR-1882).
  const reached = new Map(
    entries.map(([pkg, info]) => [pkg, Math.max(0, ...viasOf(info).map((via) => rank(severityOf(via))))]),
  );
  for (let grew = true; grew; ) {
    grew = false;
    for (const [pkg, info] of entries) {
      for (const via of viasOf(info)) {
        const theirs = typeof via === 'string' ? (reached.get(via) ?? 0) : 0;
        if (theirs > reached.get(pkg)) {
          reached.set(pkg, theirs);
          grew = true;
        }
      }
    }
  }
  const unread = [];
  for (const [pkg, info] of entries) {
    const severity = severityOf(info);
    if (!rank(severity)) continue;
    if (viasOf(info).some((via) => typeof via === 'object' && via !== null && !SEVERITIES.includes(severityOf(via)))) {
      unread.push(`BLOCKED: ${pkg} is ${severity} and carries an advisory the gate cannot read: unrecognized shape, failing closed`);
    } else if (reached.get(pkg) < rank(severity)) {
      unread.push(`BLOCKED: ${pkg} is ${severity}, but no advisory the gate can read accounts for it: unrecognized shape, failing closed`);
    }
  }
  if (unread.length) return { code: 1, lines: unread };

  // A malformed entry is a gate-config bug: it blocks, and excepts nothing (so a
  // firing advisory it meant to cover still falls to the keyhole).
  const valid = [];
  for (const e of exceptions) {
    const problem = validateException(e);
    if (problem) {
      lines.push(`INVALID EXCEPTION: ${JSON.stringify(e?.id ?? e)} — ${problem}`);
      code = Math.max(code, 1);
      continue;
    }
    valid.push(e);
  }
  const exceptedIds = new Set(valid.map((e) => e.id));

  // Decision A: expired or no-longer-firing exceptions WARN, never change code.
  // Both still suppress their advisory — only `real` (the keyhole) blocks.
  for (const e of valid) {
    if (e.expires < today) {
      lines.push(`WARNING: exception ${e.id} expired ${e.expires} — re-decide it, do not just extend the date (does not block)`);
    }
    if (!firing.has(e.id)) {
      lines.push(`WARNING: exception ${e.id} no longer appears in the audit — delete it if fixed, update the id if the DB was renumbered (does not block)`);
    }
  }

  // The keyhole: anything firing that no valid exception covers is a real fail.
  const unexcepted = [...firing].filter(([id]) => !exceptedIds.has(id));
  for (const [id, v] of unexcepted) lines.push(`BLOCKED: ${id} [${v.severity}] ${v.title}`);
  if (unexcepted.length) code = Math.max(code, 1);

  if (code === 0) {
    const warned = lines.some((l) => l.startsWith('WARNING'));
    const base = firing.size
      ? `${firing.size} high/critical advisory(ies), all excepted`
      : 'no high or critical advisories';
    lines.push(warned ? `pass (with warnings) — ${base}` : `pass — ${base}`);
  }
  return { code, lines };
}

// Returns { audit, raw, stderr }: audit is the parsed JSON or null; raw is npm's
// stdout; stderr is its stderr (or the spawn error). All three are kept so a
// fail-closed exit can name its cause — including npm's own {"error":{…}} JSON,
// which it prints on stdout when the registry is unreachable (JAR-1734 review).
function runAudit() {
  try {
    const out = execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // npm's audit JSON can be large; the default 1 MiB maxBuffer would make a
      // big report throw ENOBUFS and fail closed spuriously (JAR-1734 review).
      maxBuffer: 64 * 1024 * 1024,
      // A hung registry (proxy stall) must fail closed fast, not hold the CI
      // job to its own timeout (JAR-1734 review, OCR routed).
      timeout: 120_000,
    });
    return { audit: JSON.parse(out), raw: out, stderr: '' };
  } catch (err) {
    // npm audit exits non-zero when advisories exist; the JSON is still on
    // stdout. Keep the raw output and stderr either way.
    const raw = err && err.stdout !== null && err.stdout !== undefined ? String(err.stdout) : '';
    const stderr = err && (err.stderr || err.message) ? String(err.stderr || err.message) : '';
    if (raw) {
      try {
        return { audit: JSON.parse(raw), raw, stderr };
      } catch {
        /* not JSON — fall through */
      }
    }
    return { audit: null, raw, stderr };
  }
}

// Boolean(process.argv[1]) &&: when the module is imported rather than run (a
// test, or `node -e`), argv[1] can be absent, and pathToFileURL(undefined)
// throws — the repo idiom guards it (check-absolute-claims.mjs, JAR-1734 review).
if (Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { audit, raw, stderr } = runAudit();
  if (!audit || !audit.metadata) {
    // Two fail-closed shapes: output that would not parse as JSON, and JSON that
    // parsed but is not an audit — npm prints {"error":{…}} on stdout when the
    // registry is unreachable, and its cause must not be dropped (JAR-1734 review).
    // npm puts the reason in a top-level `message` when the registry is down and
    // leaves error.summary/detail empty; prefer message, then a non-empty summary
    // or detail, then stderr, then the raw output (JAR-1734 review round 3).
    const err = audit && audit.error;
    const cause =
      (audit && typeof audit.message === 'string' && audit.message.trim()) ||
      (err && typeof err.summary === 'string' && err.summary.trim()) ||
      (err && typeof err.detail === 'string' && err.detail.trim()) ||
      String(stderr).trim() ||
      String(raw).trim();
    console.error('npm-audit-gate: npm audit did not return a usable audit — failing closed');
    if (cause) console.error('  cause: ' + cause.split('\n').slice(0, 5).join('\n  '));
    process.exitCode = 1;
  } else {
    // UTC calendar date; exception `expires` is compared against this in UTC.
    const today = new Date().toISOString().slice(0, 10);
    const { code, lines } = evaluate(audit, EXCEPTIONS, today);
    for (const l of lines) console.log(l);
    if (code !== 0) console.error('npm-audit-gate: blocked (see BLOCKED / INVALID lines above).');
    // process.exitCode, not process.exit: exit() can truncate piped output, and
    // the whole point of this gate is a readable failure message (JAR-1734 review).
    process.exitCode = code;
  }
}
