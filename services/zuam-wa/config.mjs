import { randomUUID } from "node:crypto";

// Configuracion del bot de WhatsApp. Todo por env, sin valores hardcodeados,
// para que el mismo build sirva con el numero personal (tests) o el dedicado.

const bool = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw !== "false" && raw !== "0";
};

const int = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const list = (name, fallback) =>
  (process.env[name] || fallback)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const config = {
  // Carpeta donde Baileys guarda las credenciales del dispositivo enlazado.
  // Tiene que sobrevivir a los reinicios o hay que re-escanear el QR.
  authDir: process.env.WA_AUTH_DIR || "./.wa-auth",

  // (El estado de las sesiones vive en Postgres desde la Fase 1: tabla
  // `wa_sessions`. Ver store.mjs.)

  // Como se lo invoca. Ademas de estas palabras, siempre responde a una
  // mencion real (@numero) y a las respuestas directas a un mensaje suyo.
  //
  // La comparacion es JS puro (`hasTrigger`), sin IA: mientras no aparezca uno
  // de estos, el mensaje no llega nunca a OpenAI y no cuesta un token.
  triggers: list("WA_TRIGGERS", "@truco,@bot,@juntada"),

  // Como se lo despide.
  dismissals: list("WA_DISMISSALS", "listo,gracias,chau,ya esta,nada mas"),

  // Si nadie lo despide, se apaga solo. Privacidad: no queda escuchando
  // un grupo para siempre porque alguien se olvido de decirle "listo".
  sessionTtlMs: int("WA_SESSION_TTL_MINUTES", 360) * 60 * 1000,

  // Con el numero personal, los mensajes propios llegan como `fromMe` y hay
  // que procesarlos igual o el bot nunca ve lo que escribe el dueno.
  allowSelf: bool("WA_ALLOW_SELF", true),

  // Los grupos habilitados se eligen en la interfaz (tabla `wa_chats.allowed`),
  // no por env: es una decision que cambia seguido y por grupo.
  //
  // Los chats 1-a-1 estan APAGADOS por defecto. El bot vive en grupos; que le
  // escriban por privado no deberia hacer que lea ni guarde nada.
  allowDirect: bool("WA_ALLOW_DIRECT", false),

  // Loguear el texto de los mensajes. En false solo loguea metadatos.
  logMessageText: bool("WA_LOG_MESSAGE_TEXT", true),

  // Vinculacion por codigo de 8 digitos en vez de QR (mas comodo si el
  // servidor es headless). Requiere el numero completo con pais, sin +.
  pairingNumber: process.env.WA_PAIRING_NUMBER || "",

  // Ruido interno de Baileys. En "warn" no se ven los fallos de desencriptado
  // del backlog, que son esperables y no significan nada.
  logLevel: process.env.WA_LOG_LEVEL || "warn",

  // Margen para descartar mensajes viejos que WhatsApp reenvia al conectar.
  // Sin esto, un "@truco ping" de hace tres dias abriria una sesion al arrancar.
  maxMessageAgeMs: int("WA_MAX_MESSAGE_AGE_SECONDS", 120) * 1000,

  // ── IA (Fase 2+) ──────────────────────────────────────────────────────────
  openaiKey: process.env.OPENAI_API_KEY || "",
  // Ojo: NO cae a OPENAI_CHAT_MODEL. Esa es la del chat del landing y son
  // decisiones distintas; el bot elige su modelo aparte.
  model: process.env.WA_OPENAI_MODEL || "gpt-5.6-luna",
  maxOutputTokens: int("WA_OPENAI_MAX_OUTPUT_TOKENS", 500),
  reasoningEffort: process.env.WA_OPENAI_REASONING_EFFORT || "low",
  openaiTimeoutMs: int("WA_OPENAI_TIMEOUT_MS", 30_000),
  // Tope de vueltas del loop de herramientas por mensaje.
  maxToolTurns: int("WA_MAX_TOOL_TURNS", 4),
  // Cuantos mensajes del chat se le dan de contexto al agente.
  historySize: int("WA_HISTORY_SIZE", 25),

  // Donde viven las paginas /j/{id} que se comparten por link.
  meetupBaseUrl: process.env.WA_MEETUP_BASE_URL || "https://zuam.com",

  // ── Interfaz para elegir grupos ──────────────────────────────────────────
  // Local por defecto: desde ahi se decide que conversaciones lee el bot.
  adminPort: int("WA_ADMIN_PORT", 3210),
  adminHost: process.env.WA_ADMIN_HOST || "0.0.0.0",
  // Si no se configura, se inventa uno al azar y se imprime al arrancar. Nunca
  // vacio: un token vacio dejaria la interfaz abierta con `?token=`.
  adminToken: process.env.WA_ADMIN_TOKEN || randomUUID().replace(/-/g, "").slice(0, 16),

  // ── Modo despierto (hablar por cuenta propia) ────────────────────────────
  ambient: bool("WA_AMBIENT", true),
  // Mensajes nuevos que tienen que juntarse antes de siquiera preguntarle al
  // modelo si vale la pena hablar.
  ambientMinMessages: int("WA_AMBIENT_MIN_MESSAGES", 4),
  // Enfriamiento desde el ultimo mensaje del bot.
  ambientCooldownMs: int("WA_AMBIENT_COOLDOWN_MINUTES", 10) * 60 * 1000,

  // ── Comportamiento proactivo (Fase 4) ────────────────────────────────────
  // Reaccionar con 👍 en vez de escribir cuando la intencion es clara.
  silentReactions: bool("WA_SILENT_REACTIONS", true),
  // Dias de retencion de los mensajes leidos.
  retentionDays: int("WA_RETENTION_DAYS", 7),
};
