// Maquina de estados de "cuando el bot escucha".
//
// Regla (definida por el usuario): el bot NO lee el grupo por defecto. Se lo
// invoca con @, escucha hasta que se lo despide, y en el medio ve todo lo que
// se dice para poder organizar la juntada.
//
// Este modulo es puro: se testea sin WhatsApp ni base de datos de por medio.
// El estado persistente vive en store.mjs (Postgres).

// Normaliza para comparar: minusculas, sin tildes, sin signos.
export function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¡!¿?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Devuelve el texto sin la palabra que lo invoco, para que el resto del
// mensaje ("@bot quien va?") quede limpio para el agente.
export function stripTrigger(text, triggers) {
  let out = text || "";
  for (const trigger of triggers) {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function hasTrigger(text, triggers) {
  const normalized = normalize(text);
  return triggers.some((trigger) => normalized.includes(normalize(trigger)));
}

// El despido tiene que estar dirigido al bot (mencion o respuesta), no alcanza
// con que alguien diga "listo" en medio de la charla.
export function isDismissal(text, dismissals) {
  const normalized = normalize(text);
  if (!normalized) return false;
  return dismissals.some(
    (word) => normalized === normalize(word) || normalized.startsWith(`${normalize(word)} `)
  );
}

// WhatsApp reenvia el backlog al conectar y el timestamp puede venir como
// numero o como Long de protobuf ({low, high}). Devuelve true si el mensaje es
// tan viejo que no hay que hacerle caso.
export function isStaleTimestamp(raw, maxAgeMs, now = Date.now()) {
  if (raw === null || raw === undefined) return false;
  const seconds = typeof raw === "number" ? raw : Number(raw.low ?? raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return false;
  return now - seconds * 1000 > maxAgeMs;
}
