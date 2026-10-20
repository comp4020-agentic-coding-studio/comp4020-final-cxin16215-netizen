import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { events, open, scratch, sow, stranger, type Scratch } from "./scratch.ts";

// The garden keeps a log of who did what, so whoever runs it can say what happened without being in the
// room: one key=value line per thing a visitor does, printed for `flyctl logs` and kept in a table on the
// volume so it outlives the machine. A visitor appears in it only as a short hash of their cookie, never
// the cookie itself: the cookie is the identity, and anyone who reads it can sow as that person.
// Each test runs a garden of its own (spec/scratch.ts), since the log is only visible from beside it.
const gardens: Scratch[] = [];
const start = async (dir?: string): Promise<Scratch> => {
  const g = await scratch({ dir });
  gardens.push(g);
  return g;
};
afterEach(async () => {
  for (const g of gardens.splice(0).reverse()) await g.dispose();
});

const secret = (cookie: string): string => cookie.split("=")[1];
const hash = (cookie: string): string => createHash("sha256").update(secret(cookie)).digest("hex").slice(0, 8);
const until = async (check: () => boolean, within = 2000): Promise<void> => {
  for (const end = Date.now() + within; !check(); ) {
    if (Date.now() > end) throw new Error("the log never showed it");
    await new Promise((r) => setTimeout(r, 20));
  }
};

it("writes a line for each thing a visitor does: when, what, who, and how it went", async () => {
  const g = await start();
  const a = await stranger(g);
  const page = await open(g, a);
  expect((await sow(g, a, { species: "poppy", x: 612.5, y: 700 })).status).toBe(201);
  expect((await sow(g, a, { species: "poppy", x: 500, y: 100 })).status).toBe(400);
  page.close();
  await until(() => events(g).some((e) => e.event === "leave"), 10_000);

  const mine = events(g).filter((e) => e.visitor === hash(a));
  expect(mine.map((e) => e.event)).toEqual(["new", "arrive", "sow", "sow", "leave"]);
  for (const e of mine) {
    expect(new Date(e.t).toISOString(), "every line says when").toBe(e.t);
    expect(e.result).toMatch(/^(ok|refused)$/);
  }
  expect(mine[2]).toMatchObject({ result: "ok", species: "poppy", x: "612.5", y: "700" });
  expect(mine[3], "a refusal says why").toMatchObject({ result: "refused", reason: "sky" });
  expect(mine[4]).toMatchObject({ result: "ok", how: "closed" });
});

it("tells two people apart, and the same person apart from nobody", async () => {
  const g = await start();
  const a = await stranger(g);
  const b = await stranger(g);
  await sow(g, a, { species: "tulip", x: 300, y: 700 });
  await sow(g, b, { species: "lily", x: 900, y: 740 });

  const sown = events(g).filter((e) => e.event === "sow");
  expect(sown.map((e) => e.visitor)).toEqual([hash(a), hash(b)]);
  expect(hash(a)).not.toBe(hash(b));
  for (const e of sown) expect(e.visitor, "a visitor is eight hex characters of a hash").toMatch(/^[0-9a-f]{8}$/);
});

it("counts someone with two tabs open as arriving once and leaving once", async () => {
  const g = await start();
  const a = await stranger(g);
  const one = await open(g, a);
  const two = await open(g, a);
  one.close();
  await new Promise((r) => setTimeout(r, 300));
  expect(events(g).filter((e) => e.event === "leave"), "closing one of two tabs isn't leaving").toEqual([]);
  two.close();
  await until(() => events(g).some((e) => e.event === "leave"), 10_000);
  expect(events(g).filter((e) => e.event === "arrive")).toHaveLength(1);
});

it("logs refusals with their reasons, including attempts to change a flower", async () => {
  const g = await start();
  const a = await stranger(g);
  await sow(g, a, { species: "cactus", x: 500, y: 700 });
  await sow(g, a, { species: "poppy", x: "far", y: 700 });
  await sow(g, a, "not json");
  await fetch(g.url("/api/flowers/1"), { method: "DELETE", headers: { cookie: a } });
  await fetch(g.url("/api/flowers/1"), { method: "PUT", headers: { cookie: a } });

  const refused = events(g).filter((e) => e.result === "refused");
  expect(refused.map((e) => `${e.event}:${e.reason}`)).toEqual([
    "sow:not-a-species",
    "sow:not-a-place",
    "sow:not-json",
    "edit:no-edits",
    "edit:no-edits",
  ]);
  for (const e of refused) expect(e.visitor).toBe(hash(a));
});

it("never prints or keeps a visitor's cookie", async () => {
  const g = await start();
  const a = await stranger(g);
  const b = await stranger(g);
  const pa = await open(g, a);
  const pb = await open(g, b);
  await sow(g, a, { species: "cosmos", x: 420, y: 710 });
  await sow(g, b, { species: "cosmos", x: 100, y: 100 });
  await fetch(g.url(`/api/flowers/${secret(a)}`), { method: "DELETE", headers: { cookie: b } });
  pa.close();
  pb.close();
  await until(() => events(g).filter((e) => e.event === "leave").length === 2, 10_000);

  const printed = g.printed();
  const kept = JSON.stringify(g.kept());
  for (const cookie of [a, b]) {
    expect(printed).toContain(hash(cookie));
    expect(printed, "the cookie is the identity; printing it hands it out").not.toContain(secret(cookie));
    expect(kept, "nor is it kept in the log table").not.toContain(secret(cookie));
  }
});

it("keeps the log on the volume, so it is still there after a restart", async () => {
  const first = await start();
  const a = await stranger(first);
  await sow(first, a, { species: "marigold", x: 640, y: 720 });
  await first.stop();

  const again = await start(first.dir);
  const kept = again.kept();
  const sown = kept.find((r) => r.event === "sow" && r.visitor === hash(a));
  expect(sown, "the sowing from before the restart").toMatchObject({ result: "ok" });
  expect(kept.filter((r) => r.event === "start"), "both starts are in it").toHaveLength(2);
  // what is kept is what was printed, line for line
  expect(first.printed()).toContain(String(sown!.line));
});

// Windows has no SIGTERM to send a process: kill() ends it outright, so this runs where Fly does
it.skipIf(process.platform === "win32")("says who was still there when the machine stops", async () => {
  const g = await start();
  const a = await stranger(g);
  await open(g, a);
  await g.stop("SIGINT");

  const last = events(g).slice(-2);
  expect(last[0]).toMatchObject({ event: "leave", visitor: hash(a), how: "shutdown" });
  expect(last[1]).toMatchObject({ event: "stop", result: "ok" });
});
