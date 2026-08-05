# Worker de Cotizaciones (Agente de Cotizaciones Software)

Servicio **aislado** que ejecuta el **Claude Agent SDK sobre Kimi K2.6** para generar y editar
cotizaciones, manteniendo la sesión viva y reanudándola por `sessionId`. La app web GCC World
le habla por HTTP + token compartido (`x-worker-token`). Está separado del monorepo web porque
el Agent SDK requiere `zod@4` (la web usa `zod@3`).

## Cómo funciona
- `POST /generate { model, context }` → crea una sesión nueva del agente, genera la cotización y
  devuelve `{ sessionId, payload }` (payload = `{ title, summary, deadline, requirements[] }`).
- `POST /chat { sessionId, model, message, context }` → reanuda la sesión y devuelve
  `{ sessionId, reply, payload? }` (payload solo si el agente cambió la cotización).
- `GET /health` → `{ ok, tools, talentSearch, model, baseUrl, apiKey }`.
- Herramientas del agente: `list_my_projects` (proyectos previos del miembro, para calibrar
  precios) y `buscar_talentos` (búsqueda semántica vía la app, requiere `APP_URL`).
- **Thinking extendido DESACTIVADO** (no se configura ninguna opción de thinking).

## El proveedor: Kimi K2.6, no Anthropic

El Agent SDK **no llama a Anthropic directamente**: lanza el binario de Claude Code, que respeta
`ANTHROPIC_BASE_URL`. Moonshot expone un endpoint **compatible con `/v1/messages`**, así que el
cambio de proveedor no toca ni el prompt, ni las herramientas MCP, ni la reanudación por
`sessionId`. El worker arma ese entorno en `entornoDelAgente()` (`index.mjs`), y ahí están las
dos trampas que ya se pagaron una vez al razonarlas:

1. **Claude Code hace llamadas de modelo pequeño por su cuenta** (compactación, títulos,
   subagentes) con IDs de Claude. Contra Moonshot eso es *model not found*, y no salta en la
   primera prueba: salta cuando la sesión de GCC Bot crece. Por eso se fijan **las cuatro**
   `ANTHROPIC_DEFAULT_*_MODEL` y `CLAUDE_CODE_SUBAGENT_MODEL` al mismo modelo.
2. **`ANTHROPIC_API_KEY` gana a `ANTHROPIC_AUTH_TOKEN`** en el orden de resolución. Una clave de
   Anthropic olvidada en el entorno se mandaría a Moonshot → 401. El worker la **borra** del
   entorno del subproceso.

⚠️ El modelo es **`kimi-k2.6`** y no `kimi-k2.7-code` porque ese último **exige thinking
activado** (devuelve `400 invalid thinking: only type=enabled is allowed`), y aquí el thinking
va desactivado por decisión del usuario.

⚠️ Contexto: **262 k**, no el millón de Opus. Generar una cotización cabe de sobra; GCC Bot
acumula turnos, por eso se fija `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (200 k por defecto).

## Variables de entorno
| Var | Descripción |
|---|---|
| `KIMI_API_KEY` | Clave de la API de Kimi/Moonshot (**obligatoria**). Sin ella el worker falla en claro, no en silencio. |
| `COTIZADOR_WORKER_TOKEN` | Secreto compartido con la app web (`x-worker-token`). Sin él → 503. |
| `DATABASE_URL` | Postgres de GCC (misma que la web) para `list_my_projects`. |
| `APP_URL` | URL de la app, para que `buscar_talentos` use embeddings. Sin ella cae a búsqueda por texto. |
| `COTIZADOR_MODEL` | Opcional, default `kimi-k2.6`. Debe coincidir con el de la web. |
| `KIMI_BASE_URL` | Opcional, default `https://api.moonshot.ai/anthropic`. |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | Opcional, default `200000`. |
| `PORT` | Opcional, default `4610`. |

**No pongas `ANTHROPIC_API_KEY`** en este servicio.

## Local
```bash
cd services/cotizador-worker
npm install
npm run dev     # lee ../../.env y ../../.env.local (necesita KIMI_API_KEY en uno de los dos)
```
Comprueba sin gastar una cotización:
```bash
curl -s localhost:4610/health
# → { ok, model: "kimi-k2.6", baseUrl: "https://api.moonshot.ai/anthropic", apiKey: "ok", ... }
```
En la app web (`.env.local`): `COTIZADOR_WORKER_URL=http://localhost:4610`, el mismo
`COTIZADOR_WORKER_TOKEN` y `COTIZADOR_MODEL=kimi-k2.6`.

## Despliegue en Railway

⚠️ **Este servicio NO sale de un push a `main`**: está en Railway como subida por CLI, sin repo
conectado (verificado con `railway status --json` → `source.repo = null`). Para desplegarlo:

```bash
cd services/cotizador-worker && railway up . --path-as-root --service cotizador-worker --detach
```

Los dos flags son **obligatorios**, cada uno por un fallo distinto ya pagado:

- **`--path-as-root`**: la **raíz del repo está enlazada a este servicio**, así que `railway up`
  arma el archivo desde el directorio del proyecto (la raíz) aunque lo lances desde aquí — sube
  la app Next entera y Cloudflare responde **`413 Payload Too Large`**. Con `--path-as-root` el
  archivo se arma desde `.` (92 KB). Mover `node_modules` no arregla nada: el problema no es
  esta carpeta, es cuál se archiva. El `.railwayignore` tampoco, por lo mismo.
- **`--detach`**: sin él, `railway up` se cuelga en "Uploading…" y revienta con
  `operation timed out`.

Variables en el servicio `cotizador-worker`: `KIMI_API_KEY`, `COTIZADOR_WORKER_TOKEN`,
`DATABASE_URL`, `APP_URL`, `COTIZADOR_MODEL=kimi-k2.6` — y **quitar `ANTHROPIC_API_KEY`**.
En el servicio **web** (`corazonescruzados`): `COTIZADOR_WORKER_URL`
(`http://cotizador-worker.railway.internal:4610`, red privada), `COTIZADOR_WORKER_TOKEN` y
`COTIZADOR_MODEL=kimi-k2.6`.
