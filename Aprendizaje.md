# Aprendizaje — Módulo "Suscripciones" (cobros mensuales recurrentes → factura + email + ingreso)

> Documento vivo de la skill `/aprendizaje`. Acumula todas las preguntas técnicas y sus
> respuestas hasta dominar el problema y resolverlo sin fallos.
>
> **Estados de pregunta:** ❓ Abierta · 🔎 Investigando · ✅ Resuelta · ⏸ Bloqueada (espera al usuario)

## Objetivo ACTUAL (declarado 2026-07-08) — Comandos Violeta: generación REAL de tareas al activar una política
**Necesidad:** cuando se activa una **política** que contiene una función **`generate_tasks`**, las tareas
programadas deben **materializarse y asignarse a los usuarios** (candidatos/miembros) para los que se
programaron, apareciendo en su **"Mi día"**. Hoy la autoría funciona (se guardan los `TaskProgram` en la
config de la función) pero **al activar NO pasa nada** (es el PENDIENTE (3) de enforcement documentado en
`MEMORIA.md`).

### Rol asumido
**Ingeniero full-stack (Next.js 15 App Router + Postgres crudo `pg`)** con foco en el modelo de datos del
Horario de Vida / Mi día y el enforcement de Comandos Violeta.

### Arquitectura de AUTENTICACIÓN (aprendido 2026-07-09) — clave para el flujo de candidatos
- **Dos mundos de cuentas:** (a) `gcc_world.users` = staff/clientes de negocio (miembro/admin/client) con
  **JWT `auth_token`** (`lib/auth/jwt.ts`, `createToken`, role client|member|admin); **`/dashboard` exige ese
  JWT** (`middleware.ts`, si no → redirige `/auth`). (b) `gcc_world.clients` = juego/reclutamiento (candidatos,
  `account_type`), con cookies **`gcc_player_auth`** (=`clients.auth_token`) y **`gcc_client_token`**
  (=`clients.client_token`).
- **Un candidato NO tiene fila en `users` ni JWT** → **NO puede entrar a `/dashboard`** tal como está. `complete-profile`
  setea `gcc_player_auth` (juego), no el JWT. `/api/auth/login` valida solo contra `users`.
- **Consecuencia (PENDIENTE):** el requisito "candidato que entra por *Colaborar* → `/dashboard`" **no funciona**
  hasta darle a los candidatos aprobados una **sesión de dashboard** (crear/vincular fila `users` role='client' +
  emitir JWT). Es cambio con implicaciones de seguridad → **confirmar con el usuario** el modelo antes de construir.
  El destino **juego** (por *Entrar*) sí funciona.

### Progreso
- **% de información para el objetivo:** 100% — **IMPLEMENTADO Y VERIFICADO (2026-07-08)**. `tsc`+`next build`
  OK; expansión de días (weekdays con `EXTRACT(DOW)`) e idempotencia (`ON CONFLICT DO NOTHING`) probadas contra
  Postgres real dentro de una transacción con ROLLBACK (sin tocar datos). Detalle en `MEMORIA.md`.

### Solución construida (resumen)
- Tabla `cv_generated_tasks` + `materializePolicyTasks`/`removePolicyPendingTasks` enganchadas a `setPolicyActive`.
- `getSubjectGeneratedTasks` → `generated[]` en `getSubjectHorario`; se ven en Mi día y en el sistema Horario de
  Vida como entradas FIJAS (estilo auto de ticket/proyecto). Solo estado + etiquetas editables.
- `PATCH /api/centralized/horario/generated`; scoring incluye las generadas completadas/fallidas.

### Ampliaciones de la MISMA sesión (2026-07-08) — todas implementadas + verificadas (tsc/build/Postgres rollback)
Todo lo detallado en `MEMORIA.md`; aquí el arco de aprendizaje del objetivo, que fue creciendo:
1. **Alcance "todos los usuarios"** — `TaskProgram.scope` = `'user' | 'all'`. En `'all'`, la materialización
   expande a `getAllTaskSubjects()` (miembros activos + candidatos aprobados = quienes salen en `UsersList`),
   una fila por sujeto/día. Se resuelve **en la activación** (usuarios nuevos no la reciben salvo re-activar).
   Aprendizaje: el targeting por-usuario ya cuadraba; "todos" es solo fan-out sobre el mismo INSERT idempotente.
2. **Re-sync al editar función de política ACTIVA** — el bug real: editar la config guardaba pero NO re-materializaba
   (solo desactivar+activar lo hacía). Fix: `createFunction`/`updateFunctionConfig` → **`resyncFunctionTasks`**
   (si activa + `generate_tasks`: borra PENDIENTES de esa función y re-materializa; `ON CONFLICT DO NOTHING`
   conserva completadas/fallidas). Borrar la función limpia por FK `ON DELETE CASCADE`.
3. **Tareas de política como BLOQUES en el calendario de Mi día** — decisión del usuario: sí, además del rail;
   color por estado (verde/rojo/violeta); clic → popover con `TaskStatusButtons`. Técnica: `EventInstance`
   sintéticos (`generated:true`) fusionados en `allInstances` solo para el calendario; `CalendarView` gana
   `onGeneratedClick` y `dayTotals` los excluye de las horas.
4. **UI del modal Generar tareas** — panel de tareas a la DERECHA (estilo Horario de Vida: chip de etiquetas
   icono+contador con burbuja); **seleccionar tarjeta = editar** esa tarea en el formulario ("Guardar cambios").
5. **Fixes de diseño transversales**: tipo de evento **Laboral→Progreso** (rename de valor `work`→`progreso` +
   migración BD); campo "Tarea del horario" del EventModal ahora **solo-lectura** y solo vía "Registrar tiempo";
   indicador de **política activa = anillo esmeralda** (no punto verde) + **leyenda-filtros** (hover/pin) con
   Tipos + Estado; `MultiSelectSearch` con **chips debajo** del buscador.

### Decisiones del usuario (2026-07-08)
- **P5 · ✅ SÍ alimentan el perfil**: completar/fallar una tarea generada suma/resta a sus valores/talentos
  (igual que el Horario de Vida).
- **P6 · ✅ Al desactivar**: se **borran las pendientes** (pasadas y futuras sin resolver); se **conserva el
  historial** de completadas/fallidas. Re-activar **regenera** desde el nuevo `activated_at`, idempotente
  (ON CONFLICT DO NOTHING) para no duplicar días ya materializados.
- **P7 · ✅ Sin vista admin nueva**: aparecen en el **"Mi día"** de cada usuario asignado **Y** en el sistema
  **Horario de Vida**, comportándose **como las entradas auto de ticket/proyecto**: **fijas** (no se arrastran
  ni se quitan); el usuario **solo cambia estado y etiquetas** (etiquetas se editan en el sistema Horario de
  Vida). Feed de scoring incluido.

### Hallazgos (investigación en el código, 2026-07-08)
- **P1 — ¿La activación genera tareas? · ✅** NO. `PATCH /api/centralized/comandos/policies {active}` →
  `setPolicyActive()` solo pone `active`/`activated_at`. `getActiveEffects()` (`comandos-db.ts`) procesa
  `permanent_message`, `policy_terms` y `block_modules` pero **ignora `generate_tasks`**. No existe tabla ni
  código de materialización (grep confirmó: `generate_tasks` solo aparece en autoría/UI).
- **P2 — ¿El targeting de usuarios es correcto? · ✅ SÍ.** `TaskProgram.userKind`+`userId` (de `UsersList`)
  coincide exactamente con el sujeto que resuelve `GET /horario/me`:
  - candidato → `UsersList` usa `/api/admin/candidates` → `clients.id`; `/me` resuelve candidato = `clients.id`. ✔
  - miembro → `UsersList` usa `/api/admin/team` → `members.id`; `/me` resuelve miembro = `users.member_id`
    (y `member_id::bigint = members.id`). ✔
  Conclusión: la preocupación del usuario ("que se asignen a los usuarios correctos") está **cubierta en el
  targeting**; lo único que falta es **ejecutar** la generación.
- **P3 — ¿Dónde aterrizan las tareas? · 🔎 Mismatch de modelo.** El Horario/Mi día está atado al sistema
  **Apoyo**: una tarea = una **alternativa** (`aa_solutions` status='alternative') unida por problemas/
  situaciones; `hv_schedule.alternative_id` es `BIGINT NOT NULL`. La tarea generada es **libre**
  (título+detalle+etiquetas+horario), sin alternativa ni grafo psicosocial. Además `hv_schedule` es
  **granular por día** (no guarda hora), pero `TaskProgram` trae `allDay`/`startTime`/`endTime`.
  → **No se puede reusar `hv_schedule` tal cual.** Decisión de diseño: **store dedicado
  `cv_generated_tasks`** (instancias materializadas por usuario/día con estado+hora+política origen) y que el
  rail de "Mi día" **fusione** esa segunda fuente. (Alternativa descartada: crear alternativas sintéticas en
  el grafo de Apoyo — contamina el modelo psicosocial y no soporta hora.)
- **P4 — Expansión de presencia · ✅ decidido en MEMORIA.** Inicio = `activated_at`; ventana = `daysCount`
  días; `weekdays` (vacío=todos) filtra qué días dentro de la ventana; `allDay` o `startTime`/`endTime`.

### Preguntas ABIERTAS para el usuario (deciden el modelo de datos / comportamiento)
- **P5 — ⏸ ¿Las tareas generadas alimentan el PERFIL (scoring de valores/talentos)** igual que las del
  Horario de Vida? Llevan las mismas etiquetas, así que lo natural es que completarlas/fallarlas sume/reste.
- **P6 — ⏸ Ciclo de vida al DESACTIVAR la política:** ¿se **eliminan** las tareas pendientes/futuras (y se
  conserva el historial de las ya completadas/fallidas para el registro y el scoring), o quedan todas? ¿Y al
  **re-activar** se regeneran (idempotente por función+día para no duplicar)?
- **P7 — ⏸ ¿Se necesita una vista/gestión para el ADMIN** (previsualizar/depurar las tareas generadas por una
  política), o basta con que aparezcan en el "Mi día" de cada usuario?

### Plan de solución (borrador, a confirmar con P5–P7)
1. Tabla `gcc_world.cv_generated_tasks` (function_id, policy_id, subject_kind, subject_id, title, detail,
   value_tags[], talent_tags[], day DATE, all_day, start_time, end_time, status, created_at) + índice por
   sujeto y **UNIQUE (function_id, subject_kind, subject_id, day)** para idempotencia.
2. Al activar (`setPolicyActive(true)`): por cada función `generate_tasks` de la política, expandir cada
   `TaskProgram` sobre [activated_at, +daysCount) filtrando `weekdays`, e insertar filas (ON CONFLICT DO
   NOTHING). Al desactivar: según P6.
3. `getSubjectHorario`/`/horario/me` (o un endpoint nuevo) devuelve también las `cv_generated_tasks` del
   sujeto en la ventana; el rail de "Mi día" las fusiona con estado propio + `TaskStatusButtons`.
4. Scoring según P5. Verificar `tsc` + `next build`. Commit+push a main.

---

## Objetivo ACTUAL (declarado 2026-06-23) — Onboarding de candidato en la landing (8 sliders + postulación)
**Necesidad:** al pulsar "Entrar" en la landing, un visitante **nuevo** debe ver primero un modal tipo
carrusel ("deslizados") con **8 sliders** que le **dan a conocer el proyecto**, y al final un formulario
con la pregunta **"¿Por qué quieres ser candidato de este proyecto?"** (postulación), antes de ingresar al
juego/mundo.
- **% de información para el objetivo:** ~30% — **sliders 1 y 2 totalmente especificados e implementados**;
  **sliders 3–8 pendientes** (el usuario los dictará uno a uno); persistencia de la postulación en backend
  **sin definir** (hoy solo `localStorage`).
- **Contenido recibido (verbatim en `MEMORIA.md` → "Fundamentos del proyecto"):**
  - **Slider 1 · Modelo de Grupo** = Modelo 4P (4 pisos: Global, Pilar, Controlador, Colaborador; 4 pasos:
    Fundamentación, Creación, Implementación, Gestión). Cada paso contiene los 4 pisos.
  - **Slider 2 · Herramientas** = Metodología Condiciológica (6 pasos; Condiciología = estudio de las
    condiciones, de L. F. González Muyulema), Sistema de Control Psicosocial, Proyecto Centralizado, Violeta.
- **Implementado:** `components/landing/OnboardingSlidersModal.tsx` (data-driven, estilo pixelart, acordeón
  en slider 2, animaciones) + hook en `app/page.tsx` (estado `onboardingOpen`, intercepta "Entrar" para
  nuevos, `onComplete` arranca el flujo original y guarda la motivación en localStorage). `tsc` OK, sin commitear.
- **Preguntas abiertas para el usuario:** (1) contenido de los sliders 3–8; (2) ¿la postulación se guarda en
  BD / se asocia al personaje creado? ¿hay revisión/aprobación de candidatos?; (3) ¿el modal debe poder
  saltarse o es obligatorio? (hoy tiene "✕" que cancela y vuelve a la landing).

### Ampliación 2026-06-23 — Candidato vs Cliente, cuentas, aprobación y marketplace (DISEÑO acordado)
El usuario definió el flujo completo (ver `MEMORIA.md` → feature onboarding):
- Tras "Entrar": **modal de elección** Candidato/Cliente (`EntryChoiceModal`). **HECHO** (UI + ruteo + `gcc_account_type`).
- **Candidato:** sliders → motivación → creación de cuenta (datos personales en `SignupForm`) → verificación correo.
  **PENDIENTE (backend):** aprobación por **admin Global** + correo de aprobación antes de poder ingresar al juego.
- **Cliente:** sin sliders ni motivación → creación de cuenta (`account_type='client'`) → verificación correo.
  **PENDIENTE (backend):** inicio = **marketplace**; **/dashboard restringido** (Marketplace, Tickets, Proyectos,
  Suscripciones, Automatizaciones, Perfil/Config); publica requerimientos de tickets/proyectos; ve suscripciones
  asignadas; automatizaciones solo-ver-compartido (no crea flujos).
- **HECHO:** `SignupForm` pide nombre/correo/país/dirección/teléfono + contraseña; `signup` persiste
  `full_name/country/address/phone/account_type` en `gcc_world.clients`; checkbox de marketing opcional en la
  postulación; se quitó el texto "Slider N".
- **HECHO (propuestas 2026-06-23):** tabla `gcc_world.candidate_proposals` + `POST/GET /api/candidate/proposal`
  (bloqueo de correo UNIQUE, `ip_hash`, estado `pending`) + verificación de correo (`/api/candidate/verify`) +
  `ProposalPendingModal` (espera de aprobación) + reconocimiento por IP al elegir "candidato". El candidato NO
  entra al juego tras postularse; queda en espera.
- **RESUELTO — Flujo del candidato APROBADO en la landing (2026-07-09):** al volver a "Entrar", si el visitante
  (reconocido por `PROPOSAL_COOKIE`/ip en `GET /api/candidate/proposal`) tiene la postulación **`status='approved'`**,
  el `EntryChoiceModal` muestra una opción **verde** "¡Tu postulación fue aprobada!" (antes decía siempre "en proceso").
  Al pulsarla → `ProposalPendingModal` en **variante aprobada** (icono 🎉, etiqueta **verde** "aceptado por el
  administrador", botón **"Continuar"** en vez de "Entendido"). "Continuar" abre **`CandidateAccountModal`** (nuevo,
  `components/landing/`) = formulario nombre/país/dirección/teléfono/contraseña que POSTea a
  `/api/character/auth/complete-profile` (reemplaza la contraseña temporal, `profile_completed=true`, borra la
  propuesta, deja sesión de juego activa) → recarga `/`. **Clave backend:** el `GET` de propuesta, cuando está
  aprobada, **setea el `CLIENT_COOKIE`** con el `client_token` del candidato (por email) para que `complete-profile`
  lo identifique (el token se creó en el navegador del admin al aprobar, no en el del candidato); además el fallback
  por ip de `complete-profile` ahora acepta candidatos aprobados **sin personaje**. Verificado tsc+build + estado real
  en Postgres. (Nota: `/dashboard` exige JWT `auth_token`; el candidato queda con `gcc_player_auth` del juego, por eso
  se recarga a `/`, no a `/dashboard`.)
- **PENDIENTE / preguntas:** (a) ¿confirmas que clientes y candidatos comparten `gcc_world.clients` con
  `account_type`, o quieres tabla física separada?; (b) flujo de **aprobación de candidato** (estado en BD +
  endpoint admin + correo); (c) gating de **acceso del cliente** al juego (no debe entrar) y redirección a
  marketplace tras verificar; (d) permisos del `/dashboard` para rol cliente; (e) el `SignupForm` hoy vive
  dentro del juego (requiere personaje) — para el cliente habría que ofrecer creación de cuenta SIN pasar por
  el juego (rework de flujo, a definir).

---

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
- **P13 (IVA):** ✅ **CORREGIDO 2026-06-11 → SIN IVA (0%)**. El usuario aclaró que GCC todavía no cobra IVA;
  el costo mensual es el **valor neto** (ej. $5 son netos, no recalcular $0.65 como IVA). `iva_rate=0` por
  defecto (tabla/POST/UI). Se conserva la columna `iva_rate` por suscripción por si en el futuro se activa.
  Suscripciones existentes actualizadas a 0% vía UPDATE. (La 1ª factura #30 ya se emitió con IVA y quedó
  autorizada en SRI; su total $5 es correcto, revertir el desglose requeriría nota de crédito.)

## Anular factura de suscripción → revertir el mes (2026-06-11)
Requisito del usuario: al **anular** (nota de crédito) una factura que provino de una suscripción, el mes
correspondiente debe volver a **pendiente de pago**. Implementado: `POST /api/invoices/[id]/void`, tras
autorizar la NC y marcar la factura `voided`, si `source_type='subscription'` llama
`revertSubscriptionPaymentForVoidedInvoice(invoiceId)` → borra la marca de pago (mes → pendiente) y
`removeIncomeFromFinance('subscription','<subId>-<YYYY-MM>')` (quita el ingreso del dashboard + log).
Esto cierra el ciclo: anular → mes pendiente → se puede volver a cobrar (nueva factura + ingreso limpios).

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

## Aprendizaje técnico — Grafo tipo Obsidian con `react-force-graph` (2026-07-07)
Contexto: sistema **Apoyo y Autoayuda** (Centralizado) — visualizar Situación→Problemas→Causas y
Soluciones→Problemas+Causas como un *graph view* estilo Obsidian. Detalle de diseño en `Diseño.md`.

### P — ¿Qué usa Obsidian y cómo replicarlo en open source? · ✅ Resuelta
Obsidian es **cerrado**; su graph = **d3-force** (física/layout) + **PIXI.js/WebGL** (render). La forma
open-source equivalente es **`react-force-graph`** (vasturiano), mismo motor `d3-force` con render en
canvas/WebGL. Elegido **`react-force-graph-2d`** (canvas 2D).

### P — ¿Cómo integrarlo en Next.js (SSR) conservando el `ref`? · ✅ Resuelta
La lib usa `window/canvas` → no puede importarse en SSR. **`next/dynamic` NO reenvía refs** (y el `ref`
es necesario para `d3Force`, `zoomToFit`, `zoom`). Solución: cargar la lib con `import('react-force-graph-2d')`
dentro de un `useEffect`, guardarla en `useState` y **renderizar el componente real** con `ref` normal;
placeholder mientras carga. Medir ancho/alto del contenedor con `ResizeObserver`.

### P — Gotchas de rendering en canvas · ✅ Resuelta
- `createRadialGradient` **lanza** si `x/y/r` no son finitos → en los primeros frames `node.x/y` pueden
  ser `NaN` (antes de que la física posicione). **Guardar** con `Number.isFinite` al inicio de
  `nodeCanvasObject`/`nodePointerAreaPaint`.
- Formas por tipo: trazar el path en canvas (`traceShape`) y usar `nodePointerAreaPaint` con la misma
  forma para que el hit-test coincida.

### P — ¿Cómo evitar el "salto"/lentitud al cambiar aristas? · ✅ Resuelta
Dos causas: (1) **refetch completo** del grafo por cada cambio; (2) recrear los objetos-nodo cambia su
identidad → react-force-graph **reinicia el layout** y pierde posiciones. Solución: **actualización
optimista** del estado local (sync en 2º plano, revertir si falla) + **cachear los objetos-nodo por key**
(useRef Map) para conservar `x/y`; y disparar `zoomToFit` **solo cuando cambia el conjunto de nodos**
(firma `nodes.map(n=>n.key).join()`), no al cambiar aristas.

### Lecciones de diseño (del usuario, iterando) · ✅
- Fondo **negro** puro (sin nebulosa morada). Color oscuro de marca (`#4B2D8E`) **no se distingue** sobre
  negro → subir a violeta vivo `#8b5cf6`. Nodos **sin núcleo blanco** (se ve "infantil"): orbe saturado +
  halo. Distinción por **forma + tamaño**, no solo color. Panel de detalle **transparente** con bloques
  "glass" (`bg-black/40 backdrop-blur`) para leerse sobre el canvas sin taparlo; **anclado abajo-derecha**;
  incluir **referencias a conexiones** (chips navegables).

---

## Objetivo (2026-07-08) — Sistema "Comandos Violeta" (políticas organizacionales activables)
**Rol asumido:** arquitecto de plataforma + ingeniero full-stack (modelado de datos, grafo, enforcement transversal).

**Necesidad:** un sistema (Centralizado, global · creación) donde el usuario global crea **políticas** agrupadas por
**categoría**, activables/desactivables; cada política contiene **funciones** que, al activarse, generan **acciones en toda
la app**: mensaje permanente (header), bloqueo de módulos (seguridad), generación de tareas, y **detalle/términos** (documento
textual compartible). Interfaz espejada del sistema Apoyo (categorías izq → grafo → panel de detalle), con formas de grafo NO
usadas en Apoyo.

- **% de información para el objetivo:** ~90% — AUTORÍA completa + enforcement de mensaje y bloqueo HECHOS y verificados; **falta
  la generación real de tareas** en Mi día al activar (la lógica de presencia ya está especificada: ver TaskProgram en MEMORIA).
- **Resumen del estado:** modelo Categoría→Política→Función en tablas `cv_*`; grafo con 3 formas (estrella/pentágono/documento);
  4 tipos de función; banner flotante por pestañas con visor de detalle; bloqueo real de módulos para no-admin.

### Preguntas y decisiones · ✅
- **P — ¿Dónde vive y cómo aparece el sistema sin crearlo a mano?** → Es built-in por slug (`comandos-violeta`); se **siembra
  idempotente** dentro de `ensureTable()` de la ruta de `systems` (se llama en cada carga de Centralizado). Sembrarlo solo en su
  propia `comandos-db` NO basta: hay huevo-y-gallina (el despacho busca el sistema por slug antes de renderizar el componente).
- **P — ¿El banner dónde va para no romper el layout?** → Un banner en el flujo de `<main>` empuja el contenido y **recalcula** los
  componentes que miden su `top` (`innerHeight − top`). Solución: **fixed, fuera del flujo, sin reservar espacio**
  (`pointer-events-none` salvo el card). Ubicación final: flotante arriba, tipo pestañas.
- **P — ¿Cómo mostrar varias políticas activas sin amontonar?** → **Pestañas** (una por política; solo se ve el contenido de la
  seleccionada). Header morado + zona inferior color tarjeta; la pestaña activa toma el color de la zona inferior (tipo navegador).
- **P — Presencia de la tarea generada.** → El usuario aclaró: NO son opciones excluyentes ni hace falta recurrencia. Inicio =
  **fecha de activación** (fijo); `daysCount` = ventana/límite; `weekdays[]` = días presentes (recurrencia dentro de la ventana);
  `allDay` + `startTime`/`endTime`. (Ver TaskProgram en MEMORIA.)

### Lecciones técnicas · ✅
- **Multiselect dentro de panel flotante con `overflow-y-auto`**: el dropdown de `MultiSelectSearch` se **recorta**. Para listas
  cortas (módulos), usar **chips toggle** en vez de dropdown.
- **`bg-white` bajo `.corp` (modo oscuro)** puede quedar pisado → una pestaña "blanca" salía oscura. Para colores garantizados en
  cualquier tema, usar **estilos inline** (`style={{ background:'#fff', color:'#4c1d95' }}`), no utilidades Tailwind de color.
- **Grafo reusable pero con formas propias**: se copió el motor de `KnowledgeGraph` a `PolicyGraph` (formas por `shapeOf`, color por
  `colorOf`/`FUNCTION_TYPE_META`) en vez de generalizar el de Apoyo (riesgo de regresión). Documento = rect con esquina doblada.
- **Efectos "serios"**: se quitó la "luz que se movía" (sweep) del banner; queda un flotado sutil. Menos fantasía, más profesional.
- **Enforcement transversal**: un `PolicyEffectsProvider` en el layout provee {policies, blockedModules} a banner + sidebar + guard;
  refresca por `pathname` y por `visibilitychange`.
