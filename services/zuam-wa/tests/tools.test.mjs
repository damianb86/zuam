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

  await t.test("se le puede asignar algo a otra persona por nombre", async () => {
    const result = await handlers.tomar_item({ item: "hielo", quien: "Nacho" });
    assert.equal(result.quien, "Nacho");
    const state = await handlers.ver_juntada({});
    assert.equal(state.que_se_lleva.find((i) => i.item === "hielo").lo_lleva, "Nacho");
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

// ── Gestion completa desde WhatsApp (editar, admins, asignar, torneo) ────────

test("gestion de la juntada desde el chat", { skip: !enabled && "sin base de datos" }, async (t) => {
  const { buildTools } = await import("../tools.mjs");
  const { ensureWaSchema, getIdentity, getActiveMeetup, setLastEventId, getLastEventId } =
    await import("../store.mjs");
  const { finishedMessage, roundMessage } = await import("../announcer.mjs");
  const { getState, pushTableScore, deleteMeetup } = await import("../../zuam-api/juntada/store.mjs");
  await ensureWaSchema();

  const chatId = `mgmt-${Date.now()}@g.us`;
  const yo = await getIdentity(chatId, "5493498477549", "Damian");
  const ctx = { chatId, meetupId: null, adminToken: "", deviceToken: yo.device_token, displayName: "Damian" };
  const { handlers } = buildTools(ctx);

  await handlers.crear_juntada({ titulo: "Truco", fecha: "2026-08-07", hora: "21:00" });
  const bound = await getActiveMeetup(chatId);
  ctx.adminToken = bound.adminToken;

  await t.test("editar_juntada cambia nombre, dia y hora", async () => {
    const result = await handlers.editar_juntada({
      titulo: "Truco en lo de Dami", fecha: "2026-08-08", hora: "22:30", lugar: "casa de Dami",
    });
    assert.deepEqual(result.actualizado.sort(), ["date", "place", "time", "title"]);
    assert.equal(result.juntada.titulo, "Truco en lo de Dami");
    assert.equal(result.juntada.fecha, "2026-08-08");
    assert.equal(result.juntada.hora, "22:30");
  });

  await t.test("compartir_link devuelve el link listo", async () => {
    const result = await handlers.compartir_link({});
    assert.match(result.link, /\/j\/[a-z0-9]+$/i);
  });

  await t.test("admins: modo y marcar a alguien por nombre", async () => {
    await handlers.anotarme({});
    await handlers.anotar_a({ nombres: ["Nacho", "Pepe", "Fede", "Lucho", "Tincho"] });

    const modo = await handlers.modo_admins({ modo: "all" });
    assert.equal(modo.modo, "all");

    // Marcar a alguien a mano solo tiene efecto en modo "chosen": la
    // herramienta cambia el modo sola para que el pedido haga lo esperado.
    const hecho = await handlers.hacer_admin({ nombre: "nacho" });
    assert.equal(hecho.ahora_es_admin, "Nacho");
    assert.equal(hecho.modo, "chosen");

    const estado = await handlers.ver_juntada({});
    assert.ok(estado.admins.includes("Nacho"));

    const quitado = await handlers.hacer_admin({ nombre: "Nacho", quitar: true });
    assert.equal(quitado.ya_no_es_admin, "Nacho");
  });

  await t.test("agregar_item puede asignar en el mismo paso", async () => {
    const result = await handlers.agregar_item({ item: "fernet", quien: "Nacho", detalle: "1 litro" });
    assert.equal(result.lo_lleva, "Nacho");
    const estado = await handlers.ver_juntada({});
    assert.equal(estado.que_se_lleva.find((i) => i.item === "fernet").lo_lleva, "Nacho");
  });

  await t.test("tomar_item asigna a OTRA persona por nombre", async () => {
    await handlers.agregar_item({ item: "hielo" });
    const result = await handlers.tomar_item({ item: "hielo", quien: "pepe" });
    assert.equal(result.quien, "Pepe");
    const estado = await handlers.ver_juntada({});
    assert.equal(estado.que_se_lleva.find((i) => i.item === "hielo").lo_lleva, "Pepe");
  });

  await t.test("tomar_item sin nombrar a nadie es quien habla", async () => {
    await handlers.agregar_item({ item: "carbon" });
    const result = await handlers.tomar_item({ item: "carbon" });
    assert.equal(result.quien, "Damian");
  });

  await t.test('el modelo manda quien:"yo" y sigue siendo quien habla', async () => {
    await handlers.agregar_item({ item: "cartas" });
    const result = await handlers.tomar_item({ item: "cartas", quien: "yo" });
    assert.equal(result.quien, "Damian");
  });

  await t.test("soltar_item deshace la asignacion", async () => {
    await handlers.soltar_item({ item: "hielo", quien: "Pepe" });
    const estado = await handlers.ver_juntada({});
    assert.equal(estado.que_se_lleva.find((i) => i.item === "hielo").lo_lleva, null);
  });

  await t.test("quitar_item saca la cosa de la lista", async () => {
    await handlers.quitar_item({ item: "carbon" });
    const estado = await handlers.ver_juntada({});
    assert.ok(!estado.que_se_lleva.some((i) => i.item === "carbon"));
  });

  await t.test("armar_equipos devuelve el texto listo para el grupo", async () => {
    const result = await handlers.armar_equipos({ jugadores_por_equipo: 2 });
    assert.equal(result.equipos, 3, "6 anotados / 2 = 3 equipos");
    assert.match(result.mensaje_para_el_grupo, /Equipos/);
    // Lo que importa del mensaje: que estén los NOMBRES, no solo los equipos.
    assert.match(result.mensaje_para_el_grupo, /Damian/);
    assert.match(result.mensaje_para_el_grupo, /Nacho/);
  });

  await t.test("armar_equipos avisa quien queda sin equipo", async () => {
    await handlers.anotar_a({ nombres: ["Colgado"] });
    const result = await handlers.armar_equipos({ jugadores_por_equipo: 2 });
    assert.equal(result.sin_equipo.length, 1, "7 anotados: uno queda afuera");
  });

  await t.test("armar_mesas cruza los equipos libres", async () => {
    const result = await handlers.armar_mesas({});
    assert.equal(result.mesas_creadas, 1, "3 equipos → una mesa y uno libre");
    assert.ok(result.libre, "avisa que equipo quedo sin jugar");
  });

  await t.test("el aviso de partido terminado nombra equipos Y jugadores", async () => {
    const state = await getState(ctx.meetupId, "", ctx.adminToken);
    const mesa = state.tables[0];
    await pushTableScore(mesa.id, { scoreBlue: 30, scoreRed: 18, done: true });

    const after = await getState(ctx.meetupId, "", ctx.adminToken);
    const event = after.events.find((e) => e.type === "table_finished");
    assert.ok(event, "se registro el evento");

    const texto = finishedMessage(after, event.data);
    assert.match(texto, /Termino/);
    assert.match(texto, /30/);
    assert.match(texto, /18/);
    // Cada equipo tiene que aparecer con sus integrantes entre parentesis.
    assert.match(texto, /\(.+,.+\)/, "los nombres de los jugadores van en el mensaje");
  });

  await t.test("ver_campeon rankea por partidos ganados", async () => {
    const result = await handlers.ver_campeon({});
    assert.equal(result.ranking.length, 1);
    assert.equal(result.ranking[0].ganadas, 1);
  });

  await t.test("el anunciador no repite lo que ya conto", async () => {
    const state = await getState(ctx.meetupId, "", ctx.adminToken);
    const ultimo = state.events[0].id;
    await setLastEventId(chatId, ultimo);
    assert.equal(await getLastEventId(chatId), ultimo);
    const nuevos = state.events.filter((e) => e.id > ultimo);
    assert.equal(nuevos.length, 0);
  });

  await t.test("roundMessage arma el texto de los cruces", async () => {
    const state = await getState(ctx.meetupId, "", ctx.adminToken);
    const texto = roundMessage(state, 1);
    assert.match(texto, /Ronda 1/);
    assert.match(texto, /vs/);
  });

  await t.test("borrar_juntada exige confirmacion explicita", async () => {
    const sinConfirmar = await handlers.borrar_juntada({ confirmar: false });
    assert.equal(sinConfirmar.error, "falta_confirmar");
    const todavia = await getActiveMeetup(chatId);
    assert.ok(todavia?.meetupId, "no se borro nada");

    const meetupId = ctx.meetupId;
    const result = await handlers.borrar_juntada({ confirmar: true });
    assert.equal(result.borrada, true);
    assert.equal(await getState(meetupId, "", ""), null, "ya no existe");
    assert.equal((await getActiveMeetup(chatId))?.meetupId, undefined, "el chat quedo sin juntada");
  });

  if (ctx.meetupId) await deleteMeetup(ctx.meetupId);
});

test("el anunciador avisa una sola vez", { skip: !enabled && "sin base de datos" }, async (t) => {
  const { buildTools } = await import("../tools.mjs");
  const { sweep } = await import("../announcer.mjs");
  const { ensureWaSchema, getIdentity, getActiveMeetup, setAllowed } = await import("../store.mjs");
  const { getState, pushTableScore, deleteMeetup } = await import("../../zuam-api/juntada/store.mjs");
  await ensureWaSchema();

  const chatId = `ann-${Date.now()}@g.us`;
  const yo = await getIdentity(chatId, "549222", "Damian");
  const ctx = { chatId, meetupId: null, adminToken: "", deviceToken: yo.device_token, displayName: "Damian" };
  const { handlers } = buildTools(ctx);

  await handlers.crear_juntada({ titulo: "Torneo" });
  ctx.adminToken = (await getActiveMeetup(chatId)).adminToken;
  // El anunciador solo mira los chats habilitados.
  await setAllowed(chatId, true);
  await handlers.anotar_a({ nombres: ["Ana", "Beto", "Caro", "Dani"] });
  await handlers.armar_equipos({ jugadores_por_equipo: 2 });
  await handlers.armar_mesas({});

  const enviados = [];
  const capturar = async (chat, text) => enviados.push({ chat, text });
  const silencio = () => {};

  await t.test("sin nada nuevo, no dice nada", async () => {
    await sweep(capturar, silencio);
    assert.equal(enviados.length, 0);
  });

  await t.test("avisa el partido terminado con nombres", async () => {
    const state = await getState(ctx.meetupId, "", ctx.adminToken);
    await pushTableScore(state.tables[0].id, { scoreBlue: 30, scoreRed: 21, done: true });

    await sweep(capturar, silencio);
    assert.equal(enviados.length, 1, "un aviso");
    assert.equal(enviados[0].chat, chatId);
    assert.match(enviados[0].text, /30/);
    assert.match(enviados[0].text, /21/);
    assert.match(enviados[0].text, /\(.+,.+\)/, "con los jugadores de cada equipo");
  });

  await t.test("no lo repite en el barrido siguiente", async () => {
    await sweep(capturar, silencio);
    await sweep(capturar, silencio);
    assert.equal(enviados.length, 1, "sigue habiendo un solo aviso");
  });

  if (ctx.meetupId) await deleteMeetup(ctx.meetupId);
});
