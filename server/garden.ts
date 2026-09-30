// What the server holds the garden to: the species it grows, the ground they
// grow on, how presence is counted and how time together turns into growth.
// The page draws with the same numbers (public/index.html), so a change here
// needs its twin there.

export const SPECIES = [
  "poppy",
  "tulip",
  "cosmos",
  "bell",
  "lavender",
  "forget",
  "sunflower",
  "marigold",
  "lily",
] as const;
export type Species = (typeof SPECIES)[number];

// the planting band in the page's world units: wider than any screen shows,
// and never the sky
export const GROUND = { x: [-200, 1400], y: [664, 752] } as const;

// the page holds 140 plants; wild ones make room for planted ones, but a
// garden of nothing but planted flowers is full
export const MAX_SOWN = 140;

// how much one visitor can sow in ten minutes
export const SOW_LIMIT = { count: 12, windowMs: 10 * 60_000 };

// someone is here until a while after their last heartbeat (the page sends
// one every 15 seconds)...
export const HERE_MS = 40_000;
// ...and warmth for a while after that: company fades with a six-minute time
// constant, so a stranger who arrives just after someone left isn't alone
export const ECHO_TAU_MS = 6 * 60_000;
export const ECHO_WINDOW_MS = 60 * 60_000;

export type Presence = { here: number; echo: number; people: number };

export function presence(lastSeen: number[], now: number): Presence {
  let here = 0;
  let echo = 0;
  for (const t of lastSeen) {
    const age = now - t;
    if (age < HERE_MS) here++;
    else if (age < ECHO_WINDOW_MS) echo += Math.exp(-(age - HERE_MS) / ECHO_TAU_MS);
  }
  // the page brings a colour family back at each whole person, from 2 to 5
  const people = Math.min(5, Math.max(1, Math.round(here + echo)));
  return { here, echo: Math.round(echo * 100) / 100, people };
}

// Time spent together, in person-seconds beyond the first person, is what
// makes the garden grow. It is integrated between heartbeats and never across
// a gap longer than one, so a garden nobody visited overnight doesn't wake up
// grown.
export function warm(warmth: number, since: number, now: number, people: number): number {
  const dt = Math.max(0, Math.min(now - since, HERE_MS)) / 1000;
  return warmth + dt * Math.max(0, people - 1);
}

export type Sowing = { species: Species; x: number; y: number };

export function validSowing(body: unknown): Sowing | null {
  if (typeof body !== "object" || body === null) return null;
  const { species, x, y } = body as Record<string, unknown>;
  if (!SPECIES.includes(species as Species)) return null;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < GROUND.x[0] || x > GROUND.x[1] || y < GROUND.y[0] || y > GROUND.y[1]) return null;
  return { species: species as Species, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
