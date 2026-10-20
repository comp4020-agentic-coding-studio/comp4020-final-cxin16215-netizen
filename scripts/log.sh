#!/bin/sh
# Reading the garden's log of who did what (ADR 3). Nothing serves it, so this asks Fly: live lines from
# `flyctl logs`, history from the log table on the volume over `flyctl ssh console`. Read-only: it never
# writes to the live database.
#
#   scripts/log.sh live              follow the garden's lines as they happen, Fly's own noise left out
#   scripts/log.sh recent [n]        the last n kept lines (default 40), oldest first
#   scripts/log.sh visitor <hash>    everything one visitor did
#   scripts/log.sh since <iso-time>  everything from a moment on, e.g. 2026-10-21T04:00
#   scripts/log.sh who               one row per visitor: first and last seen, sown, refused
set -eu
app=comp4020-final-cxin16215-netizen
fly() { mise exec -- flyctl "$@" -a "$app"; }
q() { fly ssh console -q -C "sqlite3 -readonly /data/log.db \"$1\""; }
safe() { printf %s "$1" | grep -Eq "^$2\$" || { echo "not a $3: $1" >&2; exit 2; }; }

case "${1:-}" in
live) fly logs | grep --line-buffered -E 't=[^ ]+ event=' | sed -u -E 's/^.*(t=[^ ]+ event=)/\1/' ;;
recent)
  n=${2:-40}
  safe "$n" '[0-9]+' number
  q "SELECT line FROM (SELECT id, line FROM log ORDER BY id DESC LIMIT $n) ORDER BY id"
  ;;
visitor)
  safe "${2:-}" '[0-9a-f]{8}' 'visitor hash'
  q "SELECT line FROM log WHERE visitor = '$2' ORDER BY id"
  ;;
since)
  safe "${2:-}" '[0-9T:.Z-]+' time
  q "SELECT line FROM log WHERE t >= '$2' ORDER BY id"
  ;;
who)
  q "SELECT visitor, min(t), max(t), sum(event = 'sow' AND result = 'ok') AS sown, sum(result = 'refused') AS refused FROM log WHERE visitor IS NOT NULL GROUP BY visitor ORDER BY max(t) DESC LIMIT 30"
  ;;
*) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
