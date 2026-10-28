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
felt wrong: trees became nine flower species, a messy view got clearer
composition, and withering gained curling leaves and dropping heads. These
changes happened before the prototype entered git.

Some mistakes became permanent instructions. The agent once ran tests against
the deployed app and planted test flowers in the real garden. `CLAUDE.md` now
requires a scratch database ([`d3e4e45`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/d3e4e45)) and forbids the agent from
writing to the live one ([`288fd29`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/288fd29)). It also says never to log identity
cookies, and to use separate Chrome profiles when checking two visitors, since
two incognito windows share an identity ([`8ed1d78`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/8ed1d78)). Some corrections
became specs instead: the page and server each keep the same numbers, and a
spec now compares them, so a change that forgets one side goes red
([`c7a6eb3`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/c7a6eb3)).

The clearest case came after crit 10. `CLAUDE.md` had always forbidden a way
to fake company, but nothing checked it. Testing the garden the way a marker
would, two profiles plus scripted requests, the agent found that four
heartbeats with fresh cookies made "7 people here" and brought every colour
back. The rule had been followed in spirit and broken in the code. The fix
went in as a red spec ([`dd7f274`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/dd7f274)) and then the change: only a visitor
with the garden open counts as here ([`ba11a88`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/ba11a88)). `CLAUDE.md` now names
the spec behind its rule.

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
Checking this caught an identity race that made one new visitor count as
two ([`1d82725`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/1d82725)); the page now hands out the identity itself
([`2ef7b58`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2ef7b58)). Why presence was the decision worth making is in
[ADR 2](docs/adr/0002-presence.md).

For crit 10, I added permission checks and a persistent log, specified red
([`6bbd0fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/6bbd0fb)) before they went green ([`2e74468`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/2e74468)). Tests call the
HTTP API directly, so the page cannot be the only thing stopping an invalid
action. The log survives restarts on the volume and names a visitor by an
eight-character hash: logging the cookie would let someone impersonate them,
and totals alone would explain nothing ([ADR 3](docs/adr/0003-who-may-do-what.md)).

Before the crit, we noticed that 123 of the garden's 140 spaces were already
filled. I initially wanted the least-nourished flower to give way, but care
builds up for every flower at the same rate from the day it is planted, so
the least-nourished is always the newest. Instead, a full garden retires the
oldest flower that has lived a garden year ([`b098358`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/b098358), [`cc19533`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/cc19533)).
Its record stays in the database ([ADR 4](docs/adr/0004-a-full-garden.md)).

## What real use showed

A week after crit 8, almost nothing people had planted had grown, though all
tests passed: nearly everyone visited alone, so care fell close to zero and the
planted flowers stayed asleep as seeds. The rule worked; the experience was
wrong, so neglect now leaves a sparse
garden ([`cbc3766`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/cbc3766)), with planted flowers still appearing
([`70097d5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/70097d5)).

The crit 10 rehearsal checked something different: two Chrome profiles
planted flowers and tried actions the server refused, then the machine
restarted. The log the agent read back
afterwards was enough to tell what each visitor did and why an action was
refused, and the lines from before the restart were still there
([`f72485f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/f72485f)).
It was my first check that did not depend on watching the screen.

The marker check found two more things the spec could not. Two people's
flowers went to seed as the year turned, leaving a bare bed under a line that
still said "growing"; it now says they are resting till spring ([`f4a44d6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/f4a44d6)). And on a phone the ring
marking your own flower was 3.4 px across; it now keeps one size on any
screen ([`c78a321`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/c78a321)). A closer phone view was tried and
dropped when it would have hidden thirteen live flowers ([`f22610f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/commit/f22610f)).

## Where I stand

Visitors can leave a flower and find it again, and everyone sees changes
within a second. The unresolved question is still the person arriving alone:
since 20 October the garden has been opened twelve times, only twice with
company. The showcase will test how much being together adds.

Clay Shirky's [“Situated Software”](http://shirky.com/essays/situated-software/)
(2004) helped me think about keeping this small. The garden is built for a
particular social situation, and one machine is enough for it. I agree that
scaling does not have to be the goal. I am less comfortable with accepting a
short lifespan. The garden may end with the course, but while it is open,
someone's flower should not disappear without a reason. Making room in a full
garden forced me to qualify that promise: people cannot remove another
person's flower, but time eventually can.
