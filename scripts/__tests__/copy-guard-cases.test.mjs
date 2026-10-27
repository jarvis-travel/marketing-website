#!/usr/bin/env node
// Runs the shared copy-guard case suite (scripts/copy-guard/cases.json) through
// THIS repo's own guards (JAR-3766). cases.json is byte-identical across
// marketing-website, web-app and design-library; a failure here means this
// repo's guard extraction or rules have drifted from the canonical behaviour.
// New cases land in marketing-website first, then sync to the other two.
//
// Run:  node scripts/__tests__/copy-guard-cases.test.mjs

import { runCases } from '../copy-guard/run-cases.mjs';

const { passed, failed, failures } = runCases();
for (const f of failures) {
  console.error(`  FAIL [${f.guard}] ${f.name}`);
  console.error(`       expected flagged lines ${JSON.stringify(f.expected)}, this repo's guard flagged ${JSON.stringify(f.actual)}`);
}
console.log(`copy-guard cases: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
