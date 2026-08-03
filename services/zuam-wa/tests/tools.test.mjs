// Tests de integracion de las herramientas del agente contra Postgres de
// verdad. No hay OpenAI de por medio: se llaman los handlers directamente,
// que es exactamente lo que hace el modelo cuando elige una herramienta.
//
// Necesita una base: se saltea solo si no hay JUNTADA_DATABASE_URL.
//
//   createdb wa_test
//   JUNTADA_DATABASE_URL=postgresql://$USER@localhost:5432/wa_test npm test

import test from "node:test";
import assert from "node:assert/strict";

const enabled = Boolean(process.env.JUNTADA_DATABASE_URL || process.env.DATABASE_URL);

test("herramientas del agente contra Postgres", { skip: !enabled && "sin base de datos" }, async (t) => {
  const { buildTools } = await import("../tools.mjs");
  const { ensureWaSchema, getActiveMeetup, getIdentity, saveMessage, recentMessages, startSession, getSession, endSession, touchSession } =
    await import("../store.mjs");
  await ensureWaSchema();

  const chatId = `test-${Date.now()}@g.us`;
  const damian = await getIdentity(chatId, "5493498477549", "Damian");
  const ctx = {
    chatId,
    meetupId: null,
    adminToken: "",
    deviceToken: damian.device_token,
    displayName: "Damian",
  };
  const { handlers } = buildTools(ctx);

  await t.test("sin juntada atada, las herramientas avisan en vez de romper", async () => {
    const result = await handlers.ver_juntada({});
    assert.equal(result.error, "no_hay_juntada");
  });

  await t.test("crear_juntada la crea, la ata al chat y devuelve el link", async () => {
    const result = await handlers.crear_juntada({
      titulo: "Truco del viernes",
      fecha: "2026-08-07",
      hora: "21:00",
      lugar: "lo de Dami",
      items: ["fernet", "hielo"],
    });
    assert.equal(result.creada, true);
    assert.match(result.link, /\/j\/[a-z0-9]+$/i);

    const bound = await getActiveMeetup(chatId);
    assert.ok(bound?.meetupId, "el chat quedo atado a la juntada");
    assert.ok(bound.adminToken, "se guardo el adminToken para poder administrar");
  });

  await t.test("ver_juntada devuelve el resumen compacto", async () => {
    const state = await handlers.ver_juntada({});
    assert.equal(state.juntada.titulo, "Truco del viernes");
    assert.equal(state.juntada.lugar, "lo de Dami");
    assert.equal(state.cuantos_van, 0);
    assert.deepEqual(
      state.que_se_lleva.map((i) => i.item).sort(),
      ["fernet", "hielo"],
    );
    assert.deepEqual(state.falta_cubrir.sort(), ["fernet", "hielo"]);
  });

  await t.test("anotarme suma a quien hablo", async () => {
    const result = await handlers.anotarme({});
    assert.equal(result.anotado, "Damian");
    const state = await handlers.ver_juntada({});
    assert.deepEqual(state.van, ["Damian"]);
  });

  await t.test("anotar_a suma a los que se mencionan por nombre", async () => {
    const result = await handlers.anotar_a({ nombres: ["Nacho", "Pepe"] });
    assert.equal(result.cuantos, 2);
    const state = await handlers.ver_juntada({});
    assert.equal(state.cuantos_van, 3);
    assert.ok(state.van.includes("Nacho"));
  });

  await t.test("tomar_item encuentra el item aunque no lo escriban igual", async () => {
    // El modelo (y la gente) escribe "el fernet", no el id del item.
    const result = await handlers.tomar_item({ item: "el fernet", detalle: "1 litro" });
    assert.equal(result.toma, "fernet");
    assert.equal(result.quien, "Damian");

    const state = await handlers.ver_juntada({});
    const fernet = state.que_se_lleva.find((i) => i.item === "fernet");
    assert.equal(fernet.lo_lleva, "Damian");
    assert.deepEqual(state.falta_cubrir, ["hielo"], "solo queda el hielo sin dueño");
  });

  await t.test("tomar_item avisa cuando el item no existe", async () => {
    const result = await handlers.tomar_item({ item: "langostinos" });
    assert.equal(result.error, "no_encontrado");
    assert.match(result.mensaje, /fernet/, "sugiere los que si hay");
  });

  await t.test("nadie puede tomar algo en nombre de otro", async () => {
    // Limite real: `toggleClaim` necesita el deviceToken del que lo toma.
    const result = await handlers.tomar_item({ item: "hielo", quien: "Nacho" });
    assert.equal(result.error, "solo_uno_mismo");
  });

  await t.test("agregar_item suma a la lista de que llevar", async () => {
    await handlers.agregar_item({ item: "carbon", cantidad: 2, obligatorio: true });
    const state = await handlers.ver_juntada({});
    assert.ok(state.que_se_lleva.some((i) => i.item === "carbon" && i.obligatorio));
  });

  await t.test("bajar_a saca a alguien por nombre aproximado", async () => {
    const result = await handlers.bajar_a({ nombre: "nacho" });
    assert.equal(result.baja, "Nacho");
    const state = await handlers.ver_juntada({});
    assert.ok(!state.van.includes("Nacho"));
    assert.equal(state.cuantos_van, 2);
  });

  await t.test("bajar_a avisa si no encuentra a la persona", async () => {
    const result = await handlers.bajar_a({ nombre: "Maradona" });
    assert.equal(result.error, "no_encontrado");
  });

  await t.test("bajarme da de baja a quien hablo", async () => {
    assert.deepEqual(await handlers.bajarme({}), { baja: true });
    const state = await handlers.ver_juntada({});
    assert.ok(!state.van.includes("Damian"));
  });

  await t.test("ver_mesas avisa cuando todavia no hay mesas", async () => {
    const result = await handlers.ver_mesas({});
    assert.match(result.mensaje, /no hay mesas/i);
  });

  // ── Fase 1: sesiones, identidades y mensajes ──────────────────────────────

  await t.test("la sesion de escucha vive en la base y vence sola", async () => {
    assert.equal(await getSession(chatId, 60_000), null, "arranca cerrada");
    await startSession(chatId, "damian");
    const open = await getSession(chatId, 60_000);
    assert.equal(open.startedBy, "damian");

    await touchSession(chatId);
    // Con un TTL de 0 ya vencio: el bot no queda escuchando para siempre.
    assert.equal(await getSession(chatId, 0), null, "vencida se cierra sola");
    assert.equal(await getSession(chatId, 60_000), null, "y quedo borrada");
  });

  await t.test("la identidad de cada numero es estable", async () => {
    const again = await getIdentity(chatId, "5493498477549", "Damian");
    assert.equal(again.device_token, damian.device_token, "mismo numero, mismo token");
    const otro = await getIdentity(chatId, "5493511111111", "Nacho");
    assert.notEqual(otro.device_token, damian.device_token);
  });

  await t.test("los mensajes se guardan y vuelven en orden cronologico", async () => {
    await saveMessage({ chatId, waId: "1", author: "Damian", body: "primero" });
    await saveMessage({ chatId, waId: "1", author: "Nacho", body: "segundo" });
    const history = await recentMessages(chatId, 10);
    assert.deepEqual(
      history.map((m) => m.body),
      ["primero", "segundo"],
    );
  });

  await t.test("la allowlist arranca apagada y se prende por grupo", async () => {
    const { isAllowed, setAllowed, registerChats, listChats } = await import("../store.mjs");
    const otro = `test-otro-${Date.now()}@g.us`;

    // Registrar un grupo NO lo habilita: solo lo hace visible en la interfaz.
    await registerChats([{ id: otro, title: "Los del truco" }]);
    assert.equal(await isAllowed(otro), false, "aparece pero sigue apagado");

    await setAllowed(otro, true);
    assert.equal(await isAllowed(otro), true);
    assert.equal(await isAllowed(`nunca-visto-${Date.now()}@g.us`), false);

    const listed = (await listChats()).find((c) => c.chatId === otro);
    assert.equal(listed.title, "Los del truco");
    assert.equal(listed.allowed, true);

    await setAllowed(otro, false);
    assert.equal(await isAllowed(otro), false, "se puede apagar de nuevo");
  });

  await t.test("limpieza", async () => {
    const { deleteMeetup } = await import("../../zuam-api/juntada/store.mjs");
    const bound = await getActiveMeetup(chatId);
    if (bound?.meetupId) await deleteMeetup(bound.meetupId);
    await endSession(chatId);
  });
});
