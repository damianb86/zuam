// Persistencia del bot (Fase 1).
//
// Reusa el pool de Postgres de las juntadas: es la misma base y el bot no
// necesita una conexion propia. Las tablas van con prefijo `wa_`.
//
// Reemplaza al JSON de sesiones de la Fase 0: ahora el estado sobrevive al
// contenedor y no solo al proceso.

import { query, getPool, ensureSchema } from "../zuam-api/juntada/db.mjs";
import { shortId } from "../zuam-api/juntada/store.mjs";

const SCHEMA = `
-- Un chat de WhatsApp (grupo o 1-a-1) y la juntada que tiene activa.
CREATE TABLE IF NOT EXISTS wa_chats (
  chat_id          TEXT PRIMARY KEY,
  title            TEXT NOT NULL DEFAULT '',
  active_meetup_id TEXT REFERENCES juntada_meetups(id) ON DELETE SET NULL,
  admin_token      TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Allowlist explicita. Sin esto en true, el bot ni mira el chat.
ALTER TABLE wa_chats ADD COLUMN IF NOT EXISTS allowed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wa_chats ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
-- Hasta que evento de la juntada se aviso ya en el grupo (ver announcer.mjs).
ALTER TABLE wa_chats ADD COLUMN IF NOT EXISTS last_event_id BIGINT NOT NULL DEFAULT 0;

-- Ventana de escucha. Si no hay fila, el bot esta callado y no lee nada.
CREATE TABLE IF NOT EXISTS wa_sessions (
  chat_id          TEXT PRIMARY KEY,
  started_by       TEXT NOT NULL DEFAULT '',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count    INTEGER NOT NULL DEFAULT 0
);

-- Quien es quien: el numero de WhatsApp mapeado al participante de la juntada.
CREATE TABLE IF NOT EXISTS wa_identities (
  id           TEXT PRIMARY KEY,
  chat_id      TEXT NOT NULL,
  wa_id        TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  device_token TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wa_identities_chat_wa ON wa_identities(chat_id, wa_id);

-- Mensajes leidos durante una sesion abierta. Retencion corta a proposito:
-- son conversaciones privadas, no un archivo historico.
CREATE TABLE IF NOT EXISTS wa_messages (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    TEXT NOT NULL,
  wa_id      TEXT NOT NULL DEFAULT '',
  author     TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  from_me    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_messages_chat ON wa_messages(chat_id, id DESC);
`;

let ready = null;
export function ensureWaSchema() {
  if (!ready) {
    // Primero el esquema de las juntadas: `wa_chats` referencia
    // `juntada_meetups`. El contenedor del bot puede arrancar antes que el de
    // la API, asi que no se puede dar por hecho que las tablas ya existen.
    ready = ensureSchema()
      .then(() => getPool().query(SCHEMA))
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}

async function wq(text, params = []) {
  await ensureWaSchema();
  return query(text, params);
}

async function wq1(text, params = []) {
  const rows = await wq(text, params);
  return rows[0] ?? null;
}

// ── Sesiones de escucha ─────────────────────────────────────────────────────

// El vencimiento se calcula EN la base, no comparando contra el reloj del
// proceso: el contenedor del bot y el de Postgres no tienen por que estar
// sincronizados al milisegundo.
export async function getSession(chatId, ttlMs) {
  const row = await wq1(
    `SELECT * FROM wa_sessions
      WHERE chat_id=$1 AND last_activity_at > now() - ($2 || ' milliseconds')::interval`,
    [chatId, String(Math.max(0, ttlMs))],
  );
  if (!row) {
    // Vencida (o inexistente). Si quedo la fila, se limpia: es la garantia de
    // que el bot no escucha un grupo para siempre porque nadie lo despidio.
    await endSession(chatId);
    return null;
  }
  return {
    chatId: row.chat_id,
    startedBy: row.started_by,
    startedAt: row.started_at,
    messageCount: row.message_count,
  };
}

export async function startSession(chatId, startedBy = "") {
  await wq(
    `INSERT INTO wa_sessions (chat_id, started_by, started_at, last_activity_at, message_count)
     VALUES ($1,$2,now(),now(),0)
     ON CONFLICT (chat_id) DO UPDATE
       SET started_by=$2, started_at=now(), last_activity_at=now(), message_count=0`,
    [chatId, startedBy],
  );
}

export async function touchSession(chatId) {
  await wq(
    `UPDATE wa_sessions SET last_activity_at=now(), message_count=message_count+1 WHERE chat_id=$1`,
    [chatId],
  );
}

export async function endSession(chatId) {
  await wq(`DELETE FROM wa_sessions WHERE chat_id=$1`, [chatId]);
}

// ── Chats y la juntada que tienen activa ────────────────────────────────────

export async function getChat(chatId) {
  return wq1(`SELECT * FROM wa_chats WHERE chat_id=$1`, [chatId]);
}

// ── Allowlist ───────────────────────────────────────────────────────────────
//
// La decision de que grupos mira el bot es explicita y por grupo. Se cachea en
// memoria porque se consulta en CADA mensaje que entra, incluidos los de los
// grupos que no nos interesan: no vale hacer una query por cada uno.

let allowCache = null;

export async function refreshAllowCache() {
  const rows = await wq(`SELECT chat_id FROM wa_chats WHERE allowed = true`);
  allowCache = new Set(rows.map((r) => r.chat_id));
  return allowCache;
}

export async function isAllowed(chatId) {
  if (!allowCache) await refreshAllowCache();
  return allowCache.has(chatId);
}

export async function setAllowed(chatId, allowed) {
  await wq(
    `INSERT INTO wa_chats (chat_id, allowed) VALUES ($1,$2)
     ON CONFLICT (chat_id) DO UPDATE SET allowed=$2`,
    [chatId, Boolean(allowed)],
  );
  await refreshAllowCache();
}

// Registra los grupos que existen para poder elegirlos en la interfaz. NO los
// habilita: solo anota que estan ahi, con su nombre.
export async function registerChats(chats) {
  for (const chat of chats) {
    await wq(
      `INSERT INTO wa_chats (chat_id, title, last_seen_at) VALUES ($1,$2,now())
       ON CONFLICT (chat_id) DO UPDATE
         SET title = COALESCE(NULLIF($2,''), wa_chats.title), last_seen_at = now()`,
      [chat.id, chat.title || ""],
    );
  }
  await refreshAllowCache();
}

export async function listChats() {
  const rows = await wq(
    `SELECT c.chat_id, c.title, c.allowed, c.active_meetup_id, c.last_seen_at,
            (s.chat_id IS NOT NULL) AS listening
       FROM wa_chats c LEFT JOIN wa_sessions s ON s.chat_id = c.chat_id
      ORDER BY c.allowed DESC, c.title ASC`,
  );
  return rows.map((r) => ({
    chatId: r.chat_id,
    title: r.title,
    allowed: r.allowed,
    listening: r.listening,
    meetupId: r.active_meetup_id,
    isGroup: String(r.chat_id).endsWith("@g.us"),
  }));
}

export async function ensureChat(chatId, title = "") {
  await wq(
    `INSERT INTO wa_chats (chat_id, title) VALUES ($1,$2)
     ON CONFLICT (chat_id) DO UPDATE SET title = COALESCE(NULLIF($2,''), wa_chats.title)`,
    [chatId, title],
  );
  return getChat(chatId);
}

// Ata una juntada al chat. El adminToken se guarda aca porque es lo que le
// permite al bot hacer cosas de organizador mas adelante.
export async function bindMeetup(chatId, meetupId, adminToken = "") {
  await ensureChat(chatId);
  // La linea de base de los avisos se fija ACA, con el ultimo evento que ya
  // tiene la juntada. Asi una juntada nueva (sin eventos) arranca en 0 y avisa
  // todo lo que pase; y si se ata una que ya venia jugada, no vomita el
  // historial. Hacerlo en el barrido no alcanzaba: si la juntada todavia no
  // tenia ningun evento, la base nunca quedaba fijada y el primer resultado se
  // perdia.
  const base = meetupId
    ? await wq1(`SELECT COALESCE(MAX(id), 0) AS id FROM juntada_events WHERE meetup_id=$1`, [meetupId])
    : null;
  await wq(
    `UPDATE wa_chats SET active_meetup_id=$2, admin_token=$3, last_event_id=$4 WHERE chat_id=$1`,
    [chatId, meetupId, adminToken, Number(base?.id ?? 0)],
  );
}

export async function getActiveMeetup(chatId) {
  const chat = await getChat(chatId);
  if (!chat?.active_meetup_id) return null;
  return { meetupId: chat.active_meetup_id, adminToken: chat.admin_token || "" };
}

// ── Avisos automaticos ──────────────────────────────────────────────────────

// Chats con una juntada atada: son los unicos donde hay algo que anunciar.
export async function chatsWithMeetup() {
  const rows = await wq(
    `SELECT chat_id, active_meetup_id, admin_token FROM wa_chats
      WHERE allowed = true AND active_meetup_id IS NOT NULL`,
  );
  return rows.map((r) => ({
    chatId: r.chat_id,
    meetupId: r.active_meetup_id,
    adminToken: r.admin_token || "",
  }));
}

export async function getLastEventId(chatId) {
  const row = await wq1(`SELECT last_event_id FROM wa_chats WHERE chat_id=$1`, [chatId]);
  return Number(row?.last_event_id ?? 0);
}

export async function setLastEventId(chatId, eventId) {
  await wq(`UPDATE wa_chats SET last_event_id=$2 WHERE chat_id=$1`, [chatId, Number(eventId) || 0]);
}

// ── Identidades ─────────────────────────────────────────────────────────────

// Cada numero tiene un `device_token` estable, que es lo que `store.mjs` usa
// para saber quien es "yo" al anotarse o tomar un item. Asi el bot puede obrar
// en nombre de cada persona sin inventar participantes duplicados.
export async function getIdentity(chatId, waId, displayName = "") {
  const existing = await wq1(`SELECT * FROM wa_identities WHERE chat_id=$1 AND wa_id=$2`, [
    chatId,
    waId,
  ]);
  if (existing) {
    if (displayName && displayName !== existing.display_name) {
      await wq(`UPDATE wa_identities SET display_name=$2 WHERE id=$1`, [existing.id, displayName]);
      existing.display_name = displayName;
    }
    return existing;
  }
  const row = {
    id: shortId(10),
    chat_id: chatId,
    wa_id: waId,
    display_name: displayName,
    device_token: `wa:${shortId(16)}`,
  };
  await wq(
    `INSERT INTO wa_identities (id, chat_id, wa_id, display_name, device_token)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (chat_id, wa_id) DO NOTHING`,
    [row.id, chatId, waId, displayName, row.device_token],
  );
  return (await wq1(`SELECT * FROM wa_identities WHERE chat_id=$1 AND wa_id=$2`, [chatId, waId])) || row;
}

// ── Mensajes ────────────────────────────────────────────────────────────────

export async function saveMessage({ chatId, waId, author, body, fromMe }) {
  await wq(
    `INSERT INTO wa_messages (chat_id, wa_id, author, body, from_me) VALUES ($1,$2,$3,$4,$5)`,
    [chatId, waId || "", author || "", body || "", Boolean(fromMe)],
  );
}

// Ventana de contexto para el agente: los ultimos N mensajes del chat.
export async function recentMessages(chatId, limit = 25) {
  const rows = await wq(
    `SELECT author, body, from_me, created_at FROM wa_messages
      WHERE chat_id=$1 ORDER BY id DESC LIMIT $2`,
    [chatId, limit],
  );
  return rows.reverse().map((r) => ({
    author: r.author,
    body: r.body,
    fromMe: r.from_me,
    at: r.created_at,
  }));
}

// Retencion: los mensajes son de conversaciones privadas, no se acumulan.
export async function purgeOldMessages(days = 7) {
  const rows = await wq(
    `DELETE FROM wa_messages WHERE created_at < now() - ($1 || ' days')::interval RETURNING id`,
    [String(days)],
  );
  return rows.length;
}
