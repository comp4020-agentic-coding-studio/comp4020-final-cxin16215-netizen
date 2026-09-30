# Process overview

## From the brief to a garden

The brief asks for something multi-user, real-time and persistent that becomes
better when people use it together. I made that the main rule: the garden grows
only when people are there together, and anyone can leave a flower behind. The
showcase, with a room full of people, is when it should feel most alive. But it
also has to make sense to one stranger arriving alone.

I started with the picture because the idea depends on what being together
looks like. I built a standalone visual prototype with Claude Code in one long
session, then brought it into the repo once the look had settled
([`66603ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/66603ae)).
Later I asked for the day to be repainted in Monet's broken colour, to give it
a different feel from the Van Gogh night
([`aaa3bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/aaa3bff)).

## How I directed the agent, and where it went wrong

I gave the agent visual references (*Gris*, *Neva*, *The Starry Night*, and
later Monet), then looked at each result and said what was wrong. These were
the changes that mattered most:

- The first draft drew trees. I wanted a garden of many kinds of flower,
  sown by visitors and growing wild, so it became nine species.
- Every species used the same stems and leaves; each got its own habit.
- Twice the view felt disordered. The fix was composition, not detail:
  rows by height, a blurred near plane, and colours graded across the bed.
- Sowing silently did nothing once the garden was full. Now a visitor's
  flower always takes the place of a wild one, and the page says so.
- Withering only shrank the flower. It became a real sequence: colour drains,
  leaves curl, heads drop and seed, and seeds wait through winter.
- A lily sown in summer came up already withered, so a flower sown out of
  season now waits as a seed until its kind comes round.
- The sun stayed out through a thunderstorm; storm clouds now roll in over
  the sun, moon and stars.

These fixes happened before I put the prototype in git, so I cannot link to
separate commits for them. I have started putting lessons like these into the
harness. The agent once ran the spec against the deployed app and planted test
flowers in the real garden. I added a rule against that in `CLAUDE.md`
([`d3e4e45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/d3e4e45)),
alongside a rule to check visual changes by looking at them. That is how
nearly every visual bug so far was found, by me in the browser or by the agent
in its own screenshots.

## How the work was checked

The agent checked its own visual work with headless screenshots across
seasons, hours and numbers of visitors, and I looked at the page myself after
each change. The screenshots showed a limit of the method: a headless browser
only gives an animation a few frames, so the agent has to step a storm by hand
to see it at all. That lesson is now in `CLAUDE.md`.

I had the agent write the server's promises as tests first and run them
against the placeholder, where they failed
([`e3bf487`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/e3bf487)).
The server turned them green
([`52d4ec9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/52d4ec9)),
and the page was connected to it after that
([`70318a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/70318a8)).
The part the tests cannot reach, flowers surviving a restart and a redeploy,
the agent checked by hand on Fly by restarting and redeploying the app.

## The stack

I chose Node 24, Hono and SQLite in one process. The reasons are in
[ADR 1](docs/adr/0001-stack.md)
([`6a5e69f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/6a5e69f)).
The page paints itself, so the server only needs to keep an anonymous identity,
the planted flowers, who is here, and the time people have spent together.
Node runs the TypeScript directly, so I test the same code I deploy. Everything
lives in one process on one machine, which fits the course setup.

On the client, the Monet day uses about 25,000 brush dabs. The page paints
them once to a canvas and shows the result as a few images instead of keeping
25,000 SVG paths.

## Where it stands

Someone can sow a flower, leave, and find it again when they come back. The
garden counts who is here and who just left, and grows only with company. For
now, other people's flowers appear through polling every fifteen seconds. I
plan to replace that with a push in crit 9.

[To write: my position on what I read about software at this scale, and how
it changed the definition of good in `README.md`.]
