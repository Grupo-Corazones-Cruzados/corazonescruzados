# Aprendizaje — Módulo "Suscripciones" (cobros mensuales recurrentes → factura + email + ingreso)

> Documento vivo de la skill `/aprendizaje`. Acumula todas las preguntas técnicas y sus
> respuestas hasta dominar el problema y resolverlo sin fallos.
>
> **Estados de pregunta:** ❓ Abierta · 🔎 Investigando · ✅ Resuelta · ⏸ Bloqueada (espera al usuario)

## Objetivo / necesidad (declarado 2026-06-11)
Nuevo módulo **Suscripciones**, ubicado en el sidebar **justo debajo de Proyectos**. Permite al
miembro/usuario llevar el control de **cobros mensuales recurrentes** a clientes por productos/servicios
de costo mensual. Funcionalidad:
- Crear una suscripción definiendo: **cliente** (a quien se cobra), **título/razón** del cobro,
  **costo mensual** y **fecha de inicio** (que fija el **día de corte** mensual; ej. inicio 11-jun-2026 ⇒
  se cobra el **11 de cada mes**).
- **Tabla principal** con las suscripciones creadas; debe **alertar** cuando el día de corte esté
  **cerca** de la fecha actual.
- Al **seleccionar** una suscripción, en un **panel lateral derecho** aparece el **listado de meses**
  que debieron pagarse desde la fecha de inicio hasta hoy. **Si empieza un nuevo mes calendario, ese mes
  ya aparece** en la lista aunque no haya llegado el día de corte.
- En ese panel el miembro **marca meses como pagados / no pagados**.
- Al **marcar un mes como pagado** se dispara automáticamente:
  1. **Generar factura** SRI para el cliente con sus datos.
  2. **Enviar email** al cliente con su factura (PDF adjunto).
  3. La factura **aparece en la tabla de Facturas**.
  4. El **ingreso** se registra en el **dashboard en el mes del día en que se marca pagada** la cuota.
- **Diseño:** replicar **exactamente** las reglas de estilo del `/dashboard` (tema corporativo `.corp`).

## Rol asumido
**Ingeniero full-stack (Next.js 15 App Router + Postgres/SQL crudo `pg` + Prisma 7) con foco en
facturación electrónica SRI Ecuador** y en el sistema de diseño corporativo `.corp` del dashboard.

## Progreso
- **% de información para el objetivo:** 98% — **IMPLEMENTADO** y verificado con `tsc --noEmit` OK
  (build de Next en validación). Falta solo prueba funcional en vivo (login + factura real SRI/email).
- **Decisiones del usuario (2026-06-11):** (1) modelo de cobro **por mes calendario** (vencimiento =
  día de corte de cada mes); (2) roles **admin + member**; (3) IVA: el costo mensual es **precio final,
  IVA 15% incluido** (se desglosa hacia atrás: base = total/1.15); (4) **alerta 7 días** antes del corte.
- **Resumen del estado actual:** Módulo completo construido: tablas `subscriptions` +
  `subscription_payments`, lib de lógica de meses/alertas, 3 endpoints API, función SRI
  `createManualInvoiceFromSubscription`, wrapper de ingreso, NavItem en sidebar y página UI `.corp` con
  tabla principal (alertas) + panel lateral de meses con marcado de pago.

## Fuentes recibidas / consultadas (2026-06-11)
- `MEMORIA.md` — contexto del proyecto, stack, tema `.corp`, decisiones SRI, vínculo factura→origen.
- `components/dashboard/DashboardSidebar.tsx` — `NAV_ITEMS` (label/href/icon Lucide/roles opcional);
  item "Proyectos" en L24 (`{ label:'Proyectos', href:'/dashboard/projects', icon:FolderKanban }`); filtro
  `!item.roles || item.roles.includes(user.role)`. **Aquí se inserta "Suscripciones" debajo de Proyectos.**
- `app/(dashboard)/dashboard/projects/page.tsx` — patrón de módulo de lista: `ModuleToolbar` (tabs+buscador+acción)
  + `PixelDataTable` (columns/data/onRowClick/paginación) + `PixelModal` (panel lateral derecho) + estados +
  `fetch('/api/...')`. Constantes `pf`/`mf` (fuentes), `STATUS_V` (variantes de badge).
- `app/(dashboard)/layout.tsx` — shell con `.corp`; `<main className="flex-1 ml-0 lg:ml-56 …">`.
- `lib/integrations/sri/index.ts` — `createManualInvoiceFromTicket(opts)` (L407): inserta en
  `gcc_world.invoices` con `is_manual=true`, **`source_type`/`source_id`** (vínculo a origen),
  datos `client_*_sri`, items en `invoice_items_sri`; retorna `{invoiceId, total}`. `sendInvoiceToSri(id)`
  firma + envía a SRI + genera PDF (`pdf_data` BYTEA) y retorna `{ok, authorized, authNumber?, error?}`.
- `app/api/invoices/from-ticket/route.ts` — endpoint de referencia del flujo completo: crea factura →
  `addTicketIncomeToFinance` → `sendInvoiceToSri` → (si autorizado) email Resend con PDF adjunto (BCC a
  `lfgonzalezm0@grupocc.org`), HTML con tabla de items. Item shape: `{description, quantity, unitPrice, ivaRate, discount}`.
- `app/api/invoices/route.ts` (GET) — lista `gcc_world.invoices` (ORDER BY created_at DESC). **Si inserto
  por el mismo mecanismo, la factura aparece automáticamente.** No filtra por source.
- `lib/finance.ts` — `addIncomeToFinance(sourceType, sourceId, description, amount, date?)`: idempotente vía
  `gcc_world.finance_source_log`; `ensureMonth(year, month)` por `date`; inserta en `finance_items` y
  `recalcMonth`. El **mes del ingreso = `date`** que se pase (para "mes del día en que se marca pagado" ⇒
  pasar `new Date()` del momento de marcar). `addProjectIncomeToFinance`/`addTicketIncomeToFinance` son wrappers.
- `app/api/clients/route.ts` (GET) — `SELECT id, name, email FROM gcc_world.clients ORDER BY name`. La tabla
  `clients` tiene además `ruc`, `address` (ADD COLUMN IF NOT EXISTS). Datos SRI completos del adquirente viven
  en `invoices.client_*_sri`; endpoint `GET /api/invoices/clients-history` devuelve adquirentes ya facturados
  con `id_type` inferido (patrón "Cliente previo").

## Preguntas y respuestas

### P1 — ¿Cómo se inserta el módulo en el sidebar bajo Proyectos? · ✅ Resuelta
- **Por qué importa:** ubicación exacta pedida ("debajo de Proyectos").
- **Respuesta:** Añadir un `NavItem` en `NAV_ITEMS` (`DashboardSidebar.tsx`) inmediatamente después del de
  Proyectos (L24): `{ label:'Suscripciones', href:'/dashboard/subscriptions', icon:<Lucide>, roles?:[...] }`.
  El icono es un `LucideIcon` (candidatos: `RefreshCw`, `CalendarClock`, `Repeat`). (Fuente: código.)

### P2 — ¿Cómo se genera la factura programáticamente y aparece en Facturas? · ✅ Resuelta
- **Por qué importa:** requisito (a) y (c).
- **Respuesta:** `createManualInvoiceFromTicket`-style → inserta en `gcc_world.invoices` con
  `source_type='subscription'`, `source_id='<subId>-<YYYY-MM>'`, `is_manual=true`, datos `client_*_sri` e items.
  Reutilizaré/extraeré una función análoga (`createManualInvoiceFromSubscription`) o usaré la genérica. La
  tabla de Facturas (`GET /api/invoices`) lista todas las de `invoices`, así que **aparece sola**. (Fuente: `sri/index.ts`, `invoices/route.ts`.)

### P3 — ¿Cómo se envía el email con la factura? · ✅ Resuelta
- **Por qué importa:** requisito (b).
- **Respuesta:** Resend (`getResend().emails.send`) con `from=EMAIL_FROM`, `to=client_email`, BCC interno,
  `subject` con nº de factura, HTML con items y **PDF adjunto** desde `invoices.pdf_data` (tras `sendInvoiceToSri`
  autorizado). Copiar el bloque de `from-ticket/route.ts`. (Fuente: código.)

### P4 — ¿Cómo se registra el ingreso en el mes correcto del dashboard? · ✅ Resuelta
- **Por qué importa:** requisito (d) — "ingreso en el mes del día en que se marca pagada".
- **Respuesta:** `addIncomeToFinance('subscription', '<subId>-<YYYY-MM>', '<título> <mes>', total, new Date())`.
  Es **idempotente** (no duplica si se re-marca). El **mes** lo fija la `date`: para "el mes del día en que se
  marca pagado" se pasa la fecha actual (`new Date()`). (Fuente: `lib/finance.ts`.)

### P5 — ¿Qué tablas nuevas se necesitan? · ✅ Resuelta (diseño propio)
- **Por qué importa:** persistencia del módulo.
- **Respuesta (propuesta):** Dos tablas en `gcc_world` (vía `ensure...Columns()` con `CREATE TABLE IF NOT EXISTS`,
  patrón del repo tras eliminar migraciones SQL):
  - `gcc_world.subscriptions`: `id`, `client_id` (FK clients, nullable), datos `client_*_sri` snapshot (id_type,
    ruc, name, email, phone, address) para facturar sin re-preguntar, `title`, `monthly_cost`, `iva_rate`,
    `currency`, `start_date` (DATE; fija el día de corte), `status` ('active'/'paused'/'cancelled'),
    `created_by`, `created_at`, `updated_at`.
  - `gcc_world.subscription_payments`: `id`, `subscription_id` FK, `period` (DATE = primer día del mes
    facturado, ej. 2026-06-01), `paid` (bool), `paid_at`, `invoice_id` (FK invoices, nullable), `created_at`.
    Único `(subscription_id, period)`. Una fila por mes marcado pagado (los no pagados se derivan en runtime).

### P6 — ¿Qué meses se listan en el panel lateral y cómo se calcula el vencimiento? · ✅ Resuelta (modelo propuesto, a confirmar en P10)
- **Por qué importa:** lógica central del panel.
- **Respuesta (modelo):** Una fila por **mes calendario** desde el mes de `start_date` hasta el **mes actual**
  inclusive. Vencimiento del mes = **día de corte** (= `start_date.getDate()`) de ese mes, *clamp* al último día
  si el mes es más corto (p.ej. corte 31 → 28/29 feb). Un mes aparece **en cuanto empieza el mes calendario**
  (aunque falte el día de corte). Estado del mes: **pagado** (existe fila en `subscription_payments` con
  `paid=true`) o **pendiente**. (Fuente: requisito del usuario; confirmar P10.)

### P7 — ¿Cuándo y cómo alertar "día de corte cerca"? · ⏸ Bloqueada (espera al usuario, P12)
- **Por qué importa:** requisito de la tabla principal.
- **Respuesta:** Falta definir la **ventana** (días antes del corte) y si la alerta es por suscripción con
  el **próximo mes impago** cuyo vencimiento esté dentro de la ventana o ya vencido. Propuesta por defecto:
  alerta ámbar si faltan ≤ N días, roja si ya venció e impago.

### P8 — ¿Qué roles acceden al módulo? · ⏸ Bloqueada (espera al usuario, P11)
- **Por qué importa:** define `roles` del NavItem y los checks en la API.
- **Respuesta:** Pendiente (Proyectos/Tickets permiten `member`+`admin`; Suscripciones probablemente igual o
  solo `admin`). 

### P9 — ¿IVA en la factura de la cuota mensual? · ⏸ Bloqueada (espera al usuario, P13)
- **Por qué importa:** define el `unitPrice`/`ivaRate` del item SRI y el total cobrado. Ecuador: IVA 15%.
- **Respuesta:** Pendiente: ¿el `monthly_cost` definido es **precio final con IVA incluido**, se le **suma 15%**,
  o es **configurable** (`iva_rate` por suscripción)? Propuesta: `iva_rate` configurable, default a decidir.

## Preguntas para el usuario (negocio — no deducibles del repo) · ✅ todas resueltas (2026-06-11)
- **P10 (modelo de cobro):** ✅ por **mes calendario**, vencimiento = día de corte de cada mes.
- **P11 (roles):** ✅ **admin + member** (`roles:['member','admin']` en NavItem y checks de API).
- **P12 (alerta):** ✅ **7 días** antes (`ALERT_WINDOW_DAYS=7`): ámbar ≤7d, roja si venció e impago.
- **P13 (IVA):** ✅ costo mensual = **precio final, IVA 15% incluido** → `unitPrice = costo/1.15`, `ivaRate=15`.

## Decisión sobre DESMARCAR un mes (política fiscal)
Una factura electrónica **autorizada por el SRI no se puede anular** sin nota de crédito. Por eso:
- "Marcar pagado" genera la factura, la envía por email y registra el ingreso **solo si el SRI autoriza**
  (si rechaza, no se marca pagado y se muestra el error; la factura queda en estado `generated`).
- "Desmarcar" está **permitido solo si el mes NO tiene factura emitida** (caso borde). Si ya tiene
  `invoice_id`, el endpoint responde 409 con mensaje "requiere nota de crédito". (Revisable a futuro.)

## Decisiones de diseño / arquitectura (firmes)
- **2 tablas nuevas** (`subscriptions`, `subscription_payments`) creadas con `CREATE TABLE IF NOT EXISTS`
  dentro de un `ensureSubscriptionTables()` invocado por los endpoints (patrón del repo, sin migraciones SQL).
- **Snapshot de datos SRI del cliente** en la suscripción (al crear, reusando patrón "Cliente previo" +
  `/api/clients`) → al marcar pagado se factura sin volver a pedir datos.
- **Reutilizar el flujo de `from-ticket`**: crear factura (`source_type='subscription'`) → registrar ingreso
  (`addIncomeToFinance`, fecha = hoy) → `sendInvoiceToSri` → email Resend con PDF. Idempotencia por `source_log`
  y por `(subscription_id, period)` único.
- **Marcar pagado** solo se confirma si la factura **SRI queda autorizada** (consistente con tickets); si falla,
  se informa y no se marca (o se permite reintento). La fila `subscription_payments` guarda `invoice_id`.
- **UI 100% `.corp`**: `ModuleToolbar` + `PixelDataTable` (tabla principal) + panel lateral derecho propio para
  los meses (puede ser un `PixelModal` md/lg, que ya es panel derecho, o un panel sticky tipo `PropertyRail`).
  Fuentes `var(--font-display)`/`var(--font-body)`, badges `PixelBadge`, sin hex hardcodeado.

## Plan de solución (se concreta al cerrar P10–P13)
1. **BD:** `ensureSubscriptionTables()` (subscriptions + subscription_payments).
2. **API:** `GET/POST /api/subscriptions` (listar/crear, con alerta calculada), `GET /api/subscriptions/[id]`
   (detalle + meses derivados), `POST /api/subscriptions/[id]/pay` (marcar mes pagado → factura+email+ingreso),
   `POST /api/subscriptions/[id]/unpay` (desmarcar; decidir si anula factura o solo quita el flag — a definir),
   `PATCH/DELETE /api/subscriptions/[id]`.
3. **Lib:** `createManualInvoiceFromSubscription` (o reusar genérica) + helper de email compartido.
4. **UI:** `app/(dashboard)/dashboard/subscriptions/page.tsx` (tabla + toolbar + modal crear + panel meses) y
   NavItem en el sidebar. Estilo `.corp` calcado de `projects/page.tsx`.
5. **Verificar:** `tsc --noEmit`, compilación, y prueba del flujo (factura/email/ingreso) en caso real.

## Riesgos y cómo se mitigan
- **Doble cobro / doble ingreso** al re-marcar → unicidad `(subscription_id, period)` + idempotencia de
  `addIncomeToFinance` (source_log).
- **SRI rechaza la factura** (datos de cliente inválidos) → exigir datos SRI válidos al crear la suscripción;
  no marcar pagado si no se autoriza; mostrar el error de SRI.
- **Mes corto (feb) con corte 29/30/31** → clamp del día de corte al último día del mes.
- **Zona horaria en cálculo de meses/vencimientos** → calcular con fechas locales del servidor de forma
  consistente (igual que el resto del repo); `period` se guarda como primer día del mes (date sin hora).
- **Desmarcar un mes ya facturado** → una factura SRI autorizada no se puede "borrar" sin nota de crédito;
  definir política (probablemente: desmarcar solo si no estaba facturado, o requerir anulación manual).

---

## Histórico — objetivo anterior (✅ cerrado 2026-06-07)
**Rediseño del `/dashboard` de pixelart → corporativo (Microsoft/Fluent, scope `.corp`).** Implementado y
verificado estáticamente (tsc OK, compila); pendiente solo confirmación visual del usuario. Todo el detalle
de fases (1–9: tokens `.corp`, controles/modales Fluent, formularios como panel lateral derecho, contraste,
quitar título+descripción, `ModuleToolbar`, sidebar lucide, páginas de detalle estilo Monday) está registrado
en **`MEMORIA.md`** (sección "Lecciones técnicas → Theming corporativo") y en el historial de git. Objetivos
previos (feature "Cliente previo") también en MEMORIA.md/git.
