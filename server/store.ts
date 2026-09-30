import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ECHO_WINDOW_MS, presence, warm, type Presence, type Sowing } from "./garden.ts";

// Everything the garden remembers, in one SQLite file on the volume: who
// planted what where, when each visitor was last seen, and the garden's
// running total of time spent together.

export type Flower = {
  id: number;
  species: string;
  x: number;
  y: number;
  plantedAt: number;
  warmthAt: number;
  mine: boolean;
};
export type Garden = Presence & { now: number; warmth: number; flowers: Flower[] };

type FlowerRow = {
  id: number;
  species: string;
  x: number;
  y: number;
  planted_at: number;
  warmth_at: number;
  visitor: string;
};

export function openStore(dir: string) {
  mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "garden.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS flowers (
      id INTEGER PRIMARY KEY,
      species TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      planted_at INTEGER NOT NULL,
      warmth_at REAL NOT NULL,
      visitor TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS flowers_by_visitor ON flowers (visitor, planted_at);
    CREATE TABLE IF NOT EXISTS visits (visitor TEXT PRIMARY KEY, last_seen INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS garden (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      warmth REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO garden VALUES (1, 0, 0);
  `);

  const q = {
    flowers: db.prepare("SELECT id, species, x, y, planted_at, warmth_at, visitor FROM flowers ORDER BY id"),
    sownCount: db.prepare("SELECT COUNT(*) AS n FROM flowers"),
    sownBy: db.prepare("SELECT COUNT(*) AS n FROM flowers WHERE visitor = ? AND planted_at > ?"),
    sow: db.prepare(
      "INSERT INTO flowers (species, x, y, planted_at, warmth_at, visitor) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    ),
    seen: db.prepare(
      "INSERT INTO visits (visitor, last_seen) VALUES (?, ?) ON CONFLICT (visitor) DO UPDATE SET last_seen = excluded.last_seen",
    ),
    recent: db.prepare("SELECT last_seen FROM visits WHERE last_seen > ?"),
    forget: db.prepare("DELETE FROM visits WHERE last_seen <= ?"),
    warmth: db.prepare("SELECT warmth, updated_at FROM garden WHERE id = 1"),
    setWarmth: db.prepare("UPDATE garden SET warmth = ?, updated_at = ? WHERE id = 1"),
  };

  const count = (row: unknown): number => (row as { n: number }).n;
  const presenceAt = (now: number): Presence =>
    presence(
      (q.recent.all(now - ECHO_WINDOW_MS) as { last_seen: number }[]).map((r) => r.last_seen),
      now,
    );
  const warmthAt = (now: number, people: number): number => {
    const g = q.warmth.get() as { warmth: number; updated_at: number };
    return warm(g.warmth, g.updated_at, now, people);
  };

  // being seen moves the garden's warmth on to now, counting whoever was here
  const see = (visitor: string, now: number): Presence & { warmth: number } => {
    q.seen.run(visitor, now);
    const p = presenceAt(now);
    const warmth = warmthAt(now, p.people);
    q.setWarmth.run(warmth, now);
    return { ...p, warmth };
  };

  return {
    // a visitor only ever learns which flowers are theirs, never who planted the rest
    garden(visitor: string, now: number): Garden {
      const p = presenceAt(now);
      const flowers = (q.flowers.all() as FlowerRow[]).map((r) => ({
        id: r.id,
        species: r.species,
        x: r.x,
        y: r.y,
        plantedAt: r.planted_at,
        warmthAt: r.warmth_at,
        mine: r.visitor === visitor,
      }));
      return { now, ...p, warmth: warmthAt(now, p.people), flowers };
    },

    heartbeat(visitor: string, now: number): Presence & { now: number; warmth: number } {
      q.forget.run(now - ECHO_WINDOW_MS);
      return { now, ...see(visitor, now) };
    },

    sownCount: (): number => count(q.sownCount.get()),
    sownBy: (visitor: string, since: number): number => count(q.sownBy.get(visitor, since)),

    // sowing is being here too
    sow(visitor: string, s: Sowing, now: number): Flower {
      const { warmth } = see(visitor, now);
      const { id } = q.sow.get(s.species, s.x, s.y, now, warmth, visitor) as { id: number };
      return { id, species: s.species, x: s.x, y: s.y, plantedAt: now, warmthAt: warmth, mine: true };
    },

    close: (): void => db.close(),
  };
}
