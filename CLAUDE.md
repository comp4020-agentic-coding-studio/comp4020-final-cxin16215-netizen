# Working on the garden

`README.md` is the argument for what makes this garden good. These are the
rules that follow from it, and from the times the work went wrong. Read both
before changing anything.

## What the garden must never do

- Show different gardens to people who are there at the same moment. Anything
  shared or persistent comes from the server's state and the shared clock,
  never from `Math.random()`; a planted flower's shape is drawn from its id.
  Local randomness is only for things that don't last (rain, butterflies).
- Let anyone remove or move a flower someone else planted.
- Tell anyone who planted a flower, except the planter (the API says `mine`,
  never whose).
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
  screenshot the changed view at 1280×860 and at a real 390-wide viewport (an
  iframe; headless windows can't go that narrow), by day and by night, and with
  few people and many. Headless browsers give an animation only a few frames,
  so step time-based effects by hand rather than trusting a screenshot of
  nothing. Most visual bugs so far (a new lily that looked withered, a storm
  that didn't show, a header lost against the clouds) were found by looking.
- Keeps `public/index.html` working when opened as a file: that is the offline
  sketch with the debug controls, and where visual work happens.
- Keeps the twin numbers in step: species, the ground, presence and growth are
  in both `server/garden.ts` and `public/index.html`.
- Says in its commit message what changed and why, in a commit of its own.

## Secrets and the repo

- The Fly token lives only in `mise.local.toml`. Never print it, never commit it.
- Run flyctl as `mise exec -- flyctl ...`, which is what hands it the token.
- The repo stays private until the crit cutoff. Don't push without asking, and
  never `gh repo create`.

## Talking to me

Answer me in Chinese. Code, commit messages and everything in the repo are in
English.
