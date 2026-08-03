// Bot de WhatsApp de las juntadas (Fases 0 a 4).
//
// EL EMBUDO, que es lo que importa entender de este archivo:
//
//   1. Todo mensaje pasa por filtros de JS puro. Sin sesion abierta y sin
//      invocacion, muere aca: no se guarda, no se lee, NO CUESTA UN TOKEN.
//   2. Con `@truco` (comparacion de strings, sin IA) se abre la sesion.
//   3. Con la sesion abierta, el grupo se guarda como contexto. Las frases
//      evidentes ("yo llevo el fernet") se resuelven con regex y un 👍:
//      tampoco cuestan tokens.
//   4. Solo cuando le hablan al bot directamente entra OpenAI.
//
// O sea: la IA es el ultimo escalon, no el primero.

import { rm } from "node:fs/promises";
import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { config } from "./config.mjs";
import { hasTrigger, isDismissal, isStaleTimestamp, stripTrigger } from "./sessions.mjs";
import {
  bindMeetup,
  endSession,
  ensureChat,
  ensureWaSchema,
  getActiveMeetup,
  getIdentity,
  getSession,
  isAllowed,
  purgeOldMessages,
  recentMessages,
  registerChats,
  saveMessage,
  startSession,
  touchSession,
} from "./store.mjs";
import { detectIntent } from "./intents.mjs";
import { runAgent, runAmbient } from "./agent.mjs";
import { shouldConsiderSpeaking } from "./ambient.mjs";
import { buildTools } from "./tools.mjs";
import { startAdminServer } from "./admin.mjs";

const log = (event, data = {}) =>
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));

// El estado vive en Postgres desde la Fase 1: sobrevive al contenedor, no solo
// al proceso.
await ensureWaSchema();

// Retencion: los mensajes leidos son charla privada, no un archivo historico.
setInterval(
  () => {
    purgeOldMessages(config.retentionDays)
      .then((deleted) => deleted && log("purged", { deleted }))
      .catch((error) => log("purge_failed", { message: error?.message }));
  },
  6 * 60 * 60 * 1000,
).unref();

// --- Extraccion del texto -------------------------------------------------
// Baileys entrega el contenido en una union de tipos segun como se mando.
function extractText(message) {
  const content = message?.message;
  if (!content) return "";
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.ephemeralMessage?.message?.conversation ||
    content.ephemeralMessage?.message?.extendedTextMessage?.text ||
    ""
  );
}

// "5493498477549:12@s.whatsapp.net" y "73186494394537@lid" → solo el numero.
function bareId(jid) {
  return String(jid || "").split("@")[0].split(":")[0];
}

function contextInfo(message) {
  const content = message?.message;
  return content?.extendedTextMessage?.contextInfo || content?.imageMessage?.contextInfo || null;
}

// El bot se da por aludido con: una mencion real a su JID, una respuesta a un
// mensaje suyo, o una de las palabras de invocacion configuradas.
function isAddressed(message, text, selfIds) {
  const ctx = contextInfo(message);
  const mentioned = ctx?.mentionedJid || [];
  if (mentioned.some((jid) => selfIds.has(bareId(jid)))) return true;
  if (ctx?.participant && selfIds.has(bareId(ctx.participant))) return true;
  return hasTrigger(text, config.triggers);
}

// El filtro de entrada. Un chat que no esta habilitado en la interfaz no se
// lee, no se guarda y no se contesta — ni aunque nombren al bot.
async function chatAllowed(chatId) {
  if (!chatId.endsWith("@g.us")) return config.allowDirect && (await isAllowed(chatId));
  return isAllowed(chatId);
}

// Nombre del grupo, si viene. Solo para que los logs y la base sean legibles.
function chatTitle(message) {
  return message?.key?.remoteJid?.endsWith("@g.us") ? message.pushName || "" : "";
}

// Una sola reconexion en vuelo. Sin esto, cada `connection.update` con cierre
// apilaba un socket nuevo mientras el viejo seguia con sus handlers vivos.
let reconnecting = false;
let currentSock = null;
// El servidor de la interfaz se levanta una sola vez, no en cada reconexion.
let adminServer = null;
// Estado de la conexion, para mostrarlo (y mostrar el QR) en la interfaz.
const status = { connected: false, qr: null };

// Desvincula el numero actual y arranca de cero para que salga un QR nuevo.
// Es lo que permite cambiar de numero sin entrar al servidor.
async function relinkNumber() {
  log("relink_started");
  status.connected = false;
  status.qr = null;

  if (currentSock) {
    // `logout` avisa al telefono; si falla (ya desconectado) igual seguimos:
    // lo que manda es borrar las credenciales locales.
    await currentSock.logout().catch(() => {});
    try {
      currentSock.ev.removeAllListeners();
      currentSock.end(undefined);
    } catch {
      // Ya estaba cerrado.
    }
    currentSock = null;
  }

  // Sin esto, Baileys reusa las credenciales viejas y nunca emite un QR.
  await rm(config.authDir, { recursive: true, force: true });
  reconnecting = false;
  setTimeout(() => void start(), 1_000);
}

// Los grupos donde esta el numero, para poder elegirlos en la interfaz.
async function fetchGroups(sock) {
  if (!sock) return [];
  const all = await sock.groupFetchAllParticipating();
  return Object.entries(all || {}).map(([id, meta]) => ({ id, title: meta?.subject || "" }));
}

function scheduleReconnect(delayMs = 2_000) {
  if (reconnecting) return;
  reconnecting = true;
  if (currentSock) {
    // Cortar el socket viejo de raiz: sus reintentos en vuelo son los que
    // terminaban tirando "Connection Closed" contra un socket ya muerto.
    try {
      currentSock.ev.removeAllListeners();
      currentSock.end(undefined);
    } catch {
      // Ya estaba cerrado.
    }
    currentSock = null;
  }
  setTimeout(() => {
    reconnecting = false;
    void start();
  }, delayMs);
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();
  log("starting", { waVersion: version.join("."), authDir: config.authDir });

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: config.logLevel }),
    // El bot no necesita aparecer "en linea" ni marcar leidos.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    printQRInTerminal: false,
  });
  currentSock = sock;

  // El JID propio viene en dos formatos: el clasico (@s.whatsapp.net) y el
  // nuevo LID (@lid), que es el que aparece en los grupos modernos. Hay que
  // conocer los dos o las menciones al bot no se detectan.
  const selfIds = new Set();
  const rememberSelf = () => {
    for (const raw of [sock.user?.id, sock.user?.lid]) {
      if (raw) selfIds.add(bareId(raw));
    }
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Se guarda para la interfaz web, que es la forma comoda de vincular.
      status.qr = qr;
      status.connected = false;
      if (!config.pairingNumber) {
        console.log("\nEscanea este QR (o entrá a la interfaz web):\n");
        qrcode.generate(qr, { small: true });
      }
    }

    if (connection === "open") {
      rememberSelf();
      status.connected = true;
      status.qr = null;
      // Los grupos se anotan al conectar para que aparezcan en la interfaz.
      // Anotarlos NO los habilita: siguen apagados hasta que los prendas.
      fetchGroups(sock)
        .then((groups) => groups.length && registerChats(groups))
        .catch((error) => log("group_sync_failed", { message: error?.message }));
      log("connected", { me: sock.user?.id, lid: sock.user?.lid, activeChats: sessions.activeChats().length });
      console.log(
        `\n✅ Conectado como ${sock.user?.id}. Invocalo escribiendo ${config.triggers[0]} en un chat.\n`
      );
    }

    if (connection === "close") {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      status.connected = false;
      log("disconnected", { status: code });

      if (code === DisconnectReason.loggedOut) {
        // Sesion cerrada desde el telefono (o recien desvinculada desde la
        // interfaz). No es un error fatal: se limpian las credenciales y se
        // vuelve a empezar, que es justo lo que hace falta para otro numero.
        log("logged_out_relinking");
        void relinkNumber();
        return;
      }

      // 440 "conflict: replaced": otra instancia tomo la sesion. Reconectar es
      // lo peor que se puede hacer — las dos se pelean la vinculacion en loop
      // y WhatsApp lo lee como comportamiento raro. Salimos y listo.
      if (code === DisconnectReason.connectionReplaced) {
        console.error(
          "\n❌ Otra instancia del bot tomo la sesion (conflict: replaced)." +
            "\n   Suele ser otro `npm run dev` abierto en otra terminal." +
            "\n   Cerra el otro proceso y volve a levantar este.\n"
        );
        process.exit(1);
      }

      // El resto (incluido 515 restartRequired despues de vincular) es
      // transitorio: reconectar, pero de a uno.
      scheduleReconnect();
    }
  });

  // Vinculacion por codigo en vez de QR (servidor headless).
  if (config.pairingNumber && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(config.pairingNumber);
        console.log(`\n🔑 Codigo de vinculacion: ${code}\n   WhatsApp > Dispositivos vinculados > Vincular con numero.\n`);
      } catch (error) {
        log("pairing_failed", { message: error?.message });
      }
    }, 3_000);
  }

  // La interfaz vive adentro del proceso porque la lista de grupos sale de
  // este socket, y solo puede haber una sesion por numero.
  if (!adminServer) {
    adminServer = startAdminServer({
      getGroups: () => fetchGroups(currentSock),
      getBotName: () => currentSock?.user?.id || "",
      getStatus: () => ({ connected: status.connected, qr: status.qr }),
      relink: relinkNumber,
      log,
    });
  }

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) {
      try {
        await handleMessage(sock, message, selfIds);
      } catch (error) {
        log("handler_failed", { message: error?.message });
      }
    }
  });
}

// WhatsApp reenvia el backlog al conectar. Un mensaje viejo no debe disparar
// nada: seria el bot despertandose por un "@bot" de hace tres dias.
function isStale(message) {
  return isStaleTimestamp(message.messageTimestamp, config.maxMessageAgeMs);
}

async function handleMessage(sock, message, selfIds) {
  const chatId = message.key?.remoteJid;
  if (!chatId || chatId === "status@broadcast") return;
  if (message.key.fromMe && !config.allowSelf) return;

  // Primer filtro y el mas importante: si el chat no esta habilitado, el
  // mensaje se descarta ACA. No se extrae el texto, no se loguea, no se
  // guarda. Para el bot, esa conversacion no existe.
  if (!(await chatAllowed(chatId))) return;

  if (isStale(message)) {
    log("stale_ignored", { chat: chatId });
    return;
  }

  const text = extractText(message).trim();
  if (!text) return;

  const author = message.key.participant || chatId;
  const session = await getSession(chatId, config.sessionTtlMs);
  const active = Boolean(session);
  const addressed = isAddressed(message, text, selfIds);
  const command = stripTrigger(text, config.triggers);

  // El texto solo se loguea si el bot tiene derecho a leerlo: sesion abierta,
  // o mensaje dirigido a el. Un mensaje ajeno con la sesion cerrada deja
  // rastro de que paso algo, nunca de que decia.
  const mayRead = active || addressed;
  log("message", {
    chat: chatId,
    author,
    active,
    addressed,
    text: mayRead && config.logMessageText ? text.slice(0, 200) : undefined,
    chars: text.length,
  });

  // ── Escalon 1: sin sesion, solo lo despierta una invocacion ──────────────
  // Todo lo demas muere aca. Cero escritura, cero IA, cero costo.
  if (!active) {
    if (!addressed) return;
    await ensureChat(chatId, chatTitle(message));
    await startSession(chatId, author);
    log("session_started", { chat: chatId, by: author });

    const pending = command.trim();
    if (!pending || pending.toLowerCase().startsWith("ping")) {
      await sock.sendMessage(chatId, {
        text: `Aca estoy. Contame que hacemos con la juntada.\nDecime "listo" cuando no me necesiten mas.`,
      });
      return;
    }
    // Lo invocaron pidiendo algo concreto: se atiende en el mismo mensaje.
    await respond(sock, message, chatId, author, pending);
    return;
  }

  // ── Escalon 2: sesion abierta ────────────────────────────────────────────
  await touchSession(chatId);
  await saveMessage({
    chatId,
    waId: bareId(author),
    author: message.pushName || bareId(author),
    body: text,
    fromMe: Boolean(message.key.fromMe),
  });

  if (addressed && isDismissal(command, config.dismissals)) {
    await endSession(chatId);
    log("session_ended", { chat: chatId, by: author });
    await sock.sendMessage(chatId, {
      text: `Listo, me callo. Llamame con ${config.triggers[0]} cuando quieras. 👋`,
    });
    return;
  }

  // ── Escalon 3: no le hablan a el, pero esta despierto ────────────────────
  if (!addressed) {
    // 3a. Intencion evidente: se ejecuta y se acusa con 👍. Sin IA.
    const intent = config.silentReactions ? detectIntent(text) : null;
    if (intent) {
      await applyIntentSilently(sock, message, chatId, author, intent);
      return;
    }
    // 3b. Modo despierto: mira la charla y decide si aporta algo.
    if (config.ambient) await maybeChimeIn(sock, chatId, author, message);
    return;
  }

  // ── Escalon 4: le hablan. Recien aca entra OpenAI ────────────────────────
  await respond(sock, message, chatId, author, command);
}

// Contexto de quien habla, para que el agente pueda obrar en su nombre.
async function contextFor(chatId, author, message) {
  const identity = await getIdentity(chatId, bareId(author), message.pushName || "");
  const bound = await getActiveMeetup(chatId);
  return {
    chatId,
    meetupId: bound?.meetupId || null,
    adminToken: bound?.adminToken || "",
    deviceToken: identity.device_token,
    displayName: identity.display_name || "Jugador",
  };
}

// Una accion evidente se ejecuta directo y se acusa recibo con un 👍. Sin
// texto y sin modelo: es la diferencia entre un bot util y uno insoportable.
async function applyIntentSilently(sock, message, chatId, author, intent) {
  const ctx = await contextFor(chatId, author, message);
  if (!ctx.meetupId) return; // Sin juntada atada no hay nada que anotar.

  const { handlers } = buildTools(ctx);
  let result;
  try {
    if (intent.kind === "claim") result = await handlers.tomar_item({ item: intent.arg });
    else if (intent.kind === "join") result = await handlers.anotarme({});
    else if (intent.kind === "leave") result = await handlers.bajarme({});
  } catch (error) {
    log("intent_failed", { kind: intent.kind, message: error?.message });
    return;
  }

  // Si no se pudo (el item no existe, no estaba anotado), se calla: no vale
  // interrumpir la charla para corregir a alguien que ni le hablo al bot.
  if (!result || result.error) {
    log("intent_skipped", { kind: intent.kind, reason: result?.error });
    return;
  }

  log("intent_applied", { kind: intent.kind, arg: intent.arg });
  await sock.sendMessage(chatId, {
    react: { text: "👍", key: message.key },
  });
}

// Estado del modo despierto, por chat y en memoria: cuantos mensajes se
// juntaron desde que el bot miro por ultima vez, y cuando hablo.
const ambientState = new Map();

function ambientFor(chatId) {
  if (!ambientState.has(chatId)) {
    ambientState.set(chatId, { pending: 0, lastSpokeAt: 0 });
  }
  return ambientState.get(chatId);
}

// El bot mira la charla y decide solo si mete un bocadillo. Los dos frenos
// (cantidad de mensajes y enfriamiento) se evaluan en JS ANTES de gastar nada.
async function maybeChimeIn(sock, chatId, author, message) {
  const state = ambientFor(chatId);
  state.pending += 1;

  const considering = shouldConsiderSpeaking({
    newMessages: state.pending,
    msSinceBotSpoke: Date.now() - state.lastSpokeAt,
  });
  if (!considering) return;

  // Se consumen los pendientes aunque decida callarse: si no, cada mensaje
  // siguiente volveria a disparar una llamada.
  state.pending = 0;

  const ctx = await contextFor(chatId, author, message);
  const history = await recentMessages(chatId, config.historySize);
  const session = await getSession(chatId, config.sessionTtlMs);

  let snapshot = null;
  if (ctx.meetupId) {
    const { handlers } = buildTools(ctx);
    snapshot = await handlers.ver_juntada({}).catch(() => null);
  }

  let decision;
  try {
    decision = await runAmbient(ctx, history, snapshot, session?.startedAt);
  } catch (error) {
    log("ambient_failed", { message: error?.message });
    return;
  }

  if (!decision.hablar) {
    log("ambient_quiet", { chat: chatId });
    return;
  }

  state.lastSpokeAt = Date.now();
  log("ambient_spoke", { chat: chatId });
  await sock.sendMessage(chatId, { text: decision.texto });
  await saveMessage({ chatId, waId: "bot", author: "bot", body: decision.texto, fromMe: true });
}

// Le hablaron al bot: corre el agente y contesta.
async function respond(sock, message, chatId, author, text) {
  const ctx = await contextFor(chatId, author, message);
  const history = await recentMessages(chatId, config.historySize);

  await sock.sendPresenceUpdate("composing", chatId).catch(() => {});

  let reply;
  let toolsUsed = [];
  try {
    const result = await runAgent(ctx, text, history, {});
    reply = result.reply;
    toolsUsed = result.toolsUsed;
  } catch (error) {
    log("agent_failed", { message: error?.message, status: error?.status });
    reply = "Se me colgó la cabeza, probá de nuevo en un rato.";
  }

  log("replied", { chat: chatId, tools: toolsUsed });

  // Hablo: se reinicia el enfriamiento del modo despierto para que no meta un
  // comentario propio justo despues de contestar.
  const ambient = ambientFor(chatId);
  ambient.lastSpokeAt = Date.now();
  ambient.pending = 0;

  // Si el agente creo una juntada, el chat quedo atado a ella dentro de la
  // herramienta; esto solo refresca por si acaso.
  if (toolsUsed.includes("crear_juntada") && ctx.meetupId) {
    await bindMeetup(chatId, ctx.meetupId, ctx.adminToken);
  }

  if (reply) {
    await sock.sendMessage(chatId, { text: reply });
    await saveMessage({ chatId, waId: "bot", author: "bot", body: reply, fromMe: true });
  }
}

// Baileys tira rechazos asincronicos desde reintentos en vuelo cuando el socket
// se cae (por ejemplo "Connection Closed" al responder un retry). No son
// fatales: si los dejamos sin atrapar, Node mata el proceso y el bot se cae
// entero por una desconexion transitoria.
process.on("unhandledRejection", (reason) => {
  log("unhandled_rejection", {
    message: reason?.message || String(reason),
    status: reason?.output?.statusCode,
  });
});

process.on("uncaughtException", (error) => {
  log("uncaught_exception", { message: error?.message, status: error?.output?.statusCode });
  scheduleReconnect(5_000);
});

// Cierre limpio para que Docker no mate el proceso a la fuerza.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log("shutdown", { signal });
    process.exit(0);
  });
}

await start();
