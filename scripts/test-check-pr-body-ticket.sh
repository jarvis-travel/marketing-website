#!/usr/bin/env bash
# Behavioural self-test for check-pr-body-ticket.sh. Each case drives the real
# script with a body, an author and a creation time, and asserts the outcome -
# including the three that must NOT fail: a bot, an old PR, and a body that
# declares "No-Ticket:".
#
# The script is invoked as `bash "$check"`, never as `"$check"`: the file lands
# through an API that cannot carry the executable bit, so relying on +x would
# make this suite fail with rc 126 on every case - which is exactly what it did
# on its first CI run.
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check-pr-body-ticket.sh"
pass=0; fail=0
run() { # name expect body author created
  local name="$1" expect="$2" body="$3" author="$4" created="$5" out rc
  out="$(PR_BODY="$body" PR_AUTHOR="$author" PR_CREATED="$created" PR_NUMBER=7 bash "$check" 2>&1)"; rc=$?
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
run "No-Ticket on line 1 is exempt" pass $'No-Ticket: revert the experiment\n\nbody' alice "$NEW"
run "a bare No-Ticket: with no reason fails" fail $'No-Ticket:' alice "$NEW"
run "No-Ticket below line 1 does NOT exempt" fail $'This went away with JAR-2763\n\nNo-Ticket: example' alice "$NEW"
run "No-Ticket inside a fenced example does NOT exempt" fail $'This went away with JAR-2763\n\n```\nNo-Ticket: example\n```' alice "$NEW"
run "pre-cutover PRs are exempt" pass $'old body' alice "$OLD"

# A variable that is UNSET is not the same as one holding an empty string: the
# guard must refuse rather than treat "cannot see" as "no ticket named".
out="$(env -u PR_BODY PR_AUTHOR=alice PR_CREATED="$NEW" PR_NUMBER=7 bash "$check" 2>&1)"; rc=$?
if [ "$rc" -eq 2 ]; then pass=$((pass+1)); echo "  ok   an unset body refuses, not passes"
else fail=$((fail+1)); echo "  FAIL an unset body refuses, not passes (got rc=$rc)"; echo "$out" | sed 's/^/       /'; fi

# A malformed cutover must refuse, not compare as a string and exempt everything.
out="$(PR_BODY='wrong ticket' PR_AUTHOR=alice PR_CREATED="2026-10-25T00:00:00Z" PR_TICKET_SINCE="yesterday" PR_NUMBER=7 bash "$check" 2>&1)"; rc=$?
if [ "$rc" -eq 2 ]; then pass=$((pass+1)); echo "  ok   a malformed PR_TICKET_SINCE refuses"
else fail=$((fail+1)); echo "  FAIL a malformed PR_TICKET_SINCE refuses (got rc=$rc)"; echo "$out" | sed 's/^/       /'; fi

echo
echo "check-pr-body-ticket self-test: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
