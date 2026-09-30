# 1. Node, Hono and SQLite on one machine

Status: accepted, week 9 (crit 8)

## Context

The garden has to be multi-user, real-time and persistent, and it runs on what
the course fixes in `fly.toml`: one shared-cpu-1x machine with 256 MB, one
volume at `/data`, no database server beside it.

The client already exists and decides a lot. The visual prototype is one page
that paints the whole garden itself (SVG layers, canvas-painted day backdrops,
its own animation loop). It needs a server for very little: hand out an
anonymous identity, store who planted what where, say how many people are
around, and from crit 9 push changes to everyone watching. It has no pages to
compose and no components to share.

The server's state is small and hot: a few hundred flowers, the visitors seen
in the last hour, and one number for how much time people have spent together.
Presence changes every few seconds and has to be read by every request.

## Options

- **Node 24, Hono, `node:sqlite`.** Node 24 runs TypeScript directly by
  stripping the types, so there is no build step to fall out of step with what
  deploys. Hono is a small router with cookie helpers and a Node adapter.
  `node:sqlite` is built in: one file on the volume, synchronous queries, no
  native module to compile in the image. Server-sent events for crit 9 are
  plain HTTP responses that Hono can stream.
- **Plain `node:http` and `node:sqlite`, no framework.** No dependencies at
  all, and nothing hidden. It means hand-writing routing, JSON body limits,
  cookie parsing and static file serving, which is where small bugs live and
  none of which is what this project is about.
- **Astro in server mode with the Node adapter.** The course default for the
  static half. Its strength is composing pages from components, and this app
  has one page that draws itself; the adapter and build would add a compile
  step and a heavier image for no gain the garden can use.

## Decision

Node 24 with Hono and `node:sqlite`, one process, the database at
`$DATA_DIR/garden.db` (`/data` on Fly). The server serves the garden page as a
static file, renders `README.md` at `/readme/`, and exposes a small JSON API.
Real-time arrives in crit 9 as server-sent events from the same process.

## What it costs

- One process on one machine is the whole design: presence and the push
  channel live in its memory, so it can never run as two machines without a
  rethink. The course setup rules out a second machine anyway.
- `node:sqlite` is marked release-candidate in Node 24; the API could shift in
  a later major. It is used through one small module, so a swap is contained.
- Type stripping only accepts erasable TypeScript: no enums, no namespaces, no
  parameter properties. `pnpm typecheck` covers the server so the rule is
  enforced rather than remembered.
- Hono is a dependency the image carries and the lockfile pins, and one more
  thing whose behaviour has to be learned rather than read off `node:http`.
