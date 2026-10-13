# Crit 9 reflection

## What was the breakthrough that moved the work forward?

Making the garden live turned out to be the easy part: server-sent events on
the stack from ADR 1 were almost mechanical, and writing "a flower reaches
everyone within a second" as a test first even caught a race where a lone
visitor counted as two people.

The breakthrough came a week after deploying, when I opened the live garden
and almost nothing anyone had sown had come up. Every test was green. The
neglect rule I wrote in crit 8 was doing exactly what it said: nearly every
visitor came alone, care never rose, and all 66 planted flowers had been
asleep as seeds for days. Nothing was broken, but the garden was breaking its
own promise that a stranger's flower comes up. I changed the rule so that
neglect leaves a sparse garden, never a bare one.

## What did this work change about who I want to be as a software developer?

In crit 8 I said I wanted to check what someone sees when ideal conditions
are missing. This week showed me that the spec can't tell me that. Only the
deployed app, after real people have used it, can. I want to keep looking at
what I've shipped, not only at whether it passes.

It also changed how I ask for things. When the garden felt slow, I had the
agent measure before changing anything, and the cause wasn't where I would
have guessed. When I said the 5x seasons were still dragging, the agent found
the clock was right and asked what I was seeing, and the real problem was
something I hadn't put into words. I want to describe what I see, not the fix
I imagine.
