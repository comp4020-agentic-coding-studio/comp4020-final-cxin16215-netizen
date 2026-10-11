# Crit 9 reflection

## What was the breakthrough that moved the work forward?

I expected the hard part to be the transport — it wasn't; server-sent events
on top of the stack from ADR 1 were almost mechanical. The breakthrough was
realising the actual decision crit 9 was asking for wasn't "how do changes
reach everyone," it was "what does seeing each other even mean here," and
that the garden had already answered it in `README.md`: a picture, not a
dashboard. That ruled out a presence counter or a list of names before I'd
written any server code, and pointed straight at light and colour arriving
instead.

The second breakthrough was a bug I didn't expect: specifying "a flower
reaches everyone within a second" as a test before writing the push code
surfaced a second, unrelated race. The page opens its heartbeat and its event
stream at the same instant, and without a cookie yet, each was handed its own
identity — a lone visitor could count as two people. I only found it because
a screenshot said "2 people here" for one headless page, which looked wrong
enough to chase.

## What did this work change about who I want to be as a software developer?

Crit 8 taught me to check the case where ideal conditions are missing. This
taught me to also check the case where two things I assumed were sequential
are actually racing — the identity bug only existed because two requests
left at once, which never happens if you test by hand, one click at a time.
