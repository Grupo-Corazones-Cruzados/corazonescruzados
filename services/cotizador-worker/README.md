# Worker de Cotizaciones (Agente de Cotizaciones Software)

Servicio **aislado** que ejecuta el **Agents SDK de OpenAI (`@openai/agents`) sobre
`gpt-5.6-luna`** para generar y editar cotizaciones, manteniendo la conversación viva y
reanudándola por `sessionId`. La app web GCC World le habla por HTTP + token compartido
(`x-worker-token`). Está separado del monorepo web porque el SDK requiere `zod@4` (la web usa
`zod@3`).

## Cómo funciona
- `POST /generate { model, context }` → crea una sesión nueva del agente, genera la cotización y
  devuelve `{ sessionId, payload }` (payload = `{ title, summary, deadline, requirements[] }`).
- `POST /chat { sessionId, model, message, context }` → reanuda la sesión y devuelve
  `{ sessionId, reply, payload? }` (payload solo si el agente cambió la cotización).
- `GET /health` → `{ ok, tools, talentSearch, model, proveedor, apiKey }`.
- Herramientas del agente: `list_my_projects` (proyectos previos del miembro, para calibrar
  precios) y `buscar_talentos` (búsqueda semántica vía la app, requiere `APP_URL`).
- **Razonamiento DESACTIVADO** (`reasoning.effort: 'none'`), por decisión del usuario. Medido
  el 2026-08-21: apagarlo no impide que el agente llame a las herramientas.

## El proveedor: OpenAI (2026-08-21)

Hasta el 2026-08-21 esto corría el **Claude Agent SDK apuntado a Kimi K2.6**, que funcionaba
porque **Moonshot expone a propósito un endpoint compatible con `/v1/messages`** de Anthropic:
bastaba con reapuntar `ANTHROPIC_BASE_URL`. **OpenAI no expone nada equivalente**, así que
unificar el proveedor obligó a cambiar de SDK, no de variable.

El cambio se llevó por delante tres fragilidades que este mismo README documentaba:

1. **El subproceso.** El Agent SDK lanzaba el binario de Claude Code, que hacía llamadas de
   modelo pequeño por su cuenta (compactación, títulos, subagentes) con IDs de Claude que
   Moonshot no conocía. Había que fijar **seis** variables de entorno para que no se cayera a
   mitad de una cotización. Ya no hay subproceso, ni esas variables.
2. **La puerta doble de permisos.** Declarar las herramientas en `allowedTools` las
   auto-aprobaba *antes* de consultar al callback `canUseTool`. Ahora el agente tiene
   exactamente las herramientas que se le pasan: no hay nada que denegar.
3. **Las sesiones en disco.** Vivían en el contenedor y Railway levanta uno nuevo en **cada
   despliegue**, así que toda cotización anterior al despliegue quedaba sin hilo para siempre.
   Ahora la conversación vive en OpenAI (`OpenAIConversationsSession`) y sobrevive.

⚠️ **`gpt-5.6-luna` devuelve 400 con `temperature` y `top_p`** — no los ignora. Y el techo va
como `max_output_tokens`, no `max_tokens`.

⚠️ **El modelo no sabe en qué día vive** (corte de conocimiento en febrero de 2026). Antes no se
notaba porque el CLI de Claude Code inyectaba la fecha en su prompt de sistema; al quitar el
subproceso, esa muleta se fue con él y el agente propuso una `deadline` **cuatro meses en el
pasado**. Por eso los prompts llevan ahora `hoyEnEcuador()`.

## Variables de entorno
| Var | Descripción |
|---|---|
| `OPENAI_API_KEY` | Clave de OpenAI (**obligatoria**). Sin ella el worker falla en claro, no en silencio. |
| `COTIZADOR_WORKER_TOKEN` | Secreto compartido con la app web (`x-worker-token`). Sin él → 503. |
| `DATABASE_URL` | Postgres de GCC (misma que la web) para `list_my_projects`. |
| `APP_URL` | URL de la app, para que `buscar_talentos` use embeddings. Sin ella cae a búsqueda por texto. |
| `COTIZADOR_MODEL` | Opcional, default `gpt-5.6-luna`. **Debe coincidir con el de la web**: se guarda en `quote_sessions` y si difieren, el historial miente. |
| `PORT` | Opcional, default `4610`. |

`KIMI_API_KEY` y `KIMI_BASE_URL` **ya no se usan**: si siguen en el servicio, sobran (y conviene
revocar la clave en Moonshot).

## Local
```bash
cd services/cotizador-worker
npm install
npm run dev     # lee ../../.env y ../../.env.local (necesita OPENAI_API_KEY en uno de los dos)
```
Comprueba sin gastar una cotización:
```bash
curl -s localhost:4610/health
# → { ok, model: "gpt-5.6-luna", proveedor: "openai", apiKey: "ok", ... }
```
En la app web (`.env.local`): `COTIZADOR_WORKER_URL=http://localhost:4610`, el mismo
`COTIZADOR_WORKER_TOKEN` y `COTIZADOR_MODEL=gpt-5.6-luna`.

## Despliegue en Railway

⚠️ **Este servicio NO sale de un push a `main`**: está en Railway como subida por CLI, sin repo
conectado (verificado con `railway status --json` → `source.repo = null`). Para desplegarlo:

```bash
cd services/cotizador-worker && railway up --detach
```

**`--detach` es obligatorio**: sin él, `railway up` se cuelga en "Uploading…" y revienta con
`operation timed out`.

### Por qué ya no hace falta `--path-as-root` (2026-08-06)

Hacía falta porque **esta carpeta no estaba enlazada**: la CLI armaba el archivo desde el
*directorio del proyecto* —la raíz del repo— aunque el comando se lanzara desde aquí. Eso subía
la app Next entera (**1.896 ficheros, 426 MB**) y Cloudflare respondía **`413 Payload Too Large`**.
Peor: la raíz estaba enlazada **a este mismo servicio**, así que un `railway up` tecleado desde la
raíz habría plantado la app web encima del worker. Ni mover `node_modules` ni el `.railwayignore`
arreglaban nada: el problema no era qué carpeta se ignora, sino **cuál se archiva**.

Se arregló enlazando cada directorio a lo suyo:

```bash
cd services/cotizador-worker && railway link -p 9879300f-745e-4929-b9cb-3d6a03ce0117 -e production -s cotizador-worker
cd ../..                     && railway link -p 9879300f-745e-4929-b9cb-3d6a03ce0117 -e production -s corazonescruzados
```

Ahora esta carpeta es su propio directorio de proyecto: el archivo sale a **5 ficheros / 96 KB** y
la subida tarda **1,6 s**. Y la raíz apunta al servicio web, que es lo que de verdad hay ahí.

⚠️ **El enlace vive en `~/.railway/config.json`, que es local a cada máquina.** En un portátil
nuevo o un clon recién hecho no existe, y el `railway up` volvería a archivar la raíz. Si
`railway status` desde esta carpeta no responde `Service: cotizador-worker`, vuelve a lanzar el
`railway link` de arriba **antes** de desplegar (o usa `railway up . --path-as-root --service
cotizador-worker --detach`, que sigue funcionando como salida de emergencia).

Variables en el servicio `cotizador-worker`: `OPENAI_API_KEY`, `COTIZADOR_WORKER_TOKEN`,
`DATABASE_URL`, `APP_URL`, `COTIZADOR_MODEL=gpt-5.6-luna`.

⚠️ **Cambiar SOLO las variables no despliega el código.** Tocar una variable reinicia el
servicio con el **build que ya había**, y el 2026-08-23 eso dejó media hora al worker corriendo
el código viejo de Kimi con `COTIZADOR_MODEL=gpt-5.6-luna` — o sea, mandando un modelo de OpenAI
a Moonshot. Si cambias el modelo, **haz también el `railway up`**. El log de arranque dice cuál
de los dos está vivo: `… en OpenAI` (nuevo) o `… en https://api.moonshot.ai/anthropic` (viejo).
En el servicio **web** (`corazonescruzados`): `COTIZADOR_WORKER_URL`
(`http://cotizador-worker.railway.internal:4610`, red privada), `COTIZADOR_WORKER_TOKEN` y
`COTIZADOR_MODEL=gpt-5.6-luna`.
