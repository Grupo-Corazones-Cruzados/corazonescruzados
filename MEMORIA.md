# Memoria del proyecto — GCC World (gcc-world-manager)

> Fuente de verdad del contexto del proyecto. Se mantiene viva: cada decisión y
> aprendizaje importante se registra aquí en el momento.

## Objetivo
Plataforma interna de gestión para **Grupo Corazones Cruzados (GCC)** — estudio/agencia
de software en Ecuador. Centraliza documentación de proyectos, tickets/soporte,
facturación electrónica (SRI Ecuador), calendario/disponibilidad de miembros, portal de
clientes, y un "mundo" gamificado estilo Digimon (sprites, mapas, NPCs).

## Stack
Stack estándar de la casa, con particularidades de este repo:
- **App**: Next.js 15 (App Router) + TypeScript + React 19 + Tailwind v4.
- **Datos**: PostgreSQL. **Prisma 7** con adapter `@prisma/adapter-pg` **+ SQL crudo vía `pg`**.
  - Cliente Prisma generado en `lib/generated/prisma` (no el default `@prisma/client`).
  - **Schema de BD = `gcc_world`** (no `public`); `search_path=gcc_world,public`. Ver `lib/db.ts`.
  - Prisma `schema.prisma` solo modela Project/Module/Section/Subsection/Incident; el resto
    de tablas se gestionan con **migraciones SQL manuales en `sql/migrations/`** (001–020+).
- **Auth**: propia, **JWT (`jose`) + `bcryptjs`**, roles/permisos por sección. Passkeys
  (`@simplewebauthn`) para clientes.
- **Deploy**: Railway (nixpacks.toml). `build` corre `prisma generate && next build`.
- **Integraciones**: OpenAI + fal.ai (generación de sprites/IA), Resend (email),
  Puppeteer/PDFKit (PDFs), `ec-sri-invoice-signer` + node-forge/xadesjs (firma SRI con `data/firma.p12`).
- **Dev**: `npm run dev` → puerto 3002 (`-H 0.0.0.0`); `dev:https` vía `server.cjs`.

## Estado actual
- **Rama de trabajo y fuente de verdad: `main`** (confirmado por el usuario, 2026-06-07).
  Remote: `Grupo-Corazones-Cruzados/corazonescruzados`.
  La rama `rebuild/v2` fue **eliminada** del remoto el 2026-06-07 (rebuild descartado).
- Trabajo reciente (may-2026): módulo **Tickets** (admin completa/factura tickets, modal
  estandarizado con el de proyectos) y **Calendario** (disponibilidad de miembro, vista
  semanal 24h, hora actual, color "fuera de casa", calendario público con sincronización).
- **2026-06-07:**
  - Limpieza de repo: eliminado código muerto (componentes huérfanos), migraciones SQL ya
    aplicadas (`sql/migrations/`), scripts one-off y assets sin uso. Commit `94cfcee`.
  - Nueva feature: en el modal **"Completar Proyecto y Generar Factura"**
    (`app/(dashboard)/dashboard/projects/[id]/page.tsx`) se agregó **"Cliente previo"** —
    selector que autocompleta los datos del adquiriente (tipo id, identificación, razón
    social, dirección, email, teléfono) desde clientes ya facturados. Verificado (tsc OK),
    **sin commitear aún**. Ver `Aprendizaje.md`.
  - **Rediseño visual del dashboard: pixelart → corporativo (Microsoft/SharePoint, Fluent).**
    Tema **light** (fondo `#faf9f8`, texto `#242424`), acento morado de marca `#4B2D8E`, fuente
    **Segoe UI**. **Solo `/dashboard/`** (landing/auth/portal/mundo conservan pixelart). Trabajo grande,
    **TODO sin commitear** (un solo bloque, ~60+ archivos). Fases:
    1. Recoloreo por tokens scoped `.corp`.
    2. Rediseño de la forma de todos los controles y modales a Fluent (campos, selects, tabs, tabla, diálogos).
    3. Formularios como **panel lateral derecho** (md/lg) vs diálogo centrado (sm).
    4. Arreglo de contraste de colores claros sobre blanco.
    5. **Quitado el bloque título+descripción** (`PageHeader`) de todos los módulos; la home perdió su saludo.
    6. **`ModuleToolbar`**: pestañas+buscador+acción en una fila (+ layout móvil + overflow menu, ver lecciones).
    7. **Sidebar**: íconos lucide por módulo, logo sin borde negro, botones inferiores en 2 filas (salir en rojo).
    Verificado en cada paso (tsc OK, compila). Ver `Aprendizaje.md` y "Lecciones técnicas → Theming corporativo".

- **2026-06-11:** Nuevo módulo **Suscripciones** (cobros mensuales recurrentes). Sidebar **debajo de
  Proyectos** (`roles:['member','admin']`). Tablas nuevas `gcc_world.subscriptions` y
  `subscription_payments` (creadas con `CREATE TABLE IF NOT EXISTS` en `ensureSubscriptionTables()`,
  `lib/subscriptions.ts`). Lógica de meses/alertas en `lib/subscriptions.ts` (`computePeriods`,
  `summarizeSubscription`, helper `toYMD`). Endpoints `app/api/subscriptions/{route,[id]/route,[id]/pay/route}.ts`.
  Factura SRI vía `createManualInvoiceFromSubscription` (`lib/integrations/sri/index.ts`,
  `source_type='subscription'`, `source_id='<subId>-<YYYY-MM>'`). Ingreso vía
  `addSubscriptionIncomeToFinance` (`lib/finance.ts`). UI `app/(dashboard)/dashboard/subscriptions/page.tsx`
  (tabla + panel lateral de meses, estilo `.corp` calcado de projects/invoices). Verificado: tsc + `next build` OK.
  **Sin commitear.** Ver `Aprendizaje.md` (objetivo actual).

- **2026-06-11:** Nuevo módulo **Clientes** (de facturación), en el sidebar **debajo de Marketplace**
  (`roles:['member','admin']`). Identidad de cliente centrada en `client_ruc` de las facturas (la tabla
  `gcc_world.clients` es el portal/auth, concepto distinto, no se toca). Tabla nueva
  `gcc_world.billing_clients` (id_type, ruc UNIQUE, name, email, phone, address, notes) **sembrada
  idempotentemente desde las facturas** (`ensureBillingClientsTable` en `lib/billing-clients.ts`) + registro
  **Consumidor Final** (`ruc='9999999999999'`, agrupa esas facturas; no editable/borrable). Endpoints
  `app/api/billing-clients/{route,[id]/route}.ts`: lista con totales por cliente (LATERAL sobre invoices por
  `client_ruc`), detalle = datos editables + facturas del cliente con su **origen** (`invoiceOrigin`: ticket/
  project/subscription → botones "Ver factura"/"Ver origen"). UI `app/(dashboard)/dashboard/clients/page.tsx`
  (tabla + panel editable + facturas + totales). **Gotcha:** join ticket por `t.id::text = i.source_id` (NO
  `source_id::bigint`, que rompe con source_id de suscripción tipo `5-2026-06`). Verificado contra BD + build.

## Arquitectura y módulos
Rutas en `app/`, agrupadas por layout: `(auth)`, `(dashboard)`, `(main)`, `(public)`.
API en `app/api/` (~40 grupos). Lógica en `lib/`, componentes en `components/`.
Módulos principales:
- **Proyectos/Docs**: projects, modules, sections, public-docs, project-structures.
- **Tickets/Soporte**: tickets, support, incidents, requests.
- **Finanzas**: finance, invoices, proforma, exchange-rates — facturación electrónica SRI
  (`lib/finance.ts`, `lib/finance-pdf.ts`, firma `data/firma.p12`).
- **Calendario**: `app/calendario`, `lib/calendar`, `app/api/calendar` — disponibilidad,
  calendario público compartible.
- **Miembros/Clientes**: members, users, clients, portal (con passkeys).
- **Mundo gamificado (Digimon)**: world, digimundo, sprites, character, marketplace,
  citizens — mapas/NPCs/items/sprites generados con IA (`lib/world`, `lib/sprites`, fal/openai).
- **Agentes/Dev tooling**: agent-links, dev-server, open-vscode, tools — gestión de
  servidores de desarrollo (`data/agent-*.json`, `lib/dev-servers.ts`).

## Decisiones y reglas de negocio
- **BD multi-schema**: toda query (Prisma o `pg` cruda) opera sobre el schema `gcc_world`.
  Al crear tablas nuevas, hacerlo como migración SQL en `sql/migrations/` con numeración correlativa.
- **Facturación = Ecuador / SRI**: firma electrónica con `.p12`; respetar formato XML SRI.
- **Rebuild v2 descartado** (2026-06-07): el usuario confirmó que `main` de este repo es la
  versión correcta y en uso. Se eliminó la rama `origin/rebuild/v2`. El trabajo continúa aquí.
- **Suscripciones (reglas, 2026-06-11):** cobro **por mes calendario** (una fila por mes desde el mes de
  inicio hasta hoy; vencimiento = día de corte = día de `start_date`, clamp al último día en meses cortos;
  un mes aparece al iniciar el mes calendario). **IVA: SIN IVA (0%)** — corregido el 2026-06-11: el costo
  mensual es el **valor neto** que cobra GCC, se factura tarifa 0% (`iva_rate=0`, default 0 en tabla/POST/UI).
  GCC **no cobra IVA por ahora**. Se mantiene la columna `iva_rate` por suscripción por si en el futuro se
  pide activar IVA (entonces `unitPrice = costo/(1+iva/100)`). **Alerta** 7 días antes (ámbar ≤7d, roja si
  venció e impago). **Marcar pagado** ⇒ genera factura SRI + email al cliente + ingreso del mes actual,
  **solo si el SRI autoriza**. **Desmarcar** permitido solo si el mes aún no tiene factura emitida (una
  factura autorizada requeriría nota de crédito → 409).
  - Nota 2026-06-11: la 1ª factura de prueba (#30, suscripción "Servidor", periodo 2026-06) se emitió
    ANTES del cambio, **autorizada por SRI** con desglose IVA (4.35+0.65=5.00). El total ($5) es correcto;
    revertir SOLO el desglose de esa factura requeriría nota de crédito. La suscripción #1 ya quedó a 0%.
  - **Anular factura de suscripción → mes vuelve a pendiente (2026-06-11):** el endpoint
    `POST /api/invoices/[id]/void` (emite nota de crédito; al autorizar SRI marca la factura
    `status='cancelled'/sri_status='voided'`) ahora, si la factura es `source_type='subscription'`, llama
    `revertSubscriptionPaymentForVoidedInvoice(invoiceId)` (`lib/subscriptions.ts`): borra la fila de
    `subscription_payments` (el mes vuelve a **pendiente**) y quita el ingreso con
    `removeIncomeFromFinance('subscription', '<subId>-<YYYY-MM>')` (`lib/finance.ts`: elimina el
    `finance_items` y su `finance_source_log` y recalcula el mes) → así el dashboard deja de contarlo y un
    re-cobro futuro genera factura+ingreso limpios.
  - **Anular factura de TICKET → ticket vuelve a facturable (2026-06-11):** análogo a suscripciones; el void
    (`app/api/invoices/[id]/void`), si `source_type='ticket'`, regresa el ticket de `completed` a `confirmed`
    y quita su ingreso (`removeIncomeFromFinance('ticket', source_id)`). Antes el ticket quedaba "completado"
    colgado con su factura anulada (Factura/Cliente en blanco en la tabla).
  - **Tabla de tickets — Cliente con fallback a la factura (2026-06-11):** `GET /api/tickets` usaba `c.name`
    (vía `tickets.client_id`); si el ticket no tenía cliente registrado, mostraba "-". Ahora
    `COALESCE(c.name, inv_info.invoice_client_name)` cae al `client_name_sri` de la factura del ticket
    (LATERAL) → un ticket facturado muestra el cliente aunque no exista registro en `clients`.

- **Estado 'failed' para facturas con error/rechazo SRI (2026-06-11):** las facturas cuyo proceso SRI fue
  **rechazado** (`sri_status='rejected'`) o **erró** (`sri_status='error'`) ya no quedan en `pending`: pasan a
  `status='failed'` ("Fallida", badge rojo). `sendInvoiceToSri` setea `failed` en recepción rechazada,
  no-autorizado y catch (guarda `NOT IN ('paid','cancelled')`); si luego se reintenta y **autoriza**, vuelve
  `failed → pending`. El enum `status` es **varchar con CHECK** `invoices_status_check` (valores
  pending/sent/paid/cancelled) → se amplió a incluir `failed` (DDL idempotente en `ensureSriColumns`, y
  aplicado en prod). Backfill: #13 (rejected) y #19 (error) → failed. UI: pestaña "Fallidas" + STATUS_LABEL.
- **Estado de factura ligado al comprobante de pago (2026-06-11):** `status` de `gcc_world.invoices`
  (enum `pending`/`sent`/`paid`/`cancelled`) ahora se sincroniza con el comprobante: subir comprobante
  (`POST /api/invoices/[id]/proof`) pone `status='paid'` (salvo `cancelled`); quitarlo (`DELETE`) revierte
  `paid → pending`. Las 9 facturas que ya tenían comprobante se backfilearon a `paid`. Badge muestra
  etiqueta ES (`STATUS_LABEL`: Pendiente/Enviada/Pagada/Anulada) en lista y detalle. "Pagada" = factura
  cobrada/completada (no hay estado 'completed' en facturas; ese es de proyectos/tickets).

## Lecciones técnicas
- **Postgres "inconsistent types deduced for parameter $N" (2026-06-11):** ocurre cuando un mismo
  parámetro `$N` se usa en dos contextos que deducen tipos distintos en la misma query (ej. `sri_status = $2`
  → varchar y `CASE WHEN $2 = 'rejected'` → text). Fix: castear explícitamente (`$2::text`) en todos los usos.
  Pasó en `sendInvoiceToSri` al introducir el estado 'failed'. node-pg envía params sin tipo y deja deducir a PG.
- **Diagnóstico SRI con scripts (2026-06-11):** se pueden compilar módulos SRI self-contained
  (`soap-client.ts`+`config.ts`, o `ride-pdf.ts`+`config.ts`) con `npx tsc --outDir .ridetmp --module commonjs`
  y requerirlos desde un `.cjs` para consultar el SRI (`consultarAutorizacion(claveAcceso)`) o regenerar RIDEs
  sin levantar la app. El `.p12` se inspecciona con `node-forge` (vigencia del cert). "FIRMA INVALIDA" del SRI
  = la firma del comprobante no validó (no es problema de datos del cliente).
- **RIDE PDF — overflow de Razón Social larga (2026-06-11):** en `lib/integrations/sri/ride-pdf.ts` la
  sección de cliente dibujaba `data.clienteNombre` **sin `width`** con `continued:true`, así que un nombre
  largo (ej. "GESTIÓN DE PROYECTOS Y ADMINISTRACIÓN… MEDICINA NUCLEAR S.A.S") fluía por todo el ancho y se
  montaba sobre la columna derecha (RUC/CI, Guía de Remisión). Fix: el bloque izquierdo (Razón Social +
  Fecha Emisión) se limita a `width=PW*0.62` (hace **wrap** antes de la columna derecha en `L+PW*0.65`), y
  la columna derecha se dibuja en **slots fijos top-aligned** (`cTop`, `cTop+11`); `y` final = `max(leftBottom,
  rightBottom)+8`. Verificado generando un PDF de prueba con el nombre real (wrap a 2 líneas, sin solape).
  Patrón general para PDFKit: todo `text()` en layout de 2 columnas debe llevar `width` acotado a su columna.
- **El RIDE se RE-RENDERIZA al descargar (2026-06-11):** antes `GET /api/invoices/[id]/pdf` servía el
  `pdf_data` guardado (horneado al emitir) → las facturas viejas conservaban el diseño antiguo aunque se
  arreglara la plantilla. Ahora, para facturas **autorizadas**, el endpoint llama
  `regenerateRidePdf(invoiceId)` (`lib/integrations/sri/index.ts`): re-renderiza el RIDE desde los datos
  guardados (clave/autorización/XML NO cambian — el RIDE es derivado), con **fallback** al `pdf_data`
  almacenado si fallara. Así toda factura (vieja o nueva) se descarga con la plantilla actual. Nota de tipos:
  `NextResponse` ya no acepta `Buffer<ArrayBufferLike>` directo → pasar `new Uint8Array(buffer)`.
- **Theming corporativo del dashboard (scope `.corp`):** el look pixelart está centralizado en
  `app/globals.css` (tokens `@theme` `--color-digi-*`/`--color-accent*`, fuentes, clases `.pixel-*`).
  Para dar al dashboard un tema **light corporativo** sin afectar landing/auth/portal/mundo (que
  comparten esos estilos), se montó la clase **`.corp`** en `app/(dashboard)/layout.tsx` y dentro de
  ella se **redefinen las CSS vars** → todas las utilidades Tailwind `digi-*`/`accent` y las clases
  `.pixel-*` heredan el color corporativo **sin editar las 22 páginas** (las páginas casi no usan hex
  hardcodeado). Detalles:
  - Las fuentes que se fijaban inline (`fontFamily: "'Silkscreen'…"` / JetBrains) se migraron a
    `var(--font-display)` / `var(--font-body)` (theme-aware): por defecto = pixel; bajo `.corp` = Segoe UI.
  - `text-white` (no overrideable por var) → `text-digi-text` en el scope del dashboard, **salvo** sobre
    color sólido (p.ej. badge `bg-red-600`, que sigue blanco).
  - **`.pixel-scope`**: clase que **revierte localmente** los tokens a los valores dark/pixel. Se usa en
    "islas" que deben seguir oscuras dentro del dashboard: previews de WhatsApp/chatbot
    (`components/dashboard/flows/*`) y `ProformaChatPanel` (GitHub-dark). Si creas otra isla con fondo
    hardcodeado oscuro, envuélvela en `.pixel-scope`.
  - `PixelBadge` usa `data-variant` + clase base `pixel-badge`; los colores claros (Fluent) de los
    badges viven en `.corp .pixel-badge[data-variant=…]`.
  - **Forma de los controles (fase 2):** los componentes compartidos llevan **clases base semánticas**
    y su diseño Fluent vive en `app/globals.css` → "CORPORATE CONTROLS" (`.corp .<clase>`):
    `field-control`/`field-label`/`field-select` (inputs/selects), `modal-surface/header/title/close/body`
    (PixelModal), `pivot`/`pivot-tab`/`pivot-count` (PixelTabs), `data-table`/`dt-th`/`dt-td`/`dt-row`
    (PixelDataTable), `dlg-btn`/`dlg-btn--primary|--danger` (PixelConfirm), `page-title` (PageHeader).
    El chevron del `<select>` se movió del inline a la clase `.field-select` para poder tematizarlo.
    Para restilizar un control en el dashboard, edita su `.corp .<clase>` (no toques el componente, así
    auth/portal siguen pixel). Regla global: `.corp input/select/textarea` también estiliza campos sueltos.
  - **Formularios = panel lateral derecho (fase 3, estilo Azure/SharePoint Fluent Panel):** `PixelModal`
    pone `data-size={size}` en el surface. En `.corp`, `data-size='md'|'lg'` → panel `position:fixed` a la
    **derecha**, alto completo, ancho 644/840px, slide-in `panelSlideInRight`; `data-size='sm'` → diálogo
    centrado pequeño (lo usa solo `PixelConfirm`). Como 43 de 44 modales son `md`/`lg`, los formularios se
    volvieron panel **sin tocar las llamadas**. Pendiente opcional: footer sticky con botones.
  - **Quitar título+descripción de módulos (fase 5):** `PageHeader` (solo dashboard) se reescribió: NO
    renderiza título/descripción; si hay `action` la deja como barra delgada, si no, renderiza `null`. Las
    44 llamadas no cambian. La home perdió su bloque "Welcome". **Efecto:** las páginas de detalle
    (`projects/[id]`, `tickets/[id]`, `support/[id]`) también perdieron su título de registro (pendiente
    confirmar si se restaura ahí).
  - **Barra de módulo en una fila (fase 6):** `components/ui/ModuleToolbar.tsx` agrupa pestañas + buscador +
    acción (command bar). El layout vive ahí (un solo punto). `PixelTabs` tiene prop `flush` (sin borde/margen
    propios). Aplicado a projects/tickets/invoices/marketplace/support/portfolio; faltan admin,
    admin/incidents, centralized. **Móvil (< lg):** la barra sube (`-mt-12`) a la altura del hamburguesa y las
    pestañas van a su lado (`pl-12`), con buscador+acción en 2ª fila; en `lg` vuelve a una fila. Pestañas
    alineadas: **derecha en móvil, izquierda en escritorio** (`.corp .pivot--flush` flex-end; `@media (min-width:1024px)` flex-start).
  - **Pestañas colapsables = overflow menu, NO scroll (fase 6.1):** `PixelTabs` mide anchos (capa oculta +
    `ResizeObserver`) y muestra las que caben; las demás van a un botón **⋯** (`MoreHorizontal`) que despliega
    un dropdown hacia abajo. Reemplazó el `overflow-x-auto` por `overflow-hidden` → eliminó el gotcha del scroll
    vertical (overflow-x:auto forzaba overflow-y:auto). El subrayado activo no se corta gracias a
    `.corp .pivot--flush .pivot-tab { margin-bottom:0 }`.
  - **Sidebar (fase 7):** íconos de módulo con **lucide-react** (ya instalado) en `DashboardSidebar`
    (`NavItem.icon: LucideIcon`); hamburguesa (`Menu`)/colapsar/salir con lucide. El botón hamburguesa móvil
    es **z-30** (debajo del sidebar/backdrop z-40) para que al abrir el menú el panel lo cubra, no se superponga. Botones inferiores en 2 filas
    (colapsar arriba, **cerrar sesión abajo en rojo** `text-red-400`). **`BrandLoader`** (logo rotatorio en todas
    las pantallas de carga): el arte tiene borde negro irregular; se separó el clip circular del sprite y se
    escala el sprite `transform: scale(1.18)` para recortarlo (factor ajustable).
  - **Rediseño de páginas de detalle (fase 9, estilo Microsoft/Fluent + Monday):** shell reutilizable
    `components/ui/DetailHeader.tsx` (breadcrumb + título + status + chips `HeaderChip` + command bar con
    acciones + menú overflow ⋯) y `components/ui/PropertyRail.tsx` (panel lateral sticky de metadatos).
    Patrón por página: DetailHeader + `PixelTabs` (Pivot) + PropertyRail + sección de tareas/acciones estilo
    **Monday** (barra de presupuesto + filas + "+ agregar" inline). **Ticket (`tickets/[id]`) HECHO** (tabs
    Resumen/Acciones). **Proyecto (`projects/[id]`) — etapa 1 HECHA:** DetailHeader + command bar (acción
    primaria por estado + ⋯ Editar nombre/Cancelar/Eliminar), título editable preservado, tarjeta "Acciones"
    adelgazada (sin duplicar). **Etapa 2 HECHA:** Pivot en la columna izquierda con 3 pestañas — **Resumen**
    (descripción + detalles con edición inline + solicitudes + progreso + acciones), **Requerimientos**
    (jerárquicos + subitems + asignaciones + participantes/bids), **Imágenes**. Truco: se envuelven SOLO las
    secciones en `{ptab==='x' && (<>…</>)}` y los **modales anidados** (Invite/Bid/Complete/ImagePreview) quedan
    SIN envolver → se renderizan siempre, sin moverlos. La columna derecha conserva integraciones
    (DigiMundo/Proforma/Contenido IA/Incidencias). **Etapa 3 HECHA:** Pivot movido arriba del grid (full width)
    con 4 pestañas — Resumen · Requerimientos · **DigiMundo** (agrupa DigiMundo+Proforma+Contenido IA+Incidencias)
    · Imágenes; **panel Propiedades** sticky a la derecha (como tickets) con edición inline de presupuesto/límite/
    visibilidad preservada (Details se movió ahí). El contenido de cada pestaña (incl. DigiMundo) va en la
    columna IZQUIERDA (área principal, col-span-2) y el panel Propiedades queda fijo a la DERECHA (col-span-1).
    **Requerimientos estilo Monday HECHO:** checkboxes reales (cuadro + ✓ lucide `Check`, morado al completar),
    cada requerimiento como card con barra de color a la izquierda (verde=completado / morado=pendiente),
    título semibold tachado al completar, subitems con checkbox pequeño, barra de progreso redondeada.
    Ver `Aprendizaje.md` fase 9.
  - **Tablas de altura fija + scroll interno (fase 8):** `PixelDataTable` mide su `top` y fija
    `height = innerHeight − top − 16` (mín 220) → llena el alto disponible; el cuerpo scrollea **internamente**
    (no la página), con **thead sticky** y paginador fijo abajo. Recalcula en resize / cambio de datos /
    `ResizeObserver` sobre `document.body` (guarda anti-bucle por umbral de 1px). Aplica a todos los módulos.
    Nota: asume que la tabla es el último contenido de la página; si hay algo debajo, quedaría bajo el fold.
  - **KPI cards del home (fase 8):** `StatCard` dejó de usar `.pixel-card` (padding 24px) → ahora card compacta
    `bg-digi-card border rounded-lg px-4 py-3 shadow-sm`, etiqueta mayúscula pequeña + número grande (estilo Power BI).
  - **Contraste sobre blanco (fase 4):** las variantes claras de la paleta Tailwind (`text-*-300/400`,
    p.ej. amarillo) no contrastan sobre el fondo blanco. Se **redefinen las vars de paleta v4**
    (`--color-red-400`, `--color-green-400`, `--color-yellow-400`, …) dentro de `.corp` a equivalentes
    legibles; eso arregla texto/bordes/opacidades de golpe. `.pixel-scope` restaura los oklch originales
    para las islas oscuras. Si aparece un color de texto ilegible nuevo, remapea su shade en el bloque
    "Contrast fixes" de `globals.css`.
- **Vínculo ticket → factura (2026-06-07):** antes NO existía (la factura de ticket se creaba con
  `project_id=NULL`, sin referencia). Se añadió `invoices.source_type`/`source_id` (additivo, `ADD COLUMN
  IF NOT EXISTS` en `ensureSriColumns` y en el GET de tickets). `createManualInvoiceFromTicket` ahora guarda
  `source_type='ticket', source_id=<ticketId>`. El GET `/api/tickets` une la factura por ese origen (LATERAL,
  como projects) y devuelve `invoice_id`/`invoice_sri_status`; la tabla de tickets muestra columna **Factura**
  (■ + botón PDF si `authorized`). **Backfill hecho (2026-06-07):** los 6 tickets completados existentes se
  asociaron a su factura autorizada por monto + cercanía de tiempo (`invoice.created_at ≈ ticket.updated_at`):
  facturas #27→t10, #24→t7, #23→t6, #22→t5, #20→t4, #16→t3 (las manuales 1500/630/120/1800 no eran de tickets).
  Para nuevos tickets el vínculo se guarda solo. (Projects usa otro mecanismo: `invoices.project_id` + `invoice_projects`.)
- **Autocompletar adquirente desde clientes ya facturados:** el endpoint
  `GET /api/invoices/clients-history` devuelve adquirentes distintos de `gcc_world.invoices`
  (excluye consumidor final `9999999999999`) con el `id_type` ya inferido. El patrón de UI
  "Cliente previo" (botón + buscador + lista que rellena los campos) está en
  `dashboard/invoices/page.tsx` y se replicó en `dashboard/projects/[id]/page.tsx`. Si se
  estandariza el modal de **tickets**, aplicar el mismo patrón ahí (pendiente).
- Datos del adquiriente en factura: columnas `client_*_sri` en `gcc_world.invoices`
  (`client_id_type`, `client_ruc`, `client_name_sri`, `client_email_sri`, `client_phone_sri`,
  `client_address_sri`). Códigos SRI tipo id en `lib/integrations/sri/config.ts`
  (04 RUC, 05 cédula, 06 pasaporte, 07 consumidor final, 08 exterior).
- El cliente Prisma vive en `lib/generated/prisma` — importar desde `@/lib/generated/prisma/client`,
  NO desde `@prisma/client`.
- `prisma generate` corre en `postinstall` y en `build`; tras tocar `schema.prisma` regenerar.
- Las tablas que no están en Prisma se creaban con migraciones SQL manuales. Esas migraciones
  (`sql/migrations/`) se **eliminaron el 2026-06-07** (ya aplicadas en prod, no afectan runtime);
  el historial queda en git. Si necesitas el DDL de una tabla, recupéralo de git o de la BD.
- **Carga dinámica en todos lados** (¡cuidado al "limpiar archivos sin uso"!):
  - Assets `public/character/**`, `public/sounds/**`, `public/universal_assets/citizens/**`,
    `public/world/**` se cargan con rutas construidas en runtime (p.ej.
    `\`/character/body/${sheet}/${skin}.png\``). Un grep por nombre NO los encuentra → parecen
    "huérfanos" pero NO lo son.
  - Las rutas `app/api/**` se llaman con URLs dinámicas (`fetch(\`/api/projects/${id}/proforma\`)`).
    Un matcher que normaliza `[id]` da falsos positivos masivos. NO borrar rutas por "sin caller".
  - `data/*.json` son almacenamiento activo (no datos de prueba). NO borrar.
  - Para detectar código muerto real: solo es fiable sobre archivos **importados** (components/lib),
    verificando cada candidato a mano. Ver `Estado actual`.

## Pendientes / preguntas abiertas
- **Commit del rediseño corporativo (fases 1–7):** TODO sin commitear; es un bloque grande (~60+ archivos).
  Falta la luz verde del usuario tras revisión visual.
- **Confirmación visual del usuario:** el dashboard requiere login; las verificaciones de la sesión fueron
  `tsc`/compilación, no visuales. Hay que validar en vivo cada cambio.
- `ModuleToolbar` en los **3 módulos restantes**: `admin` (sub-tabs anidados), `admin/incidents`, `centralized`.
- **¿Restaurar el título de registro en páginas de detalle** (`projects/[id]`, `tickets/[id]`, `support/[id]`)?
  Hoy se quitó junto con el resto vía `PageHeader`.
- Ajustes finos pendientes de feedback visual: factor de recorte del logo (`scale(1.18)`), punto de colapso del
  overflow de pestañas (reserva 44px), íconos elegidos por módulo, nivel del rojo en "Salir".
- Opcional (fidelidad Azure): **footer sticky** con botones primario/secundario en los paneles de formulario.
- **"Cliente previo"**: ya replicado en el modal de completar/facturar **tickets** (`tickets/[id]`) además de proyectos. ✅
