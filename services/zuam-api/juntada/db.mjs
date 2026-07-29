// Conexión a Postgres y esquema de las "juntadas de truco".
//
// Usa el Postgres compartido del stack (host `postgres` en la red shared_apps).
// El esquema se crea solo la primera vez que arranca el servicio, así no hace
// falta un paso de migración aparte para una feature tan acotada.

import pg from "pg";

const CONNECTION =
  process.env.JUNTADA_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "";

let pool = null;
let ready = null;

export function juntadaEnabled() {
  return Boolean(CONNECTION);
}

export function getPool() {
  if (!CONNECTION) {
    const error = new Error("Falta configurar JUNTADA_DATABASE_URL para las juntadas.");
    error.status = 503;
    throw error;
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: CONNECTION,
      max: Number(process.env.JUNTADA_DB_POOL_MAX || 4),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", () => { /* el pool se recupera solo; no tumbar el proceso */ });
  }
  return pool;
}

// Ejecuta una consulta. Devuelve las filas.
export async function query(text, params = []) {
  await ensureSchema();
  const result = await getPool().query(text, params);
  return result.rows;
}

// Igual que `query` pero devuelve la primera fila (o null).
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS juntada_meetups (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  date           TEXT NOT NULL DEFAULT '',
  time           TEXT NOT NULL DEFAULT '',
  duration_min   INTEGER NOT NULL DEFAULT 180,
  place          TEXT NOT NULL DEFAULT '',
  notes          TEXT NOT NULL DEFAULT '',
  max_players    INTEGER,
  selection_mode TEXT NOT NULL DEFAULT 'waitlist',
  admin_token    TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS juntada_items (
  id             TEXT PRIMARY KEY,
  meetup_id      TEXT NOT NULL REFERENCES juntada_meetups(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  qty            INTEGER NOT NULL DEFAULT 1,
  required       BOOLEAN NOT NULL DEFAULT false,
  detail_mode    TEXT NOT NULL DEFAULT 'none',
  detail_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS juntada_items_meetup ON juntada_items(meetup_id);

CREATE TABLE IF NOT EXISTS juntada_participants (
  id           TEXT PRIMARY KEY,
  meetup_id    TEXT NOT NULL REFERENCES juntada_meetups(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'in',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS juntada_participants_meetup ON juntada_participants(meetup_id);

CREATE TABLE IF NOT EXISTS juntada_claims (
  id             TEXT PRIMARY KEY,
  meetup_id      TEXT NOT NULL REFERENCES juntada_meetups(id) ON DELETE CASCADE,
  item_id        TEXT NOT NULL REFERENCES juntada_items(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES juntada_participants(id) ON DELETE CASCADE,
  detail         TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS juntada_claims_meetup ON juntada_claims(meetup_id);

CREATE TABLE IF NOT EXISTS juntada_teams (
  id         TEXT PRIMARY KEY,
  meetup_id  TEXT NOT NULL REFERENCES juntada_meetups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS juntada_teams_meetup ON juntada_teams(meetup_id);

CREATE TABLE IF NOT EXISTS juntada_team_members (
  id             TEXT PRIMARY KEY,
  team_id        TEXT NOT NULL REFERENCES juntada_teams(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES juntada_participants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS juntada_team_members_team ON juntada_team_members(team_id);

CREATE TABLE IF NOT EXISTS juntada_tables (
  id           TEXT PRIMARY KEY,
  meetup_id    TEXT NOT NULL REFERENCES juntada_meetups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'Mesa',
  format       TEXT NOT NULL DEFAULT '2v2',
  match_json   JSONB,
  blue_team_id TEXT,
  red_team_id  TEXT,
  target       INTEGER NOT NULL DEFAULT 30,
  score_blue   INTEGER NOT NULL DEFAULT 0,
  score_red    INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'playing',
  winner       TEXT,
  round        INTEGER NOT NULL DEFAULT 1,
  bracket      TEXT NOT NULL DEFAULT 'main',
  version      INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS juntada_tables_meetup ON juntada_tables(meetup_id);

CREATE TABLE IF NOT EXISTS juntada_events (
  id         BIGSERIAL PRIMARY KEY,
  meetup_id  TEXT NOT NULL REFERENCES juntada_meetups(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  data_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS juntada_events_meetup ON juntada_events(meetup_id, id);
`;

// Crea el esquema una sola vez por proceso.
export function ensureSchema() {
  if (!ready) {
    ready = getPool()
      .query(SCHEMA)
      .catch((error) => { ready = null; throw error; });
  }
  return ready;
}
