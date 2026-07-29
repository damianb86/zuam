// Página pública de una juntada: `/j/:id` y `/j/:id/mesa/:tableId`.
//
// La sirve este servicio (y no el Next del landing) porque el landing se
// exporta estático y no puede generar las etiquetas Open Graph por juntada,
// que son las que hacen que WhatsApp muestre una preview linda.
//
// El HTML es mínimo: las OG tags de esta juntada + los mismos assets del bundle
// de La Casita. La SPA mira la URL y monta la vista de la juntada.

import { readFile } from "node:fs/promises";
import { getMeetupMeta } from "./store.mjs";

const TRUCO_INDEX = process.env.TRUCO_INDEX_PATH || "./static-apps/truco/index.html";
const TRUCO_BASE = "/truco/";

// Etiquetas <script>/<link> del bundle compilado, leídas del index.html que
// genera el build de La Casita (los nombres llevan hash y cambian por deploy).
let assetsCache = null;
async function trucoAssets() {
  if (assetsCache) return assetsCache;
  try {
    const html = await readFile(TRUCO_INDEX, "utf8");
    const scripts = [...html.matchAll(/<script[^>]*src="[^"]+"[^>]*><\/script>/g)].map((m) => m[0]);
    const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
    assetsCache = [...styles, ...scripts].join("\n    ");
  } catch {
    // Sin bundle disponible: la página igual responde (con la preview), pero
    // sin la app. Evita romper el deploy si el estático todavía no se copió.
    assetsCache = "";
  }
  return assetsCache;
}

const escape = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return "";
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  if (Number.isNaN(local.getTime())) return "";
  return `${DAYS[local.getDay()]} ${d} de ${MONTHS[m - 1]}`;
}

// ¿La ruta es una página de juntada? Devuelve el id, o null.
export function juntadaPageId(path) {
  const match = /^\/j\/([a-z0-9]{4,20})(?:\/mesa\/[a-z0-9]{4,20})?$/i.exec(path);
  return match ? match[1] : null;
}

export async function renderJuntadaPage(meetupId, origin) {
  let meta = null;
  try { meta = await getMeetupMeta(meetupId); } catch { meta = null; }

  const title = meta ? `${meta.title} — Juntada de truco` : "Juntada de truco — La Casita";
  const when = meta ? [formatDate(meta.date), meta.time].filter(Boolean).join(" · ") : "";
  const bits = meta
    ? [when, meta.place, `${meta.count}${meta.maxPlayers ? `/${meta.maxPlayers}` : ""} anotados`].filter(Boolean)
    : [];
  const description = bits.length
    ? `${bits.join(" · ")}. Tocá para anotarte y ver qué llevar.`
    : "Anotate a la juntada, elegí qué llevás y seguí las partidas en vivo.";
  const image = `${origin}${TRUCO_BASE}og.png`;
  const assets = await trucoAssets();

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#12325a" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escape(meta ? meta.title : "Juntada de truco")}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:image" content="${escape(image)}" />
    <meta property="og:site_name" content="La Casita" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(meta ? meta.title : "Juntada de truco")}" />
    <meta name="twitter:description" content="${escape(description)}" />
    <meta name="twitter:image" content="${escape(image)}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${TRUCO_BASE}favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="${TRUCO_BASE}apple-touch-icon.png" />
    ${assets}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}
