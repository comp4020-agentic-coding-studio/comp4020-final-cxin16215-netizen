import { expect, inject, it } from "vitest";
import { GROUND, MAX_SOWN, SPECIES, WILD, YEAR_MS } from "../server/garden.ts";

// The page draws with its own copy of the numbers the server holds the garden
// to (CLAUDE.md: keep the twin numbers in step). A change to one side that
// misses the other shows a garden the server doesn't keep: a species it turns
// away, ground it won't sow, a year out of step with the wild flowers. This
// reads the page the running app serves and holds the two copies together.
const baseUrl = inject("baseUrl");
const page = async (): Promise<string> => (await fetch(new URL("/", baseUrl))).text();
const pick = (html: string, pattern: RegExp, what: string): string[] => {
  const m = html.match(pattern);
  expect(m, `the page no longer declares ${what} where this test looks`).toBeTruthy();
  return m!.slice(1);
};

it("draws the same species the server grows", async () => {
  const html = await page();
  const [block] = pick(html, /const SPECIES=\[([\s\S]*?)\n\];/, "SPECIES");
  const ids = [...block.matchAll(/\{id:'(\w+)'/g)].map((m) => m[1]);
  expect(ids).toEqual([...SPECIES]);
});

it("sows on the same ground, and holds as many planted flowers", async () => {
  const html = await page();
  expect(pick(html, /const GROUND_X=\[(-?\d+),(-?\d+)\]/, "GROUND_X").map(Number)).toEqual([...GROUND.x]);
  expect(pick(html, /const BAND=\[(\d+),(\d+)\]/, "BAND").map(Number)).toEqual([...GROUND.y]);
  expect(Number(pick(html, /const MAX=(\d+)/, "MAX")[0])).toBe(MAX_SOWN);
});

it("keeps the same wild garden on the same year", async () => {
  const html = await page();
  const [min, max] = pick(html, /WILD=\{min:(\d+),max:(\d+)\}/, "WILD").map(Number);
  expect({ min, max }).toEqual({ ...WILD });
  const [season, seasons] = pick(html, /SEASON_MS=(\d+),YEAR_MS=(\d+)\*SEASON_MS/, "YEAR_MS").map(Number);
  expect(season * seasons).toBe(YEAR_MS);
});
