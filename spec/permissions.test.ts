import { afterEach, expect, inject, it } from "vitest";
import { SOW_LIMIT } from "../server/garden.ts";
import { open, scratch, sow, stranger, type Scratch } from "./scratch.ts";

// What each visitor may do and see, decided by the server (docs/adr/0003-who-may-do-what.md), checked by
// asking the HTTP API directly the way someone skipping the page would: the page's own limits are a
// courtesy, these are the rules. The running app answers most; the ones that need a clock moved on, or a
// garden filled, run a scratch garden of their own (spec/scratch.ts).
const baseUrl = inject("baseUrl");
const url = (path: string): URL => new URL(path, baseUrl);

type Flower = { id: number; species: string; x: number; y: number; mine: boolean } & Record<string, unknown>;
type Garden = { flowers: Flower[] } & Record<string, unknown>;

async function visitor(): Promise<string> {
  const cookie = (await fetch(url("/"))).headers.get("set-cookie");
  expect(cookie, "a first visit is handed an identity").toBeTruthy();
  return cookie!.split(";")[0];
}
const plant = async (cookie: string, body: unknown): Promise<Response> =>
  fetch(url("/api/flowers"), {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
const garden = async (cookie: string): Promise<Garden> =>
  (await (await fetch(url("/api/garden"), { headers: { cookie } })).json()) as Garden;

const gardens: Scratch[] = [];
afterEach(async () => {
  for (const g of gardens.splice(0)) await g.dispose();
});

it("refuses a flower sown in the sky, off the ground, or of a kind it doesn't grow", async () => {
  const me = await visitor();
  for (const body of [
    { species: "poppy", x: 600, y: 200 },
    { species: "poppy", x: 600, y: 800 },
    { species: "poppy", x: 5000, y: 700 },
    { species: "poppy", x: Number.MAX_VALUE, y: 700 },
    { species: "cactus", x: 600, y: 700 },
    { species: "poppy", x: 600 },
    { species: "poppy", x: 600, y: 700, visitor: "someone-else", id: -7 },
  ]) {
    const res = await plant(me, body);
    if (body.visitor) {
      // extra fields are ignored, never trusted: the planter is whoever holds the cookie
      expect(res.status).toBe(201);
      const { flower } = (await res.json()) as { flower: Flower };
      expect(flower.id).not.toBe(-7);
      expect(flower).not.toHaveProperty("visitor");
    } else expect(res.status, JSON.stringify(body)).toBe(400);
  }
});

it("has no way to remove, move or replace a flower", async () => {
  const me = await visitor();
  const { flower } = (await (await plant(me, { species: "bell", x: 700, y: 720 })).json()) as { flower: Flower };
  for (const method of ["DELETE", "PUT", "PATCH"]) {
    for (const path of [`/api/flowers/${flower.id}`, "/api/flowers"]) {
      const res = await fetch(url(path), {
        method,
        headers: { "content-type": "application/json", cookie: me },
        body: method === "DELETE" ? undefined : JSON.stringify({ species: "poppy", x: 0, y: 700 }),
      });
      expect([404, 405], `${method} ${path} answered ${res.status}`).toContain(res.status);
    }
  }
  // not even its own planter can: the flower is where it was
  expect((await garden(me)).flowers.find((f) => f.id === flower.id)).toMatchObject({ species: "bell", x: 700, y: 720 });
});

it("never tells one visitor another's identity", async () => {
  const a = await visitor();
  const b = await visitor();
  const { flower } = (await (await plant(a, { species: "forget", x: 820, y: 735 })).json()) as { flower: Flower };
  await fetch(url("/api/presence"), { method: "POST", headers: { cookie: a } });

  const secretOf = (cookie: string): string => cookie.split("=")[1];
  for (const path of ["/api/garden", "/", "/readme/"]) {
    const res = await fetch(url(path), { headers: { cookie: b } });
    const body = await res.text();
    expect(body, `${path} shows b someone else's cookie`).not.toContain(secretOf(a));
    expect(res.headers.get("set-cookie"), "b keeps their own identity").toBeNull();
  }
  const presence = await (await fetch(url("/api/presence"), { method: "POST", headers: { cookie: b } })).text();
  expect(presence).not.toContain(secretOf(a));

  // b sees a's flower, but only that it isn't theirs; a sees it as theirs; neither learns more than that
  const seenByB = (await garden(b)).flowers.find((f) => f.id === flower.id)!;
  const seenByA = (await garden(a)).flowers.find((f) => f.id === flower.id)!;
  expect(seenByB.mine).toBe(false);
  expect(seenByA.mine).toBe(true);
  expect(Object.keys(seenByB).sort(), "a flower carries no owner field").toEqual(Object.keys(seenByA).sort());
  expect(Object.keys(seenByB)).not.toEqual(expect.arrayContaining(["visitor"]));
});

it("hands a forged or malformed cookie a fresh identity, never someone else's", async () => {
  const a = await visitor();
  await plant(a, { species: "lavender", x: 150, y: 700 });
  const forged = `gid=${a.split("=")[1].slice(0, -1)}${a.endsWith("A") ? "B" : "A"}`;
  for (const cookie of [forged, "gid=", "gid=../../etc/passwd", `gid=${"x".repeat(200)}`]) {
    const res = await fetch(url("/api/garden"), { headers: { cookie } });
    const g = (await res.json()) as Garden;
    if (cookie !== forged) expect(res.headers.get("set-cookie"), cookie).toMatch(/^gid=[A-Za-z0-9_-]{22};/);
    expect(g.flowers.filter((f) => f.mine), `${cookie.slice(0, 30)} owns nothing`).toEqual([]);
  }
});

it(`lets a visitor sow ${SOW_LIMIT.count} in ten minutes, refuses the next, and lets them sow again later`, async () => {
  const g = await scratch({ clock: true });
  gardens.push(g);
  const me = await stranger(g);
  for (let i = 0; i < SOW_LIMIT.count; i++) {
    expect((await sow(g, me, { species: "poppy", x: 100 + i * 10, y: 700 })).status, `flower ${i + 1}`).toBe(201);
  }
  const thirteenth = await sow(g, me, { species: "poppy", x: 400, y: 700 });
  expect(thirteenth.status).toBe(429);

  // the limit is per visitor: someone else can still sow
  expect((await sow(g, await stranger(g), { species: "tulip", x: 600, y: 700 })).status).toBe(201);

  g.advance(SOW_LIMIT.windowMs - 1000);
  expect((await sow(g, me, { species: "poppy", x: 400, y: 700 })).status, "still inside the ten minutes").toBe(429);
  g.advance(2000);
  expect((await sow(g, me, { species: "poppy", x: 400, y: 700 })).status, "the window has passed").toBe(201);
});

// Company is people with the garden open, and growth is time spent together, so nobody may make company out
// of nothing: a heartbeat sent without the page open (a script, or a page whose stream has closed) says
// nothing about who is here. CLAUDE.md: a way to fake company for everyone is not allowed.
it("counts only people with the garden open as here, never a heartbeat sent by itself", async () => {
  const g = await scratch();
  gardens.push(g);
  const here = async (cookie: string): Promise<number> =>
    ((await (await fetch(g.url("/api/presence"), { method: "POST", headers: { cookie } })).json()) as { here: number }).here;

  const me = await stranger(g);
  const page = await open(g, me);
  try {
    expect(await here(me), "the one person with the page open").toBe(1);
    for (let i = 0; i < 4; i++) {
      expect(await here(await stranger(g)), "a heartbeat from someone without the page open").toBe(1);
    }
    // sowing leaves a flower, but a flower sown without the page open isn't company either
    for (let i = 0; i < 4; i++) {
      expect((await sow(g, await stranger(g), { species: "tulip", x: 200 + i * 40, y: 700 })).status).toBe(201);
    }
    const state = (await (await fetch(g.url("/api/garden"), { headers: { cookie: me } })).json()) as { here: number; people: number };
    expect(state, "nobody was added").toMatchObject({ here: 1, people: 1 });

    const other = await stranger(g);
    const theirs = await open(g, other);
    try {
      expect(await here(me), "a second person opening the garden is company").toBe(2);
    } finally {
      theirs.close();
    }
  } finally {
    page.close();
  }
});
