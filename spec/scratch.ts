import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Some promises can only be checked from beside the server: what it writes in its log, what it still has
// after a restart, what it does ten minutes from now. For those a test starts a garden of its own from
// server/main.ts, on a scratch directory it throws away, and reads what it printed and kept. This runs the
// source rather than the image CI builds, but the image runs these same files.
export type Scratch = {
  dir: string;
  url: (path: string) => URL;
  // everything it has printed so far, stdout and stderr together
  printed: () => string;
  // the rows of its log table, oldest first
  kept: () => Record<string, unknown>[];
  // resolves with the first printed line that matches, or fails once the time is up
  line: (pattern: RegExp, within?: number) => Promise<string>;
  // moves the garden's clock on, for a garden started with `clock: true`
  advance: (ms: number) => void;
  stop: (signal?: NodeJS.Signals) => Promise<void>;
  dispose: () => Promise<void>;
};

// Visiting a scratch garden as a stranger would: a first request is handed an identity, and keeping the
// cookie is coming back as the same person.
export async function stranger(g: Scratch): Promise<string> {
  const cookie = (await fetch(g.url("/"))).headers.get("set-cookie");
  if (!cookie) throw new Error("a first visit wasn't handed an identity");
  return cookie.split(";")[0];
}

export const sow = (g: Scratch, cookie: string | null, body: unknown): Promise<Response> =>
  fetch(g.url("/api/flowers"), {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// Opens the garden's event stream the way a page does and waits until the garden has answered, so the
// visitor is counted as there; the result closes it again, the way closing the tab does.
export async function open(g: Scratch, cookie: string): Promise<{ heard: () => string; close: () => void }> {
  const stop = new AbortController();
  const res = await fetch(g.url("/api/events"), { headers: { cookie, accept: "text/event-stream" }, signal: stop.signal });
  if (res.status !== 200) throw new Error(`the event stream answered ${res.status}`);
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let heard = (await reader.read()).value ?? "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        heard += value;
      }
    } catch {
      // closed
    }
  })();
  return { heard: () => heard, close: () => stop.abort() };
}

// the fields of one printed line: key=value, a value quoted when it holds anything but plain characters
export function fields(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/(\w+)=("(?:[^"\\]|\\.)*"|\S*)/g)) {
    out[m[1]] = m[2].startsWith('"') ? (JSON.parse(m[2]) as string) : m[2];
  }
  return out;
}

// the garden's own log lines among everything it printed, as fields
export const events = (g: Scratch): Record<string, string>[] =>
  g
    .printed()
    .split(/\r?\n/)
    .filter((l) => /^t=\S+ event=/.test(l))
    .map(fields);

// A garden started with `clock: true` reads how far its clock has been moved on from a file in its
// directory (GARDEN_CLOCK_FILE), so a test can see what it does ten minutes from now without waiting.
export async function scratch(opts: { dir?: string; clock?: boolean } = {}): Promise<Scratch> {
  const dir = opts.dir ?? mkdtempSync(join(tmpdir(), "garden-"));
  const clockFile = join(dir, "clock");
  let offset = 0;
  if (opts.clock) writeFileSync(clockFile, "0");
  const child = spawn(process.execPath, ["server/main.ts"], {
    env: { ...process.env, PORT: "0", DATA_DIR: dir, GARDEN_CLOCK_FILE: opts.clock ? clockFile : "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.setEncoding("utf8").on("data", (s: string) => (out += s));
  child.stderr.setEncoding("utf8").on("data", (s: string) => (out += s));
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));

  const line = (pattern: RegExp, within = 2000): Promise<string> =>
    new Promise((resolve, reject) => {
      const find = (): string | undefined => out.split(/\r?\n/).find((l) => pattern.test(l));
      const give = setTimeout(() => {
        clearInterval(look);
        reject(new Error(`nothing printed matched ${pattern} within ${within} ms; printed:\n${out}`));
      }, within);
      const look = setInterval(() => {
        const l = find();
        if (l !== undefined) {
          clearTimeout(give);
          clearInterval(look);
          resolve(l);
        }
      }, 10);
    });

  const stop = async (signal: NodeJS.Signals = "SIGTERM"): Promise<void> => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal);
    await exited;
  };

  const started = await line(/event=start\b.*\bport=(\d+)/, 15_000).catch(async (e: unknown) => {
    await stop();
    throw e;
  });
  const port = Number(started.match(/\bport=(\d+)/)![1]);

  return {
    dir,
    url: (path) => new URL(path, `http://127.0.0.1:${port}`),
    printed: () => out,
    kept: () => {
      const db = new DatabaseSync(join(dir, "log.db"), { readOnly: true });
      try {
        return db.prepare("SELECT * FROM log ORDER BY id").all() as Record<string, unknown>[];
      } finally {
        db.close();
      }
    },
    line,
    advance: (ms) => {
      if (!opts.clock) throw new Error("this garden keeps real time; start it with { clock: true }");
      offset += ms;
      writeFileSync(clockFile, String(offset));
    },
    stop,
    dispose: async () => {
      await stop();
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}
