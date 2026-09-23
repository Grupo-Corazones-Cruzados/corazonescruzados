# Automatizaciones — producto del Grupo Corazones Cruzados

El agente de IA en WhatsApp, las campañas de correo y las plantillas, que hasta el
2026-09-23 vivían dentro de la plataforma como la sección «Automatizaciones».

- **Esquema:** `automatizaciones` (mismo Postgres de Railway, sin compartir tablas con `gcc_world`)
- **Servicio Railway:** `automatizaciones` · puerto **3014** · `productos/automatizaciones`
- **Dirección:** https://automatizaciones.grupocc.org
- **Inquilinos actuales:** `/grupo` (cortesía) y `/peter-tours` (cliente real, con su número conectado)

## Cómo se monta en local

```bash
npm install
cp .env.example .env          # y pon DATABASE_URL con ?schema=automatizaciones
npm run migrar                # aplica sql/migraciones/ en orden
npm run semilla               # plan + cuenta del equipo (enseña la contraseña UNA vez)
npm run dev                   # http://localhost:3014
```

Para probar de verdad, **contra el build de producción**, no contra `next dev`:

```bash
NEXT_DIST_DIR=.next-build npm run build
NEXT_DIST_DIR=.next-build PORT=3014 npm start
```

⚠️ `next dev` compila cada ruta la primera vez que se pide; con varias pestañas abiertas
aparecen esperas agotadas y «navegaciones que no ocurren» que no son del código.
Y para parar el servidor: `kill $(lsof -ti :3014)` — `pkill -f "next start"` NO lo mata,
porque el proceso se llama `next-server`.

## Las piezas que hay que entender antes de tocar nada

| Archivo | Qué decide |
|---|---|
| `src/lib/inquilino.ts` | **El más importante.** A qué inquilino pertenece una petición, si puede entrar (la mensualidad es una puerta) y si puede hacer lo que va a hacer. Ninguna página construye ese filtro por su cuenta. |
| `src/lib/cuentaGcc.ts` | La **única** lectura que este producto hace de `gcc_world`: dos columnas de `users` para comprobar la contraseña de quien entra con su cuenta de GCC World. |
| `src/lib/sesion.ts` | Dos cookies que no se mezclan: la de la gente del cliente y la del equipo GCC. |
| `src/lib/marca.ts` | El cliente elige un color y los otros tres se calculan, con el contraste del texto por WCAG. |

## Las dos clases de cuenta

Es la particularidad de este producto frente a los otros cuatro (Fernando, 2026-09-23):

- **`origen = GCC`** — la persona ya tiene cuenta de cliente en GCC World. Entra con su
  correo y **su contraseña de siempre**, que se comprueba contra `gcc_world.users`.
  `clave_hash` es NULO aquí **a propósito**: si se copiara, el día que la cambiara en la
  plataforma aquí seguiría valiendo la vieja.
- **`origen = PRODUCTO`** — la crea el administrador del inquilino desde `/‹cliente›/usuarios`.
  Su contraseña sí vive en este esquema, se genera al crearla y se enseña **una vez**.

La pantalla de acceso tiene **una sola casilla** para las dos: la fila encontrada decide
contra qué se comprueba.

## La mudanza de datos

```bash
node scripts/traer-de-la-plataforma.mjs --contar   # qué se traería
node scripts/traer-de-la-plataforma.mjs            # traer (repetible)
```

- **No borra nada de `gcc_world`.** La sección vieja sigue en pie mientras esto se verifica.
- **Conserva los identificadores originales**, así que es repetible (`ON CONFLICT DO NOTHING`)
  y cualquier fila se rastrea hasta su origen. Al final recoloca las secuencias.
- Si aparece un flujo nuevo en la plataforma, el script **para** y pide asignarle inquilino
  en la constante `INQUILINOS`: traerlo a ciegas lo dejaría sin dueño.

## El agente de WhatsApp

Portado desde la plataforma (2026-09-23). Vive en `src/lib/agente/` y se asoma por dos
rutas: `/api/agente/webhook` (lo que manda Meta) y `/api/agente/procesar` (un pase del
worker, protegido con `CRON_TOKEN`). El worker es el servicio Railway
`automatizaciones-worker`: un proceso que llama a `/api/agente/procesar` cada 5 segundos y
**no tiene lógica propia a propósito** —si la tuviera, habría que mantenerla en dos sitios.

**Dos cosas que NO se pueden tocar:**

1. `contextoCanal()` en `cifrado.ts` devuelve `agente_canales:<id>:<campo>`. Dice
   «agente_canales» aunque aquí la tabla se llame `canales`, **y así tiene que seguir**: es
   el dato asociado autenticado con el que se cifraron los tokens que se migraron.
   Renombrarlo los deja indescifrables y el agente deja de poder enviar.
2. Por lo mismo, **los identificadores de canal no se recrean** (11 = Peter Tours,
   33 = pruebas): el id también entra en ese contexto.

**El inquilino nunca se pasa desde JavaScript.** Cada INSERT lo deriva de la fila padre en
el propio SQL (`SELECT c.inquilino_id FROM canales c WHERE c.id = $1`). Así no se puede
escribir en el inquilino equivocado ni olvidando un parámetro.

## ⚠️ EL CAMBIO DE GUARDIA (pendiente)

Meta sigue apuntando a `app.grupocc.org/api/agente/webhook`, que escribe en `gcc_world`.
Mientras tanto este producto enseña lo migrado hasta la última vez que se corrió el script.

El corte, en este orden y no en otro:

1. Comprobar que el webhook nuevo responde al apretón de manos:
   `GET https://automatizaciones.grupocc.org/api/agente/webhook?hub.mode=subscribe&hub.verify_token=<el de Meta>&hub.challenge=123`
   → tiene que devolver `123` en texto plano.
2. `node scripts/traer-de-la-plataforma.mjs` una última vez (trae lo entrado entre medias).
3. **Ahora sí**: cambiar la URL del webhook en la app de Meta.
4. Mandar un mensaje real al número y ver que llega y que el agente contesta.
5. Apagar el worker viejo (`agente-worker`) — no antes, o nadie contesta.

⚠️ **No se cambia la URL antes del paso 1.** Y no se apaga el worker viejo antes del 4:
mientras Meta apunte a la plataforma, es el único que contesta.
3. **La ficha del marketplace está creada pero le faltan capturas y una demostración.**
   El precio es **5 $/mes con las tres cosas dentro** (Fernando, 2026-09-23). Falta subir
   capturas reales y montar un inquilino de escaparate en modo solo lectura con sus
   credenciales públicas.
