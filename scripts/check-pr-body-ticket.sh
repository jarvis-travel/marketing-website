#!/usr/bin/env bash
# Every pull request names the ticket it serves, on its own line, at the top of
# the body:  Fixes JAR-1234
#
# WHY THIS IS A GUARD AND NOT A CONVENTION. Linear links a pull request to the
# first ticket id it can resolve anywhere in the body, and it links it exactly
# once, however many ids follow. So a body whose opening paragraph mentions an
# incidental ticket - "this rows went away with JAR-2763" - files the PR under
# the wrong issue, and the ticket that owns the work is left with nothing
# attached. That is invisible from both sides: the PR looks linked, and the
# ticket looks like it never had a PR. Found on design-library#32 / JAR-2797,
# where the work was done, merged, and the owning ticket still read "In Review,
# no PR" three days later.
#
# WHAT THIS CAN SEE: the body's first non-empty line, and whether it is a
# ticket reference.
# WHAT IT CANNOT SEE: whether the number is the RIGHT ticket. That is a
# judgement, and the guard deliberately does not pretend to make it.
#
# Exemptions, both deliberate:
#   * bots (dependabot, renovate, github-actions) have no ticket to name
#   * any body carrying a line starting "No-Ticket:" - a change that genuinely
#     has no issue (a typo fix, a reverted experiment) says so in public rather
#     than being forced to invent a number
#
# The cutover is a ratchet, not a flag day: pull requests opened before
# PR_TICKET_SINCE are not checked, so landing this guard does not paint every
# open PR red for a rule that did not exist when they were opened.
set -euo pipefail

PR_TICKET_SINCE="${PR_TICKET_SINCE:-2026-10-24T00:00:00Z}"

# Refuse on an UNSET input, not an empty one. An empty body is a real PR with
# nothing in it and fails as a violation; an unset variable means the caller
# wired this job wrong and the guard is looking at nothing. Defaulting first and
# then testing the LOCAL would make every unset input read as "empty body" and
# hide a broken wiring behind a plausible message - which this guard did on its
# first run, until the self-test's last case caught it.
for v in PR_BODY PR_AUTHOR PR_CREATED; do
  if [ -z "${!v+x}" ]; then
    echo "::error::check-pr-body-ticket: $v is unset - the guard cannot see this pull request, so it refuses rather than passing"
    exit 2
  fi
done

BODY="$PR_BODY"
AUTHOR="$PR_AUTHOR"
CREATED="$PR_CREATED"
NUMBER="${PR_NUMBER:-?}"

# Bots do not have tickets.
case "$AUTHOR" in
  *"[bot]"|dependabot|renovate) echo "pr-ticket: $AUTHOR is a bot, no ticket expected"; exit 0 ;;
esac

# A change with no issue says so, in public.
if printf '%s\n' "$BODY" | grep -qiE '^[[:space:]]*no-ticket:'; then
  echo "pr-ticket: exempt - the body carries a No-Ticket: line"
  exit 0
fi

# Ratchet: only pull requests opened after the cutover are held to the rule.
if [ -n "$CREATED" ] && [ "$CREATED" \< "$PR_TICKET_SINCE" ]; then
  echo "pr-ticket: exempt - opened $CREATED, before the $PR_TICKET_SINCE cutover"
  exit 0
fi

first="$(printf '%s\n' "$BODY" | sed -e 's/\r$//' | awk 'NF { print; exit }')"

if [ -z "$first" ]; then
  echo "::error::check-pr-body-ticket: PR #$NUMBER has an empty body. Start it with a line reading 'Fixes JAR-1234'."
  exit 1
fi

if ! printf '%s' "$first" | grep -qE '^Fixes JAR-[0-9]+$'; then
  echo "::error::check-pr-body-ticket: PR #$NUMBER's first line is not a ticket reference."
  echo "  got:      $first"
  echo "  expected: Fixes JAR-1234"
  echo ""
  echo "  Linear links a pull request to the FIRST ticket id it can resolve in the body, so an"
  echo "  incidental id in the opening paragraph files the PR against the wrong issue and leaves"
  echo "  the owning ticket with no PR attached. Put the real one on line 1, alone."
  echo "  No issue for this change? Add a line reading 'No-Ticket: <why>' instead."
  exit 1
fi

echo "pr-ticket: OK - $first"
