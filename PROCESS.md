# Process overview

## From the brief to a garden

The brief asks for something multi-user, real-time and persistent that gets
better when people use it together. My idea was a garden that grows when
people spend time together, where anyone can leave a flower. I pictured the
showcase with a room full of people, but most visitors would probably arrive
alone. Working out what the garden offers each of them became the main design
problem.

I started with the visual prototype in Claude Code, using *Gris*, *Neva* and
*The Starry Night* as references. Once the look had settled, I brought it into
the repo ([`66603ae`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/66603ae)).
Later, I changed the daytime colours using Monet as a reference, while keeping
the Van Gogh night ([`aaa3bff`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/aaa3bff)).

## The stack and workflow

I chose Node 24, Hono and SQLite in one process
([ADR 1](docs/adr/0001-stack.md)). The page draws the garden, so the server only
needs to keep flowers, anonymous identities, presence and time spent together.
Plain `node:http` would mean writing cookies and routing myself. Astro, the
course default, seemed unnecessary for one page that draws itself. Node runs
the TypeScript directly, so the tests and deployment use the same source.
The tradeoff is that presence and live updates depend on one process, so the
app cannot run across multiple machines.

I kept two habits the agent suggested: write a failing test before adding a
server promise, and record decisions with tradeoffs in ADRs. The first server
went in that way, red ([`e3bf487`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/e3bf487)) then green ([`52d4ec9`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/52d4ec9)).
The test gives the agent something concrete to work against. The ADR keeps the reason for a
choice after the conversation is gone.

## Directing and correcting the agent

For visual work, I gave references, looked at the result and described what
felt wrong. Trees became nine flower species. When the garden looked messy,
I asked for clearer composition: height, depth and colour grouping. Withering
needed more than smaller flowers, so leaves now curl and flower heads drop.
A lily planted in summer looked dead immediately; out-of-season seeds now
wait for their season. These changes happened before the prototype entered git.

Some mistakes became permanent instructions. The agent once ran tests against
the deployed app and planted test flowers in the real garden. `CLAUDE.md` now
requires a scratch database ([`d3e4e45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/d3e4e45)) and forbids the agent from
writing to the live one ([`288fd29`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/288fd29)). It also says never to log identity
cookies, and to use separate Chrome profiles when checking two visitors, since
two incognito windows share an identity ([`8ed1d78`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/8ed1d78)). Some corrections
became specs instead: the page and server each keep the same numbers, and a
spec now compares them, so a change that forgets one side goes red
([`c7a6eb3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/c7a6eb3)).

The agent also corrected my assumptions. I asked for a 5x preview, then said
the seasons still felt slow. It measured the clock and found it was already
five times faster. After asking what I was seeing, we realised the days were
flickering while seasons still took twenty-four seconds. Now the preview speeds
up only the seasons ([`81e895d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/81e895d)).
That helped me ask for changes by describing the experience first.

## Making it shared and persistent

For crit 9, I first wrote a test requiring a planted flower to reach everyone
within about a second ([`2df86c4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2df86c4)). Server-sent events replaced polling
and passed it ([`a123dd4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/a123dd4), [`470fb47`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/470fb47)).
Checking this caught an identity race: two requests from a new visitor could
create two identities, making one person count as company ([`1d82725`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/1d82725)).
The fix was to hand out the identity with the page itself, so every request
after it comes from one person ([`2ef7b58`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2ef7b58)). That kept presence matching
the rule in [ADR 2](docs/adr/0002-presence.md).

For crit 10, I added permission checks and a persistent log, specified red
([`6bbd0fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/6bbd0fb)) before they went green ([`2e74468`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2e74468)). Tests call the
HTTP API directly, so the page cannot be the only thing stopping an invalid
action. The log is kept in its own database on the volume, so it survives
restarts and redeploys, and uses an eight-character hash to follow a
visitor. Logging the cookie would let someone impersonate them; logging only totals would make it
hard to explain what happened ([ADR 3](docs/adr/0003-who-may-do-what.md)).

Before the crit, we noticed that 123 of the garden's 140 spaces were already
filled. I initially wanted the least-nourished flower to give way, but care
builds up for every flower at the same rate from the day it is planted, so
the least-nourished is always the newest. Instead, a full garden retires the
oldest flower that has lived a garden year ([`b098358`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/b098358), [`cc19533`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/cc19533)).
Its record stays in the database ([ADR 4](docs/adr/0004-a-full-garden.md)).

## What real use showed

A week after crit 8, I opened the live garden and almost nothing people had
planted had grown. All tests passed. Nearly everyone visited alone, so care
fell close to zero and all 66 planted flowers stayed asleep as seeds. The rule was
working, but the experience was wrong. I changed neglect to leave a sparse
garden ([`cbc3766`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/cbc3766)), with planted flowers still appearing
([`70097d5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/70097d5)).

When the garden felt slow, measurement showed that repainting unchanged layers
was the expensive part ([`32aa475`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/32aa475)). The crit 10 rehearsal checked
something different: two Chrome profiles planted flowers and tried actions the
server refused, then the machine restarted. The log the agent read back
afterwards was enough to tell what each visitor did and why an action was
refused, and the lines from before the restart were still there
([`f72485f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/f72485f)).
It was my first check that did not depend on watching the screen.

## Where I stand

Visitors can leave a flower and find it again, and everyone sees changes
within a second. The unresolved question is still the person arriving alone:
care stays low and flowers stay small until there is company. The showcase
will test how much being together adds.

Clay Shirky's [“Situated Software”](http://shirky.com/essays/situated-software/)
(2004) helped me think about keeping this small. The garden is built for a
particular social situation, and one machine is enough for it. I agree that
scaling does not have to be the goal. I am less comfortable with accepting a
short lifespan. The garden may end with the course, but while it is open,
someone's flower should not disappear without a reason. Making room in a full
garden forced me to qualify that promise: people cannot remove another
person's flower, but time eventually can.
