// Avisos automaticos al grupo: cuando termina una mesa, cuando arranca una
// ronda nueva.
//
// El bot no se entera solo de lo que pasa en la app (el contador de fosforos
// vive en el celular de quien anota), asi que se mira la tabla de eventos de
// la juntada cada tanto. Es la unica parte del bot que habla sin que nadie
// escriba nada.
//
// Cero IA aca: los mensajes son plantillas. Un resultado de partido no
// necesita que lo redacte un modelo.

import { getState } from "../zuam-api/juntada/store.mjs";
import { chatsWithMeetup, getLastEventId, setLastEventId } from "./store.mjs";
import { config } from "./config.mjs";

// "Los Pulpos (Nacho, Pepe)" — el nombre del equipo solo no le dice nada a
// nadie; los que jugaron, si.
function teamLabel(state, teamId) {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return "?";
  const names = team.memberIds
    .map((id) => state.participants.find((p) => p.id === id)?.name)
    .filter(Boolean);
  return names.length ? `${team.name} (${names.join(", ")})` : team.name;
}

export function finishedMessage(state, data) {
  const table = state.tables.find((t) => t.id === data.tableId);
  const blue = table ? teamLabel(state, table.blueTeamId) : "Azul";
  const red = table ? teamLabel(state, table.redTeamId) : "Rojo";
  const ganoAzul = data.winner === "blue";

  return [
    `🏆 *Termino ${data.name || "la mesa"}*`,
    "",
    `${ganoAzul ? "🥇" : "  "} ${blue} — *${data.scoreBlue}*`,
    `${ganoAzul ? "  " : "🥇"} ${red} — *${data.scoreRed}*`,
  ].join("\n");
}

export function roundMessage(state, round) {
  const mesas = state.tables.filter((t) => t.round === round);
  if (!mesas.length) return null;
  const lines = mesas.map(
    (t) => `• *${t.name}*\n   ${teamLabel(state, t.blueTeamId)}\n   vs ${teamLabel(state, t.redTeamId)}`,
  );
  return `🃏 *Ronda ${round}*\n\n${lines.join("\n\n")}`;
}

// Un solo barrido: por cada chat con juntada atada, mira los eventos nuevos.
export async function sweep(sendMessage, log) {
  const chats = await chatsWithMeetup();

  for (const chat of chats) {
    try {
      const state = await getState(chat.meetupId, "", chat.adminToken);
      if (!state) continue;

      const lastSeen = await getLastEventId(chat.chatId);
      // Los eventos vienen del mas nuevo al mas viejo: se dan vuelta para
      // contarlos en el orden en que pasaron.
      const fresh = state.events.filter((e) => e.id > lastSeen).reverse();
      if (!fresh.length) continue;

      for (const event of fresh) {
        let text = null;
        if (event.type === "table_finished") text = finishedMessage(state, event.data);
        else if (event.type === "round_generated") text = roundMessage(state, event.data?.round);
        if (!text) continue;

        await sendMessage(chat.chatId, text);
        log("announced", { chat: chat.chatId, type: event.type });
      }

      await setLastEventId(chat.chatId, Math.max(lastSeen, state.events[0]?.id ?? lastSeen));
    } catch (error) {
      log("announce_failed", { chat: chat.chatId, message: error?.message });
    }
  }
}

export function startAnnouncer(sendMessage, log) {
  if (!config.announce) return null;
  const timer = setInterval(() => {
    sweep(sendMessage, log).catch((error) => log("sweep_failed", { message: error?.message }));
  }, config.announceIntervalMs);
  timer.unref();
  return timer;
}
