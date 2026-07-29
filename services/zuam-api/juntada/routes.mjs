// Rutas HTTP de las juntadas de truco.
//
// Se enganchan en server.mjs. Caddy manda `/api/*` acá quitando el prefijo, así
// que aceptamos las dos formas (`/juntada/...` y `/api/juntada/...`), igual que
// hacen las rutas de chat y contacto.

import {
  addItem, assignItemsRandomly, autoFormTeams, createMeetup, createTable, deleteItem,
  deleteTable, generateTournamentRound, getState, getTableState, joinMeetup, setTeams,
  syncTableMatch, toggleClaim, updateItem, updateTable, verifyAdmin,
} from "./store.mjs";

// Devuelve los segmentos de la ruta si es de juntadas, o null si no lo es.
// "/api/juntada/abc/state" → ["abc", "state"]
export function juntadaSegments(path) {
  const match = /^(?:\/api)?\/juntada(?:\/(.*))?$/.exec(path);
  if (!match) return null;
  return match[1] ? match[1].split("/").filter(Boolean) : [];
}

const forbidden = (send) => send(403, { error: "Sólo el organizador puede hacer esto." });
const notFound = (send) => send(404, { error: "Juntada no encontrada." });

// `send(status, body)` y `readBody()` los provee server.mjs para no duplicar
// el manejo de CORS, límites de tamaño ni el formato de respuesta.
export async function handleJuntada({ method, segments, searchParams, send, readBody }) {
  // POST /juntada → crear
  if (segments.length === 0) {
    if (method !== "POST") return send(405, { error: "Método no permitido." });
    const body = (await readBody()) || {};
    if (typeof body.title !== "string" || !body.title.trim()) {
      return send(400, { error: "Falta el título de la juntada." });
    }
    const created = await createMeetup(body);
    return send(201, created);
  }

  const [meetupId, section, param, sub] = segments;

  // GET /juntada/:id/state
  if (section === "state" && method === "GET") {
    const state = await getState(meetupId, searchParams.get("device"), searchParams.get("admin"));
    return state ? send(200, state) : notFound(send);
  }

  // POST /juntada/:id/join
  if (section === "join" && method === "POST") {
    const body = (await readBody()) || {};
    if (!body.device || !String(body.name || "").trim()) {
      return send(400, { error: "Falta nombre o identificador de dispositivo." });
    }
    const result = await joinMeetup(meetupId, body.device, body.name);
    return result ? send(200, result) : notFound(send);
  }

  // POST /juntada/:id/claim
  if (section === "claim" && method === "POST") {
    const body = (await readBody()) || {};
    if (!body.device || !body.itemId) return send(400, { error: "Datos incompletos." });
    await toggleClaim(meetupId, body.device, body.itemId, body.on !== false, body.detail ?? "");
    return send(200, { ok: true });
  }

  // Ítems (organizador): POST agregar · PATCH editar · DELETE quitar
  if (section === "item") {
    if (method === "DELETE") {
      if (!(await verifyAdmin(meetupId, searchParams.get("admin")))) return forbidden(send);
      const itemId = searchParams.get("itemId");
      if (!itemId) return send(400, { error: "Falta el ítem." });
      await deleteItem(itemId);
      return send(200, { ok: true });
    }
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin))) return forbidden(send);
    if (method === "POST") {
      if (!String(body.label || "").trim()) return send(400, { error: "Falta el ítem." });
      await addItem(meetupId, body);
      return send(201, { ok: true });
    }
    if (method === "PATCH") {
      if (!body.itemId) return send(400, { error: "Falta el ítem." });
      await updateItem(body.itemId, body);
      return send(200, { ok: true });
    }
    return send(405, { error: "Método no permitido." });
  }

  // POST /juntada/:id/assign-items
  if (section === "assign-items" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin))) return forbidden(send);
    await assignItemsRandomly(meetupId);
    return send(200, { ok: true });
  }

  // POST /juntada/:id/teams
  if (section === "teams" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin))) return forbidden(send);
    if (body.mode === "set" && Array.isArray(body.teams)) await setTeams(meetupId, body.teams);
    else await autoFormTeams(meetupId, Math.max(1, Math.min(6, Math.round(body.teamSize || 2))));
    return send(200, { ok: true });
  }

  // POST /juntada/:id/tournament
  if (section === "tournament" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin))) return forbidden(send);
    const result = await generateTournamentRound(meetupId, body.mode ?? "winners-losers", body.pairs ?? []);
    return result.ok ? send(200, result) : send(400, { error: result.error });
  }

  // Mesas
  if (section === "table") {
    // POST /juntada/:id/table → crear (organizador)
    if (!param && method === "POST") {
      const body = (await readBody()) || {};
      if (!(await verifyAdmin(meetupId, body.admin))) return forbidden(send);
      await createTable(meetupId, body);
      return send(201, { ok: true });
    }
    if (!param) return send(405, { error: "Método no permitido." });
    void sub;

    // GET /juntada/:id/table/:tableId → estado de la mesa (contador)
    if (method === "GET") {
      const state = await getTableState(param);
      return state ? send(200, state) : send(404, { error: "Mesa no encontrada." });
    }

    // POST → sincronizar la partida (cualquiera de la mesa)
    if (method === "POST") {
      const body = (await readBody()) || {};
      if (!body.match || typeof body.baseVersion !== "number") {
        return send(400, { error: "Datos incompletos." });
      }
      const result = await syncTableMatch(param, { match: body.match, baseVersion: body.baseVersion });
      return result ? send(200, result) : send(404, { error: "Mesa no encontrada." });
    }

    // PATCH → asignar equipos / renombrar (organizador)
    if (method === "PATCH") {
      const body = (await readBody()) || {};
      if (!(await verifyAdmin(meetupId, body.admin))) return forbidden(send);
      await updateTable(param, body);
      return send(200, { ok: true });
    }

    // DELETE → borrar la mesa (organizador)
    if (method === "DELETE") {
      if (!(await verifyAdmin(meetupId, searchParams.get("admin")))) return forbidden(send);
      await deleteTable(param);
      return send(200, { ok: true });
    }
  }

  return send(404, { error: "Not found." });
}
