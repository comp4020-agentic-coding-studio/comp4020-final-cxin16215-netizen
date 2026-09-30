import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
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

app.get("/api/garden", (c) => c.json(store.garden(c.get("visitor"), Date.now())));
app.post("/api/presence", (c) => c.json(store.heartbeat(c.get("visitor"), Date.now())));

app.post("/api/flowers", bodyLimit({ maxSize: 1024 }), async (c) => {
  const sowing = validSowing(await c.req.json().catch(() => null));
  if (!sowing) return c.json({ error: "the garden can't grow that there" }, 400);
  const visitor = c.get("visitor");
  const now = Date.now();
  if (store.sownBy(visitor, now - SOW_LIMIT.windowMs) >= SOW_LIMIT.count) {
    return c.json({ error: "give these a moment to take root" }, 429);
  }
  if (store.sownCount() >= MAX_SOWN) return c.json({ error: "every spot holds a planted flower" }, 409);
  return c.json({ flower: store.sow(visitor, sowing, now) }, 201);
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
