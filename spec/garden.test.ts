import { expect, inject, it } from "vitest";

// The garden's promises to a stranger, checked against the RUNNING app. A
// visitor is whoever holds the cookie the garden hands out, so a test plays a
// stranger by keeping the cookie it is given, and a second stranger by asking
// for another one.
const baseUrl = inject("baseUrl");
const url = (path: string): URL => new URL(path, baseUrl);

type Flower = { id: number; species: string; x: number; y: number; plantedAt: number; mine: boolean };
type Garden = { now: number; people: number; flowers: Flower[] };

async function stranger(): Promise<string> {
  const res = await fetch(url("/api/garden"));
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie");
  expect(cookie, "a first visit is handed an identity").toBeTruthy();
  return cookie!.split(";")[0];
}

const sow = (cookie: string | null, body: unknown): Promise<Response> =>
  fetch(url("/api/flowers"), {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });

const garden = async (cookie?: string): Promise<Garden> =>
  (await (await fetch(url("/api/garden"), { headers: cookie ? { cookie } : {} })).json()) as Garden;

it("a stranger's flower is still there when they come back, marked as theirs", async () => {
  const me = await stranger();
  const res = await sow(me, { species: "poppy", x: 612.5, y: 700 });
  expect(res.status).toBe(201);
  const { flower } = (await res.json()) as { flower: Flower };

  // coming back is a fresh request carrying nothing but the cookie
  const back = await garden(me);
  expect(back.flowers.find((f) => f.id === flower.id)).toMatchObject({
    species: "poppy",
    x: 612.5,
    y: 700,
    mine: true,
  });
});

it("everyone else sees the flower too, but not as theirs", async () => {
  const planter = await stranger();
  const { flower } = (await (await sow(planter, { species: "lily", x: 300, y: 740 })).json()) as { flower: Flower };

  const other = await garden(await stranger());
  expect(other.flowers.find((f) => f.id === flower.id)).toMatchObject({ species: "lily", mine: false });
});

it("lets a stranger sow on their very first request", async () => {
  const res = await sow(null, { species: "tulip", x: 500, y: 690 });
  expect(res.status).toBe(201);
  expect(res.headers.get("set-cookie"), "the planter is handed an identity to come back with").toBeTruthy();
});

// The page asks for several things at once as it opens (it says it's here and starts listening together).
// If the identity only came with those answers, each would hand out its own, and one newcomer alone would
// count as company. So the page itself hands it out.
it("hands a newcomer their identity with the page, so one person opening it is one person", async () => {
  const res = await fetch(url("/"));
  const cookie = res.headers.get("set-cookie");
  expect(cookie, "the page hands out an identity").toMatch(/^gid=/);
  const me = cookie!.split(";")[0];

  const hello = (): Promise<Response> => fetch(url("/api/presence"), { method: "POST", headers: { cookie: me } });
  const [a, b] = await Promise.all([hello(), hello()]);
  expect(a.headers.get("set-cookie"), "a visitor who has one isn't given another").toBeNull();
  expect(b.headers.get("set-cookie")).toBeNull();
});

it("turns away a flower the garden can't grow", async () => {
  const me = await stranger();
  expect((await sow(me, { species: "cactus", x: 500, y: 700 })).status, "not a species here").toBe(400);
  expect((await sow(me, { species: "poppy", x: 500, y: 100 })).status, "in the sky").toBe(400);
  expect((await sow(me, { species: "poppy", x: "far", y: 700 })).status, "not a place").toBe(400);
});

// being here is having the garden open: the page holds its event stream open for as long as it is showing
const visit = async (cookie: string): Promise<() => void> => {
  const stop = new AbortController();
  const res = await fetch(url("/api/events"), { headers: { cookie, accept: "text/event-stream" }, signal: stop.signal });
  await res.body!.getReader().read();
  return () => stop.abort();
};

it("counts two people in the garden at once as company", async () => {
  const a = await stranger();
  const b = await stranger();
  const leaveA = await visit(a);
  const leaveB = await visit(b);
  try {
    const { people } = (await (await fetch(url("/api/presence"), { method: "POST", headers: { cookie: b } })).json()) as {
      people: number;
    };
    expect(people).toBeGreaterThanOrEqual(2);
  } finally {
    leaveA();
    leaveB();
  }
});
