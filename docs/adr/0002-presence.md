# 2. The concurrency decision: anonymous presence, not conflict or reconnect rules

Status: accepted, week 10 (crit 9)

## Context

Crit 9 asks for one concurrency-related behaviour that matters for this app,
picked according to `README.md`'s "what good means here", and written down
with the options considered and what the choice costs.

The garden only has one kind of write a visitor can make: sowing a flower.
Once sown, `CLAUDE.md` already rules out the usual reasons a concurrency
decision gets hard: nobody can move or remove a flower someone else planted,
and a flower's shape is drawn from its id rather than mutable state. So three
candidate decisions were on the table:

- **Conflict handling when two people edit the same thing.**
- **What a returning visitor sees on reconnect or the next day.**
- **Presence: seeing who else is active, and how.**

## Options

- **Conflict handling.** The only place two people's writes could collide is
  sowing near the same spot at the same moment. There is no shared field two
  people both try to set — each flower is its own row, attributed to exactly
  one planter, placed wherever they tapped. Manufacturing a conflict (locking
  a plot, deciding a winner for the same coordinates) would mean inventing a
  scarcity the garden's own rules reject: "A stranger's trace lasts" and
  nobody's planting can be undone by someone else's. There is nothing real to
  resolve.
- **Reconnect / next-day behaviour.** What a visitor sees when they come back
  is already answered by the persistence model from ADR 1: one SQLite row per
  flower and one garden row for care and wild growth, read fresh on every
  request. A reopened tab replays the full state over the event stream
  (`470fb47`); a visitor who returns tomorrow sees whatever the garden did
  overnight, computed from elapsed time rather than stored per visitor. There
  was no fork to choose between — the architecture already settles it, so
  writing a decision here would be describing a side effect, not making a
  choice.
- **Presence.** This is the one the garden actually has to decide, because
  "being together is the point": how many people counts as together, how a
  change in company should be felt, and how much about each other strangers
  get to see. The real choice was between showing presence as a number (a
  counter, a list of who's here) and showing it as the picture itself — colour
  arriving, light drifting in — with a word of status as the fallback for
  anyone who needs it said in text.

## Decision

Presence is the concurrency behaviour this project makes a decision about.
Arrivals and departures are broadcast to every open tab within about a second
over the same event stream flowers use (`a123dd4`), each visitor identified
only by an anonymous cookie-backed id that the page itself hands out so a
single visit is never miscounted as two (`1d82725`, `2ef7b58`). What's shown
is never a number of people: it's a colour family arriving, a light drifting
in from the side of the garden, a chord gaining a voice (`41a823d`). Presence
is also deliberately fuzzy, not exact: someone who left a few minutes ago
still counts for a while, decaying with a six-minute time constant rather
than dropping to zero the instant their tab closes (`server/garden.ts`,
`ECHO_TAU_MS`), so a stranger arriving just after someone left isn't alone.

## What it costs

- **It only works because there is one process.** Presence lives in an
  in-memory `Set` of SSE listeners in `server/main.ts`; every instance of the
  app would need to agree on who's here, which this design cannot do without
  a shared layer (Redis pub/sub, or similar) that ADR 1 already ruled out of
  scope for a one-machine course deployment. The decision is only free because
  of the constraint, not despite it.
- **Anonymity cuts both ways.** Nobody can be singled out, which is the point
  for a garden that "asks for nothing" — but it also means the live crit demo
  can't show the pod *whose* arrival a given bloom belongs to without them
  saying so out loud. A presence model built for attribution (named cursors,
  avatars) would answer that but would break "the same garden" principle:
  everyone would start seeing a different, more detailed picture depending on
  who they are.
- **Fuzzy presence is sometimes wrong on purpose.** The decayed "echo" count
  means the number the garden is acting on (`people`, 1–5) can briefly disagree
  with how many tabs are actually open — someone who just left is still
  "there" for up to about an hour at a shrinking weight. That cost was accepted
  deliberately for the feel of lingering company; a stricter, instantaneous
  count was the exact thing crit 8 moved away from.
- **Counting heartbeats let anyone make company.** Until `ba11a88` any
  request to `/api/presence`, or a sowing, counted its cookie as here, so a
  script with four fresh cookies made "7 people here" and brought every
  colour back. Now only a visitor with the event stream open is seen, which
  ties presence to the page being open; the cost is that a page whose stream
  has died isn't counted, so the page reopens it.
- **Getting identity wrong once was expensive, not free.** The page opens its
  heartbeat and its event stream at the same instant on first visit; before
  `1d82725`/`2ef7b58`, each request without a cookie yet was handed its own
  identity, so a lone visitor could count as two people and the garden would
  wrongly report company. That bug is the real cost of choosing "the page
  hands out identity" over a more defensive handshake, and it's the kind of
  mistake a conflict-handling or reconnect decision would not have surfaced.

## The option not chosen, argued for

If forced to defend reconnect behaviour instead: a garden that's about to be
judged live, in a room, benefits more from visitors trusting what they see
when they reopen a tab than from the ambient feel of who's currently present.
A stricter reconnect contract — "on reopen, you are told exactly what changed
since you left, itemised" — would make the pod's own multi-device demo easier
to narrate, at the cost of the picture-not-a-dashboard principle this project
has otherwise held to throughout.
