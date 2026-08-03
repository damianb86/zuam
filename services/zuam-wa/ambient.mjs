// Modo despierto: el bot lee todo lo del grupo y decide solo si vale la pena
// meter un bocadillo.
//
// El riesgo obvio es que se vuelva insoportable (o carisimo). Por eso hay dos
// controles ANTES de gastar un token, los dos en JS:
//
//   1. Un minimo de mensajes nuevos desde la ultima vez que hablo o miro.
//   2. Un tiempo de enfriamiento desde su ultimo mensaje.
//
// Recien si pasa los dos se le pregunta al modelo, y el modelo todavia puede
// decir "no digo nada" — que es lo que deberia contestar la mayoria de las
// veces. Ese "callate" esta puesto bien fuerte en el prompt a proposito.

import { config } from "./config.mjs";

const PROMPT = `Sos el bot de una juntada de truco entre amigos argentinos.

Estas leyendo la conversacion del grupo. NO te hablaron a vos: estas mirando de
costado y tenes que decidir si abrir la boca o quedarte callado.

QUEDATE CALLADO salvo que aportes algo concreto a la organizacion. Interrumpir
una charla que va bien es lo peor que podes hacer. Ante la duda: callado.

Podes hablar si ves algo asi:
- Falta poca gente para completar equipos (3v3 son 6, 2v2 son 4). Ej: "faltan 2
  para el 3v3, quien se prende?"
- Se dijo algo que quedo en el aire y nadie confirmo (el lugar, la hora, si
  alguien consiguio las cartas). Ej: "quedo confirmado el SUM?"
- HAY UNA JUNTADA CREADA Y NADIE SE ANOTA. Si el estado dice que van 0 (o
  muchos menos de los que se estan entusiasmando en la charla), empujalos:
  "dale loco, anotense!" / "se coparon todos pero no se anoto nadie eh".
  Este caso es de los mas utiles, no lo dejes pasar.
- Alguien dijo que lleva algo pero no esta en la lista, o falta algo importante.
- Se acerca la fecha y falta cubrir cosas.

NO hables si:
- Estan charlando de cualquier otra cosa.
- Ya dijiste algo parecido hace poco.
- Es solo una reaccion social ("jajaja", "dale", "buenisimo").
- No tenes nada concreto que aportar. ESTE ES EL CASO MAS COMUN.

Como hablas: castellano rioplatense, informal, con voseo. Una linea, como uno
mas del grupo. Nada de markdown (WhatsApp lo muestra literal). Sin saludos.

Sos un bot: no te ofrezcas a llevar cosas, a reservar el lugar ni a hacer nada
del mundo fisico. Empujas a que lo hagan ellos, no lo haces vos.

Respondes SIEMPRE un JSON con esta forma exacta:
{"hablar": false} si te quedas callado
{"hablar": true, "texto": "lo que decis"} si vale la pena`;

/**
 * Decide en JS puro si siquiera vale preguntarle al modelo.
 * Sin esto, cada mensaje del grupo seria una llamada a la API.
 */
export function shouldConsiderSpeaking({ newMessages, msSinceBotSpoke, now = Date.now() }) {
  if (newMessages < config.ambientMinMessages) return false;
  if (msSinceBotSpoke < config.ambientCooldownMs) return false;
  return true;
}

/** Extrae el JSON aunque el modelo lo devuelva envuelto en texto o en fences. */
export function parseDecision(raw) {
  if (!raw) return { hablar: false };
  const cleaned = String(raw).replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed?.hablar) return { hablar: false };
    const texto = String(parsed.texto || "").trim();
    return texto ? { hablar: true, texto } : { hablar: false };
  } catch {
    // Si no se entiende la respuesta, se calla. Nunca mandar texto crudo:
    // terminaria escupiendo el JSON al grupo.
    return { hablar: false };
  }
}

export function ambientPrompt() {
  return PROMPT;
}

// Arma el contexto: todo lo hablado desde que se desperto, mas el estado de la
// juntada si hay una atada.
export function ambientInput({ history, snapshot, wokeAt }) {
  const transcript = history
    .map((m) => `${m.author || "alguien"}: ${m.body}`)
    .join("\n")
    .slice(-3000);

  const parts = [];
  if (snapshot) parts.push(`[Estado de la juntada]\n${JSON.stringify(snapshot)}`);
  if (wokeAt) parts.push(`[Estas escuchando desde ${new Date(wokeAt).toLocaleString("es-AR")}]`);
  parts.push(`[Conversacion del grupo]\n${transcript}`);
  parts.push("Decidi: hablas o te quedas callado? Respondé solo el JSON.");

  return [{ role: "user", content: parts.join("\n\n") }];
}
