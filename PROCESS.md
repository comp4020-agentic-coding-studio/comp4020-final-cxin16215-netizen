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

## Crit 9: going live, and the presence decision

Polling every fifteen seconds was the one thing crit 8 left for later. I had
the agent write the promise as a test first — a flower one person sows
reaches everyone else within about a second, with no reload — and watched it
fail red against the polling server
([`2df86c4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2df86c4)).
It went green behind a server-sent-events stream that every open tab listens
on, broadcasting a sown flower and each change in who's here
([`a123dd4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/a123dd4)),
and the page was switched from asking every 15 seconds to listening
([`470fb47`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/470fb47)).
Checked with two headless browsers standing in for two people: a flower one
sowed reached the other's screen 9 ms later.

Crit 9 also asks for one concurrency decision, argued and written down. I
decided presence — what it means to see who else is here — was the one that
actually mattered for this garden, and not conflict handling or reconnect
behaviour, both of which the data model and ADR 1's persistence already
settle without a choice to make. The reasoning, the options, and what the
decision costs are in
[ADR 2](docs/adr/0002-presence.md).

Specifying "within a second" before building the push surfaced a bug I
wasn't looking for: the page opens its heartbeat and its event stream at the
same instant, and a first-time visitor with no cookie yet was handed two
identities instead of one, so a lone visitor could count as company. Found by
a headless screenshot that said "2 people here" for one page
([`1d82725`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/1d82725)),
fixed by having the page hand out its own identity instead of racing two
endpoints for it
([`2ef7b58`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2ef7b58)).
A further spec compares the numbers the page and server each hold — species,
the ground, presence, growth — against each other directly, so a change that
updates one and forgets its twin goes red instead of waiting to be noticed
([`c7a6eb3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/c7a6eb3)).

The pod will see this live on their own devices at the crit, so the controls
were also cut down for a 390-wide screen: one row of species you swipe along
instead of four or five covering the view
([`3176806`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/3176806)).

A week after deploying, I opened the live garden and saw that almost nothing
I or anyone else had sown had come up. I asked the agent why. It read the
garden's state with a plain request that doesn't count as a visit, and found
the neglect rule from crit 8 doing exactly what it said: care had decayed to
almost zero, which put all 66 planted flowers to sleep as seeds and cut the
wild garden to 12. Care only rises when two people overlap, and nearly every
visitor had come alone, so the garden had been asleep for days. That broke
the README's promise that a planted flower comes up every spring. I decided
that neglect should leave a sparse garden, never a bare one. The agent
specified the floor first
([`7d6af36`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/7d6af36)),
raised it to a third of the wild garden
([`cbc3766`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/cbc3766)),
and stopped neglect from putting planted flowers to sleep, so it now only
weakens them a little
([`70097d5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/70097d5)).
Growth itself still comes only from time spent together. The seeds people
had been staring at were identical brown beans, so I asked for each kind's
real seed instead, and checked them on an enlarged specimen sheet before
looking at them in the garden
([`c43b0ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/c43b0ec)).
The lesson matches crit 8's: a rule that reads well in the design can still
leave the lone visitor with nothing, and the place to find that is the
deployed app after real use, not the spec.

## Where it stands

Someone can sow a flower, leave, and find it again when they come back. The
garden counts who is here and who just left, and grows only with company.
Other people's flowers and arrivals now reach every open tab within about a
second, pushed rather than polled, and an arrival shows as its own light and
colour spreading through the garden rather than a number
([`41a823d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/41a823d)).

## What I read, and where I stand

Of what I read about good software at this scale, Clay Shirky's
["Situated Software"](http://shirky.com/essays/situated-software/) (2004) fits
the garden most closely: software built in and for one social situation, taken
up because it was made for the people using it, and allowed to stay small. I
agree with him that not scaling is a fair price here. The garden is for
whoever is present at the same moment, and it runs on one machine by design.

Where I part from him is lifespan. He accepts that situated software may not
last, and the garden may well end with the course. But while it is open, a
trace someone leaves must not disappear, because that is the one promise it
makes to a stranger. Reading him is what made me add that limit to the claim in
`README.md`.

I also read Mike Caulfield's "The Garden and the Stream" (2015). Despite the
name, it is about how knowledge is organised on the web, linked and reworked
rather than scrolled past in a feed, not about people being present together,
so I did not draw on it.
