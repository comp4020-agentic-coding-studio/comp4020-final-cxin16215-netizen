# 3. Who may do what, decided on the server, and a log that names nobody

Status: accepted, week 11 (crit 10)

## Context

Crit 10 asks that the garden tell people apart, that what each person may see
and change is checked on the server and written down with why, and that the
server logs who did what in a way that outlives the crit. At the crit two of
the pod use the garden from its URL alone, in separate Chrome profiles, while
I narrate from the logs without touching the app.

The garden already tells people apart: a visitor is whoever holds the `gid`
cookie, handed out on the first request (ADR 1, `2ef7b58`). What was missing
was the rules written down in one place, tests that ask the server directly
rather than through the page, and any record of what anyone did.

## Who may do what

There is one kind of person, a visitor, and the server decides everything a
visitor may do. The page's own limits (where a tap lands, which species it
offers) are a courtesy; the rules hold for a request sent by hand.

| A visitor may | Checked by | Why |
| --- | --- | --- |
| See every flower, wild and planted, and the shared clock, presence and tending | `GET /api/garden`, `/api/events` | "Everyone sees the same garden" (README) |
| Learn which flowers are theirs, and nothing about whose the rest are | `mine` is computed per request; no owner field is sent | Planting is a trace, not a signature |
| Sow one of the nine species on the ground band | `validSowing` in `server/garden.ts`; refuses `sky`, `off-ground`, `not-a-species`, `not-a-place` | The garden only grows what it can draw where it can draw it |
| Sow at most 12 in ten minutes | `SOW_LIMIT`, counted per cookie in SQLite; `429 too-many` | Keeps one person from filling the 140 spots alone |
| Sow while fewer than 140 planted flowers stand | `MAX_SOWN`; `409 full` | The page holds 140 plants (README "Still open") |

| Nobody may | Checked by | Why |
| --- | --- | --- |
| Remove, move or replace a flower, their own included | No route does it; PUT, PATCH and DELETE on `/api/flowers` answer `405` and are logged as `edit refused no-edits` | "A stranger's trace lasts" |
| Choose who a flower is planted by | The planter is the cookie; any other field sent with a sowing is ignored | The cookie is the only identity |
| Learn another visitor's identity | No response carries anyone else's cookie or hash; a malformed or guessed cookie is handed a fresh one | Holding the cookie is being that person |
| Read the log | No route serves it | See below |

These are checked against the HTTP API in `spec/permissions.test.ts`: sowing in
the sky, the 13th flower within ten minutes and the first one after (on a
garden whose clock the test moves on), the 141st flower, PUT/PATCH/DELETE, two
cookies asking about each other, and forged cookies.

## The log

Every action, and every refusal, is one line of `key=value` pairs:

```
t=2026-10-21T04:12:09.114Z event=sow visitor=7f3a91c2 result=ok flower=67 species=poppy x=612.5 y=700 sown=67 people=2
t=2026-10-21T04:12:15.630Z event=sow visitor=7f3a91c2 result=refused reason=sky sown=67
t=2026-10-21T04:13:40.002Z event=leave visitor=c01d4e88 result=ok how=closed stayed=211s open=1 people=2
```

Events: `start` and `stop` (the machine), `new` (a cookie handed out),
`arrive` and `leave` (the first page opened and the last one closed), `sow`,
and `edit` (always refused). Lines are printed, so `flyctl logs` shows them as
they happen, and kept in a `log` table in `$DATA_DIR/log.db` on the volume, so
they survive a restart, a redeploy and Fly's own short log retention.

**A visitor is the first 8 hex characters of a SHA-256 of their cookie.** The
cookie is 128 bits from `randomBytes`, so the hash can't be worked back to it,
and 8 characters (32 bits) makes two of a few hundred visitors colliding
unlikely enough to ignore. The cookie itself is never printed or stored:
reading it would let anyone sow as that visitor. `spec/log.test.ts` fails if it
appears anywhere in what the server prints or keeps, and `CLAUDE.md` forbids it.

**Leaving is the event stream closing.** HTTP doesn't know when someone leaves,
but every open page holds `/api/events` open, and a hidden tab closes it, so
the server knows exactly who has the garden open. It counts streams per
visitor: the first is `arrive`, the last closing is `leave`, a second tab is
neither. A connection that drops silently (a phone losing signal) is only
noticed when Fly's proxy or the 20-second ping finds it gone, so that `leave`
comes late.

**Fly stopping the machine.** An open stream keeps the machine running, so Fly
only stops it for idleness after everyone has closed or hidden the page, by
which time each `leave` is already logged; it sends SIGINT, the garden logs
`stop` and closes its databases. A restart or deploy with people still there
logs each of them as `leave how=shutdown` before `stop`; their pages reconnect
to the new machine within a few seconds and log `arrive` again. A crash logs
neither, and reads as a `start` with no `stop` before it.

**Reading the history** is by hand, by whoever runs the garden:

```
mise exec -- flyctl ssh console -a comp4020-final-cxin16215-netizen \
  -C "sqlite3 /data/log.db \"SELECT line FROM log WHERE visitor='7f3a91c2' ORDER BY id\""
```

## Options considered

- **Log the cookie.** Simplest, and unambiguous. But the log would then hold
  every visitor's identity, and anyone who saw a screen of it at the crit, or
  read a pasted excerpt, could become any of them.
- **Log nothing per visitor, only counts.** Truly anonymous, but then the crit
  narration ("this one sowed a poppy, that one tried the sky") can't be told,
  and neither can an investigation into who filled the garden.
- **A hash of the cookie (chosen).** Enough to follow one visitor through the
  log and tell two apart; nothing a reader can act on.
- **A public or password-protected log page.** Easier to read on a phone, but
  a route that serves who-did-what is the one thing the garden's privacy rules
  can't afford to get wrong. SSH access is already limited to whoever holds the
  Fly token.

## What it costs

- **The log is pseudonymous, not anonymous.** Whoever runs the garden can see
  that `7f3a91c2` sowed these six flowers, arrived at 4:12 and left at 4:16,
  and could match that to a person standing in the room. It doesn't say who
  `7f3a91c2` is, but it is a record of one person's behaviour over time, kept
  on the volume for as long as the garden runs.
- **The rate limit is per cookie, so clearing cookies gets round it.** Twelve
  flowers in ten minutes holds for a visitor who keeps their cookie; someone who
  clears it, opens a private window or scripts requests without one is a new
  visitor each time and can fill the remaining spots. The only backstop is the
  140-flower cap, and the log shows it happening (many `new` visitors, each
  sowing up to 12). Limiting by IP was rejected: a room full of people at the
  showcase shares one network, so it would stop the garden at its best.
- **A hash of a hash-able cookie would be reversible.** The hash is only safe
  because the cookie is long and random. If the identity ever became
  guessable (a counter, a short code), the 8 characters could be brute-forced
  back to it. `CLAUDE.md` says so.
- **The log grows without bound.** A line is about 120 bytes and the volume is
  1 GB; a busy day of a few thousand lines is under a megabyte, so this is
  left alone rather than rotated.
- **One machine, one log.** The log lives on the machine's own volume. With a
  second machine each would keep half; the course setup keeps it to one
  (ADR 1).
