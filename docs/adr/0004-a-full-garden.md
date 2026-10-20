# 4. A full garden lets its oldest flower wither

Status: accepted, week 11 (crit 10)

## Context

The page holds 140 planted flowers (ADR 1, README). Until now the 141st
sowing was refused with "every spot holds a planted flower", and README listed
what should happen instead as still open. A day before crit 10 the live garden
held 123, so a pod of four sowing at the crit would hit the wall within
minutes, and the one thing the garden lets a stranger do would stop working at
the moment it is being judged.

Of those 123, 121 had been in the ground longer than a day and 25 longer than
400 hours; the garden's care stood at 0.02, because nearly every visitor came
alone.

## Options

- **Refuse once full (what it did).** Keeps every trace for ever, and turns
  every later visitor away for ever. A garden that "asks for nothing" but
  answers a newcomer with no is the worse break of the README.
- **Raise the cap.** Buys time, not an answer, and the page draws every
  planted flower as live SVG on a phone; 140 was chosen for what it can carry.
- **The flower with the least nourishment withers.** The image I wanted. But
  nourishment here is time spent together since a flower went in (`warmth -
  warmthAt`), shared by every flower alive at once, so the flower that has had
  least is always the newest. Taken literally, the rule withers the flower
  someone sowed a minute ago, which is the opposite of the point.
- **The oldest withers (chosen).** The flower that has had its seasons gives
  way to the newcomer's. The picture is a flower that has run out of strength:
  it browns, droops and is gone over a few seconds, on every screen at once.
  The rule underneath is age, and this ADR says so rather than dressing age up
  as nourishment.

## Decision

Once 140 planted flowers stand, each new sowing withers the oldest planted
flower that has lived at least one garden year (`YEAR_MS`, eight minutes),
in the same SQLite transaction as the sowing. If all 140 are younger than
that, the sowing is refused with `409 full`, which takes a dozen people sowing
continuously to reach.

- The withered flower is not deleted: its row keeps `gone_at`, so the record
  of who sowed what survives, and it counts towards nothing after (presence,
  the cap, the page). The per-visitor limit still counts it, so withering
  isn't a way round the limit.
- Everyone listening hears `withered` with the flower's id, before the
  `sown` that replaces it; a page that reconnects drops any planted flower
  the server no longer lists.
- The log writes `event=wither visitor=<planter's hash> flower=<id> for=<new id>
  age=<hours>`, so the narration can say whose flower made way for whose.
- Under `prefers-reduced-motion`, or for a flower still a seed, it simply goes.

## What it costs

- **"Nobody can remove it" is now "nobody but time".** No person can remove a
  flower, but the garden does, and the first people to come are the first to
  lose theirs. A visitor who returns after a busy week may find their flower
  gone, with nothing to tell them it happened.
- **Floods push out the old.** Cookies are free (ADR 3), so someone scripting
  fresh identities could wither every flower older than eight minutes. The
  year-long floor stops it reaching anything recent, and the log shows it as a
  run of `new` and `wither` lines, but it isn't prevented.
- **Age isn't merit.** A flower that came up with company and one sown alone
  that never grew go in the same order. Weighting by how much each had grown
  was considered and set aside: growth is shared, so it would mostly reorder
  flowers sown at nearly the same time, for a rule nobody watching could see.
