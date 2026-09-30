import { expect, inject, it } from "vitest";
import { CARE_TAU_MS, WILD, YEAR_MS, tend, wildFor, wildNow } from "../server/garden.ts";

// A garden nobody tends slowly goes back to the wild: fewer wild flowers come
// through each winter, and planted flowers sleep as seeds until people return.
// The rules are pure functions of the garden's state and the clock, checked
// here directly; the running app has to report them.
const baseUrl = inject("baseUrl");

it("company tends the garden, and neglect lets it go", () => {
  const tended = tend(0.5, 0, 20_000, 3);
  expect(tended).toBeGreaterThan(0.5);
  expect(tend(0.5, 0, 20_000, 1), "one person alone doesn't tend it").toBeLessThanOrEqual(0.5);

  const forgotten = tend(0.5, 0, CARE_TAU_MS, 0);
  expect(forgotten).toBeLessThan(0.5);
  expect(forgotten, "neglect fades the garden, it never wipes it out at once").toBeGreaterThan(0.1);
  expect(tend(1, 0, 60_000, 5), "care has a ceiling").toBeLessThanOrEqual(1);
});

it("keeps some wild garden however long it is left", () => {
  expect(wildFor(0)).toBe(WILD.min);
  expect(wildFor(1)).toBe(WILD.max);
  expect(WILD.min).toBeGreaterThan(0);
});

it("loses wild flowers only at the turn of the year, but gains them any time", () => {
  const start = 3 * YEAR_MS + 1000;
  const lush = wildNow(80, 3, 0.9, start);

  const midYear = wildNow(lush.wild, lush.year, 0.1, start + YEAR_MS / 2);
  expect(midYear.wild, "a bad summer doesn't kill what is already up").toBe(lush.wild);

  const nextSpring = wildNow(midYear.wild, midYear.year, 0.1, start + YEAR_MS);
  expect(nextSpring.wild, "fewer come back after an untended winter").toBe(wildFor(0.1));

  const tendedAgain = wildNow(nextSpring.wild, nextSpring.year, 0.8, start + YEAR_MS + 5000);
  expect(tendedAgain.wild, "company brings wild flowers up straight away").toBe(wildFor(0.8));
});

it("tells every visitor how tended the garden is", async () => {
  const g = (await (await fetch(new URL("/api/garden", baseUrl))).json()) as {
    care: number;
    wild: number;
    wildNext: number;
  };
  expect(g.care).toBeGreaterThanOrEqual(0);
  expect(g.care).toBeLessThanOrEqual(1);
  expect(g.wild).toBeGreaterThanOrEqual(WILD.min);
  expect(g.wild).toBeLessThanOrEqual(WILD.max);
  expect(g.wildNext).toBe(wildFor(g.care));
});
