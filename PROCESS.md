# Process overview

## From the brief to a garden

The brief asks for something multi-user, real-time and persistent that is
better because other people are in it at the same time. I wanted co-presence to
be the mechanic rather than a feature, so the idea is a garden that only grows
while two or more people are in it together, where anyone can leave a flower
behind. The capstone showcase, a room full of people at once, is the garden at
its best; one stranger alone is the case it has to be kind to.

Because most of what would make this good is how being together looks, I
started with the picture, not the server: a standalone visual prototype built
with Claude Code over one long session, brought into the repo once its look
had settled ([`66603ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/66603ae)).
The day was then repainted in Monet's broken colour so that it answers the Van
Gogh night ([`aaa3bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/aaa3bff)).

## How I directed the agent, and where it went wrong

I steered mostly by reference and by rejection. I named what the look should
come from (Gris and Neva, *The Starry Night*, later Monet) and looked at every
result. The corrections that shaped the prototype were all mine, from looking:

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

Those fixes landed in code, before the work was in git, so they are described
here rather than cited. From this crit on, fixes go into the harness. When the
agent ran the spec against the deployed app and planted test flowers in the
real garden, that became a rule in `CLAUDE.md`
([`d3e4e45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/d3e4e45)),
next to the rule that visual changes are checked by looking, because looking
is how nearly every visual bug so far was found.

## How the work was checked

Visual work was checked with headless screenshots at every season, hour and
number of people. One lesson from that went into `CLAUDE.md`: a headless
browser gives an animation only a few frames, so a screenshot of a storm shows
nothing unless the storm is stepped by hand.

The server's promises were written as tests first and seen to fail against the
placeholder
([`e3bf487`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/e3bf487)),
then turned green by the server
([`52d4ec9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/52d4ec9))
and the page that talks to it
([`70318a8`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/70318a8)).
What the tests can't reach, flowers surviving a restart and a redeploy, I
checked by hand on Fly.

## The stack

Node 24, Hono and SQLite in one process, with the case in
[ADR 1](docs/adr/0001-stack.md)
([`6a5e69f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/6a5e69f)).
The page paints itself, so the server needs very little: an anonymous identity,
the planted flowers, who is here, and a running total of time spent together.
Node runs the TypeScript directly, so what I test is what deploys. The cost is
that everything lives in one process on one machine, which the course setup
fixes anyway.

One decision was about the client rather than the server: the Monet day is
some 25,000 brush dabs, painted once to a canvas and shown as a few images
instead of 25,000 SVG paths.

## Where it stands

A stranger can sow, come back and find their flower; the garden counts who is
here and who just left, and grows only with company. Other people's flowers
arrive by polling every fifteen seconds; crit 9 replaces that with a push.

[To write: my position on what I read about software at this scale, and how
it changed the definition of good in `README.md`.]
