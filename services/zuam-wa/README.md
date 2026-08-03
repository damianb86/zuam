# zuam-wa — bot de WhatsApp de las juntadas

Organiza juntadas de truco desde el chat del grupo: crea la juntada, anota
gente, lleva la lista de que trae cada uno, arma equipos y canta el marcador.

Plan y decisiones: `docs/plan-bot-whatsapp.md` en el repo Truco.

## El embudo (lo mas importante de entender)

El bot **no lee el grupo** y **no gasta un token** hasta que hace falta. Cada
mensaje pasa por estos escalones y la mayoria muere en el primero:

| Escalon | Que lo dispara | Costo |
|---|---|---|
| 0. Grupo apagado | No esta en la allowlist | Nada. **Se descarta al instante** |
| 1. Silencio | Grupo prendido pero sin sesion | Nada. Ni se guarda |
| 2. Despertar | `@truco` (comparacion de strings en JS) | Nada |
| 3. Intencion evidente | "yo llevo el fernet" via regex → 👍 | Nada |
| 4. Modo despierto | Se juntaron N mensajes y paso el enfriamiento | 1 llamada, casi siempre "me callo" |
| 5. Agente | Le hablan directamente | 1 llamada a OpenAI |

**La IA es el ultimo escalon, no el primero.** Un grupo entero charlando con la
sesion abierta no cuesta nada mientras no le hablen al bot.

## Que grupos lee (allowlist)

**Todos los grupos arrancan apagados.** En uno apagado el bot descarta el
mensaje apenas llega: no extrae el texto, no lo loguea, no lo guarda y no
contesta ni aunque lo nombren. Para el bot, esa conversacion no existe.

Se eligen en una interfaz web que corre **dentro del proceso del bot** (tiene
que ser adentro: la lista de grupos sale del socket de WhatsApp y solo puede
haber una sesion por numero):

```
http://localhost:3210/?token=EL_TOKEN
```

El token sale de `WA_ADMIN_TOKEN`; si no lo configuras se inventa uno y se
imprime al arrancar. En el servidor el puerto se publica solo en `127.0.0.1`,
asi que para abrirla desde tu compu:

```bash
ssh -L 3210:localhost:3210 ubuntu@el-servidor
```

**No exponer esa pagina a internet:** desde ahi se decide que conversaciones
privadas lee el bot.

Los chats 1-a-1 estan apagados por defecto (`WA_ALLOW_DIRECT=false`).

## Modo despierto

Una vez invocado en un grupo habilitado, el bot lee **todo** lo que se escribe
—lo nombren o no— y puede meter un bocadillo por cuenta propia: "faltan 2 para
el 3v3", "quedo confirmado el SUM?", "dale loco, anotense".

Para que no sea insoportable ni caro hay dos frenos **en JS, antes de gastar un
token**: tienen que juntarse `WA_AMBIENT_MIN_MESSAGES` mensajes nuevos y haber
pasado `WA_AMBIENT_COOLDOWN_MINUTES` desde que el bot hablo. Recien ahi se le
pregunta al modelo, que ademas tiene la instruccion de callarse salvo que
aporte algo concreto (en las pruebas, se calla ante charla que no es de la
juntada). En ese modo **no tiene herramientas**: puede opinar, no tocar la
juntada. Para cambiar algo hay que nombrarlo.

Se apaga con `WA_AMBIENT=false`.

## Como escucha

| Situacion | Que hace |
|---|---|
| Grupo apagado, cualquier cosa | **Nada de nada.** Se descarta antes de leerlo |
| Sesion cerrada, mensaje cualquiera | Nada. Loguea que hubo un mensaje, nunca que decia |
| Sesion cerrada, lo mencionan | Abre sesion y contesta |
| Sesion abierta, mensaje cualquiera | Lo lee y guarda; opina solo si aporta (modo despierto) |
| Sesion abierta, intencion evidente | Ejecuta la accion y reacciona 👍, sin escribir |
| Sesion abierta, lo mencionan | Corre el agente y responde |
| Sesion abierta + "listo" dirigido a el | Cierra la sesion y se despide |
| Sesion abierta sin actividad 6h | Se cierra sola (`WA_SESSION_TTL_MINUTES`) |

El TTL no es un detalle: sin el, un grupo donde nadie se acordo de despedir al
bot queda escuchado para siempre.

## Que sabe hacer

Todas las herramientas son wrappers finos sobre `juntada/store.mjs`. Si aparece
logica de juntadas en `tools.mjs`, esta en el lugar equivocado.

| Herramienta | Ejemplo en el chat |
|---|---|
| `ver_juntada` | "@truco quienes van y que falta?" |
| `ver_mesas` | "@truco como va la mesa 2?" |
| `crear_juntada` | "@truco armemos una el viernes 21hs en lo de Dami" |
| `anotarme` / `anotar_a` | "@truco anotame y anota a Nacho" |
| `bajarme` / `bajar_a` | "@truco bajame que no llego" |
| `agregar_item` / `tomar_item` | "@truco agrega carbon" / "yo llevo el fernet" |
| `armar_equipos` | "@truco arma los equipos" |

## Probar en local

```bash
cd services/zuam-wa
npm install
npm test              # el embudo de JS puro, sin base ni WhatsApp

createdb wa_test
npm run test:db       # + las herramientas contra Postgres de verdad

JUNTADA_DATABASE_URL=postgresql://$USER@localhost:5432/wa_test npm run dev
```

Escanear el QR desde **WhatsApp > Dispositivos vinculados**. Queda vinculado en
`.wa-auth/` y no vuelve a pedirlo. Con un servidor headless conviene
`WA_PAIRING_NUMBER=549351...` (con pais, sin `+`): imprime un codigo de 8
digitos en vez del QR.

## Variables

| Variable | Default | Para que |
|---|---|---|
| `JUNTADA_DATABASE_URL` | — | **Obligatoria.** La misma base que las juntadas |
| `OPENAI_API_KEY` | — | Sin esto solo funcionan los escalones 1 a 3 |
| `WA_TRIGGERS` | `@truco,@bot,@juntada` | Palabras que lo invocan |
| `WA_DISMISSALS` | `listo,gracias,chau,ya esta,nada mas` | Palabras que lo despiden |
| `WA_SESSION_TTL_MINUTES` | `360` | Cuanto escucha sin actividad |
| `WA_OPENAI_MODEL` | `gpt-5.6-luna` | Modelo del agente |
| `WA_MEETUP_BASE_URL` | `https://zuam.com` | Origen de los links `/j/{id}` |
| `WA_SILENT_REACTIONS` | `true` | Actuar con 👍 en vez de escribir |
| `WA_RETENTION_DAYS` | `7` | Dias que se guardan los mensajes leidos |
| `WA_HISTORY_SIZE` | `25` | Mensajes de contexto para el agente |
| `WA_MAX_TOOL_TURNS` | `4` | Tope de vueltas del loop de herramientas |
| `WA_ADMIN_TOKEN` | se inventa uno | Token de la interfaz de grupos |
| `WA_ADMIN_PORT` | `3210` | Puerto de la interfaz |
| `WA_ENABLED` | `0` | Que `deploy.sh` levante el contenedor del bot |
| `WA_ALLOW_DIRECT` | `false` | Leer tambien chats 1-a-1 |
| `WA_AMBIENT` | `true` | Que opine por cuenta propia |
| `WA_AMBIENT_MIN_MESSAGES` | `4` | Mensajes que se juntan antes de evaluar |
| `WA_AMBIENT_COOLDOWN_MINUTES` | `10` | Enfriamiento desde que hablo |
| `WA_ALLOW_SELF` | `true` | Procesar los mensajes propios |
| `WA_LOG_MESSAGE_TEXT` | `true` | En `false` loguea solo metadatos |
| `WA_LOG_LEVEL` | `warn` | Ruido interno de Baileys |
| `WA_MAX_MESSAGE_AGE_SECONDS` | `120` | Descarta el backlog viejo del arranque |
| `WA_AUTH_DIR` | `./.wa-auth` | Credenciales del dispositivo enlazado |
| `WA_PAIRING_NUMBER` | vacio | Vincular por codigo en vez de QR |

## Cambiar de numero

En la interfaz, boton **"Conectar otro numero"**: desvincula el actual, borra
las credenciales y muestra un QR nuevo. No hace falta entrar al servidor.

## Deploy

**Ver `DEPLOY.md`**, que tiene los comandos con los valores reales del
proyecto. En resumen: `WA_ENABLED=1` en la env, push, `git pull` en el
servidor, y `./deploy-production.local.sh`.

`WA_ENABLED=1` no es opcional: `deploy.sh` corre `up -d --remove-orphans`, asi
que sin esa variable un deploy de Zuam **borraria el contenedor del bot** y
habria que re-escanear el QR.

Las credenciales viven en el volumen `wa_auth`: **si se borra, hay que
re-escanear.**

## Errores conocidos

**`conflict: replaced` (status 440) y el bot sale.** Otra instancia tomo la
sesion: casi siempre es otro `npm run dev` abierto en otra terminal. Solo puede
haber **un** proceso por numero. El bot ya no reintenta en ese caso, a
proposito: dos instancias reconectando se pelean la vinculacion en loop y eso
es justo lo que hace que WhatsApp mire mal a un numero.

**`PreKeyError: Invalid PreKey ID` / `SessionError: No session record` al
vincular por primera vez.** No es un error del bot: son mensajes del backlog
cifrados **antes** de que el dispositivo existiera, asi que no hay forma de
desencriptarlos. Se ignoran solos y por defecto ni se ven.

**`Connection Closed` (status 428) despues de una desconexion.** Rechazo
asincronico del socket viejo. Ya esta atrapado; queda en el log como
`unhandled_rejection`.

## Advertencias

- Esto usa un **cliente no oficial** (Baileys). Es contra los ToS de WhatsApp y
  el numero puede ser baneado. Usar un numero dedicado, nunca el personal, en
  cuanto se pase de las pruebas.
- `baileys` esta pinneado en `6.7.24` (tag `legacy`). La `latest` es una RC.
- Mientras la sesion esta abierta, el bot guarda los mensajes del grupo (se
  borran a los `WA_RETENTION_DAYS` dias). Avisarle a la gente.
