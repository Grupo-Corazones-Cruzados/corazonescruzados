# Gestión de Catering

Tercer **producto** del Grupo Corazones Cruzados: comida por suscripción a domicilio
(viandas) para negocios pequeños —clientes, servicios por días, menú del día,
etiquetas con las restricciones de cada cliente y hojas de ruta por motorizado—,
vendido por mensualidad. Mismo talento que los otros dos (**Automatización de
procesos**) y mismo armazón que `productos/pedidos`; lo propio son las tablas del
dominio, sus pantallas y **el portal del cliente final**.

Nace del proyecto de Cristian (Fit Grill & Cook): se portó la interfaz y se
tradujo el modelo, no se copió el código.

**Desplegado:** https://catering-production-8f59.up.railway.app
Contexto y decisiones: `MEMORIA.md` en la raíz del repositorio.

## Qué hace

| | |
|---|---|
| **Panel** | Entregas de hoy y de mañana por comida, cancelaciones, restricciones que chocan con el menú, lo que necesita atención |
| **Clientes** | Se registran solos desde `/<negocio>/registro`, el negocio los aprueba (o pide más datos, o rechaza). Ficha con dos direcciones, motorizado por dirección, restricciones de cocina y de despacho, mensajes, ficha imprimible |
| **Servicios** | N días de comida en ciertas comidas y ciertos días de la semana. Consumidos y fecha de fin **calculados**, no guardados. Renovar crea uno nuevo; el anterior queda con su histórico |
| **Cancelaciones** | Un día completo. El cliente, hasta la hora límite del negocio; el personal, sin hora. Tope por porcentaje. Reactivar no borra: marca |
| **Menús** | Por día y comida, con los alimentos del catálogo. Mientras se arma, dice **quién no come eso** |
| **Etiquetas** | 10 × 7 cm, una por cliente y comida, agrupadas por motorizado. Solo avisan las restricciones que chocan con el menú de ese día |
| **Rutas** | Hoja por motorizado: dirección efectiva del día, comidas, particularidades, casilla de entregado |
| **Restricciones** | Simples (una sustitución) y compuestas (dos o más), contra el menú del día; y todas por alimento |
| **Motorizados · Alimentos · Feriados** | Catálogos del negocio. Los feriados de Ecuador se cargan con un botón |
| **Reportes** | Indicadores del periodo y **exportación a Excel** con cuatro hojas |
| **Portal del cliente** | Mi servicio (calendario y mensajes) · Cancelaciones · Mi dirección · Mi perfil (lo que no como, contraseña) |
| **Configuración** | Marca (nombre, logo, color, tema), operativa (comidas, días, hora límite, %, registro abierto), suscripción y contraseña |

## Dos clases de cuenta, una puerta

El **personal** entra con su usuario; el **cliente final** entra con su correo. La
misma pantalla de acceso los distingue por el «@». Viven en tablas distintas
(`usuarios` y `clientes`) porque el cliente se registra solo, pasa por aprobación
y tiene un perfil que el personal no tiene. `lib/inquilino.ts` tiene dos puertas
—`exigirContexto` y `exigirContextoCliente`— y cada una devuelve al otro a **su**
sitio, no a un error.

## Los tres oficios

⚠️ **Los roles NO son una escalera** (`src/lib/permisos.ts`): el permiso se pide por
capacidad y el menú se arma con ellas.

| | Ve | Hace |
|---|---|---|
| **Administrador** | todo | todo |
| **Cocina** | menús, etiquetas, restricciones, alimentos | arma el menú e imprime etiquetas |
| **Despacho** | rutas, motorizados | asigna motorizados e imprime rutas |

El tope de **100 cuentas** del plan cuenta **solo al personal**; los clientes
finales no tienen límite (Fernando, 2026-09-15).

## La aritmética del servicio

`src/lib/servicios.ts`. Desde la fecha de inicio se avanza por los días de la
semana contratados, saltando los **feriados no laborables** y las **cancelaciones
activas**, hasta consumir los días. Nada de eso se guarda: se calcula en cada
lectura, así que no depende de que un cron haya corrido. Lo único que se escribe
al leer es marcar VENCIDO lo que el calendario dice que venció (`terminoEn`), que
es por donde corta la purga.

**Las fechas de calendario son `date`** y viajan como `AAAA-MM-DD`
(`src/lib/fechas.ts`). Un menú es un día, no un instante.

## Un solo día de despacho

`src/lib/despacho.ts` → `calcularDia()` decide **quién recibe comida un día** y con
qué: dirección efectiva (la 2 si ese día de la semana la usa), motorizado efectivo,
comidas, restricciones que chocan con el menú. El panel, las etiquetas, las rutas,
las restricciones y los reportes salen de ahí: si el panel dice 34, hay 34
etiquetas.

## La retención

El plan conserva **un mes**. En la última hora del último día del mes, hora del
negocio, se borran los **servicios vencidos** que terminaron antes del corte (y sus
cancelaciones, en cascada), los **menús** y los **mensajes** anteriores.

⚠️ **Las cancelaciones no se purgan por su fecha**: una cancelación vieja de un
servicio vigente corre su fecha de fin un día; borrarla sola le quitaría al cliente
un día que pagó. Se midió: la primera versión lo hacía. **Clientes, alimentos,
motorizados y feriados nunca se purgan**: son datos maestros.

Dispara el cron de la plataforma (`nightly-cron`, `scripts/frequent-cron.mjs`) contra
`POST /api/cron/purgar` con `x-cron-token`; quien decide si toca es el endpoint. Un
negocio en **escaparate** no se purga.

## Poner en marcha

```bash
cp .env.example .env      # DATABASE_URL (…?schema=catering), JWT_SECRETO, CRON_TOKEN
npm install
npm run migrar            # sql/migraciones/
DEMO_CLAVE=… npm run semilla   # plan, operador GCC y «Verde & Sano» de demostración
npm run dev               # http://localhost:3012
```

Direcciones: `/` portada · `/<codigo>/acceso` acceso · `/<codigo>/registro` alta
del cliente · `/gcc` equipo GCC.

`DEMO_CLAVE` es la contraseña **pública** del escaparate (va en la ficha del
marketplace a propósito); sin ella, la semilla genera contraseñas al azar y las
imprime una sola vez.

## Migraciones

**No se usa `prisma migrate`**: su motor no atraviesa el proxy TCP de Railway. Prisma
**genera** el SQL sin tocar la red y lo aplica el runner propio:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
node scripts/migrar.mjs
```

La `001_inicial.sql` lleva además un índice parcial que Prisma no sabe escribir:
**un solo servicio vigente por cliente**. Una migración aplicada no se edita ni se
borra: el runner lo detecta por checksum.

## Desplegado en Railway

Servicio **`catering`** del proyecto **Servidor-GCC**, sobre este mismo repositorio.

| Ajuste | Valor |
|---|---|
| Root Directory | `productos/catering` |
| Watch patterns | `productos/catering/**` |
| `DATABASE_URL` | referencia a `${{Postgres.*}}` por la red privada, con `?schema=catering` |
| `JWT_SECRETO` · `CRON_TOKEN` | propios, distintos de los de desarrollo y de los de los otros productos |
| En `nightly-cron` | `CATERING_URL` y `CATERING_CRON_TOKEN` |

⚠️ Al crear el servicio, Railway encola un despliegue **antes** de que se le fije el
«Root Directory». Hay que relanzarlo después (`railway redeploy --service catering -y`).

## El plan

**Estándar · 5 $/mes**: clientes sin límite, **hasta 100 cuentas del personal** y
**un mes de histórico**.

## Lo que falta

- **Pasarela de pago**: hoy el cobro de la mensualidad es por autoservicio desde `/gcc`.
- **Correo al cliente** (bienvenida, solicitud de información): el código está y
  usa Resend si hay `RESEND_API_KEY`; sin ella, el mensaje queda solo en el portal.
