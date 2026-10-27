# Working on the garden

`README.md` is the argument for what makes this garden good. These are the
rules that follow from it, and from the times the work went wrong. Read both
before changing anything.

## What the garden must never do

- Show different gardens to people who are there at the same moment. Anything
  shared or persistent comes from the server's state and the shared clock,
  never from `Math.random()`; a planted flower's shape is drawn from its id.
  Local randomness is only for things that don't last (rain, butterflies).
- Let anyone remove or move a flower someone else planted. The garden itself
  retires flowers in exactly one way: once 140 are planted, the oldest that has
  lived a whole garden year withers for each new one (ADR 4). Don't add another
  (by species, by planter, by vote), and never delete the row: a withered
  flower keeps its record with `gone_at`.
- Tell anyone who planted a flower, except the planter (the API says `mine`,
  never whose).
- Log, print or store a visitor's cookie (`gid`), or anything that holds it
  (a raw `Cookie` header, a request dump, an error with the request in it).
  The cookie is the identity: whoever reads it can sow as that person. The log
  names a visitor only as `who()` in `server/log.ts`, 8 hex characters of a
  hash, and `spec/log.test.ts` fails if the cookie shows up anywhere in what
  the server prints or keeps. Keep the cookie from `randomBytes`: a guessable
  one would make the hash reversible.
- Serve the log. There is no route to it, public or "admin": the history is
  read with `flyctl ssh console` and sqlite3, by me (ADR 3).
- Ask a visitor for anything before they can sow: no sign-up, no name.
- Grow while one person is alone with no company lingering. Growth is time
  spent together; don't add a shortcut around it.
- Put a number where the picture can say it. The status line is the one place
  for plain words; don't add scores, counts of people or leaderboards.
- Flash more than three times a second, or at all under
  `prefers-reduced-motion`.

## Every change

- Keeps `pnpm check` green against a local server on a scratch database:
  `PORT=8080 DATA_DIR=.data-test node server/main.ts` (delete `.data-test`
  first), then `pnpm check`.
- Never runs the spec against the deployed app: the tests plant real flowers
  in the real garden. This happened once, on 2026-09-30, and left three test
  flowers and a stretch of made-up company in the live garden.
- Never writes to the live database from a remote shell; that is mine to do,
  by hand.
- Starts with a failing test when it adds a promise the server keeps. Commit
  the red test, then the change that turns it green.
- Is looked at, not only tested, when it changes what the garden looks like:
  screenshot the changed view at the two viewports the marker uses, 1920×1080
  and 390×844 (Chrome's device emulation, as DevTools' device toolbar does; a
  headless window can't go that narrow, and a cross-site iframe drops the
  cookie), by day and by night, and with few people and many. Headless browsers give an animation only a few frames,
  so step time-based effects by hand rather than trusting a screenshot of
  nothing. Most visual bugs so far (a new lily that looked withered, a storm
  that didn't show, a header lost against the clouds) were found by looking.
- Keeps `public/index.html` working when opened as a file: that is the offline
  sketch with the debug controls, and where visual work happens.
- Keeps the console a preview. The backquote key (or `?debug`) opens controls
  for showing the garden, which change only what this browser shows: they never
  write to the server, change anyone else's garden, or make anything grow
  faster, and the status line says "Preview" while they are in use. Five
  people are hard to gather for a demo, so a preview is allowed; a way to fake
  company for everyone is not. Only a visitor with the event stream open
  counts as here, and `spec/permissions.test.ts` fails if a heartbeat or a
  sowing from a page that isn't open adds anyone.
- Keeps the twin numbers in step: species, the ground, presence and growth are
  in both `server/garden.ts` and `public/index.html`.
- Logs what a visitor does that changes anything, or is refused, through
  `log.write` in `server/main.ts`: one key=value line with `t`, `event`,
  `visitor`, `result`, and `reason` when refused. A new route that changes
  state, or turns someone away, gets a line and a spec for it.
- Checks two people with two separate browsers: two Chrome profiles, or Chrome
  and another browser. Incognito windows of one Chrome share one cookie jar
  with each other, so two of them are one visitor.
- Says in its commit message what changed and why, in a commit of its own.

## Secrets and the repo

- The Fly token lives only in `mise.local.toml`. Never print it, never commit it.
- Run flyctl as `mise exec -- flyctl ...`, which is what hands it the token.
- The repo stays private until the crit cutoff. Don't push without asking, and
  never `gh repo create`.

## Talking to me

Answer me in Chinese. Code, commit messages and everything in the repo are in
English.
