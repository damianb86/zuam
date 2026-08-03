// Tests del embudo de JS puro: lo que decide si un mensaje despierta al bot,
// lo despide, o se resuelve sin gastar un token.

import test from "node:test";
import assert from "node:assert/strict";
import { hasTrigger, isDismissal, isStaleTimestamp, normalize, stripTrigger } from "../sessions.mjs";
import { detectIntent } from "../intents.mjs";

const TRIGGERS = ["@truco", "@bot", "@juntada"];
const DISMISSALS = ["listo", "gracias", "chau", "ya esta", "nada mas"];

test("normalize saca tildes, signos y mayusculas", () => {
  assert.equal(normalize("¿Quién VA?"), "quien va");
  assert.equal(normalize("  Listo!!  "), "listo");
});

test("hasTrigger reconoce la invocacion en cualquier posicion", () => {
  assert.ok(hasTrigger("@truco quien va?", TRIGGERS));
  assert.ok(hasTrigger("che @truco anotame", TRIGGERS));
  assert.ok(hasTrigger("@TRUCO ping", TRIGGERS), "no debe importar la mayuscula");
  assert.ok(hasTrigger("@bot dale", TRIGGERS), "los alias siguen andando");
  assert.ok(!hasTrigger("mañana jugamos al truco", TRIGGERS), "'truco' suelto NO invoca");
});

test("stripTrigger deja el pedido limpio", () => {
  assert.equal(stripTrigger("@truco quien va?", TRIGGERS), "quien va?");
  assert.equal(stripTrigger("che @truco  anotame", TRIGGERS), "che anotame");
});

test("isDismissal solo dispara con la despedida al principio", () => {
  assert.ok(isDismissal("listo", DISMISSALS));
  assert.ok(isDismissal("Gracias!", DISMISSALS));
  assert.ok(isDismissal("ya esta, nos vemos", DISMISSALS));
  assert.ok(!isDismissal("listorti no era eso", DISMISSALS));
  assert.ok(!isDismissal("me parece que no", DISMISSALS));
});

test("isStaleTimestamp descarta el backlog viejo y respeta lo reciente", () => {
  const now = 1_000_000_000_000;
  const maxAge = 120_000;
  const seconds = (ms) => ms / 1000;

  assert.equal(isStaleTimestamp(seconds(now - 10_000), maxAge, now), false, "reciente");
  assert.equal(isStaleTimestamp(seconds(now - 600_000), maxAge, now), true, "de hace 10 min");
  assert.equal(isStaleTimestamp(seconds(now - 86_400_000), maxAge, now), true, "de ayer");
  assert.equal(isStaleTimestamp({ low: seconds(now - 600_000) }, maxAge, now), true, "Long");
  assert.equal(isStaleTimestamp({ low: seconds(now - 1_000) }, maxAge, now), false, "Long reciente");
  assert.equal(isStaleTimestamp(undefined, maxAge, now), false, "sin fecha, procesar");
  assert.equal(isStaleTimestamp(0, maxAge, now), false);
});

// ── Intenciones silenciosas (Fase 4) ────────────────────────────────────────

test("detectIntent reconoce que alguien se hace cargo de algo", () => {
  assert.deepEqual(detectIntent("yo llevo el fernet"), { kind: "claim", arg: "fernet" });
  assert.deepEqual(detectIntent("traigo hielo"), { kind: "claim", arg: "hielo" });
  assert.deepEqual(detectIntent("me encargo de la picada"), { kind: "claim", arg: "picada" });
  assert.deepEqual(detectIntent("Yo Llevo Las Cartas"), { kind: "claim", arg: "cartas" });
});

test("detectIntent reconoce altas y bajas", () => {
  assert.deepEqual(detectIntent("me anoto"), { kind: "join" });
  assert.deepEqual(detectIntent("yo voy"), { kind: "join" });
  assert.deepEqual(detectIntent("no voy"), { kind: "leave" });
  assert.deepEqual(detectIntent("me bajo"), { kind: "leave" });
});

test("detectIntent NO dispara ante dudas ni preguntas", () => {
  // Lo mas importante del modulo: ante la duda, no hacer nada.
  assert.equal(detectIntent("quien lleva el fernet?"), null);
  assert.equal(detectIntent("alguien lleva hielo"), null);
  assert.equal(detectIntent("capaz llevo el fernet"), null);
  assert.equal(detectIntent("no se si voy"), null);
  assert.equal(detectIntent("voy si llego"), null);
  assert.equal(detectIntent("uh que garron"), null);
  assert.equal(detectIntent(""), null);
});

// ── Frenos del modo despierto ───────────────────────────────────────────────

test("parseDecision entiende la respuesta y se calla ante la duda", async () => {
  const { parseDecision } = await import("../ambient.mjs");

  assert.deepEqual(parseDecision('{"hablar":false}'), { hablar: false });
  assert.deepEqual(parseDecision('{"hablar":true,"texto":"dale loco, anotense!"}'), {
    hablar: true,
    texto: "dale loco, anotense!",
  });
  // El modelo a veces envuelve el JSON en fences.
  assert.deepEqual(parseDecision('```json\n{"hablar":true,"texto":"falta uno"}\n```'), {
    hablar: true,
    texto: "falta uno",
  });
  // Lo critico: si no se entiende, se calla. Jamas mandar el crudo al grupo.
  assert.deepEqual(parseDecision("che, me parece que si"), { hablar: false });
  assert.deepEqual(parseDecision(""), { hablar: false });
  assert.deepEqual(parseDecision('{"hablar":true}'), { hablar: false }, "sin texto no habla");
  assert.deepEqual(parseDecision('{"hablar":true,"texto":"   "}'), { hablar: false });
});

test("shouldConsiderSpeaking frena por cantidad y por enfriamiento", async () => {
  const { shouldConsiderSpeaking } = await import("../ambient.mjs");
  const { config } = await import("../config.mjs");

  const frio = config.ambientCooldownMs + 1;

  assert.equal(
    shouldConsiderSpeaking({ newMessages: 1, msSinceBotSpoke: frio }),
    false,
    "un mensaje suelto no amerita",
  );
  assert.equal(
    shouldConsiderSpeaking({ newMessages: config.ambientMinMessages, msSinceBotSpoke: 0 }),
    false,
    "recien hablo, no encima otro",
  );
  assert.equal(
    shouldConsiderSpeaking({ newMessages: config.ambientMinMessages, msSinceBotSpoke: frio }),
    true,
    "charla acumulada y hace rato que no habla",
  );
});

test("detectIntent ignora los textos largos", () => {
  // Un parrafo no es una decision puntual; que lo lea el agente si le hablan.
  const largo = "yo llevo el fernet pero ojo que la semana pasada me quede sin plata asi que";
  assert.equal(detectIntent(largo), null);
});
