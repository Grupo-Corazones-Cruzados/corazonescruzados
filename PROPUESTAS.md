# Propuestas de mejora — GCC World

> Registro vivo de mejoras propuestas (arquitectura, seguridad, diseño/UX, flujo de trabajo)
> con su estado. Contexto del proyecto → `MEMORIA.md` · Estilo → `Diseño.md` ·
> Aprendizaje por objetivo → `Aprendizaje.md`.
>
> **Estados:** 🟡 Propuesta · 🔵 Aprobada (pendiente de hacer) · 🟢 Implementada · ⚪ Descartada

## Diseño / UX

### D1 — Migrar los ~13 rails de filtro duplicados a `FilterRail` · 🟡 Propuesta
**Detectado:** 2026-07-19, al construir Gestión Social.
El rail de filtro (icono + label + burbuja de conteo, activo con barra izquierda accent) estaba
**reescrito inline** en `tickets`, `projects`, `tickets/[id]`, `projects/[id]`, `clients`,
`subscriptions`, `invoices`, `support`, `centralized`, `admin`, `marketplace`,
`flows/FlowsTable` y `ReclutamientoSystem` — como `RailItem`/`SectionRailItem` locales.
**Hecho:** se creó la definición única `components/ui/FilterRail.tsx` y la usan los consumidores
nuevos (Gestión Social, Experiencias).
**Propuesta:** migrar los antiguos a ese componente para que un cambio de estilo se propague solo.
**Riesgo:** bajo pero amplio (13 archivos); hacerlo en un bloque, verificando `tsc` + `build`.
**Requiere OK del usuario** por ser un refactor transversal.

## Arquitectura

### A1 — `ensure*Tables()` sin promise-singleton en 6 módulos · 🟡 Propuesta
**Detectado:** 2026-07-19 (investigación del Centralizado).
Solo `percepcion-db.ts`, `gestion-datos-db.ts` y el nuevo `gestion-social-db.ts` serializan el DDL
con un promise-singleton. `encuadre-db.ts`, `metodologia-db.ts`, `comandos-db.ts` y
`condiciones-db.ts` usan un `let ready` sin promesa en vuelo (varias peticiones en frío pasan el
guard a la vez), y **`apoyo-db.ts` y `horario-db.ts` no memoizan nada** (re-ejecutan todo el DDL
en cada llamada). Es exactamente el fallo ya documentado en `MEMORIA.md` → Lecciones técnicas
("ensureGestionDatosTables concurrente"), que rompió un endpoint en producción.
**Propuesta:** aplicar el mismo patrón a los 6.

### A2 — El filtro piso/paso del Centralizado no protege las rutas de datos · 🟡 Propuesta
**Detectado:** 2026-07-19.
La regla "un miembro ve su piso y los de abajo, solo en su paso" vive **únicamente** en
`app/api/centralized/systems/route.ts`. Las rutas de datos de cada sistema solo comprueban
`['admin','member']`. En Percepción Social no importa (las filas son del propio usuario), pero
para sistemas con datos **compartidos** —como el nuevo Gestión Social— cualquier miembro puede
llamar al endpoint directamente aunque la UI no le muestre el sistema.
**Propuesta:** un helper `assertSystemAccess(userId, slug)` reutilizable en el `guard()` de las
rutas de sistemas con datos compartidos.

### A3 — Las rutas del Centralizado devuelven `err.message` al cliente · 🟡 Propuesta
El patrón `catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }) }` está
en todas las rutas de `api/centralized/*` y filtra texto crudo de errores de Postgres.
**Hecho parcialmente:** las rutas nuevas de Gestión Social registran el detalle con `console.error`
y devuelven un mensaje genérico (los 409 de regla de negocio sí llevan mensaje, porque son para el
usuario). **Propuesta:** alinear el resto.

## Funcionalidad

### F1 — Tareas de Gestión Social como BLOQUES en la grilla de Mi día · 🟢 Implementada (2026-07-19)
Pedido por el usuario y hecho el mismo día: se pintan en la grilla (mes/semana/día) como
`EventInstance` sintéticos punteados en ámbar/verde/rojo, fuera del cómputo de horas, con popover
de estado que respeta el bloqueo; y en el panel "Eventos" con `PartyPopper` + "· evento".
`EventInstance` ganó `taskKind: 'policy' | 'social'` para distinguir el origen del bloque.

### F2 — El % de talento no es comparable entre personas · 🟡 Propuesta
`getSubjectsProfileScores` normaliza los talentos **dentro del top 10 del propio sujeto**: alguien
con 2 tareas completadas y alguien con 200 pueden mostrar ambos "Cocinar — 40%". `CriteriaSections`
los presenta como si fueran comparables, y `api/tickets/assignees` ordena candidatos con ese dato.
**Propuesta:** mostrar también el volumen (nº de tareas resueltas) junto al %, como ya hace
`valuesBalance` con sus conteos crudos.
