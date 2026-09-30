import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { marked } from "marked";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { MAX_SOWN, SOW_LIMIT, validSowing } from "./garden.ts";
import { openStore } from "./store.ts";

const port = Number(process.env.PORT ?? 8080);
const store = openStore(process.env.DATA_DIR ?? "data");
const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../public/index.html");
const readme = readmePage(read("../README.md"));

type Env = { Variables: { visitor: string } };
const app = new Hono<Env>();

// A visitor is whoever holds this cookie. A first request is handed one, so a
// stranger needs nothing to begin, and coming back with it is coming back as
// the same person.
const VISITOR = /^[A-Za-z0-9_-]{22}$/;
app.use("/api/*", async (c, next) => {
  let visitor = getCookie(c, "gid");
  if (!visitor || !VISITOR.test(visitor)) {
    visitor = randomBytes(16).toString("base64url");
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
});

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
  const state = store.state(Date.now());
  tell("presence", () => state);
};
// company fades on its own as people leave, so the listeners hear how things stand now and then as well
setInterval(() => listeners.size && tellPresence(), 10_000).unref();
// a comment every so often keeps quiet connections from being dropped along the way
const PING_MS = 20_000;

app.get("/api/garden", (c) => c.json(store.garden(c.get("visitor"), Date.now())));
app.post("/api/presence", (c) => {
  const state = store.heartbeat(c.get("visitor"), Date.now());
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
    store.heartbeat(visitor, Date.now());
    tellPresence();
    while (!stream.aborted) {
      await Promise.race([stream.sleep(PING_MS), gone]);
      if (!stream.aborted) await stream.write(": ping\n\n");
    }
    listeners.delete(me);
  });
});

app.post("/api/flowers", bodyLimit({ maxSize: 1024 }), async (c) => {
  const sowing = validSowing(await c.req.json().catch(() => null));
  if (!sowing) return c.json({ error: "the garden can't grow that there" }, 400);
  const visitor = c.get("visitor");
  const now = Date.now();
  if (store.sownBy(visitor, now - SOW_LIMIT.windowMs) >= SOW_LIMIT.count) {
    return c.json({ error: "give these a moment to take root" }, 429);
  }
  if (store.sownCount() >= MAX_SOWN) return c.json({ error: "every spot holds a planted flower" }, 409);
  const flower = store.sow(visitor, sowing, now);
  tell("sown", (l) => ({ flower: { ...flower, mine: l.visitor === visitor } }));
  tellPresence();
  return c.json({ flower }, 201);
});

const server = serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`garden listening on ${info.address}:${info.port}`);
});

// Fly stops an idle machine with SIGTERM (or SIGINT); close the database cleanly first
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close();
    store.close();
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
