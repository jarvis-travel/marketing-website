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
// is out of our control. core's own header still says "turns red" and is stale
// (ticketed); this gate follows what core's script actually does, not its
// header. A MALFORMED exception entry is different — a bad date or a missing
// reason is an authoring bug in this file, fully in our control, so it blocks.
//
// Gates at high+critical (npm's --audit-level=high). Exit codes: 0 clean, or
// every firing advisory is excepted (expired/stale exceptions only warn); 1 a
// real high/critical advisory with no valid exception, a malformed exception
// entry, or npm audit could not run (fail closed). There is no exit 2.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Each exception is { id, expires, why }:
//   id      canonical advisory id as this gate prints it — a GHSA id
//           (e.g. 'GHSA-fx2h-pf6j-xcff'), or 'npm:<n>' when npm reports no GHSA
//           advisory url for it. Not a bare number.
//   expires 'YYYY-MM-DD', compared as a UTC calendar date (see `today` below).
//           Past it the entry WARNS; it does not block (decision A).
//   why     one line: dev-only or unreachable in what we ship, plus a ticket.
// An empty list is the goal.
const EXCEPTIONS = [
  {
    id: 'GHSA-fx2h-pf6j-xcff',
    expires: '2026-12-16',
    // vite server.fs.deny bypass on Windows alternate paths — dev-server only; a
    // static production build never runs the vite dev server, so visitor
    // exposure is nil. Only fixed by vite@8 (major, 5->8): JAR-1765.
    why: 'vite dev-server-only server.fs.deny bypass; unreachable in the static prod build; fixed by vite@8 major (JAR-1765)',
  },
];

const THRESHOLD = new Set(['high', 'critical']);

// npm's `via` mixes advisory objects with plain strings (a transitive edge);
// only the objects carry a severity and an id. Prefer the GHSA in the advisory
// url; fall back to npm's numeric advisory id, namespaced so it can never be
// mistaken for — or matched against — a GHSA-shaped exception (JAR-1734 review).
function ghsaId(via) {
  const fromUrl = (via.url ?? '').split('/advisories/')[1];
  if (fromUrl) return fromUrl;
  if (via.source != null && via.source !== '') return `npm:${via.source}`;
  return '';
}

// null if the entry is well-formed, else a one-line reason it is not. Rejects an
// impossible date (e.g. 2026-13-01, 2026-02-30) by round-tripping through Date:
// a rollover or NaN means the calendar date does not exist (JAR-1734 review).
function validateException(e, today) {
  if (!e || typeof e !== 'object') return 'not an object';
  if (typeof e.id !== 'string' || !e.id.trim()) return 'missing id';
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

  // Every distinct advisory at or above the threshold, keyed by canonical id.
  const firing = new Map();
  for (const info of Object.values(audit?.vulnerabilities ?? {})) {
    for (const via of info?.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      if (!THRESHOLD.has(via.severity)) continue;
      const id = ghsaId(via);
      if (!id) continue;
      if (!firing.has(id)) firing.set(id, { severity: via.severity, title: via.title ?? '' });
    }
  }

  // A malformed entry is a gate-config bug: it blocks, and excepts nothing (so a
  // firing advisory it meant to cover still falls to the keyhole).
  const valid = [];
  for (const e of exceptions) {
    const problem = validateException(e, today);
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

// Returns { audit, stderr }: audit is the parsed JSON or null (fail closed);
// stderr is npm's stderr when the run genuinely failed, kept so the fail-closed
// message can name the cause (JAR-1734 review).
function runAudit() {
  try {
    const out = execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { audit: JSON.parse(out), stderr: '' };
  } catch (err) {
    // npm audit exits non-zero when advisories exist; the JSON is still on
    // stdout. Only a genuinely unparseable result is a fail-closed error.
    if (err && err.stdout) {
      try {
        return { audit: JSON.parse(err.stdout), stderr: '' };
      } catch {
        /* fall through */
      }
    }
    return { audit: null, stderr: (err && (err.stderr || err.message)) || '' };
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { audit, stderr } = runAudit();
  if (!audit || !audit.metadata) {
    console.error('npm-audit-gate: npm audit did not return parseable JSON — failing closed');
    const tail = String(stderr).trim();
    if (tail) console.error('  npm said: ' + tail.split('\n').slice(-5).join('\n  '));
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
