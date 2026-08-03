// Herramientas del agente: el puente entre lo que se dice en el chat y las
// funciones que ya existen en `juntada/store.mjs`.
//
// Fase 2 = las de lectura. Fase 3 = las que escriben (marcadas WRITE).
// Casi ninguna tiene logica propia a proposito: si aparece logica de juntadas
// aca, va en el lugar equivocado.

import {
  addItem,
  addParticipants,
  autoFormTeams,
  createMeetup,
  getState,
  getTablesPulse,
  joinMeetup,
  leaveMeetup,
  removeParticipant,
  toggleClaim,
} from "../zuam-api/juntada/store.mjs";
import { bindMeetup } from "./store.mjs";
import { config } from "./config.mjs";
import { normalize } from "./sessions.mjs";

const meetupLink = (id) => `${config.meetupBaseUrl.replace(/\/$/, "")}/j/${id}`;

// Busca por nombre sin exigir exactitud: la gente escribe "el fernet", no el id.
function findByName(list, needle, key = "name") {
  const target = normalize(needle);
  if (!target) return null;
  return (
    list.find((entry) => normalize(entry[key]) === target) ||
    list.find((entry) => normalize(entry[key]).includes(target)) ||
    list.find((entry) => target.includes(normalize(entry[key]))) ||
    null
  );
}

// "yo", "mi", el propio nombre: todas formas de decir uno mismo.
const SELF_WORDS = new Set(["yo", "mi", "mio", "mia", "para mi", "yo mismo"]);
function isSelfReference(who, displayName) {
  const target = normalize(who);
  if (!target) return true;
  if (SELF_WORDS.has(target)) return true;
  const me = normalize(displayName);
  return Boolean(me) && (target === me || target.includes(me) || me.includes(target));
}

// Resumen compacto de la juntada. Va como resultado de herramienta, asi que
// cuanto mas corto, menos tokens: nada de volcar el estado crudo.
function summarize(state) {
  const going = state.participants.filter((p) => p.status === "in");
  const waiting = state.participants.filter((p) => p.status === "wait");
  const items = state.items.map((item) => {
    const takenBy = item.claims
      .map((claim) => going.find((p) => p.id === claim.participantId)?.name)
      .filter(Boolean);
    return {
      item: item.label,
      cantidad: item.qty,
      obligatorio: item.required,
      lo_lleva: takenBy.length ? takenBy.join(", ") : null,
    };
  });
  return {
    juntada: {
      titulo: state.meetup.title,
      fecha: state.meetup.date || null,
      hora: state.meetup.time || null,
      lugar: state.meetup.place || null,
      cupo: state.meetup.maxPlayers,
      link: meetupLink(state.meetup.id),
    },
    van: going.map((p) => p.name),
    cuantos_van: going.length,
    en_espera: waiting.map((p) => p.name),
    que_se_lleva: items,
    falta_cubrir: items.filter((it) => !it.lo_lleva).map((it) => it.item),
  };
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

  const handlers = {
    // ── Lectura (Fase 2) ────────────────────────────────────────────────────
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
          estado: t.status === "done" ? `terminada, gano ${t.winner === "blue" ? t.blue : t.red}` : "jugando",
        })),
      };
    },

    // ── Escritura (Fase 3) ──────────────────────────────────────────────────
    crear_juntada: async ({ titulo, fecha, hora, lugar, items }) => {
      const created = await createMeetup({
        title: titulo,
        date: fecha || "",
        time: hora || "",
        place: lugar || "",
        items: (Array.isArray(items) ? items : []).map((label) => ({ label })),
      });
      // El chat queda atado a esta juntada: "la juntada" en la charla es esta.
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

    agregar_item: async ({ item, cantidad, obligatorio }) => {
      const missing = needMeetup();
      if (missing) return missing;
      await addItem(ctx.meetupId, {
        label: item,
        qty: cantidad || 1,
        required: Boolean(obligatorio),
      });
      return { agregado: item };
    },

    tomar_item: async ({ item, detalle, quien }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const current = await state();
      const found = findByName(current.items, item, "label");
      if (!found) {
        return {
          error: "no_encontrado",
          mensaje: `No hay un item que se llame "${item}". Los que hay: ${current.items.map((i) => i.label).join(", ") || "ninguno"}.`,
        };
      }
      // Solo se puede tomar algo en nombre propio: `toggleClaim` necesita el
      // deviceToken de quien lo toma, y el bot solo tiene el de quien hablo.
      // Ojo: el modelo suele mandar `quien: "yo"` al traducir "yo llevo el
      // fernet". Eso ES uno mismo, no otra persona.
      if (quien && !isSelfReference(quien, ctx.displayName)) {
        return {
          error: "solo_uno_mismo",
          mensaje: `Cada uno toma lo suyo. Que ${quien} lo escriba, o se marca desde el link.`,
        };
      }
      const me = current.participants.find((p) => p.isMe);
      if (!me) {
        return {
          error: "no_estas_anotado",
          mensaje: "Primero hay que anotarse en la juntada para poder llevar algo.",
        };
      }
      await toggleClaim(ctx.meetupId, ctx.deviceToken, found.id, true, detalle || "");
      return { toma: found.label, quien: me.name, detalle: detalle || null };
    },

    armar_equipos: async ({ jugadores_por_equipo }) => {
      const missing = needMeetup();
      if (missing) return missing;
      const teams = await autoFormTeams(ctx.meetupId, jugadores_por_equipo || 2);
      if (!teams || !teams.length) {
        return { error: "faltan_jugadores", mensaje: "No hay suficientes anotados para armar equipos." };
      }
      return { equipos: teams.length, mensaje: "Equipos armados. Se ven en el link de la juntada." };
    },
  };

  return { handlers, definitions: TOOL_DEFINITIONS };
}

// Definiciones para la Responses API. Descripciones cortas y en castellano:
// el modelo es nano y cuanto menos ambiguo, mejor elige.
export const TOOL_DEFINITIONS = [
  {
    type: "function",
    name: "ver_juntada",
    description:
      "Estado de la juntada activa: quienes van, cuantos son, que se lleva y que falta cubrir. Usala para cualquier pregunta sobre quien va o que falta.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "ver_mesas",
    description: "Marcador de las mesas que se estan jugando ahora.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "crear_juntada",
    description:
      "Crea una juntada nueva y la ata a este chat. Solo si todavia no hay una, o si piden explicitamente armar otra.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Nombre corto, ej: 'Truco del viernes'" },
        fecha: { type: "string", description: "AAAA-MM-DD si la dijeron" },
        hora: { type: "string", description: "HH:MM si la dijeron" },
        lugar: { type: "string" },
        items: {
          type: "array",
          items: { type: "string" },
          description: "Cosas para llevar mencionadas, ej: ['fernet','hielo']",
        },
      },
      required: ["titulo"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "anotarme",
    description: "Anota en la juntada a la persona que escribio el mensaje.",
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
    description: "Anota a otras personas que la que escribe menciona por nombre.",
    parameters: {
      type: "object",
      properties: { nombres: { type: "array", items: { type: "string" } } },
      required: ["nombres"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "bajarme",
    description: "Da de baja de la juntada a quien escribio el mensaje.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
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
    name: "agregar_item",
    description: "Agrega algo a la lista de cosas para llevar.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
        cantidad: { type: "number" },
        obligatorio: { type: "boolean" },
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "tomar_item",
    description:
      "Marca que quien escribio se hace cargo de algo de la lista ('yo llevo el fernet').",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string" },
        detalle: { type: "string", description: "Ej: la marca o el gusto" },
        quien: { type: "string", description: "Solo si lo toma otra persona" },
      },
      required: ["item"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "armar_equipos",
    description: "Arma los equipos al azar con los que estan anotados.",
    parameters: {
      type: "object",
      properties: { jugadores_por_equipo: { type: "number" } },
      required: [],
      additionalProperties: false,
    },
  },
];

export const READ_ONLY_TOOLS = new Set(["ver_juntada", "ver_mesas"]);
