#!/usr/bin/env bash
# Behavioural self-test for check-pr-body-ticket.sh. Each case drives the real
# script with a body, an author and a creation time, and asserts the outcome -
# including the two that must NOT fail: a bot, and an old PR.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check-pr-body-ticket.sh"
pass=0; fail=0
run() { # name expect body author created
  local name="$1" expect="$2" body="$3" author="$4" created="$5" out rc
  out="$(PR_BODY="$body" PR_AUTHOR="$author" PR_CREATED="$created" PR_NUMBER=7 "$check" 2>&1)"; rc=$?
  if [ "$expect" = "pass" ] && [ "$rc" -eq 0 ]; then pass=$((pass+1)); echo "  ok   $name"
  elif [ "$expect" = "fail" ] && [ "$rc" -eq 1 ]; then pass=$((pass+1)); echo "  ok   $name"
  elif [ "$expect" = "refuse" ] && [ "$rc" -eq 2 ]; then pass=$((pass+1)); echo "  ok   $name"
  else fail=$((fail+1)); echo "  FAIL $name (want $expect, got rc=$rc)"; echo "$out" | sed 's/^/       /'; fi
}
NEW=2026-10-25T00:00:00Z; OLD=2026-10-01T00:00:00Z
run "a proper first line passes" pass $'Fixes JAR-1234\n\nbody text' alice "$NEW"
run "no trailing text allowed on the line" fail $'Fixes JAR-1234 please\n\nbody' alice "$NEW"
run "an incidental id first fails" fail $'This went away with JAR-2763\n\nFixes JAR-2797' alice "$NEW"
run "empty body fails" fail '' alice "$NEW"
run "a body that only names a ticket later fails" fail $'Some words\n\nFixes JAR-1' alice "$NEW"
run "lowercase fixes fails" fail $'fixes JAR-1' alice "$NEW"
run "bold-wrapped line fails" fail $'**Fixes JAR-1**' alice "$NEW"
run "leading blank lines still find line 1" pass $'\n\nFixes JAR-9\n\nbody' alice "$NEW"
run "CRLF line endings pass" pass $'Fixes JAR-9\r\n\r\nbody' alice "$NEW"
run "bots are exempt" pass $'bump x from 1 to 2' 'dependabot[bot]' "$NEW"
run "No-Ticket is exempt" pass $'No-Ticket: revert the experiment\n\nbody' alice "$NEW"
run "pre-cutover PRs are exempt" pass $'old body' alice "$OLD"
# A variable that is UNSET is not the same as one holding an empty string: the
# guard must refuse rather than treat "cannot see" as "no ticket named".
out="$(env -u PR_BODY PR_AUTHOR=alice PR_CREATED="$NEW" PR_NUMBER=7 "$check" 2>&1)"; rc=$?
if [ "$rc" -eq 2 ]; then pass=$((pass+1)); echo "  ok   an unset body refuses, not passes"
else fail=$((fail+1)); echo "  FAIL an unset body refuses, not passes (got rc=$rc)"; echo "$out" | sed 's/^/       /'; fi
echo
echo "check-pr-body-ticket self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
