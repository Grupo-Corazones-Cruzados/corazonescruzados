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

## Desplegado

**https://reservas-production-e98f.up.railway.app** — proyecto **Servidor-GCC**, servicio
**`reservas`**, sobre este mismo repositorio.

| Ajuste | Valor |
|---|---|
| Root Directory | `productos/reservas` |
| Build · Start | `npm run build` · `npm start` |
| Watch patterns | `productos/reservas/**` — sin esto, cada push al repo lo reconstruiría |
| `DATABASE_URL` | referencia a `${{Postgres.*}}` por la **red privada**, con `?schema=reservas` |
| `JWT_SECRETO` | propio, **distinto** del de desarrollo |

⚠️ **`JWT_SECRETO` distinto por entorno.** Con el mismo secreto, una sesión firmada en
desarrollo valdría en producción.

⚠️ **La cadena de conexión se pasa ENTERA a `pg`.** No recortarle el `?schema=` con una
expresión regular: con dos parámetros se lleva el «?» por delante y la base pasa a llamarse
`railway&sslmode=disable`. Tiró el primer despliegue. `pg` ignora lo que no conoce.

Las migraciones y la semilla se ejecutan **desde local** contra la misma base (la URL pública
del proxy); no hace falta correr nada dentro del contenedor.

## El plan

**Estándar · 5 $/mes**: ubicaciones y suites **sin límite**, **hasta 100 cuentas activas**, y
**un mes de histórico** (lo anterior se borra a fin de mes, por la fecha de SALIDA).

El tope de cuentas **se cumple**: se comprueba al crear y al reactivar, cuenta solo las
**activas** —una desactivada no ocupa— y un tope NULO significa **sin límite**, no cero.

## Lo que falta (decisión de Fernando)

- **Niveles por encima del Estándar**, si algún día hacen falta.
- **La pasarela de pago.** Hoy el cobro es por **autoservicio**: el equipo GCC registra el
  mes desde `/gcc` y eso abre la puerta. `pagos_mensuales` ya guarda **método** y
  **referencia externa**, para que enchufar la pasarela no sea una migración de datos.
