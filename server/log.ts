import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// The garden's log of who did what: one key=value line per thing a visitor does, printed for
// `flyctl logs` to show as it happens and kept in its own SQLite file on the volume, so it outlives the
// machine, a restart and a redeploy. Nothing serves it: reading the history is `flyctl ssh console` and
// sqlite3, by whoever runs the garden (docs/adr/0003-who-may-do-what.md).
//
// A visitor appears only as `who()`: the first eight hex characters of a hash of their cookie. The cookie
// is the identity, so whoever reads it can sow as that person; never log it, or anything that holds it.

export const who = (visitor: string): string => createHash("sha256").update(visitor).digest("hex").slice(0, 8);

type Value = string | number | boolean | null | undefined;
export type Entry = { event: string; visitor?: string | null; result: "ok" | "refused"; reason?: string } & Record<
  string,
  Value
>;

// plain values stay bare; anything with a space, quote or equals sign is quoted so a line always splits
const show = (v: Value): string => {
  const s = String(v);
  return /^[\w.:@+/-]+$/.test(s) ? s : JSON.stringify(s);
};

export function openLog(dir: string, now: () => number) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "log.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS log (
      id INTEGER PRIMARY KEY,
      t TEXT NOT NULL,
      event TEXT NOT NULL,
      visitor TEXT,
      result TEXT NOT NULL,
      reason TEXT,
      line TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS log_by_visitor ON log (visitor, id);
  `);
  const keep = db.prepare("INSERT INTO log (t, event, visitor, result, reason, line) VALUES (?, ?, ?, ?, ?, ?)");

  return {
    // `visitor` is the cookie and only ever leaves here hashed
    write({ event, visitor, result, reason, ...rest }: Entry): void {
      const t = new Date(now()).toISOString();
      const v = visitor ? who(visitor) : null;
      const fields: [string, Value][] = [
        ["t", t],
        ["event", event],
        ["visitor", v],
        ["result", result],
        ["reason", reason],
        ...Object.entries(rest),
      ];
      const line = fields
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([k, value]) => `${k}=${show(value)}`)
        .join(" ");
      console.log(line);
      try {
        keep.run(t, event, v, result, reason ?? null, line);
      } catch (e) {
        // a full or broken disk loses the kept copy, never the visitor's request; the printed line still stands
        console.error(`t=${t} event=log-failed result=refused reason=${show(String(e))}`);
      }
    },
    close: (): void => db.close(),
  };
}
