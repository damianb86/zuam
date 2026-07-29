// Rutas HTTP de las juntadas de truco.
//
// Se enganchan en server.mjs. Caddy manda `/api/*` acá quitando el prefijo, así
// que aceptamos las dos formas (`/juntada/...` y `/api/juntada/...`), igual que
// hacen las rutas de chat y contacto.

import {
  addItem, addParticipants, assignItemsRandomly, autoFormTeams, createMeetup, createTable,
  deleteItem, deleteMeetup, deleteTable, generateTournamentRound, getState, getTablesPulse,
  getTableState, isOwner, joinMeetup, pushTableScore, setAdminMode, setParticipantAdmin,
  setTeams, toggleClaim, updateItem, updateTable, verifyAdmin,
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

  // GET /juntada/:id/pulse → latido chico para el contador (cada 15s)
  if (section === "pulse" && method === "GET") {
    return send(200, await getTablesPulse(meetupId));
  }

  // DELETE /juntada/:id → borrar la juntada entera (admin)
  if (!section && method === "DELETE") {
    if (!(await verifyAdmin(meetupId, searchParams.get("admin"), searchParams.get("device")))) {
      return forbidden(send);
    }
    await deleteMeetup(meetupId);
    return send(200, { ok: true });
  }

  // POST /juntada/:id/participants → alta manual de uno o varios (admin)
  if (section === "participants" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
    const result = await addParticipants(meetupId, body.names ?? [body.name]);
    if (!result) return notFound(send);
    if (!result.added) return send(400, { error: "Escribí al menos un nombre." });
    return send(201, result);
  }

  // POST /juntada/:id/admins → modo de administración y quiénes mandan (dueño)
  if (section === "admins" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await isOwner(meetupId, body.admin))) {
      return send(403, { error: "Sólo quien creó la juntada puede cambiar los permisos." });
    }
    if (typeof body.mode === "string") await setAdminMode(meetupId, body.mode);
    if (body.participantId) await setParticipantAdmin(meetupId, body.participantId, body.on !== false);
    return send(200, { ok: true });
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
      if (!(await verifyAdmin(meetupId, searchParams.get("admin"), searchParams.get("device")))) return forbidden(send);
      const itemId = searchParams.get("itemId");
      if (!itemId) return send(400, { error: "Falta el ítem." });
      await deleteItem(itemId);
      return send(200, { ok: true });
    }
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
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
    if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
    await assignItemsRandomly(meetupId);
    return send(200, { ok: true });
  }

  // POST /juntada/:id/teams
  if (section === "teams" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
    if (body.mode === "set" && Array.isArray(body.teams)) await setTeams(meetupId, body.teams);
    else await autoFormTeams(meetupId, Math.max(1, Math.min(6, Math.round(body.teamSize || 2))));
    return send(200, { ok: true });
  }

  // POST /juntada/:id/tournament
  if (section === "tournament" && method === "POST") {
    const body = (await readBody()) || {};
    if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
    const result = await generateTournamentRound(meetupId, body.mode ?? "winners-losers", body.pairs ?? []);
    return result.ok ? send(200, result) : send(400, { error: result.error });
  }

  // Mesas
  if (section === "table") {
    // POST /juntada/:id/table → crear (organizador)
    if (!param && method === "POST") {
      const body = (await readBody()) || {};
      if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
      await createTable(meetupId, body);
      return send(201, { ok: true });
    }
    if (!param) return send(405, { error: "Método no permitido." });

    // GET /juntada/:id/table/:tableId → datos de la mesa (se pide una sola vez,
    // al abrir el contador: equipos, jugadores y a cuánto se juega)
    if (method === "GET") {
      const state = await getTableState(param);
      return state ? send(200, state) : send(404, { error: "Mesa no encontrada." });
    }

    // POST /juntada/:id/table/:tableId/score → subir el resultado.
    // Lo manda el contador al aplicar una mano: sólo los puntos.
    if (method === "POST" && sub === "score") {
      const body = (await readBody()) || {};
      if (typeof body.scoreBlue !== "number" || typeof body.scoreRed !== "number") {
        return send(400, { error: "Datos incompletos." });
      }
      const result = await pushTableScore(param, body);
      return result ? send(200, result) : send(404, { error: "Mesa no encontrada." });
    }

    // PATCH → asignar equipos / renombrar (organizador)
    if (method === "PATCH") {
      const body = (await readBody()) || {};
      if (!(await verifyAdmin(meetupId, body.admin, body.device))) return forbidden(send);
      await updateTable(param, body);
      return send(200, { ok: true });
    }

    // DELETE → borrar la mesa (organizador)
    if (method === "DELETE") {
      if (!(await verifyAdmin(meetupId, searchParams.get("admin"), searchParams.get("device")))) return forbidden(send);
      await deleteTable(param);
      return send(200, { ok: true });
    }
  }

  return send(404, { error: "Not found." });
}
