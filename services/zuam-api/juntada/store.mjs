// Lógica de las juntadas de truco sobre Postgres.
//
// Es el puerto del backend que vivía en el proyecto Truco (drizzle + D1). Las
// reglas son las mismas; sólo cambia el motor: SQL plano sobre `pg`.

import { randomUUID, randomInt } from "node:crypto";
import { query, queryOne } from "./db.mjs";

// ── Utilidades ────────────────────────────────────────────────────────────────
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // sin caracteres confusos
export function shortId(len = 8) {
  let out = "";
  for (let i = 0; i < len; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
export const adminSecret = () => shortId(24);

const clean = (value, max) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
const isoTime = (v) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : "");
const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Mezcla aleatoria (Fisher-Yates). Para sorteos y armado de equipos.
function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SELECTION_MODES = ["waitlist", "raffle", "open"];
const DETAIL_MODES = ["none", "text", "select"];
const FORMATS = ["1v1", "2v2", "3v3"];

function normalizeItem(input = {}) {
  const options = Array.isArray(input.detailOptions)
    ? input.detailOptions.map((o) => clean(o, 40)).filter(Boolean).slice(0, 12)
    : [];
  let detailMode = DETAIL_MODES.includes(input.detailMode) ? input.detailMode : "none";
  if (detailMode === "select" && options.length === 0) detailMode = "text";
  return {
    label: clean(input.label, 60),
    qty: clampInt(input.qty, 1, 99, 1),
    required: input.required === true,
    detailMode,
    detailOptions: options,
  };
}

// ── Crear ─────────────────────────────────────────────────────────────────────
export async function createMeetup(input) {
  const id = shortId();
  const adminToken = adminSecret();
  const selectionMode = SELECTION_MODES.includes(input.selectionMode) ? input.selectionMode : "waitlist";
  const maxPlayers = input.maxPlayers === null || input.maxPlayers === undefined || input.maxPlayers === ""
    ? null
    : clampInt(input.maxPlayers, 2, 200, null);

  await query(
    `INSERT INTO juntada_meetups
       (id, title, date, time, duration_min, place, notes, max_players, selection_mode, admin_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      clean(input.title, 80) || "Juntada de truco",
      isoDate(input.date),
      isoTime(input.time),
      clampInt(input.durationMin, 30, 1440, 180),
      clean(input.place, 120),
      clean(input.notes, 500),
      maxPlayers,
      selectionMode,
      adminToken,
    ],
  );

  const items = (Array.isArray(input.items) ? input.items : []).map(normalizeItem).filter((it) => it.label);
  for (const item of items.slice(0, 40)) await insertItem(id, item);

  return { id, adminToken };
}

async function insertItem(meetupId, item) {
  await query(
    `INSERT INTO juntada_items (id, meetup_id, label, qty, required, detail_mode, detail_options)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [shortId(10), meetupId, item.label, item.qty, item.required, item.detailMode, JSON.stringify(item.detailOptions)],
  );
}

// Quién puede administrar. El organizador siempre (tiene el adminToken del link
// que se guardó en su celular); además, según el modo de la juntada, cualquier
// anotado (`all`) o los que el organizador marcó a mano (`chosen`).
export async function verifyAdmin(meetupId, adminToken, deviceToken) {
  const meetup = await queryOne(
    `SELECT admin_token, admin_mode FROM juntada_meetups WHERE id = $1`,
    [meetupId],
  );
  if (!meetup) return false;
  if (adminToken && adminToken === meetup.admin_token) return true;
  if (!deviceToken || meetup.admin_mode === "owner") return false;

  const me = await queryOne(
    `SELECT is_admin, status FROM juntada_participants WHERE meetup_id=$1 AND device_token=$2`,
    [meetupId, deviceToken],
  );
  if (!me || me.status === "out") return false;
  return meetup.admin_mode === "all" ? true : me.is_admin === true;
}

// Sólo el organizador cambia quién manda; si no, un invitado con permiso podría
// darse permisos permanentes o quitárselos al dueño.
export async function isOwner(meetupId, adminToken) {
  if (!adminToken) return false;
  const row = await queryOne(`SELECT admin_token FROM juntada_meetups WHERE id = $1`, [meetupId]);
  return Boolean(row && row.admin_token === adminToken);
}

const ADMIN_MODES = ["owner", "chosen", "all"];

export async function setAdminMode(meetupId, mode) {
  if (!ADMIN_MODES.includes(mode)) return;
  await query(`UPDATE juntada_meetups SET admin_mode=$2 WHERE id=$1`, [meetupId, mode]);
}

export async function setParticipantAdmin(meetupId, participantId, on) {
  await query(
    `UPDATE juntada_participants SET is_admin=$3 WHERE meetup_id=$1 AND id=$2`,
    [meetupId, participantId, on === true],
  );
}

// Alta manual de varios jugadores por un admin (los que no tienen celular a
// mano). No llevan device_token, así que nadie los "es" desde su teléfono.
export async function addParticipants(meetupId, names) {
  const list = (Array.isArray(names) ? names : [])
    .map((n) => clean(n, 40))
    .filter(Boolean)
    .slice(0, 40);
  if (!list.length) return { added: 0 };

  const meetup = await queryOne(`SELECT * FROM juntada_meetups WHERE id=$1`, [meetupId]);
  if (!meetup) return null;
  const active = await query(
    `SELECT id FROM juntada_participants WHERE meetup_id=$1 AND status='in'`,
    [meetupId],
  );

  let count = active.length;
  for (const name of list) {
    const full = meetup.max_players !== null && count >= meetup.max_players;
    const status = full && meetup.selection_mode === "waitlist" ? "wait" : "in";
    await query(
      `INSERT INTO juntada_participants (id, meetup_id, device_token, name, status) VALUES ($1,$2,'',$3,$4)`,
      [shortId(10), meetupId, name, status],
    );
    if (status === "in") count += 1;
  }
  return { added: list.length };
}

export async function deleteMeetup(meetupId) {
  // Ítems, participantes, equipos, mesas y eventos caen por ON DELETE CASCADE.
  await query(`DELETE FROM juntada_meetups WHERE id = $1`, [meetupId]);
}

// ── Ítems ─────────────────────────────────────────────────────────────────────
export async function addItem(meetupId, input) {
  const item = normalizeItem(input);
  if (!item.label) return;
  await insertItem(meetupId, item);
}

export async function updateItem(itemId, input) {
  const item = normalizeItem(input);
  if (!item.label) return;
  await query(
    `UPDATE juntada_items
        SET label=$2, qty=$3, required=$4, detail_mode=$5, detail_options=$6::jsonb
      WHERE id=$1`,
    [itemId, item.label, item.qty, item.required, item.detailMode, JSON.stringify(item.detailOptions)],
  );
}

export async function deleteItem(itemId) {
  await query(`DELETE FROM juntada_items WHERE id = $1`, [itemId]);
}

// ── Anotarse ──────────────────────────────────────────────────────────────────
export async function joinMeetup(meetupId, deviceToken, name) {
  const meetup = await queryOne(`SELECT * FROM juntada_meetups WHERE id = $1`, [meetupId]);
  if (!meetup) return null;
  const cleanName = clean(name, 40) || "Jugador";

  const existing = await queryOne(
    `SELECT * FROM juntada_participants WHERE meetup_id=$1 AND device_token=$2`,
    [meetupId, deviceToken],
  );
  if (existing) {
    const status = existing.status === "out" ? "in" : existing.status;
    await query(`UPDATE juntada_participants SET name=$2, status=$3 WHERE id=$1`, [existing.id, cleanName, status]);
    return { participantId: existing.id, status };
  }

  const active = await query(
    `SELECT id FROM juntada_participants WHERE meetup_id=$1 AND status='in'`,
    [meetupId],
  );
  const full = meetup.max_players !== null && active.length >= meetup.max_players;
  const status = full && meetup.selection_mode === "waitlist" ? "wait" : "in";

  const id = shortId(10);
  await query(
    `INSERT INTO juntada_participants (id, meetup_id, device_token, name, status) VALUES ($1,$2,$3,$4,$5)`,
    [id, meetupId, deviceToken, cleanName, status],
  );
  return { participantId: id, status };
}

// Darse de baja uno mismo (no un admin echando a otro). Deja el registro en
// 'out' en vez de borrarlo: conserva lo que ya había tomado en "qué llevar" y
// si vuelve a anotarse, `joinMeetup` lo revive con ese mismo historial.
export async function leaveMeetup(meetupId, deviceToken) {
  const me = await queryOne(
    `SELECT id FROM juntada_participants WHERE meetup_id=$1 AND device_token=$2`,
    [meetupId, deviceToken],
  );
  if (!me) return false;
  await query(`UPDATE juntada_participants SET status='out' WHERE id=$1`, [me.id]);
  return true;
}

// Un admin saca a alguien más (avisó que no va, o el organizador limpia la
// lista). Igual que `leaveMeetup`: queda en 'out', no se borra, conserva lo
// que ya había elegido en "qué llevar" por si vuelve a anotarse.
export async function removeParticipant(meetupId, participantId) {
  await query(
    `UPDATE juntada_participants SET status='out' WHERE meetup_id=$1 AND id=$2`,
    [meetupId, participantId],
  );
}

// ── Reclamar / soltar un ítem (con su detalle) ────────────────────────────────
export async function toggleClaim(meetupId, deviceToken, itemId, on, detail = "") {
  const me = await queryOne(
    `SELECT id FROM juntada_participants WHERE meetup_id=$1 AND device_token=$2`,
    [meetupId, deviceToken],
  );
  if (!me) return;
  const existing = await queryOne(
    `SELECT id FROM juntada_claims WHERE item_id=$1 AND participant_id=$2`,
    [itemId, me.id],
  );
  const value = clean(detail, 60);
  if (on) {
    if (existing) await query(`UPDATE juntada_claims SET detail=$2 WHERE id=$1`, [existing.id, value]);
    else await query(
      `INSERT INTO juntada_claims (id, meetup_id, item_id, participant_id, detail) VALUES ($1,$2,$3,$4,$5)`,
      [shortId(10), meetupId, itemId, me.id, value],
    );
  } else if (existing) {
    await query(`DELETE FROM juntada_claims WHERE id=$1`, [existing.id]);
  }
}

// Reparte al azar lo que falta cubrir, sin pisar lo que la gente ya eligió.
export async function assignItemsRandomly(meetupId) {
  const [items, claims, people] = await Promise.all([
    query(`SELECT * FROM juntada_items WHERE meetup_id=$1`, [meetupId]),
    query(`SELECT * FROM juntada_claims WHERE meetup_id=$1`, [meetupId]),
    query(`SELECT * FROM juntada_participants WHERE meetup_id=$1 AND status='in'`, [meetupId]),
  ]);
  for (const item of items) {
    const current = claims.filter((c) => c.item_id === item.id);
    let need = item.qty - current.length;
    if (need <= 0) continue;
    const taken = new Set(current.map((c) => c.participant_id));
    for (const person of shuffle(people.filter((p) => !taken.has(p.id)))) {
      if (need <= 0) break;
      await query(
        `INSERT INTO juntada_claims (id, meetup_id, item_id, participant_id) VALUES ($1,$2,$3,$4)`,
        [shortId(10), meetupId, item.id, person.id],
      );
      taken.add(person.id);
      need -= 1;
    }
  }
}

// ── Equipos ("tirar los reyes") ───────────────────────────────────────────────
const TEAM_NAMES = [
  "Los Pericos", "La Mensa", "Los Duros", "La Zurda", "Los Bravos",
  "La Mishadura", "Los Nervios", "La Garra", "Los Fósforos", "La Ronda",
];

async function clearTeams(meetupId) {
  await query(`DELETE FROM juntada_teams WHERE meetup_id=$1`, [meetupId]); // los miembros caen en cascada
}

export async function autoFormTeams(meetupId, teamSize) {
  const people = shuffle(await query(
    `SELECT * FROM juntada_participants WHERE meetup_id=$1 AND status='in' ORDER BY created_at`,
    [meetupId],
  ));
  await clearTeams(meetupId);
  const names = shuffle([...TEAM_NAMES]);
  const count = Math.floor(people.length / teamSize);
  for (let t = 0; t < count; t += 1) {
    const id = shortId(10);
    await query(
      `INSERT INTO juntada_teams (id, meetup_id, name, color) VALUES ($1,$2,$3,$4)`,
      [id, meetupId, names[t % names.length] || `Equipo ${t + 1}`, t % 2 === 0 ? "blue" : "red"],
    );
    for (let k = 0; k < teamSize; k += 1) {
      await query(
        `INSERT INTO juntada_team_members (id, team_id, participant_id) VALUES ($1,$2,$3)`,
        [shortId(10), id, people[t * teamSize + k].id],
      );
    }
  }
}

export async function setTeams(meetupId, incoming) {
  await clearTeams(meetupId);
  const list = Array.isArray(incoming) ? incoming.slice(0, 40) : [];
  for (const [i, team] of list.entries()) {
    const id = shortId(10);
    await query(
      `INSERT INTO juntada_teams (id, meetup_id, name, color) VALUES ($1,$2,$3,$4)`,
      [id, meetupId, clean(team.name, 30) || `Equipo ${i + 1}`, team.color === "red" ? "red" : "blue"],
    );
    for (const pid of (Array.isArray(team.memberIds) ? team.memberIds : []).slice(0, 8)) {
      await query(
        `INSERT INTO juntada_team_members (id, team_id, participant_id) VALUES ($1,$2,$3)`,
        [shortId(10), id, pid],
      );
    }
  }
}

// ── Mesas ─────────────────────────────────────────────────────────────────────
export async function createTable(meetupId, opts = {}) {
  await query(
    `INSERT INTO juntada_tables (id, meetup_id, name, format, target, blue_team_id, red_team_id, round, bracket)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      shortId(10), meetupId,
      clean(opts.name, 40) || "Mesa",
      FORMATS.includes(opts.format) ? opts.format : "2v2",
      clampInt(opts.target, 5, 99, 30),
      opts.blueTeamId ?? null, opts.redTeamId ?? null,
      clampInt(opts.round, 1, 99, 1),
      clean(opts.bracket, 20) || "main",
    ],
  );
}

export async function updateTable(tableId, patch = {}) {
  const sets = [];
  const values = [tableId];
  const add = (column, value) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  if (patch.name !== undefined) add("name", clean(patch.name, 40) || "Mesa");
  if (patch.blueTeamId !== undefined) add("blue_team_id", patch.blueTeamId);
  if (patch.redTeamId !== undefined) add("red_team_id", patch.redTeamId);
  if (patch.target !== undefined) add("target", clampInt(patch.target, 5, 99, 30));
  if (!sets.length) return;
  await query(`UPDATE juntada_tables SET ${sets.join(", ")} WHERE id = $1`, values);
}

export async function deleteTable(tableId) {
  await query(`DELETE FROM juntada_tables WHERE id = $1`, [tableId]);
}

async function addEvent(meetupId, type, data) {
  await query(
    `INSERT INTO juntada_events (meetup_id, type, data_json) VALUES ($1,$2,$3::jsonb)`,
    [meetupId, type, JSON.stringify(data)],
  );
}

// ── Torneo ────────────────────────────────────────────────────────────────────
export async function generateTournamentRound(meetupId, mode = "winners-losers", manualPairs = []) {
  const tables = await query(`SELECT * FROM juntada_tables WHERE meetup_id=$1`, [meetupId]);
  if (!tables.length) return { ok: false, error: "Todavía no hay mesas" };

  const maxRound = Math.max(...tables.map((t) => t.round));
  const current = tables.filter((t) => t.round === maxRound);
  const target = current[0]?.target ?? 30;
  const format = current[0]?.format ?? "2v2";
  const nextRound = maxRound + 1;
  let created = 0;

  if (mode === "manual") {
    const pairs = (Array.isArray(manualPairs) ? manualPairs : []).filter((p) => p && p.blueTeamId);
    if (!pairs.length) return { ok: false, error: "Elegí al menos un cruce" };
    for (const [i, pair] of pairs.entries()) {
      created += await createPair(meetupId, pair.blueTeamId, pair.redTeamId ?? null,
        "main", nextRound, target, format, `Mesa ${i + 1}`);
    }
    await addEvent(meetupId, "round_generated", { round: nextRound });
    return { ok: true, created };
  }

  const contested = current.filter((t) => t.blue_team_id && t.red_team_id);
  const unfinished = contested.filter((t) => t.status !== "finished");
  if (mode !== "all" && unfinished.length) {
    return { ok: false, error: "Hay mesas sin terminar en la ronda actual" };
  }

  const source = mode === "all" ? current.filter((t) => t.status === "finished") : current;
  const winners = [];
  const losers = [];
  for (const t of source) {
    if (t.winner === "blue") { winners.push(t.blue_team_id); if (t.red_team_id) losers.push(t.red_team_id); }
    else if (t.winner === "red") { winners.push(t.red_team_id); if (t.blue_team_id) losers.push(t.blue_team_id); }
    else if (t.blue_team_id && !t.red_team_id) winners.push(t.blue_team_id); // descanso previo
  }
  if (winners.length + losers.length < 2) {
    return { ok: false, error: "No hay suficientes equipos para otra ronda" };
  }

  if (mode === "cross") {
    const w = shuffle(winners);
    const l = shuffle(losers);
    const pairs = [];
    while (w.length && l.length) pairs.push([w.shift(), l.shift()]);
    const rest = [...w, ...l];
    while (rest.length) pairs.push([rest.shift(), rest.shift() ?? null]);
    for (const [blue, red] of pairs) {
      created += await createPair(meetupId, blue, red, "main", nextRound, target, format, "Cruce");
    }
  } else if (mode === "all") {
    created += await pairInto(meetupId, [...winners, ...losers], "main", nextRound, target, format);
  } else {
    created += await pairInto(meetupId, winners, "winners", nextRound, target, format);
    created += await pairInto(meetupId, losers, "losers", nextRound, target, format);
  }

  await addEvent(meetupId, "round_generated", { round: nextRound });
  return { ok: true, created };
}

async function pairInto(meetupId, teamIds, bracket, round, target, format) {
  const pool = shuffle(teamIds.filter(Boolean));
  const label = bracket === "winners" ? "Ganadores" : bracket === "losers" ? "Repechaje" : "Mesa";
  let n = 0;
  for (let i = 0; i < pool.length; i += 2) {
    n += await createPair(meetupId, pool[i], pool[i + 1] ?? null, bracket, round, target, format, label);
  }
  return n;
}

async function createPair(meetupId, blue, red, bracket, round, target, format, label) {
  const id = shortId(10);
  if (red) {
    await query(
      `INSERT INTO juntada_tables (id, meetup_id, name, format, target, blue_team_id, red_team_id, round, bracket)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, meetupId, `${label} · R${round}`, format, target, blue, red, round, bracket],
    );
  } else {
    // Descanso: pasa automáticamente (mesa ya terminada con ese equipo).
    await query(
      `INSERT INTO juntada_tables (id, meetup_id, name, format, target, blue_team_id, red_team_id, round, bracket, status, winner)
       VALUES ($1,$2,$3,$4,$5,$6,NULL,$7,$8,'finished','blue')`,
      [id, meetupId, `${label} · descanso`, format, target, blue, round, bracket],
    );
  }
  return 1;
}

// ── Lectura ───────────────────────────────────────────────────────────────────
export async function getState(meetupId, deviceToken, adminToken) {
  const meetup = await queryOne(`SELECT * FROM juntada_meetups WHERE id=$1`, [meetupId]);
  if (!meetup) return null;

  const [items, claims, people, teams, members, tables, events] = await Promise.all([
    query(`SELECT * FROM juntada_items WHERE meetup_id=$1 ORDER BY created_at`, [meetupId]),
    query(`SELECT * FROM juntada_claims WHERE meetup_id=$1`, [meetupId]),
    query(`SELECT * FROM juntada_participants WHERE meetup_id=$1 ORDER BY created_at`, [meetupId]),
    query(`SELECT * FROM juntada_teams WHERE meetup_id=$1 ORDER BY created_at`, [meetupId]),
    query(
      `SELECT m.* FROM juntada_team_members m
         JOIN juntada_teams t ON t.id = m.team_id WHERE t.meetup_id = $1`,
      [meetupId],
    ),
    query(`SELECT * FROM juntada_tables WHERE meetup_id=$1 ORDER BY created_at`, [meetupId]),
    query(`SELECT * FROM juntada_events WHERE meetup_id=$1 ORDER BY id DESC LIMIT 20`, [meetupId]),
  ]);

  // Los agregados a mano tienen device_token vacío: no son "yo" de nadie.
  const me = deviceToken ? people.find((p) => p.device_token && p.device_token === deviceToken) : undefined;
  const meId = me?.id;
  const isOwnerHere = Boolean(adminToken && adminToken === meetup.admin_token);
  const isAdmin = isOwnerHere
    || (Boolean(me) && me.status !== "out"
      && (meetup.admin_mode === "all" || (meetup.admin_mode === "chosen" && me.is_admin === true)));

  return {
    meetup: {
      id: meetup.id, title: meetup.title, date: meetup.date, time: meetup.time,
      durationMin: meetup.duration_min, place: meetup.place, notes: meetup.notes,
      maxPlayers: meetup.max_players, selectionMode: meetup.selection_mode,
      adminMode: meetup.admin_mode ?? "owner",
      createdAt: meetup.created_at,
    },
    items: items.map((it) => ({
      id: it.id, label: it.label, qty: it.qty, required: it.required,
      detailMode: it.detail_mode, detailOptions: Array.isArray(it.detail_options) ? it.detail_options : [],
      claims: claims.filter((c) => c.item_id === it.id).map((c) => ({ participantId: c.participant_id, detail: c.detail })),
    })),
    participants: people.map((p) => ({
      id: p.id, name: p.name, status: p.status,
      isMe: p.id === meId, isAdmin: p.is_admin === true, guest: !p.device_token,
    })),
    teams: teams.map((t) => ({
      id: t.id, name: t.name, color: t.color,
      memberIds: members.filter((m) => m.team_id === t.id).map((m) => m.participant_id),
    })),
    tables: tables.map(toTableDTO),
    events: events.map((e) => ({ id: Number(e.id), type: e.type, data: e.data_json ?? {}, createdAt: e.created_at })),
    isAdmin,
    isOwner: isOwnerHere,
  };
}

const toTableDTO = (t) => ({
  id: t.id, name: t.name, format: t.format,
  blueTeamId: t.blue_team_id, redTeamId: t.red_team_id,
  target: t.target, scoreBlue: t.score_blue, scoreRed: t.score_red,
  status: t.status, winner: t.winner, version: t.version,
  round: t.round, bracket: t.bracket,
});

// Estado de UNA mesa: lo que necesita el contador de fósforos.
export async function getTableState(tableId) {
  const t = await queryOne(`SELECT * FROM juntada_tables WHERE id=$1`, [tableId]);
  if (!t) return null;
  const [meetup, teams, members, people] = await Promise.all([
    queryOne(`SELECT title FROM juntada_meetups WHERE id=$1`, [t.meetup_id]),
    query(`SELECT * FROM juntada_teams WHERE meetup_id=$1`, [t.meetup_id]),
    query(
      `SELECT m.* FROM juntada_team_members m
         JOIN juntada_teams tt ON tt.id = m.team_id WHERE tt.meetup_id = $1`,
      [t.meetup_id],
    ),
    query(`SELECT * FROM juntada_participants WHERE meetup_id=$1`, [t.meetup_id]),
  ]);
  const nameOf = (pid) => people.find((p) => p.id === pid)?.name ?? "";
  const teamInfo = (id) => {
    const team = teams.find((x) => x.id === id);
    if (!team) return null;
    return {
      id: team.id, name: team.name,
      players: members.filter((m) => m.team_id === team.id).map((m) => nameOf(m.participant_id)).filter(Boolean),
    };
  };
  return {
    id: t.id, meetupId: t.meetup_id, meetupTitle: meetup?.title ?? "Juntada",
    name: t.name, format: t.format, target: t.target, round: t.round, bracket: t.bracket,
    status: t.status, winner: t.winner, version: t.version,
    blue: teamInfo(t.blue_team_id), red: teamInfo(t.red_team_id),
  };
}

// Latido para el contador de fósforos: lo MÍNIMO para saber qué pasa en las
// otras mesas (avisos de "terminó una mesa" y de ronda nueva). Se pide cada 15s
// desde cada mesa abierta, así que no trae ni la partida ni la configuración.
export async function getTablesPulse(meetupId) {
  const [tables, teams] = await Promise.all([
    query(
      `SELECT id, name, blue_team_id, red_team_id, score_blue, score_red, status, winner, round
         FROM juntada_tables WHERE meetup_id=$1 ORDER BY created_at`,
      [meetupId],
    ),
    query(`SELECT id, name FROM juntada_teams WHERE meetup_id=$1`, [meetupId]),
  ]);
  if (!tables.length) return { round: 1, tables: [] };

  const nameOf = (id) => teams.find((t) => t.id === id)?.name ?? "";
  const round = Math.max(...tables.map((t) => t.round));
  return {
    round,
    // Sólo la ronda actual: las anteriores ya no le sirven al contador.
    tables: tables.filter((t) => t.round === round).map((t) => ({
      id: t.id, name: t.name,
      blue: nameOf(t.blue_team_id), red: nameOf(t.red_team_id),
      blueTeamId: t.blue_team_id, redTeamId: t.red_team_id,
      scoreBlue: t.score_blue, scoreRed: t.score_red,
      status: t.status, winner: t.winner,
    })),
  };
}

// Sube el resultado de una mesa. Se llama sólo al aplicar una mano, así que
// viaja el puntaje y nada más: la partida vive en el celular que anota.
export async function pushTableScore(tableId, { scoreBlue, scoreRed, done }) {
  const table = await queryOne(
    `SELECT id, meetup_id, name, status, target FROM juntada_tables WHERE id = $1`,
    [tableId],
  );
  if (!table) return null;

  const blue = clampInt(scoreBlue, 0, 999, 0);
  const red = clampInt(scoreRed, 0, 999, 0);
  const finished = done === true;
  const winner = finished ? (blue >= red ? "blue" : "red") : null;
  const status = finished ? "finished" : "playing";

  await query(
    `UPDATE juntada_tables
        SET score_blue=$2, score_red=$3, winner=$4, status=$5, version=version+1, updated_at=now()
      WHERE id=$1`,
    [tableId, blue, red, winner, status],
  );

  if (finished && table.status !== "finished") {
    await addEvent(table.meetup_id, "table_finished", {
      tableId, name: table.name, winner, scoreBlue: blue, scoreRed: red,
    });
  }
  return { ok: true };
}

// Datos mínimos para la preview de WhatsApp.
export async function getMeetupMeta(meetupId) {
  const m = await queryOne(`SELECT * FROM juntada_meetups WHERE id=$1`, [meetupId]);
  if (!m) return null;
  const active = await query(
    `SELECT id FROM juntada_participants WHERE meetup_id=$1 AND status='in'`,
    [meetupId],
  );
  return {
    title: m.title, date: m.date, time: m.time, place: m.place,
    count: active.length, maxPlayers: m.max_players,
  };
}

export { randomUUID };
