// Every guard in a checks workflow must report its own result (JAR-1885).
//
// Steps in a GitHub Actions job run in order, and the default condition on a
// step is success() — "no earlier step in this job has failed". So in a job
// that is a plain sequence, the FIRST failure is the only result anyone gets:
// every later step is reported as skipped, whether or not it had anything to
// do with the failure.
//
// That is how this repo spent weeks with eleven unreported guards. JAR-1739
// added a step asserting STRIPE_LIVE_READ_API_KEY, the secret was never
// configured, and from that day every branch push stopped there. Copy, fonts,
// lookup keys, social meta, lint and build were skipped on every PR — including
// the PRs editing those guards, which therefore proved nothing about them.
//
// The rule this asserts, for each job in the file it is given:
//
//   1. A step may be unconditional only while it is SETUP — in the leading run
//      of steps before the first conditioned one — and only if it is an action
//      (`uses:`) or something a later step explicitly waits on. An
//      unconditional `run:` step that nothing depends on is precisely the thing
//      that hides everything after it.
//   2. Every step after that prefix carries `if: !cancelled() && steps.<id>.outcome
//      == 'success'` — it runs unless the run was cancelled or the one step it
//      actually needs failed.
//   3. The id it waits on is defined by an EARLIER step. A forward or misspelt
//      reference is not an error in Actions: the expression is empty, the
//      condition is false, and the step silently never runs again.
//   4. Nothing is `continue-on-error: true`. Independent is not advisory; a
//      guard that cannot fail the job is decorative.
//
// DEPLOY WORKFLOWS ARE NOT CHECKED, and must not be. There a failing guard
// should skip everything after it, because what comes after it is the deploy.
// The distinction is the point: this rule is about a job whose product is the
// report, not a job whose product is a release.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import yaml from 'js-yaml';

const CHECKED = ['.github/workflows/pr-checks.yml'];

const CANCEL_GUARD = /!\s*cancelled\(\)/;
const PREREQUISITE = /steps\.([A-Za-z_][A-Za-z0-9_-]*)\.outcome\s*===?\s*'success'/g;

function describe(step, index) {
  const what = step.name || step.uses || String(step.run || '').split('\n')[0] || 'unnamed';
  return `step ${index + 1} "${what}"`;
}

// The findings for one parsed workflow document. Empty means the workflow
// reports every guard it runs.
export function findings(source) {
  const doc = yaml.load(source);
  const jobs = doc && doc.jobs ? doc.jobs : {};
  const out = [];

  for (const [jobName, job] of Object.entries(jobs)) {
    const steps = (job && job.steps) || [];
    const idsSoFar = new Set();
    // The setup prefix ends at the first step that needs a condition — not at a
    // fixed count, and not at the first step that happens to have one. A job
    // with no conditions anywhere is a job that is ALL guards, which is the
    // shape that hid eleven of them.
    let inSetup = true;

    steps.forEach((step, i) => {
      const where = `${jobName}: ${describe(step, i)}`;
      const waitedOn =
        Boolean(step.id) && steps.slice(i + 1).some((later) => String(later.if || '').includes(`steps.${step.id}.`));

      if (step['continue-on-error'] === true) {
        out.push(`${where} is continue-on-error, so it cannot fail the job — a guard that cannot fail is decorative`);
      }

      if (step.if === undefined) {
        // Unconditional is allowed only while this is still setup: an action, or
        // something a later step explicitly waits on.
        if (!inSetup || !(step.uses !== undefined || waitedOn)) {
          inSetup = false;
          out.push(
            `${where} has no 'if': any earlier failure skips it and its own result goes unreported, and its own failure` +
              ' skips every step after it — condition it on the step it needs, or give it an id and make the steps that need it say so'
          );
        }
      } else {
        inSetup = false;
        const condition = String(step.if);
        if (!CANCEL_GUARD.test(condition)) {
          out.push(`${where} does not start from !cancelled(), so an unrelated earlier failure still skips it: ${condition}`);
        }
        const deps = [...condition.matchAll(PREREQUISITE)].map((m) => m[1]);
        if (deps.length === 0) {
          out.push(`${where} names no prerequisite step — say which step's success it actually needs: ${condition}`);
        }
        for (const dep of deps) {
          if (!idsSoFar.has(dep)) {
            out.push(
              `${where} waits on steps.${dep}, which no earlier step defines — Actions evaluates that to empty, so the step never runs and never reports`
            );
          }
        }
      }

      if (step.id) idsSoFar.add(step.id);
    });
  }

  return out;
}

const isCLI = (() => {
  try {
    return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isCLI) {
  const root = new URL('..', import.meta.url).pathname;
  let failed = false;
  for (const rel of CHECKED) {
    const found = findings(readFileSync(root + rel, 'utf8'));
    if (found.length === 0) {
      console.log(`ok  ${rel}: every step reports its own result`);
      continue;
    }
    failed = true;
    console.error(`\n${rel}: a failing step would hide these`);
    for (const f of found) console.error(`  - ${f}`);
  }
  if (failed) {
    console.error(
      '\nA checks job exists to report every guard. Condition each step on the one step it needs' +
        "\n(`if: ${{ !cancelled() && steps.setup.outcome == 'success' }}`) rather than on the whole" +
        '\nsequence before it. See the comment at the top of this file for why (JAR-1885).'
    );
    process.exit(1);
  }
}
