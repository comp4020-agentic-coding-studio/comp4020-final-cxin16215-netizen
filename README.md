# The garden

A garden that only grows while people are in it together. Anyone who visits can
sow a flower. It stays where they put it, and it is still there, ringed as
theirs, when they come back. But nothing grows while you are alone, and the
garden's colours come back one family at a time as more people arrive: red with
two, green with three, blue with four, yellow with five. By day it is painted in
Monet's broken colour, by night in Van Gogh's swirling strokes, and a year
passes every eight minutes.

## What good means here

**Being together is the point.** Growth is measured in time people spend here
together, so a room full of people, like the capstone showcase, is the garden at
its most alive. Company lingers: someone who left a few minutes ago still counts
for a while, so a stranger who arrives just after them isn't alone.

**A stranger's trace lasts.** Planting is the one thing you can do, so it has to
be worth doing: your flower keeps its place and shape, comes up every spring,
and nobody can remove it. The ground holds 140 planted flowers; once they are
all there, the oldest runs out of nourishment and withers to make room for each
new one, but never before it has lived a whole garden year. A full garden still
takes a newcomer's flower, and the garden, not a person, decides which gives
way.

**It is a picture, not a dashboard.** How many people are here, and how long
they have stayed, shows first in the colour and the growth. One line of plain
words says it too, for anyone who needs it said.

**It asks for nothing.** No accounts, no notifications, no streaks. Leave and
the garden waits; come back and it has moved on without you.

**Everyone sees the same garden.** One clock from real time, the same wild
flowers, the same shape for the same flower on every screen.

## What is checked, and what is judged

Checked by `spec/` on every change: a stranger can sow on their first visit and
their flower is there when they come back, marked as theirs; everyone else sees
it, not as theirs; the garden refuses species it doesn't grow and places that
aren't ground; two people at once count as company; nobody can remove or move a
flower, and nobody learns anyone else's identity; the garden keeps a log of who
did what that names each visitor only by a short hash and outlives a restart.
By hand on the deployed app: flowers and the log survive a restart and a
redeploy. Who may do what, and why, is in
[ADR 3](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/blob/main/docs/adr/0003-who-may-do-what.md).

Judged, not tested: whether the painting holds together in every season and
hour (I checked screenshots of each while building it), whether growth feels
earned rather than slow, and whether being here with others beats being here
alone. Those are for the crit.

## What I looked at

- *Gris* (2018) and *Neva* (2024) by Nomada Studio, for colour that returns as
  the world heals, and for soft watercolour.
- Van Gogh's *The Starry Night* (1889) for the night sky, and Monet's *Poppy
  Field* (1873), *Woman with a Parasol* (1875) and *The Magpie* (1869) for the
  day: dabs of unmixed colour, violet shadow, snow that is never white.
- Tyler Hobbs's generative watercolour, a shape deformed and stacked in faint
  layers, behind every petal and hill.
- Clay Shirky's ["Situated Software"](http://shirky.com/essays/situated-software/)
  (2004), on software made for one group in one situation, where not scaling
  is a fair price. The garden is built around one situation, the people here at
  the same moment, and accepts his trade: one machine, room for 140 planted
  flowers.

## What I chose not to build

Accounts and names: a visitor is whoever holds the cookie the garden hands out.
Chat, likes or comments: the garden is the only thing people share. Removing
anyone's flower. Scores or leaderboards. Watching without being counted.

## Still open

Whether the oldest flowers going is the right price for a garden that never
turns anyone away ([ADR 4](https://github.com/comp4020-agentic-coding-studio/comp4020-final-cxin16215-netizen/blob/main/docs/adr/0004-a-full-garden.md)): the people who
came first are the first to lose their flowers.
