// El agente: OpenAI Responses API + las herramientas de las juntadas.
//
// IMPORTANTE: este modulo solo se invoca cuando el filtro de JS ya decidio que
// el bot tiene que actuar. Un mensaje que no abre sesion no llega hasta aca y
// por lo tanto no gasta un solo token. Ver `sessions.mjs` y `bot.mjs`.

import { config } from "./config.mjs";
import { buildTools, READ_ONLY_TOOLS } from "./tools.mjs";
import { ambientInput, ambientPrompt, parseDecision } from "./ambient.mjs";

const SYSTEM = `Sos el bot de una juntada de truco entre amigos argentinos.

Como hablas:
- Castellano rioplatense, informal, con voseo. Como uno mas del grupo.
- CORTO. Una o dos lineas. Es un chat de WhatsApp, no un informe.
- Sin saludos formales y sin "como puedo ayudarte".
- NADA de markdown. WhatsApp no lo entiende: **esto** se ve literal y queda
  horrible. Si necesitas resaltar algo, *un asterisco solo*. Sin titulos, sin
  listas con guiones, sin tablas.

Que haces:
- Organizas la juntada: quien va, que se lleva, equipos, mesas.
- Nunca inventes datos de la juntada (quien va, que falta, marcadores). Si no
  te lo dio una herramienta ni esta en el estado de abajo, no lo sabes.

Como actuas:
- ACTUA, no interrogues. Si te dicen "armemos una el viernes", la armas ya con
  lo que tengas. Fecha, hora y lugar son opcionales: lo que no sepas, lo dejas
  vacio. Se completa despues desde el link.
- Nunca pidas una fecha en formato AAAA-MM-DD: eso lo resolves vos con el dato
  de hoy que tenes mas abajo. "El viernes" es la fecha del proximo viernes.
- Una sola pregunta como maximo, y solo si sin eso no podes hacer nada.

Quien es quien:
- Abajo dice quien escribio el mensaje. Si dicen "yo llevo el fernet" o
  "anotame", es esa persona: no preguntes el nombre.
- Si nombran a otro ("el fernet lo lleva Nacho", "hacé admin a Pepe"), pasá ese
  nombre en el parametro correspondiente. No hace falta que sea exacto.

Detalles:
- Si una herramienta devuelve "mensaje_para_el_grupo", mandalo TAL CUAL, sin
  reescribirlo y sin agregarle nada: ya viene con el formato de WhatsApp.
- Si una herramienta devuelve un error, explicalo en criollo y en una linea.
- Cuando creas una juntada, siempre pasa el link.
- Borrar la juntada es lo unico irreversible: preguntá primero y recien cuando
  te digan que si, llamá a la herramienta con confirmar=true.

Lo que NO haces:
- No sos un asistente de proposito general. Si te preguntan cualquier cosa que
  no tenga que ver con la juntada, el truco o el grupo (geografia, recetas,
  codigo, noticias, lo que sea), NO la contestes aunque sepas la respuesta.
  Respondes algo corto tipo "de eso no se, yo soy para la juntada" y listo.`;

// "lunes 3 de agosto de 2026 (2026-08-03)". El nombre del dia importa: sin el,
// el modelo no puede resolver "el viernes".
function todayInArgentina() {
  const now = new Date();
  const opts = { timeZone: "America/Argentina/Buenos_Aires" };
  const long = now.toLocaleDateString("es-AR", { ...opts, dateStyle: "full" });
  const iso = new Intl.DateTimeFormat("en-CA", { ...opts, dateStyle: "short" }).format(now);
  return `${long} (${iso})`;
}

// Contexto: los ultimos mensajes del chat, para que entienda "yo llevo eso".
function buildInput(history, latest, snapshot) {
  const input = [];
  // El estado va servido de entrada. Sin esto el modelo llamaba a
  // `ver_juntada` antes de cada accion: una vuelta entera de mas por mensaje.
  if (snapshot) {
    input.push({
      role: "user",
      content:
        `[Estado actual de la juntada, ya consultado. No llames ver_juntada ` +
        `salvo que necesites algo que no este aca]\n${JSON.stringify(snapshot)}`,
    });
  }
  if (history.length) {
    const transcript = history
      .map((m) => `${m.author || "alguien"}: ${m.body}`)
      .join("\n")
      .slice(-2000);
    input.push({
      role: "user",
      content: `[Contexto de lo que se venia hablando en el grupo]\n${transcript}`,
    });
  }
  input.push({ role: "user", content: latest });
  return input;
}

async function callOpenAi(payload) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.openaiTimeoutMs),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI devolvio ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function extractText(data) {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  const chunks = [];
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && part.text) chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

const functionCalls = (data) => (data?.output || []).filter((item) => item?.type === "function_call");

/**
 * Corre el agente sobre un mensaje.
 *
 * @param {object} ctx  chatId, meetupId, adminToken, deviceToken, displayName
 * @param {string} text lo que se le dijo, ya sin la palabra de invocacion
 * @param {Array}  history mensajes recientes para contexto
 * @param {object} opts { readOnly } para limitar a las herramientas de lectura
 * @returns {Promise<{reply:string, toolsUsed:string[]}>}
 */
export async function runAgent(ctx, text, history = [], opts = {}) {
  if (!config.openaiKey) {
    return { reply: "Me falta la clave de OpenAI, avisale al que me programo.", toolsUsed: [] };
  }

  const { handlers, definitions } = buildTools(ctx);
  const tools = opts.readOnly
    ? definitions.filter((tool) => READ_ONLY_TOOLS.has(tool.name))
    : definitions;

  // Una sola consulta a la base antes de arrancar, en vez de una vuelta con el
  // modelo. Es mas rapido y mas barato.
  let snapshot = null;
  if (ctx.meetupId) {
    try {
      snapshot = await handlers.ver_juntada({});
    } catch {
      snapshot = null; // Si falla, el modelo siempre puede pedirlo por tool.
    }
  }

  const input = buildInput(history, text, snapshot);
  const toolsUsed = [];

  // Loop acotado: el modelo pide herramientas, se las damos, vuelve a pensar.
  // El tope evita que un modelo confundido gaste tokens en circulos.
  for (let turn = 0; turn < config.maxToolTurns; turn += 1) {
    const data = await callOpenAi({
      model: config.model,
      // La fecha va en las instrucciones para que pueda resolver "el viernes"
      // sin preguntar. El modelo no tiene idea de que dia es hoy.
      instructions:
        `${SYSTEM}\n\nHoy es ${todayInArgentina()}.` +
        `\nQuien te esta escribiendo ahora es: ${ctx.displayName || "alguien del grupo"}.`,
      input,
      tools,
      parallel_tool_calls: false,
      max_output_tokens: config.maxOutputTokens,
      reasoning: { effort: config.reasoningEffort },
    });

    const calls = functionCalls(data);
    if (!calls.length) {
      return { reply: extractText(data), toolsUsed };
    }

    for (const call of calls) {
      const handler = handlers[call.name];
      let result;
      if (!handler) {
        result = { error: "herramienta_desconocida" };
      } else {
        try {
          result = await handler(JSON.parse(call.arguments || "{}"));
        } catch (error) {
          result = { error: "fallo", mensaje: error?.message || "algo se rompio" };
        }
      }
      toolsUsed.push(call.name);
      input.push({ type: "function_call", call_id: call.call_id, name: call.name, arguments: call.arguments });
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) });
    }
  }

  return {
    reply: "Me hice un lio con eso, probá de nuevo mas simple.",
    toolsUsed,
  };
}

/**
 * Modo despierto: mira la charla y decide si mete un bocadillo.
 * Sin herramientas a proposito — aca solo puede opinar, no tocar la juntada.
 * Para cambiar algo tienen que nombrarlo.
 *
 * @returns {Promise<{hablar:boolean, texto?:string}>}
 */
export async function runAmbient(ctx, history, snapshot, wokeAt) {
  if (!config.openaiKey) return { hablar: false };

  const data = await callOpenAi({
    model: config.model,
    instructions: `${ambientPrompt()}\n\nHoy es ${todayInArgentina()}.`,
    input: ambientInput({ history, snapshot, wokeAt }),
    max_output_tokens: config.maxOutputTokens,
    reasoning: { effort: config.reasoningEffort },
  });

  return parseDecision(extractText(data));
}
