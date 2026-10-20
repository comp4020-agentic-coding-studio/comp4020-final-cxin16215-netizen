# Crit 10 reflection

## What was the breakthrough that moved the work forward?

The breakthrough was the first rehearsal on the deployed garden. I opened it
in two Chrome profiles and played both visitors: each sowed flowers, one tried
to sow in the sky and to delete a flower, and then the machine was restarted.
Then the agent read the log back. From its output alone I could tell which
visitor sowed what, which one was refused and why, and that both visitors'
lines from before the restart were still there. The visitors were only
eight-character hashes, but that was enough to tell two people apart.

Until now I had checked the garden by looking at it, in screenshots and in the
browser. This was the first time I could account for what people did without
seeing their screens. The rehearsal also caught something small that would
have hurt at the crit: flyctl on Windows printed "The handle is invalid" after
every command, which looked like a failure in the middle of narrating, so the
log script now drops it.

## What did this work change about who I want to be as a software developer?

In crit 9 I said I wanted to keep looking at what I have shipped. This week
showed me that looking only works while I am there. At the crit, and after
it, most of what happens in the garden will happen when I am not watching. I
want to build software that can tell me afterwards what happened, and to
decide that while I am building it, not after something has gone wrong.
Deciding what the log records turned out to be a design decision like any
other: it has to say enough to follow one person, and nothing that would let
a reader become them.
