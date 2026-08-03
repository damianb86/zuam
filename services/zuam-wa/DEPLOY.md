# Deploy del bot de WhatsApp

Todo lo que hace falta, con los valores reales de este proyecto.

## Lo que NO hay que crear

- **Base de datos:** ya existe. El bot usa la misma que las juntadas
  (`postgresql://zuam:...@postgres:5432/truco`), con el mismo rol `zuam`. Las
  tablas `wa_*` se crean solas al arrancar (`CREATE TABLE IF NOT EXISTS`).
- **Rol / password de Postgres:** ninguno nuevo.
- **Clave de OpenAI:** la misma `OPENAI_API_KEY` que ya usa el landing.
- **Dominio, DNS o Caddy:** el bot no recibe trafico de internet. No se publica.

Lo unico nuevo es un **token para la interfaz** y decidir el **numero** de
WhatsApp.

---

## Paso 1 — Variables nuevas

Agregar al final de `.env.production` (local, se sube sola en el deploy):

```bash
# Bot de WhatsApp de las juntadas
WA_ENABLED=1
WA_ADMIN_TOKEN=a9e5fd7cf30a993a17663e860ee5fdcc
WA_ADMIN_PORT=3210
WA_MEETUP_BASE_URL=https://zuam.dev
WA_OPENAI_MODEL=gpt-5.6-luna
WA_TRIGGERS=@truco,@bot,@juntada
WA_ALLOW_DIRECT=false
WA_AMBIENT=true
WA_RETENTION_DAYS=7
```

Ese token es de ejemplo: generá el tuyo con `openssl rand -hex 16`.

`WA_ENABLED=1` es lo que hace que `deploy.sh` incluya el bot. **Importante:**
sin eso, un deploy normal de Zuam borraria el contenedor del bot, porque el
`docker compose up` corre con `--remove-orphans`.

## Paso 2 — Subir el codigo

El servidor toma el codigo por git, asi que hay que publicarlo:

```bash
cd ~/Dev/qorve/zuam
git add services/zuam-wa Dockerfile.wa docker-compose.wa.yml deploy.sh .env.example .gitignore .dockerignore
git commit -m "Bot de WhatsApp para las juntadas"
git push origin main
```

## Paso 3 — Actualizar el servidor

```bash
ssh -i ~/.ssh/ubuntu-1-2026-06 ubuntu@3.135.94.213
```

Ya adentro:

```bash
cd /opt/apps/zuam && git pull --ff-only
```

## Paso 4 — Subir la env y levantar el bot

Desde tu maquina, el deploy de siempre (sube `.env.production` como `.env` del
servidor y reconstruye todo, ahora incluyendo el bot):

```bash
cd ~/Dev/qorve/zuam && ./deploy-production.local.sh
```

Si solo querés tocar el bot sin reconstruir el landing, en el servidor:

```bash
cd /opt/apps/zuam && docker compose -f docker-compose.yml -f docker-compose.wa.yml --env-file ../shared-docker/.env --env-file .env up -d --build wa
```

## Paso 5 — Vincular el numero

La interfaz **no se expone a internet** a proposito: desde ahi se decide que
conversaciones lee el bot. Se llega por tunel SSH. Desde tu maquina:

```bash
ssh -i ~/.ssh/ubuntu-1-2026-06 -L 3210:localhost:3210 ubuntu@3.135.94.213
```

Dejando esa terminal abierta, abri en el navegador:

```
http://localhost:3210/?token=a9e5fd7cf30a993a17663e860ee5fdcc
```

Vas a ver el QR. En el celular del numero que quieras usar:
**WhatsApp → Ajustes → Dispositivos vinculados → Vincular dispositivo**, y
escanealo. La pagina se refresca sola y pasa a "Conectado".

Despues, en la misma pagina, **activá los grupos** que quieras que controle.
Arrancan todos apagados.

## Paso 6 — Probar

En un grupo activado, escribi `@truco ping`. Deberia contestar.

```bash
# Logs del bot, en el servidor
cd /opt/apps/zuam && docker compose -f docker-compose.yml -f docker-compose.wa.yml --env-file ../shared-docker/.env --env-file .env logs -f wa
```

---

## Cambiar de numero mas adelante

En la misma interfaz: boton **"Conectar otro numero"**. Desvincula el actual,
borra las credenciales y muestra un QR nuevo. No hace falta entrar al servidor.

## Cosas para tener en cuenta

- **Las credenciales viven en el volumen `zuam_wa_auth`.** Si lo borras
  (`docker volume rm`), hay que re-escanear el QR.
- **Un solo proceso por numero.** Si dejas el bot corriendo en tu compu contra
  el mismo numero, las dos instancias se pelean y se desconectan en loop.
- **Baileys es un cliente no oficial.** El numero puede ser baneado. Usar uno
  dedicado.
- Para apagar el bot sin tocar el resto:
  `docker compose ... stop wa` (o `WA_ENABLED=0` y deploy).
