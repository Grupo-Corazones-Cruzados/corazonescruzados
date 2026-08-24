# Gestión de Reservas

Primer **producto** del Grupo Corazones Cruzados: un sistema de gestión de reservas para
alojamientos, vendido por mensualidad. Vive en este repositorio pero se despliega como
**servicio propio** en Railway, con su **esquema propio** (`reservas`) dentro del mismo
servicio Postgres que usa la plataforma GCC WORLD.

- Ficha del producto en el marketplace: `gcc_world.products` id 2 → talento
  **«Automatización de procesos»**, de **Fernando** (`lfgonzalezm0@grupocc.org`).
- Contexto y decisiones: `MEMORIA.md` en la raíz del repositorio.

## Cómo está montado

| | |
|---|---|
| **Aplicación** | Next.js 15 (App Router) · TypeScript · React 19 · Tailwind v4 |
| **Datos** | PostgreSQL (Railway) · Prisma 7 con `@prisma/adapter-pg` · esquema `reservas` |
| **Sesión** | Propia: JWT con `jose` + `bcryptjs`. Dos cookies que no se mezclan: `reservas_sesion` (gente del hotel) y `reservas_gcc` (equipo GCC) |
| **Mutaciones** | Server Actions (`src/acciones/`). No hay API salvo la exportación a Excel, que devuelve un archivo |
| **Imágenes** | Cloudinary. En la base solo va la dirección: es lo que mantiene plano el coste del Postgres |
| **Idioma** | Todo en español, incluidos los nombres del código y de las tablas |

### Multi-inquilino

Un **inquilino** es un hotel. **Todas** las tablas de negocio llevan `inquilino_id`, y el
filtro se construye en **un solo sitio** (`src/lib/inquilino.ts`): ninguna página lo escribe
a mano. Cada hotel entra por su propia dirección — `/<codigo>/panel` — y una sesión firmada
para otro hotel no abre nada.

### La puerta

`suscripciones.pagado_hasta` decide si la aplicación se abre. Si la fecha pasó, todo el
armazón redirige a `/<codigo>/suscripcion`; la exportación a Excel responde 401. No es un
aviso en una pantalla: es una comprobación en el camino de sesión.

## Poner en marcha

```bash
cp .env.example .env      # y rellenar DATABASE_URL (…?schema=reservas) y JWT_SECRETO
npm install
npm run migrar            # aplica sql/migraciones/ (ver nota más abajo)
npm run semilla           # plan, operador GCC y un hotel de demostración
npm run dev               # http://localhost:3010
```

Direcciones: `/` portada · `/<codigo>/acceso` acceso del hotel · `/gcc` equipo GCC.

## Migraciones

**No se usa `prisma migrate`**: su motor no logra abrir conexión contra el proxy TCP de
Railway (P1011 / P1017 / P1001) aunque `pg` conecte sin problema desde el mismo proceso. El
reparto es:

- **Prisma** genera el cliente tipado y **genera el SQL** sin tocar la base:
  ```bash
  npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
  ```
  (para una migración posterior, `--from-config-datasource --to-schema` da solo la diferencia)
- **`scripts/migrar.mjs`** lo aplica y lo anota en `reservas._migraciones`, con checksum.
  Es el mismo patrón que ya usa GCC WORLD.

Una migración aplicada **no se edita ni se borra**: el runner lo detecta y para.

## Desplegar en Railway

Servicio **nuevo**, distinto del de GCC WORLD, sobre este mismo repositorio:

1. **Root Directory:** `productos/reservas`
2. **Build:** `npm run build` · **Start:** `npm start`
3. **Variables:** `DATABASE_URL` (la misma base, con `?schema=reservas&sslmode=disable`),
   `JWT_SECRETO` (uno propio, distinto del de desarrollo), `CLOUDINARY_URL`, `APP_URL`
4. Tras el primer despliegue: `npm run migrar` y `npm run semilla`

⚠️ **`JWT_SECRETO` distinto por entorno.** Con el mismo secreto, una sesión firmada en
desarrollo valdría en producción.

## Lo que falta (decisión de Fernando)

- **Los niveles de la tier list.** El modelo ya los soporta (tabla `planes` con topes de
  ubicaciones, suites y cuentas, y características). Hoy hay **un solo plan**, «Estándar», y
  su precio está **a cero a propósito**: un número inventado se acaba cobrando.
- **La pasarela de pago.** Hoy el cobro es por **autoservicio**: el equipo GCC registra el
  mes desde `/gcc` y eso abre la puerta. `pagos_mensuales` ya guarda **método** y
  **referencia externa**, para que enchufar la pasarela no sea una migración de datos.
- **Aplicar los topes del plan.** Están guardados pero todavía no se comprueban al crear una
  ubicación, una suite o una cuenta.
