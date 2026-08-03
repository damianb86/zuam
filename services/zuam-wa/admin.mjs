// Interfaz para elegir que grupos controla el bot.
//
// Es un servidor HTTP chiquito DENTRO del proceso del bot. Tiene que ser
// adentro porque la lista de grupos sale del socket de WhatsApp, y solo puede
// haber una sesion por numero: un proceso aparte no podria consultarla.
//
// Por defecto escucha en localhost y pide un token. NO exponerlo a internet:
// desde aca se decide que conversaciones lee el bot.

import { createServer } from "node:http";
import QRCode from "qrcode";
import { listChats, registerChats, setAllowed } from "./store.mjs";
import { config } from "./config.mjs";

const PAGE = ({ rows, status, refresh }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${refresh ? '<meta http-equiv="refresh" content="5">' : ""}
<title>Bot de juntadas</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px;
         max-width: 720px; margin-inline: auto; }
  h1 { font-size: 1.25rem; margin: 0 0 4px; }
  .sub { opacity: .7; font-size: .85rem; margin-bottom: 24px; }
  ul { list-style: none; padding: 0; margin: 0; }
  ul li { display: flex; align-items: center; gap: 12px; padding: 12px;
       border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
       border-radius: 10px; margin-bottom: 8px; }
  ul li.on { border-color: #16a34a; background: color-mix(in srgb, #16a34a 8%, transparent); }
  .name { flex: 1; min-width: 0; }
  .name b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .name span { font-size: .75rem; opacity: .6; }
  .tag { font-size: .7rem; padding: 2px 8px; border-radius: 999px;
         background: #16a34a; color: #fff; }
  button { font: inherit; padding: 8px 14px; border-radius: 8px; cursor: pointer;
           border: 1px solid currentColor; background: transparent; color: inherit; }
  button.on { background: #16a34a; border-color: #16a34a; color: #fff; }
  .empty { opacity: .6; padding: 32px 0; text-align: center; }
  footer { margin-top: 24px; font-size: .8rem; opacity: .6; }
  .card { border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
          border-radius: 10px; padding: 16px; margin-bottom: 24px; }
  .card h2 { font-size: .95rem; margin: 0 0 8px; }
  .qr { background: #fff; padding: 12px; border-radius: 8px; width: 260px;
        max-width: 100%; margin: 12px 0; }
  .qr svg { display: block; width: 100%; height: auto; }
  .danger { border-color: #dc2626; color: #dc2626; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
         margin-right: 6px; vertical-align: middle; }
  .dot.ok { background: #16a34a; } .dot.off { background: #dc2626; }
  ol { margin: 8px 0 0; padding-left: 20px; font-size: .85rem; opacity: .8; }
  ol li { display: list-item; }
</style></head><body>
${status}
<h1>Grupos que controla el bot</h1>
<div class="sub">En los grupos apagados el bot no lee ni guarda nada: los
mensajes se descartan apenas llegan.</div>
<ul>${rows}</ul>
<footer>Los grupos aparecen a medida que WhatsApp los informa. Si falta alguno,
recarga en unos segundos.</footer>
<script>
  const post = (body) =>
    fetch(location.pathname + "?token=" + encodeURIComponent(TOKEN), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  document.addEventListener("click", async (event) => {
    const chatButton = event.target.closest("button[data-chat]");
    if (chatButton) {
      chatButton.disabled = true;
      await post({ chatId: chatButton.dataset.chat, allowed: chatButton.dataset.on !== "1" });
      return location.reload();
    }

    const relink = event.target.closest("button[data-action='relink']");
    if (relink) {
      if (!confirm("Se desvincula el numero actual y vas a tener que escanear un QR nuevo. Seguro?")) return;
      relink.disabled = true;
      relink.textContent = "Desvinculando...";
      await post({ action: "relink" });
      setTimeout(() => location.reload(), 3000);
    }
  });
</script>
</body></html>`;

const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Bloque de arriba: quien esta conectado, o el QR para vincular otro numero.
async function renderStatus({ connected, botName, qr }) {
  if (connected) {
    return `<div class="card">
      <h2><span class="dot ok"></span>Conectado</h2>
      <div class="sub" style="margin:0">Numero: <b>${escape(botName)}</b></div>
      <p style="font-size:.85rem;opacity:.8">Para usar otro numero hay que
      desvincular este. El bot deja de leer todo hasta que escanees el QR nuevo.</p>
      <button data-action="relink" class="danger">Conectar otro numero</button>
    </div>`;
  }

  if (qr) {
    const svg = await QRCode.toString(qr, { type: "svg", margin: 1 });
    return `<div class="card">
      <h2><span class="dot off"></span>Esperando que escanees el QR</h2>
      <div class="qr">${svg}</div>
      <ol>
        <li>Abri WhatsApp en el celular del numero que quieras usar.</li>
        <li>Ajustes → Dispositivos vinculados → Vincular dispositivo.</li>
        <li>Escanea este codigo. La pagina se refresca sola.</li>
      </ol>
    </div>`;
  }

  return `<div class="card">
    <h2><span class="dot off"></span>Desconectado</h2>
    <div class="sub" style="margin:0">Conectando con WhatsApp... esperá unos
    segundos, el QR aparece solo.</div>
  </div>`;
}

export function startAdminServer({ getGroups, getBotName, getStatus, relink, log }) {
  if (!config.adminPort) return null;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);

    // Token obligatorio: desde esta pagina se decide que conversaciones se leen.
    if (url.searchParams.get("token") !== config.adminToken) {
      response.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Falta el token. Agregá ?token=... a la URL.");
    }

    try {
      if (request.method === "POST") {
        const body = await readJson(request);

        if (body.action === "relink") {
          log("admin_relink");
          // No se espera: desvincular corta la conexion y con ella esta misma
          // request. El navegador recarga solo a los 3 segundos.
          relink().catch((error) => log("relink_failed", { message: error?.message }));
          response.writeHead(200, { "Content-Type": "application/json" });
          return response.end(JSON.stringify({ ok: true }));
        }

        await setAllowed(body.chatId, body.allowed);
        log("admin_toggle", { chat: body.chatId, allowed: Boolean(body.allowed) });
        response.writeHead(200, { "Content-Type": "application/json" });
        return response.end(JSON.stringify({ ok: true }));
      }

      const state = getStatus();

      // La lista de grupos solo tiene sentido con la sesion levantada.
      if (state.connected) {
        const groups = await getGroups().catch(() => []);
        if (groups.length) await registerChats(groups);
      }

      const chats = (await listChats()).filter((chat) => chat.isGroup || chat.allowed);
      const rows = chats.length
        ? chats.map(renderRow).join("")
        : `<div class="empty">Todavia no aparecio ningun grupo.</div>`;

      const status = await renderStatus({
        connected: state.connected,
        botName: getBotName() || "?",
        qr: state.qr,
      });

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return response.end(
        // Mientras no este conectado la pagina se refresca sola: el QR caduca
        // cada ~20s y Baileys emite uno nuevo.
        PAGE({ rows, status, refresh: !state.connected }).replace(
          "<script>",
          `<script>const TOKEN=${JSON.stringify(config.adminToken)};`,
        ),
      );
    } catch (error) {
      log("admin_failed", { message: error?.message });
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Se rompio algo, mira los logs.");
    }
  });

  server.listen(config.adminPort, config.adminHost, () => {
    console.log(
      `\n⚙️  Elegí los grupos en: http://localhost:${config.adminPort}/?token=${config.adminToken}\n`,
    );
  });

  return server;
}

function renderRow(chat) {
  const label = chat.title || chat.chatId.split("@")[0];
  return `<li class="${chat.allowed ? "on" : ""}">
    <div class="name">
      <b>${escape(label)}</b>
      <span>${escape(chat.chatId)}</span>
    </div>
    ${chat.listening ? '<span class="tag">escuchando</span>' : ""}
    <button data-chat="${escape(chat.chatId)}" data-on="${chat.allowed ? 1 : 0}"
            class="${chat.allowed ? "on" : ""}">
      ${chat.allowed ? "Activado" : "Activar"}
    </button>
  </li>`;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) reject(new Error("body demasiado grande"));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}
