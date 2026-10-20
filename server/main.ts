import { serve } from "@hono/node-server";
import { Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { marked } from "marked";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { SOW_LIMIT, validSowing } from "./garden.ts";
import { openLog } from "./log.ts";
import { openStore } from "./store.ts";

const port = Number(process.env.PORT ?? 8080);
const dataDir = process.env.DATA_DIR ?? "data";
// A test can move the garden's clock on by writing how far into GARDEN_CLOCK_FILE (spec/scratch.ts).
// Unset, as it is on Fly, the garden keeps real time.
const clockFile = process.env.GARDEN_CLOCK_FILE;
const clock = (): number => Date.now() + (clockFile ? Number(readFileSync(clockFile, "utf8")) || 0 : 0);
const store = openStore(dataDir);
const log = openLog(dataDir, clock);
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../public/index.html");
const readme = readmePage(read("../README.md"));

type Env = { Variables: { visitor: string } };
const app = new Hono<Env>();

// A visitor is whoever holds this cookie. A first request is handed one, so a
// stranger needs nothing to begin, and coming back with it is coming back as
// the same person. The page hands it out too: it opens by asking several
// things at once, and each would otherwise be given an identity of its own.
const VISITOR = /^[A-Za-z0-9_-]{22}$/;
const identify: MiddlewareHandler<Env> = async (c, next) => {
  let visitor = getCookie(c, "gid");
  if (!visitor || !VISITOR.test(visitor)) {
    // 128 random bits from the OS's secure generator: the log names visitors by a short hash of this, and
    // a guessable cookie would let anyone work back from the hash to the identity
    visitor = randomBytes(16).toString("base64url");
    log.write({ event: "new", visitor, result: "ok", path: c.req.path });
    setCookie(c, "gid", visitor, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 365 * 24 * 3600,
      // Fly terminates TLS in front of the app, so the scheme arrives as a header
      secure: c.req.header("x-forwarded-proto") === "https",
    });
  }
  c.set("visitor", visitor);
  await next();
};
app.use("/", identify);
app.use("/api/*", identify);

app.get("/", (c) => c.html(page));
app.get("/readme", (c) => c.redirect("/readme/", 301));
app.get("/readme/", (c) => c.html(readme));

// Everyone with the page open listens here and hears what changes as it happens: a flower sown, someone
// arriving, the garden's tending moving on. A listener hears a flower as `mine` only if they planted it,
// and nobody hears who planted the rest.
type Listener = { visitor: string; send: (event: string, data: unknown) => void };
const listeners = new Set<Listener>();
const tell = (event: string, data: (l: Listener) => unknown): void => {
  for (const l of listeners) l.send(event, data(l));
};
const tellPresence = (): void => {
  const state = store.state(clock());
  tell("presence", () => state);
};

// For the log, someone arrives when their first page starts listening and leaves when their last one
// stops: closing the tab, or hiding it, since a hidden page stops listening. A second tab is neither. This
// is the plain fact of who has the garden open; the company the garden grows by fades more slowly
// (ADR 2), so each line also says how many people the garden is counting.
const open = new Map<string, { pages: number; since: number }>();
const arrive = (visitor: string): void => {
  const o = open.get(visitor);
  if (o) return void o.pages++;
  const now = clock();
  open.set(visitor, { pages: 1, since: now });
  log.write({ event: "arrive", visitor, result: "ok", open: open.size, people: store.state(now).people });
};
const leave = (visitor: string, how: "closed" | "shutdown"): void => {
  const o = open.get(visitor);
  if (!o || --o.pages > 0) return;
  open.delete(visitor);
  const now = clock();
  const stayed = `${Math.round((now - o.since) / 1000)}s`;
  log.write({ event: "leave", visitor, result: "ok", how, stayed, open: open.size, people: store.state(now).people });
};
// company fades on its own as people leave, so the listeners hear how things stand now and then as well
setInterval(() => listeners.size && tellPresence(), 10_000).unref();
// a comment every so often keeps quiet connections from being dropped along the way
const PING_MS = 20_000;

app.get("/api/garden", (c) => c.json(store.garden(c.get("visitor"), clock())));
app.post("/api/presence", (c) => {
  const state = store.heartbeat(c.get("visitor"), clock());
  tellPresence();
  return c.json(state);
});

app.get("/api/events", (c) => {
  const visitor = c.get("visitor");
  return streamSSE(c, async (stream) => {
    const me: Listener = {
      visitor,
      send: (event, data) => void stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {}),
    };
    const gone = new Promise<void>((resolve) => stream.onAbort(resolve));
    listeners.add(me);
    // opening the page is arriving: everyone hears it, the newcomer included
    store.heartbeat(visitor, clock());
    arrive(visitor);
    tellPresence();
    try {
      while (!stream.aborted) {
        await Promise.race([stream.sleep(PING_MS), gone]);
        if (!stream.aborted) await stream.write(": ping\n\n");
      }
    } finally {
      listeners.delete(me);
      // a machine stopping has already said who was still here
      if (!stopping) leave(visitor, "closed");
    }
  });
});

const tooBig: MiddlewareHandler<Env> = bodyLimit({
  maxSize: 1024,
  onError: (c) => {
    log.write({ event: "sow", visitor: c.get("visitor"), result: "refused", reason: "too-big" });
    return c.json({ error: "the garden can't grow that there" }, 413);
  },
});
app.post("/api/flowers", tooBig, async (c) => {
  const visitor = c.get("visitor");
  const refuse = (reason: string, status: 400 | 409 | 429, error: string) => {
    log.write({ event: "sow", visitor, result: "refused", reason, sown: store.sownCount() });
    return c.json({ error }, status);
  };
  const body: unknown = await c.req.json().catch(() => undefined);
  if (body === undefined) return refuse("not-json", 400, "the garden can't grow that there");
  const sowing = validSowing(body);
  if ("refused" in sowing) return refuse(sowing.refused, 400, "the garden can't grow that there");
  const now = clock();
  if (store.sownBy(visitor, now - SOW_LIMIT.windowMs) >= SOW_LIMIT.count) {
    return refuse("too-many", 429, "give these a moment to take root");
  }
  const sown = store.sow(visitor, sowing, now);
  // only a garden whose planted flowers are all in their first year has no room
  if (!sown) return refuse("full", 409, "every flower here is still in its first year");
  const { flower, withered } = sown;
  if (withered) {
    log.write({
      event: "wither",
      visitor: withered.visitor,
      result: "ok",
      flower: withered.id,
      for: flower.id,
      age: `${Math.round((now - withered.plantedAt) / 3600_000)}h`,
    });
  }
  log.write({
    event: "sow",
    visitor,
    result: "ok",
    flower: flower.id,
    species: flower.species,
    x: flower.x,
    y: flower.y,
    sown: store.sownCount(),
    people: store.state(now).people,
  });
  // the withered one goes first, so no page ever holds more than the garden does
  if (withered) tell("withered", () => ({ id: withered.id }));
  tell("sown", (l) => ({ flower: { ...flower, mine: l.visitor === visitor } }));
  tellPresence();
  return c.json({ flower }, 201);
});

// Nobody can remove, move or replace a flower, its planter included: there is no route that would. A try
// is logged, so an attempt to change someone's flower shows up as who tried it.
app.on(["PUT", "PATCH", "DELETE"], ["/api/flowers", "/api/flowers/*"], (c) => {
  log.write({ event: "edit", visitor: c.get("visitor"), result: "refused", reason: "no-edits", method: c.req.method });
  return c.json({ error: "a flower stays where it was sown" }, 405, { allow: "GET, POST" });
});

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  log.write({ event: "start", result: "ok", port: info.port, flowers: store.sownCount(), machine: process.env.FLY_MACHINE_ID });
});

// Fly stops an idle machine with SIGINT (and a deploy or restart with SIGTERM). Whoever still has the
// page open is logged as leaving because of it, then the stop itself, then the databases close cleanly.
// A machine that dies without a signal leaves a start with no stop before it.
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    for (const [visitor, o] of open) {
      o.pages = 1;
      leave(visitor, "shutdown");
    }
    log.write({ event: "stop", result: "ok", signal });
    server.close();
    store.close();
    log.close();
    process.exit(0);
  });
}

function readmePage(md: string): string {
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>About the garden</title>
<style>
  :root{--paper:#f2ece1;--ink:#2f2a26;--ink-soft:#6e665e;--line:rgba(47,42,38,.14)}
  body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.65 "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif}
  main{max-width:40rem;margin:0 auto;padding:40px 20px 80px}
  h1,h2,h3{line-height:1.25;font-weight:normal}
  h1{font-size:2rem}h2{font-size:1.35rem;margin-top:2.2em}
  a{color:inherit}
  nav{font-size:.9rem;color:var(--ink-soft)}
  blockquote{margin:1em 0;padding-left:1em;border-left:2px solid var(--line);color:var(--ink-soft)}
  code{font-size:.9em}
  img{max-width:100%}
</style>
</head>
<body>
<main>
<nav><a href="/">Back to the garden</a></nav>
${marked.parse(md, { async: false })}
</main>
</body>
</html>`;
}
