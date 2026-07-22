# Worker de Cotizaciones (Agente de Cotizaciones Software)

Servicio **aislado** que ejecuta el **Claude Agent SDK** (Opus 4.8) para generar y editar
cotizaciones, manteniendo la sesión viva y reanudándola por `sessionId`. La app web GCC World
le habla por HTTP + token compartido (`x-worker-token`). Está separado del monorepo web porque
el Agent SDK requiere `zod@4` (la web usa `zod@3`).

## Cómo funciona
- `POST /generate { model, context }` → crea una sesión nueva del agente, genera la cotización y
  devuelve `{ sessionId, payload }` (payload = `{ title, summary, deadline, requirements[] }`).
- `POST /chat { sessionId, model, message, context }` → reanuda la sesión y devuelve
  `{ sessionId, reply, payload? }` (payload solo si el agente cambió la cotización).
- `GET /health` → `{ ok: true }`.
- Herramienta del agente: `list_my_projects` (solo lectura) — lee los proyectos previos del
  miembro (`context.memberId`) desde Postgres para calibrar precios y desglose.
- **Thinking extendido DESACTIVADO** (no se configura ninguna opción de thinking).

## Variables de entorno
| Var | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de Claude (obligatoria). |
| `COTIZADOR_WORKER_TOKEN` | Secreto compartido con la app web (`x-worker-token`). Sin él → 503. |
| `DATABASE_URL` | Postgres de GCC (misma que la web) para la herramienta `list_my_projects`. |
| `COTIZADOR_MODEL` | Opcional, default `claude-opus-4-8`. |
| `PORT` | Opcional, default `4610`. |

## Local
```bash
cd services/cotizador-worker
npm install
ANTHROPIC_API_KEY=sk-ant-... \
COTIZADOR_WORKER_TOKEN=testsecret123 \
DATABASE_URL='postgresql://...' \
PORT=4610 node index.mjs
```
En la app web (`.env.local`): `COTIZADOR_WORKER_URL=http://localhost:4610` y el mismo
`COTIZADOR_WORKER_TOKEN`.

## Despliegue en Railway (servicio nuevo)
1. Crea un **servicio nuevo** en el proyecto `Servidor-GCC` apuntando a este repo, con
   **Root Directory = `services/cotizador-worker`** (así usa su propio `package.json`).
2. Start command: `npm start` (o `node index.mjs`). Build: `npm install`.
3. Variables: `ANTHROPIC_API_KEY`, `COTIZADOR_WORKER_TOKEN` (genera un secreto fuerte),
   `DATABASE_URL` (la de Postgres del proyecto), `COTIZADOR_MODEL=claude-opus-4-8`.
4. En el servicio **web** (`corazonescruzados`), agrega: `COTIZADOR_WORKER_URL` = la URL
   pública/privada del worker, y `COTIZADOR_WORKER_TOKEN` = el mismo secreto.
5. (Opcional) Monta un **volumen** para persistir las sesiones del SDK entre reinicios.
