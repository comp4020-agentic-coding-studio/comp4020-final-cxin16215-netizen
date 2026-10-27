import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ECHO_WINDOW_MS,
  MAX_SOWN,
  YEAR_MS,
  presence,
  tend,
  warm,
  wildFor,
  wildNow,
  type Presence,
  type Sowing,
} from "./garden.ts";

// Everything the garden remembers, in one SQLite file on the volume: who
// planted what where, when each visitor was last seen, the garden's running
// total of time spent together, and how tended it is. A planted flower that
// withered to make room is kept with the time it went (gone_at), and counts
// for nothing after.

export type Flower = {
  id: number;
  species: string;
  x: number;
  y: number;
  plantedAt: number;
  warmthAt: number;
  mine: boolean;
};
export type Tending = { warmth: number; care: number; wild: number; wildNext: number };
// a planted flower that gave way to a new one; `visitor` is its planter's cookie, for the log to hash
export type Withered = { id: number; visitor: string; plantedAt: number };
export type Garden = Presence & Tending & { now: number; flowers: Flower[] };

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
    INSERT OR IGNORE INTO garden (id, warmth, updated_at) VALUES (1, 0, 0);
  `);
  // gardens made before care existed start part-tended, with the 45 wild flowers they had
  const cols = (db.prepare("PRAGMA table_info(garden)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("care")) {
    db.exec(`
      ALTER TABLE garden ADD COLUMN care REAL NOT NULL DEFAULT 0.4;
      ALTER TABLE garden ADD COLUMN wild INTEGER NOT NULL DEFAULT 45;
      ALTER TABLE garden ADD COLUMN wild_year INTEGER NOT NULL DEFAULT -1;
    `);
  }
  // gardens made before flowers could wither have none gone
  const flowerCols = (db.prepare("PRAGMA table_info(flowers)").all() as { name: string }[]).map((c) => c.name);
  if (!flowerCols.includes("gone_at")) db.exec("ALTER TABLE flowers ADD COLUMN gone_at INTEGER");

  const q = {
    flowers: db.prepare(
      "SELECT id, species, x, y, planted_at, warmth_at, visitor FROM flowers WHERE gone_at IS NULL ORDER BY id",
    ),
    sownCount: db.prepare("SELECT COUNT(*) AS n FROM flowers WHERE gone_at IS NULL"),
    // the per-visitor limit counts what they sowed, whether or not it has since withered
    sownBy: db.prepare("SELECT COUNT(*) AS n FROM flowers WHERE visitor = ? AND planted_at > ?"),
    oldest: db.prepare(
      "SELECT id, visitor, planted_at FROM flowers WHERE gone_at IS NULL AND planted_at <= ? ORDER BY planted_at, id LIMIT 1",
    ),
    wither: db.prepare("UPDATE flowers SET gone_at = ? WHERE id = ?"),
    sow: db.prepare(
      "INSERT INTO flowers (species, x, y, planted_at, warmth_at, visitor) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    ),
    seen: db.prepare(
      "INSERT INTO visits (visitor, last_seen) VALUES (?, ?) ON CONFLICT (visitor) DO UPDATE SET last_seen = excluded.last_seen",
    ),
    recent: db.prepare("SELECT last_seen FROM visits WHERE last_seen > ?"),
    forget: db.prepare("DELETE FROM visits WHERE last_seen <= ?"),
    tending: db.prepare("SELECT warmth, care, wild, wild_year, updated_at FROM garden WHERE id = 1"),
    setTending: db.prepare("UPDATE garden SET warmth = ?, care = ?, wild = ?, wild_year = ?, updated_at = ? WHERE id = 1"),
  };

  const count = (row: unknown): number => (row as { n: number }).n;
  const presenceAt = (now: number): Presence =>
    presence(
      (q.recent.all(now - ECHO_WINDOW_MS) as { last_seen: number }[]).map((r) => r.last_seen),
      now,
    );
  type Row = { warmth: number; care: number; wild: number; wild_year: number; updated_at: number };
  // the garden's tending carried forward to now, counting whoever is here; a garden never updated has no gap
  const tendingAt = (now: number, people: number): Tending & { year: number } => {
    const g = q.tending.get() as Row;
    const since = g.updated_at || now;
    const care = tend(g.care, since, now, people);
    const { wild, year } = wildNow(g.wild, g.wild_year, care, now);
    return { warmth: warm(g.warmth, since, now, people), care, wild, wildNext: wildFor(care), year };
  };

  // being seen moves the garden on to now and keeps it there
  const see = (visitor: string, now: number): Presence & Tending => {
    q.seen.run(visitor, now);
    const p = presenceAt(now);
    const { year, ...t } = tendingAt(now, p.people);
    q.setTending.run(t.warmth, t.care, t.wild, year, now);
    return { ...p, ...t };
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
      const { year: _year, ...t } = tendingAt(now, p.people);
      return { now, ...p, ...t, flowers };
    },

    // who is here and how the garden stands, as everyone listening is told it; looking isn't being seen
    state(now: number): Presence & Tending & { now: number } {
      const p = presenceAt(now);
      const { year: _year, ...t } = tendingAt(now, p.people);
      return { now, ...p, ...t };
    },

    heartbeat(visitor: string, now: number): Presence & Tending & { now: number } {
      q.forget.run(now - ECHO_WINDOW_MS);
      return { now, ...see(visitor, now) };
    },

    sownCount: (): number => count(q.sownCount.get()),
    sownBy: (visitor: string, since: number): number => count(q.sownBy.get(visitor, since)),

    // Sowing with the garden open is being here too. In a full garden the oldest planted flower that has lived
    // a whole garden year withers to make room, in the same transaction; if every one is younger, nothing is sown.
    sow(visitor: string, s: Sowing, now: number, here: boolean): { flower: Flower; withered?: Withered } | null {
      db.exec("BEGIN IMMEDIATE");
      try {
        let withered: Withered | undefined;
        if (count(q.sownCount.get()) >= MAX_SOWN) {
          const old = q.oldest.get(now - YEAR_MS) as { id: number; visitor: string; planted_at: number } | undefined;
          if (!old) {
            db.exec("ROLLBACK");
            return null;
          }
          q.wither.run(now, old.id);
          withered = { id: old.id, visitor: old.visitor, plantedAt: old.planted_at };
        }
        const { warmth } = here ? see(visitor, now) : tendingAt(now, presenceAt(now).people);
        const { id } = q.sow.get(s.species, s.x, s.y, now, warmth, visitor) as { id: number };
        db.exec("COMMIT");
        return { flower: { id, species: s.species, x: s.x, y: s.y, plantedAt: now, warmthAt: warmth, mine: true }, withered };
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },

    close: (): void => db.close(),
  };
}
