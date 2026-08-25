# Gestión de Pedidos

Segundo **producto** del Grupo Corazones Cruzados: control de pedidos para negocios
de comida pequeños —mesas, carta, cocina y cobro—, vendido por mensualidad. Mismo
talento que el primero (**Automatización de procesos**) y mismo armazón que
`productos/reservas`; lo propio son las tablas del dominio y sus pantallas.

**Desplegado:** https://pedidos-production-0124.up.railway.app
Contexto y decisiones: `MEMORIA.md` en la raíz del repositorio.

## Qué hace

| | |
|---|---|
| **Tablero de mesas** | Libres · esperan atención · en cocina · listo para servir · por cobrar, por zonas, con el tiempo que lleva cada una |
| **Pedido** | Se toma desde la mesa, se añaden platos de la carta, se calcula la cuenta con IVA y se cobra eligiendo método de pago |
| **Cocina** | Comandas por mesa, la más vieja primero, con aviso cuando una lleva más de media hora. Se marca por plato o el pedido entero |
| **Carta** | Categorías y productos con precio, foto y disponibilidad («se acabó el ceviche» se apaga, no se borra) |
| **Reservas de mesa** | Día, hora y duración, con control de choques |
| **Reportes** | Filtros por fecha, estado y método de pago, y **exportación a Excel** con dos hojas: pedidos y platos |
| **Usuarios** | Administrador · mesero · cocinero |
| **Configuración** | Marca (nombre, logo, color, tema), facturación (IVA), zonas y mesas, suscripción y contraseña |

## Los tres oficios

⚠️ **Los roles NO son una escalera.** Un cocinero no es un mesero con menos
permisos: es otro trabajo. Por eso el permiso se pide por **capacidad**
(`src/lib/permisos.ts`), no por rango, y el menú se arma con ellas.

| | Ve | Hace |
|---|---|---|
| **Administrador** | todo | todo, incluidos carta, cuentas y marca |
| **Mesero** | mesas, pedidos, reservas, reportes | toma, sirve, cobra y reserva |
| **Cocinero** | la cocina | marca los platos que salen. **No cobra ni toca la carta** |

## El IVA

Se calcula de **dos maneras distintas** y confundirlas cambia lo que se cobra:

- **Precio con IVA dentro** (lo normal en una carta): el total es la suma tal cual y
  el impuesto se **desglosa hacia atrás**.
- **Precio sin IVA**: el impuesto se **suma** al final.

Sumarle un 15 % a un precio que ya lo lleva cobraría **4,35 de más en una cuenta de
29**. Se trabaja en **centavos enteros** (con decimales flotantes, 0,1 + 0,2 no da
0,3) y **cada pedido guarda la tasa que se le aplicó**: cambiar la configuración no
reescribe la caja de ayer.

## La retención

El plan dice cuántos meses de histórico conserva (`planes.meses_retencion`; el plan
**Esencial**, 5 $/mes, conserva **uno**). En la **última hora del último día del mes**,
hora del negocio, se borra lo anterior.

⚠️ **Se purga por CUÁNDO TERMINÓ, no por cuándo se creó.** Un pedido sin cerrar sigue
vivo aunque sea viejo, y una reserva cuya hora no ha llegado tampoco se toca. Mirar
la fecha de alta borraría trabajo vivo sin que nadie se entere.

Quien dispara es el cron de la plataforma (`nightly-cron`, `scripts/frequent-cron.mjs`,
una vez por hora) contra `POST /api/cron/purgar` con `x-cron-token`; **quien decide si
toca correr es el endpoint**, porque la hora que importa es la del negocio. Es
idempotente y deja constancia en la tabla `purgas`. Un negocio en **escaparate** no se
purga.

## Poner en marcha

```bash
cp .env.example .env      # DATABASE_URL (…?schema=pedidos), JWT_SECRETO, CRON_TOKEN
npm install
npm run migrar            # sql/migraciones/ (ver la nota de Prisma abajo)
npm run semilla           # plan, operador GCC y un negocio de demostración
npm run dev               # http://localhost:3011
```

Direcciones: `/` portada · `/<codigo>/acceso` acceso del negocio · `/gcc` equipo GCC.

## Migraciones

**No se usa `prisma migrate`**: su motor no atraviesa el proxy TCP de Railway. Prisma
**genera** el SQL sin tocar la red y lo aplica el runner propio:

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
node scripts/migrar.mjs
```

Una migración aplicada no se edita ni se borra: el runner lo detecta por checksum.

## Desplegado en Railway

Servicio **`pedidos`** del proyecto **Servidor-GCC**, sobre este mismo repositorio.

| Ajuste | Valor |
|---|---|
| Root Directory | `productos/pedidos` |
| Watch patterns | `productos/pedidos/**` |
| `DATABASE_URL` | referencia a `${{Postgres.*}}` por la red privada, con `?schema=pedidos` |
| `JWT_SECRETO` · `CRON_TOKEN` | propios, distintos de los de desarrollo y de los del otro producto |

⚠️ **Al crear el servicio, Railway encola un despliegue ANTES de que se le fije el
«Root Directory»**: ese primer build compila la plataforma entera y sirve la
aplicación equivocada en el dominio del producto. Hay que **relanzarlo** después de
configurarlo (`railway redeploy --service pedidos -y`).

## El plan

**Estándar · 5 $/mes**: mesas, zonas y carta **sin límite**, **hasta 100 cuentas activas**, y
**un mes de histórico** (lo anterior se borra a fin de mes).

El tope de cuentas **se cumple**: se comprueba al crear y al reactivar, cuenta solo las
**activas** —una desactivada no ocupa— y un tope NULO significa **sin límite**, no cero. El cupo
se ve siempre en Usuarios («12 de 100 cuentas»).

## Lo que falta

- **Niveles por encima del Estándar**, si algún día hacen falta (el modelo ya soporta topes de
  mesas, productos y cuentas, y meses de retención).
- **Pasarela de pago**: hoy el cobro de la mensualidad es por autoservicio desde `/gcc`.
