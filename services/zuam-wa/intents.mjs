// Deteccion de intenciones evidentes, en JS puro y sin IA.
//
// Durante una sesion abierta, el grupo dice cosas como "yo llevo el fernet" o
// "me anoto" sin dirigirse al bot. Mandar cada una de esas al modelo seria caro
// y ademas insoportable (contestaria todo). Aca se resuelven con regex: si
// matchean, el bot ejecuta la accion y reacciona con 👍, sin escribir ni gastar
// un token. Si no matchean, no pasa nada: el mensaje se guarda como contexto y
// listo.
//
// La regla es ser CONSERVADOR. Ante la duda, no hacer nada: una accion
// equivocada en la juntada de otro es peor que no hacer nada.

import { normalize } from "./sessions.mjs";

// "yo llevo el fernet", "traigo hielo", "pongo la picada"
const CLAIM = /^(?:yo )?(?:llevo|traigo|pongo|compro|me encargo de|me hago cargo de)\s+(.{2,40})$/;

// "me anoto", "voy", "yo voy", "cuenten conmigo"
const JOIN = /^(?:me anoto|me sumo|voy|yo voy|yo me anoto|cuenten conmigo|dale voy)$/;

// "no voy", "me bajo", "esta vez no"
const LEAVE = /^(?:no voy|me bajo|yo no voy|esta vez no|no llego|no puedo)$/;

// Palabras que anulan la deteccion: son preguntas o dudas, no decisiones.
const HEDGES = /\?|quien|quienes|alguien|capaz|creo que|no se si|tal vez|puede ser|si llego/;

/**
 * @returns {{kind:string, arg?:string}|null} null = no hacer nada (lo normal)
 */
export function detectIntent(text) {
  const normalized = normalize(text);
  if (!normalized || normalized.length > 60) return null;
  if (HEDGES.test(normalized)) return null;

  const claim = CLAIM.exec(normalized);
  if (claim) {
    // Sacar articulos: "el fernet" → "fernet", que es como esta en la lista.
    const item = claim[1].replace(/^(el|la|los|las|un|una|unos|unas)\s+/, "").trim();
    return item ? { kind: "claim", arg: item } : null;
  }

  if (JOIN.test(normalized)) return { kind: "join" };
  if (LEAVE.test(normalized)) return { kind: "leave" };

  return null;
}
