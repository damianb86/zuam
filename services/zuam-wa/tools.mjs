// Herramientas del agente: el puente entre lo que se dice en el chat y las
// funciones que ya existen en `juntada/store.mjs`.
//
// Casi ninguna tiene logica propia a proposito: si aparece logica de juntadas
// aca, va en el lugar equivocado.
//
// Sobre quien es quien: cada numero de WhatsApp tiene un `device_token` estable
// (tabla `wa_identities`), asi que el bot sabe SIEMPRE quien esta hablando por
// el `pushName` del contacto. Por eso "yo lo llevo" se resuelve solo, y por eso
// se puede asignar algo a otra persona nombrandola.

import {
  addItem,
  addParticipants,
  assignItemsRandomly,
  autoFormTeams,
  claimForParticipant,
  createMeetup,
  createTable,
  deleteItem,
  deleteMeetup,
  generateTournamentRound,
  getState,
  getTablesPulse,
  joinMeetup,
  leaveMeetup,
  removeParticipant,
  setAdminMode,
  setParticipantAdmin,
  toggleClaim,
  updateMeetup,
} from "../zuam-api/juntada/store.mjs";
import { bindMeetup } from "./store.mjs";
import { config } from "./config.mjs";
import { normalize } from "./sessions.mjs";

const meetupLink = (id) => `${config.meetupBaseUrl.replace(/\/$/, "")}/j/${id}`;

// Busca por nombre sin exigir exactitud: la gente escribe "el fernet" o
// "nacho", no el id ni el nombre exacto de la lista.
function findByName(list, needle, key = "name") {
  const target = normalize(needle);
  if (!target) return null;
  return (
    list.find((entry) => normalize(entry[key]) === target) ||
    list.find((entry) => normalize(entry[key]).startsWith(target)) ||
    list.find((entry) => normalize(entry[key]).includes(target)) ||
    list.find((entry) => target.includes(normalize(entry[key]))) ||
    null
  );
}

// "yo", "mi", el propio nombre: todas formas de decir uno mismo.
const SELF_WORDS = new Set(["yo", "mi", "mio", "mia", "para mi", "yo mismo", "mismo"]);
function isSelfReference(who, displayName) {
  const target = normalize(who);
  if (!target) return true;
  if (SELF_WORDS.has(target)) return true;
  const me = normalize(displayName);
  return Boolean(me) && (target === me || target.includes(me) || me.includes(target));
}

// Resumen compacto. Va como resultado de herramienta: cuanto mas corto, menos
// tokens. Nada de volcar el estado crudo.
function summarize(state) {
  const going = state.participants.filter((p) => p.status === "in");
  const waiting = state.participants.filter((p) => p.status === "wait");
  const nameOf = (id) => state.participants.find((p) => p.id === id)?.name;
  const items = state.items.map((item) => ({
    item: item.label,
    cantidad: item.qty,
    obligatorio: item.required,
    lo_lleva: item.claims.map((c) => nameOf(c.participantId)).filter(Boolean).join(", ") || null,
  }));

  return {
    juntada: {
      titulo: state.meetup.title,
      fecha: state.meetup.date || null,
      hora: state.meetup.time || null,
      lugar: state.meetup.place || null,
      cupo: state.meetup.maxPlayers,
      modo_admins: state.meetup.adminMode,
      link: meetupLink(state.meetup.id),
    },
    van: going.map((p) => p.name),
    cuantos_van: going.length,
    en_espera: waiting.map((p) => p.name),
    admins: state.participants.filter((p) => p.isAdmin).map((p) => p.name),
    que_se_lleva: items,
    falta_cubrir: items.filter((it) => !it.lo_lleva).map((it) => it.item),
    equipos: state.teams.map((t) => ({
      equipo: t.name,
      jugadores: t.memberIds.map(nameOf).filter(Boolean),
    })),
    mesas: state.tables.map((t) => ({
      mesa: t.name,
      ronda: t.round,
      marcador: `${t.scoreBlue}-${t.scoreRed}`,
      estado: t.status,
    })),
  };
}

// Texto lindo para mandar al grupo con los equipos armados.
function teamsMessage(state) {
  const nameOf = (id) => state.participants.find((p) => p.id === id)?.name ?? "?";
  if (!state.teams.length) return "Todavia no hay equipos armados.";
  const lines = state.teams.map(
    (t) => `*${t.name}*\n${t.memberIds.map((id) => `  • ${nameOf(id)}`).join("\n")}`,
  );
  return `🃏 *Equipos*\n\n${lines.join("\n\n")}`;
}

// `ctx` = de que chat viene, quien hablo y con que juntada esta atado.
export function buildTools(ctx) {
  const needMeetup = () => {
    if (!ctx.meetupId) {
      return {
        error: "no_hay_juntada",
        mensaje: "Este chat todavia no tiene una juntada. Hay que crear una primero.",
      };
    }
    return null;
  };

  const state = async () => getState(ctx.meetupId, ctx.deviceToken, ctx.adminToken);

  // Resuelve a quien se refiere el pedido: si no nombran a nadie (o dicen
  // "yo"), es quien esta hablando.
  const resolvePerson = (current, who) => {
    if (!who || isSelfReference(who, ctx.displayName)) {
      return current.participants.find((p) => p.isMe)
        || findByName(current.participants, ctx.displayName)
        || null;
    }
    return findByName(current.participants, who);
  };

  const handlers = {
    // ── Lectura ─────────────────────────────────────────────────────────────
    ver_juntada: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      if (!current) return { error: "no_existe", mensaje: "La juntada ya no existe." };
      return summarize(current);
    },

    ver_mesas: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      const pulse = await getTablesPulse(ctx.meetupId);
      if (!pulse.tables.length) return { mensaje: "Todavia no hay mesas armadas." };
      return {
        ronda: pulse.round,
        mesas: pulse.tables.map((t) => ({
          mesa: t.name,
          azul: t.blue,
          rojo: t.red,
          marcador: `${t.scoreBlue}-${t.scoreRed}`,
          estado: t.status === "finished" ? `termino, gano ${t.winner === "blue" ? t.blue : t.red}` : "jugando",
        })),
      };
    },

    compartir_link: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      return {
        link: meetupLink(ctx.meetupId),
        titulo: current?.meetup.title,
        mensaje: "Mandalo tal cual al grupo.",
      };
    },

    // ── Juntada ─────────────────────────────────────────────────────────────
    crear_juntada: async ({ titulo, fecha, hora, lugar, items }) => {
      const created = await createMeetup({
        title: titulo,
        date: fecha || "",
        time: hora || "",
        place: lugar || "",
        items: (Array.isArray(items) ? items : []).map((label) => ({ label })),
      });
      await bindMeetup(ctx.chatId, created.id, created.adminToken);
      ctx.meetupId = created.id;
      ctx.adminToken = created.adminToken;
      return {
        creada: true,
        titulo,
        link: meetupLink(created.id),
        mensaje: "Pasale el link al grupo para que se anoten.",
      };
    },

    editar_juntada: async ({ titulo, fecha, hora, lugar, cupo, notas }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const patch = {};
      if (titulo !== undefined) patch.title = titulo;
      if (fecha !== undefined) patch.date = fecha;
      if (hora !== undefined) patch.time = hora;
      if (lugar !== undefined) patch.place = lugar;
      if (notas !== undefined) patch.notes = notas;
      if (cupo !== undefined) patch.maxPlayers = cupo;
      const result = await updateMeetup(ctx.meetupId, patch);
      if (!result) return { error: "no_existe" };
      const current = await state();
      return {
        actualizado: Object.keys(patch),
        juntada: summarize(current).juntada,
      };
    },

    borrar_juntada: async ({ confirmar }) => {
      const missing = needMeetup();
      if (missing) return missing;
      // Borrar es irreversible y se lleva puesto todo. Se exige que el modelo
      // mande `confirmar` explicito para que no pase por un malentendido.
      if (!confirmar) {
        return {
          error: "falta_confirmar",
          mensaje: "Preguntale al grupo si de verdad quieren borrarla, y recien ahi confirmá.",
        };
      }
      await deleteMeetup(ctx.meetupId);
      await bindMeetup(ctx.chatId, null, "");
      ctx.meetupId = null;
      return { borrada: true };
    },

    // ── Gente ───────────────────────────────────────────────────────────────
    anotarme: async ({ nombre }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const result = await joinMeetup(ctx.meetupId, ctx.deviceToken, nombre || ctx.displayName);
      if (!result) return { error: "no_existe" };
      return {
        anotado: nombre || ctx.displayName,
        estado: result.status === "wait" ? "en lista de espera (esta lleno)" : "adentro",
      };
    },

    anotar_a: async ({ nombres }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const list = Array.isArray(nombres) ? nombres : [nombres].filter(Boolean);
      const result = await addParticipants(ctx.meetupId, list);
      if (!result) return { error: "no_existe" };
      return { anotados: list, cuantos: result.added };
    },

    bajarme: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      const done = await leaveMeetup(ctx.meetupId, ctx.deviceToken);
      return done ? { baja: true } : { error: "no_estabas_anotado" };
    },

    bajar_a: async ({ nombre }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const person = findByName(current.participants, nombre);
      if (!person) return { error: "no_encontrado", mensaje: `No encuentro a ${nombre} en la lista.` };
      await removeParticipant(ctx.meetupId, person.id);
      return { baja: person.name };
    },

    // ── Administradores ─────────────────────────────────────────────────────
    modo_admins: async ({ modo }) => {
      const missing = needMeetup();
      if (missing) return missing;
      if (!["owner", "chosen", "all"].includes(modo)) {
        return { error: "modo_invalido", mensaje: "Los modos son: owner, chosen o all." };
      }
      await setAdminMode(ctx.meetupId, modo);
      const legible = { owner: "solo el que la creo", chosen: "los que se marquen", all: "cualquiera anotado" };
      return { modo, significa: legible[modo] };
    },

    hacer_admin: async ({ nombre, quitar }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const person = resolvePerson(current, nombre);
      if (!person) return { error: "no_encontrado", mensaje: `No encuentro a ${nombre} en la lista.` };
      // Marcar admins a mano solo tiene efecto en modo "chosen": si no, o
      // manda solo el dueno, o mandan todos. Se ajusta el modo para que el
      // pedido haga lo que se espera.
      if (current.meetup.adminMode !== "chosen" && !quitar) {
        await setAdminMode(ctx.meetupId, "chosen");
      }
      await setParticipantAdmin(ctx.meetupId, person.id, !quitar);
      return {
        [quitar ? "ya_no_es_admin" : "ahora_es_admin"]: person.name,
        modo: current.meetup.adminMode !== "chosen" && !quitar ? "chosen" : current.meetup.adminMode,
      };
    },

    // ── Qué llevar ──────────────────────────────────────────────────────────
    agregar_item: async ({ item, cantidad, obligatorio, quien, detalle }) => {
      const missing = needMeetup();
      if (missing) return missing;
      await addItem(ctx.meetupId, {
        label: item,
        qty: cantidad || 1,
        required: Boolean(obligatorio),
      });
      // Si de una ya dijeron quien lo lleva, se asigna en el mismo paso.
      if (quien) {
        const current = await state();
        const found = findByName(current.items, item, "label");
        const person = resolvePerson(current, quien);
        if (found && person) {
          await claimForParticipant(ctx.meetupId, person.id, found.id, true, detalle || "");
          return { agregado: item, lo_lleva: person.name };
        }
      }
      return { agregado: item };
    },

    quitar_item: async ({ item }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const found = findByName(current.items, item, "label");
      if (!found) return { error: "no_encontrado", mensaje: `No hay ningun "${item}" en la lista.` };
      await deleteItem(found.id);
      return { quitado: found.label };
    },

    // Sirve tanto para "yo llevo el fernet" como para "el fernet lo lleva
    // Nacho": si no nombran a nadie, es quien esta hablando.
    tomar_item: async ({ item, detalle, quien }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const found = findByName(current.items, item, "label");
      if (!found) {
        return {
          error: "no_encontrado",
          mensaje: `No hay un item "${item}". Los que hay: ${current.items.map((i) => i.label).join(", ") || "ninguno"}.`,
        };
      }

      const person = resolvePerson(current, quien);
      if (!person) {
        return {
          error: "no_encontrado",
          mensaje: `${quien} no esta anotado. Anotalo primero y despues le asigno el ${found.label}.`,
        };
      }
      if (person.status === "out") {
        return { error: "no_va", mensaje: `${person.name} avisó que no va.` };
      }

      // Si es uno mismo se usa el camino de siempre (device_token). Para otro,
      // se asigna por id de participante.
      if (person.isMe) {
        await toggleClaim(ctx.meetupId, ctx.deviceToken, found.id, true, detalle || "");
      } else {
        await claimForParticipant(ctx.meetupId, person.id, found.id, true, detalle || "");
      }
      return { toma: found.label, quien: person.name, detalle: detalle || null };
    },

    soltar_item: async ({ item, quien }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const found = findByName(current.items, item, "label");
      if (!found) return { error: "no_encontrado" };
      const person = resolvePerson(current, quien);
      if (!person) return { error: "no_encontrado" };
      if (person.isMe) await toggleClaim(ctx.meetupId, ctx.deviceToken, found.id, false);
      else await claimForParticipant(ctx.meetupId, person.id, found.id, false);
      return { solto: found.label, quien: person.name };
    },

    repartir_items: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      await assignItemsRandomly(ctx.meetupId);
      const current = await state();
      const resumen = summarize(current);
      return { repartido: true, que_se_lleva: resumen.que_se_lleva };
    },

    // ── Equipos y mesas ─────────────────────────────────────────────────────
    // "Tirar los reyes": arma los equipos al azar y devuelve el texto listo
    // para mandar al grupo.
    armar_equipos: async ({ jugadores_por_equipo }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const size = Math.max(1, Math.min(6, Math.round(jugadores_por_equipo || 2)));
      await autoFormTeams(ctx.meetupId, size);
      const current = await state();
      if (!current.teams.length) {
        return {
          error: "faltan_jugadores",
          mensaje: `Con los anotados no alcanza para equipos de ${size}.`,
        };
      }
      const sobran = current.participants.filter(
        (p) => p.status === "in" && !current.teams.some((t) => t.memberIds.includes(p.id)),
      );
      return {
        equipos: current.teams.length,
        mensaje_para_el_grupo: teamsMessage(current),
        sin_equipo: sobran.map((p) => p.name),
      };
    },

    armar_mesas: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const libres = current.teams.filter(
        (t) => !current.tables.some((m) => m.blueTeamId === t.id || m.redTeamId === t.id),
      );
      if (libres.length < 2) {
        return { error: "faltan_equipos", mensaje: "Hacen falta al menos dos equipos sin mesa." };
      }
      let creadas = 0;
      for (let i = 0; i + 1 < libres.length; i += 2) {
        await createTable(ctx.meetupId, {
          blueTeamId: libres[i].id,
          redTeamId: libres[i + 1].id,
          name: `Mesa ${current.tables.length + creadas + 1}`,
        });
        creadas += 1;
      }
      const after = await state();
      return {
        mesas_creadas: creadas,
        libre: libres.length % 2 === 1 ? libres[libres.length - 1].name : null,
        mesas: after.tables.map((t) => t.name),
      };
    },

    siguiente_ronda: async ({ modo }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const result = await generateTournamentRound(ctx.meetupId, modo || "winners-losers");
      if (!result.ok) return { error: "no_se_pudo", mensaje: result.error };
      const current = await state();
      const ronda = Math.max(...current.tables.map((t) => t.round));
      const nameOf = (id) => current.teams.find((t) => t.id === id)?.name ?? "?";
      return {
        ronda,
        cruces: current.tables
          .filter((t) => t.round === ronda)
          .map((t) => `${t.name}: ${nameOf(t.blueTeamId)} vs ${nameOf(t.redTeamId)}`),
      };
    },

    ver_campeon: async () => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const done = current.tables.filter((t) => t.status === "finished");
      if (!done.length) return { mensaje: "Todavia no termino ninguna mesa." };

      const nameOf = (id) => current.teams.find((t) => t.id === id)?.name ?? "?";
      const wins = new Map();
      for (const table of done) {
        const winner = table.winner === "blue" ? table.blueTeamId : table.redTeamId;
        if (winner) wins.set(winner, (wins.get(winner) || 0) + 1);
      }
      const ranking = [...wins.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ equipo: nameOf(id), ganadas: count }));

      const ultimaRonda = Math.max(...current.tables.map((t) => t.round));
      const terminoTodo = current.tables
        .filter((t) => t.round === ultimaRonda)
        .every((t) => t.status === "finished");

      return {
        ranking,
        campeon: terminoTodo && ranking.length ? ranking[0].equipo : null,
        torneo_terminado: terminoTodo,
      };
    },
  };

  return { handlers, definitions: TOOL_DEFINITIONS };
}

const noArgs = { type: "object", properties: {}, required: [], additionalProperties: false };

// Definiciones para la Responses API. Descripciones cortas y en castellano: el
// modelo elige mejor cuanto menos ambiguo sea.
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "ver_juntada",
    description:
      "Estado completo: quienes van, admins, que se lleva y quien lo lleva, equipos y mesas. Para cualquier pregunta sobre la juntada.",
    parameters: noArgs,
  },
  { type: "function", name: "ver_mesas", description: "Marcador de las mesas que se juegan ahora.", parameters: noArgs },
  {
    type: "function",
    name: "compartir_link",
    description: "Devuelve el link de la juntada para pegarlo en el grupo.",
    parameters: noArgs,
  },
  {
    type: "function",
    name: "crear_juntada",
    description: "Crea una juntada nueva y la ata a este chat. Solo si no hay una, o si piden otra.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Nombre corto, ej: 'Truco del viernes'" },
        fecha: { type: "string", description: "AAAA-MM-DD" },
        hora: { type: "string", description: "HH:MM" },
        lugar: { type: "string" },
        items: { type: "array", items: { type: "string" }, description: "Cosas para llevar mencionadas" },
      },
      required: ["titulo"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "editar_juntada",
    description:
      "Cambia datos de la juntada ya creada: titulo, fecha, hora, lugar, cupo o notas. Mandá solo lo que cambia.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        fecha: { type: "string", description: "AAAA-MM-DD" },
        hora: { type: "string", description: "HH:MM" },
        lugar: { type: "string" },
        cupo: { type: "number", description: "Maximo de jugadores" },
        notas: { type: "string" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "borrar_juntada",
    description:
      "Borra la juntada entera y todo lo que tiene. Irreversible: primero preguntá y solo despues llamala con confirmar=true.",
    parameters: {
      type: "object",
      properties: { confirmar: { type: "boolean", description: "true solo si ya dijeron que si" } },
      required: ["confirmar"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "anotarme",
    description: "Anota a la persona que escribio el mensaje.",
    parameters: {
      type: "object",
      properties: { nombre: { type: "string", description: "Solo si pidio otro nombre" } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "anotar_a",
    description: "Anota a otras personas nombradas por quien escribe.",
    parameters: {
      type: "object",
      properties: { nombres: { type: "array", items: { type: "string" } } },
      required: ["nombres"],
      additionalProperties: false,
    },
  },
  { type: "function", name: "bajarme", description: "Da de baja a quien escribio.", parameters: noArgs },
  {
    type: "function",
    name: "bajar_a",
    description: "Da de baja a otra persona de la lista.",
    parameters: {
      type: "object",
      properties: { nombre: { type: "string" } },
      required: ["nombre"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "modo_admins",
    description:
      "Como se decide quien puede organizar: 'owner' (solo el que la creo), 'chosen' (los marcados) o 'all' (cualquier anotado).",
    parameters: {
      type: "object",
      properties: { modo: { type: "string", enum: ["owner", "chosen", "all"] } },
      required: ["modo"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "hacer_admin",
    description: "Da (o saca) permisos de organizador a alguien de la lista.",
    parameters: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Vacio = quien escribe" },
        quitar: { type: "boolean", description: "true para sacarle el permiso" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "agregar_item",
    description: "Agrega algo a la lista de cosas para llevar. Si ya dijeron quien lo lleva, pasalo en 'quien'.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
        cantidad: { type: "number" },
        obligatorio: { type: "boolean" },
        quien: { type: "string", description: "Nombre de quien se hace cargo, si lo dijeron" },
        detalle: { type: "string" },
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "quitar_item",
    description: "Saca algo de la lista de cosas para llevar.",
    parameters: {
      type: "object",
      properties: { item: { type: "string" } },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "tomar_item",
    description:
      "Marca quien se hace cargo de algo. Si no se nombra a nadie es quien escribio ('yo llevo el fernet'); si nombran a otro, se le asigna a esa persona ('el fernet lo lleva Nacho').",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
        detalle: { type: "string", description: "Ej: la marca, el gusto, la cantidad" },
        quien: { type: "string", description: "Nombre. Vacio = quien escribe" },
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "soltar_item",
    description: "Deshace: alguien deja de hacerse cargo de algo.",
    parameters: {
      type: "object",
      properties: { item: { type: "string" }, quien: { type: "string" } },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "repartir_items",
    description: "Reparte al azar lo que nadie tomo, sin pisar lo ya elegido.",
    parameters: noArgs,
  },
  {
    type: "function",
    name: "armar_equipos",
    description:
      "Tirar los reyes: arma los equipos al azar con los anotados. Devuelve un texto listo para mandar al grupo.",
    parameters: {
      type: "object",
      properties: { jugadores_por_equipo: { type: "number", description: "2 para 2v2, 3 para 3v3" } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "armar_mesas",
    description: "Cruza los equipos que no tienen mesa y crea las mesas de la primera ronda.",
    parameters: noArgs,
  },
  {
    type: "function",
    name: "siguiente_ronda",
    description:
      "Genera la ronda siguiente del torneo. Modos: winners-losers (ganadores entre si), cross (ganadores vs perdedores), all (mezcla todos).",
    parameters: {
      type: "object",
      properties: { modo: { type: "string", enum: ["winners-losers", "cross", "all"] } },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "ver_campeon",
    description: "Ranking de equipos por partidos ganados, y el campeon si el torneo termino.",
    parameters: noArgs,
  },
];

export const READ_ONLY_TOOLS = new Set(["ver_juntada", "ver_mesas", "compartir_link", "ver_campeon"]);
