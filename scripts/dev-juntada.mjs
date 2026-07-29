// Servidor de desarrollo para probar las juntadas en local.
//
// En producción esto lo hace Caddy: `/api/*` y `/j/*` van al servicio api, y el
// resto lo sirve el estático. Acá se replica ese ruteo en un solo puerto para
// poder abrir la juntada en el navegador sin levantar todo el stack de Docker.
//
//   JUNTADA_DATABASE_URL=postgres://… node scripts/dev-juntada.mjs
//
// Requiere que exista static-apps/truco (npm run build:truco).

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.DEV_PORT || 4400);
const API = process.env.DEV_API_ORIGIN || "http://localhost:3311";
const STATIC_ROOT = new URL("../static-apps/truco/", import.meta.url).pathname;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".ico": "image/x-icon",
};

async function serveStatic(response, relativePath) {
  const safe = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const file = join(STATIC_ROOT, safe);
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

async function proxy(request, response, url) {
  const target = `${API}${url.pathname}${url.search}`;
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const upstream = await fetch(target, {
    method: request.method,
    headers: { "content-type": request.headers["content-type"] || "application/json", origin: API },
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
  const body = Buffer.from(await upstream.arrayBuffer());
  response.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/j/") || url.pathname === "/health") {
      return await proxy(request, response, url);
    }
    if (url.pathname.startsWith("/truco/")) {
      const served = await serveStatic(response, url.pathname.slice("/truco/".length) || "index.html");
      if (served) return;
      return await serveStatic(response, "index.html") || response.writeHead(404).end("no encontrado");
    }
    if (url.pathname === "/" || url.pathname === "/truco") {
      response.writeHead(302, { Location: "/truco/" });
      return response.end();
    }
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("no encontrado");
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain" });
    response.end(String(error));
  }
}).listen(PORT, () => {
  console.log(`dev-juntada escuchando en http://localhost:${PORT} (api: ${API})`);
});
