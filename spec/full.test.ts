import { afterEach, expect, it } from "vitest";
import { MAX_SOWN, SOW_LIMIT, YEAR_MS } from "../server/garden.ts";
import { events, open, scratch, sow, stranger, type Scratch } from "./scratch.ts";

// A full garden still takes a newcomer's flower. The ground holds 140 planted flowers, and once they are
// all there the oldest gives way: it runs out of nourishment and withers, and the new one takes its room.
// Nobody chooses which goes, and none goes before it has lived through a whole garden year, so a flower
// someone sows is always there for at least a year of the garden's time. Only a garden whose 140 are all
// in their first year turns a sowing away. Each test fills a scratch garden of its own (spec/scratch.ts),
// with a clock it can move on.
type Flower = { id: number; species: string; x: number; y: number; mine: boolean };

const gardens: Scratch[] = [];
afterEach(async () => {
  for (const g of gardens.splice(0)) await g.dispose();
});

// sows `n` flowers left to right, a fresh visitor every dozen to stay under the per-visitor limit
async function fill(g: Scratch, n: number, from = 0): Promise<{ ids: number[]; planters: string[] }> {
  const ids: number[] = [];
  const planters: string[] = [];
  let me = "";
  for (let i = 0; i < n; i++) {
    if (i % SOW_LIMIT.count === 0) me = await stranger(g);
    const res = await sow(g, me, { species: "cosmos", x: -200 + ((from + i) % 160) * 10, y: 700 });
    expect(res.status, `flower ${from + i + 1}`).toBe(201);
    ids.push(((await res.json()) as { flower: Flower }).flower.id);
    planters.push(me);
  }
  return { ids, planters };
}
const garden = async (g: Scratch, cookie?: string): Promise<Flower[]> =>
  ((await (await fetch(g.url("/api/garden"), { headers: cookie ? { cookie } : {} })).json()) as { flowers: Flower[] })
    .flowers;

it(`lets the oldest of ${MAX_SOWN} wither to make room for a newcomer's flower`, async () => {
  const g = await scratch({ clock: true });
  gardens.push(g);
  const { ids, planters } = await fill(g, MAX_SOWN);
  g.advance(YEAR_MS + 1000);

  const newcomer = await stranger(g);
  const watcher = await open(g, await stranger(g));
  const res = await sow(g, newcomer, { species: "lily", x: 600, y: 720 });
  expect(res.status, "a full garden still takes a newcomer's flower").toBe(201);
  const { flower } = (await res.json()) as { flower: Flower };

  const now = await garden(g, newcomer);
  expect(now, "the garden still holds 140").toHaveLength(MAX_SOWN);
  expect(now.map((f) => f.id), "the oldest has gone").not.toContain(ids[0]);
  expect(now.find((f) => f.id === flower.id)).toMatchObject({ species: "lily", mine: true });

  // everyone with the page open hears which one went, so their gardens stay the same
  await expect.poll(() => watcher.heard(), { timeout: 1000 }).toMatch(new RegExp(`event: withered\\ndata: \\{"id":${ids[0]}\\}`));
  watcher.close();

  // its planter finds it gone too, and the log says what took its place
  expect((await garden(g, planters[0])).map((f) => f.id)).not.toContain(ids[0]);
  const withered = events(g).find((e) => e.event === "wither");
  expect(withered).toMatchObject({ result: "ok", flower: String(ids[0]), for: String(flower.id) });
  expect(withered!.visitor, "the log names whose flower withered, as a hash").toMatch(/^[0-9a-f]{8}$/);
});

it("withers the oldest first, one for each new flower", async () => {
  const g = await scratch({ clock: true });
  gardens.push(g);
  const { ids } = await fill(g, MAX_SOWN);
  g.advance(YEAR_MS + 1000);
  await fill(g, 3, MAX_SOWN);
  const left = (await garden(g)).map((f) => f.id);
  expect(left).toHaveLength(MAX_SOWN);
  for (const id of ids.slice(0, 3)) expect(left).not.toContain(id);
  expect(left).toContain(ids[3]);
});

it("never lets a flower wither before it has lived a whole garden year", async () => {
  const g = await scratch({ clock: true });
  gardens.push(g);
  const { ids } = await fill(g, MAX_SOWN);
  g.advance(YEAR_MS - 5000);

  const res = await sow(g, await stranger(g), { species: "poppy", x: 600, y: 700 });
  expect(res.status, "every flower is still in its first year").toBe(409);
  expect((await garden(g)).map((f) => f.id)).toEqual(ids);
  expect(events(g).filter((e) => e.event === "sow").at(-1)).toMatchObject({ result: "refused", reason: "full" });
});

it("keeps a withered flower's record, and never counts it again", async () => {
  const g = await scratch({ clock: true });
  gardens.push(g);
  const { ids } = await fill(g, MAX_SOWN);
  g.advance(YEAR_MS + 1000);
  await fill(g, 1, MAX_SOWN);
  await g.stop();

  const again = await scratch({ dir: g.dir, clock: true });
  gardens.push(again);
  const flowers = await garden(again);
  expect(flowers, "a restart doesn't bring it back").toHaveLength(MAX_SOWN);
  expect(flowers.map((f) => f.id)).not.toContain(ids[0]);
  expect(again.kept().some((r) => r.event === "wither"), "the wither is in the kept log").toBe(true);
});
