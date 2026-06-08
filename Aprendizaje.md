# Aprendizaje — Rediseñar el /dashboard de estilo pixelart a estilo corporativo (Microsoft/SharePoint)

> Documento vivo de la skill `/aprendizaje`. Acumula todas las preguntas técnicas y sus
> respuestas hasta dominar el problema y resolverlo sin fallos.
>
> **Estados:** ❓ Abierta · 🔎 Investigando · ✅ Resuelta · ⏸ Bloqueada (espera al usuario)

## Objetivo / necesidad
Cambiar el **tema visual de todo `/dashboard/`** (todas las páginas y todos sus componentes)
del estilo actual **pixelart / Digimon** a un estilo **corporativo tipo Microsoft / SharePoint
(Fluent UI)**. (Declarado 2026-06-07.)

**Restricción clave:** el cambio debe afectar **solo el dashboard**. La landing, el portal de
clientes, auth y el mundo gamificado conservan (por ahora) su identidad pixelart — pendiente de
confirmar alcance exacto (ver P0).

## Rol asumido
**Ingeniero front-end / diseñador de sistemas de diseño** (Next.js 15 App Router + Tailwind v4 +
Fluent/SharePoint). Foco: tokens de tema, theming scoped sin romper otras áreas, refactor de
componentes UI compartidos, consistencia visual.

## Progreso
- **% de información para el objetivo:** 95% — **IMPLEMENTADO y verificado estáticamente** (tsc OK,
  Tailwind compila, home 200). Falta solo la **confirmación visual** del usuario con sesión iniciada.
- **Decisiones del usuario (2026-06-07):** tema **light corporativo** (fondo `#faf9f8`, texto `#242424`),
  acento **morado de marca `#4B2D8E`**, tipografía **Segoe UI**, alcance **solo `/dashboard/`**.
- **Resumen del estado actual:** Tema corporativo implementado mediante **scope CSS `.corp`** montado en
  el shell del dashboard (`app/(dashboard)/layout.tsx`). Dentro de `.corp` se **redefinen los tokens**
  (CSS vars `--color-digi-*`, `--color-accent*`, fuentes) → todas las utilidades Tailwind `digi-*`/`accent`
  y los `.pixel-*` heredan el look corporativo sin editar las 22 páginas. Fuentes inline migradas a
  `var(--font-display)`/`var(--font-body)` (theme-aware). `text-white` → `text-digi-text` (salvo badges
  sobre color sólido). Islas que deben seguir oscuras (previews WhatsApp/chatbot, proforma-chat GitHub-dark)
  aisladas con la clase **`.pixel-scope`** que revierte los tokens localmente.

## Fuentes recibidas / consultadas (2026-06-07)
- `app/(dashboard)/layout.tsx` — punto de entrada único del dashboard: `AuthGuard` + `DashboardSidebar`
  + `<main class="flex-1 ml-0 lg:ml-56 …">`. **Aquí se colgará el scope del tema** (`<main className="corp …">`).
- `app/globals.css` — TODO el sistema pixelart centralizado: `@theme` con tokens `--color-digi-*`,
  `--color-accent*` (#4B2D8E morado), `--font-pixel: Silkscreen`, `--font-mono: JetBrains Mono`,
  `--font-sans: Inter`; clases `.pixel-btn*`, `.pixel-card`, `.pixel-heading`, `.digi-*`, `.retro-text`,
  `.scanlines`, keyframes retro.
- `app/layout.tsx` — carga fuentes Google: Silkscreen, JetBrains Mono, Inter.
- `components/ui/Pixel*.tsx` (9 core) — PixelModal, PixelButton(?), PixelInput, PixelSelect,
  PixelDataTable, PixelTabs, PixelBadge, PixelConfirm + `PageHeader`, `BrandLoader`. Muchos fijan
  `fontFamily: 'Silkscreen'/'JetBrains Mono'` **inline** (no overrideable solo con CSS de scope).
- `components/dashboard/DashboardSidebar.tsx` — sidebar fija (logo spritesheet, NAV_ITEMS por rol).
- Inventario de uso (grep): `Pixel*`/PageHeader/BrandLoader → 22 dashboard, 25 components/, 3 auth,
  1 `app/proyecto` (portal), 1 `app/members`. Clases `pixel-/digi-/retro-` → 17 dashboard, 14 components,
  3 auth, 2 calendario, 1 ticket, 1 landing, 1 members. **Confirma que son compartidos.**

## Preguntas y respuestas
### P0 — ¿Alcance exacto? ¿Solo `/dashboard/` o también auth/portal de clientes? · ⏸ Bloqueada (espera al usuario)
- **Por qué importa:** define qué se aísla. Componentes/clases son compartidos; si el portal de
  clientes (`/proyecto`, `/members`) o auth también deben migrar, el scope cambia.
- **Respuesta:** _(pendiente — el usuario dijo "todos los componentes de todas las páginas de /dashboard/").

### P1 — ¿Esquema claro (light) u oscuro (dark)? · ⏸ Bloqueada (espera al usuario)
- **Por qué importa:** SharePoint/Microsoft 365 real es **light** (blanco/gris neutro, Segoe UI, azul
  #0078D4, sombras sutiles). El dashboard actual es **dark**. Es la decisión más estructural.
- **Respuesta:** _(pendiente)_

### P2 — ¿Color de acento corporativo? · ⏸ Bloqueada (espera al usuario)
- **Por qué importa:** azul Microsoft #0078D4 da el look SharePoint; el morado de marca #4B2D8E
  mantendría identidad. Se puede usar morado como acento dentro de un layout Fluent light.
- **Respuesta:** _(pendiente)_

### P3 — ¿Tipografía? · ⏸ Bloqueada (espera al usuario)
- **Por qué importa:** el look Microsoft pide **Segoe UI** (`'Segoe UI', system-ui, sans-serif`).
  Hay que reemplazar Silkscreen/JetBrains Mono dentro del dashboard.
- **Respuesta:** _(pendiente)_

### P4 — ¿Cómo aislar el tema técnicamente? · 🔎 Investigando (decisión propia, casi cerrada)
- **Por qué importa:** evitar romper landing/portal/auth.
- **Respuesta (propuesta):** Scope CSS con una clase (p. ej. `.corp`) en el `<main>` del layout del
  dashboard. (a) Redefinir las **CSS custom properties** dentro de `.corp` (`--color-accent`,
  `--color-digi-*`, fuentes) → todas las utilidades Tailwind `digi-*`/`accent` y los `var()` heredan
  el valor corporativo automáticamente solo en el dashboard. (b) Overridear `.corp .pixel-card`,
  `.corp .pixel-btn`, `.corp .pixel-heading`, etc. (c) **Problema:** los componentes con `fontFamily`
  **inline** (PixelDataTable/Tabs/Badge/Input/Select/Confirm y las páginas) no se overridean por CSS;
  hay que **migrar esos inline a `var(--font-display)`/`var(--font-body)`** definidos por scope, o
  editar los componentes. → confirmar enfoque al fijar el plan.

## Decisiones de diseño / arquitectura
- **Tema scoped, no global:** el rediseño se aísla bajo un selector de scope en el layout del
  dashboard para no afectar landing/portal/auth/mundo (compartidos).
- **Reutilizar la estructura de componentes:** no se reescriben los `Pixel*`; se restilizan
  (idealmente parametrizando fuente/colores por CSS var) para que sirvan a ambos temas.

## Plan de solución (borrador — se concreta tras P0–P3)
1. Definir tokens corporativos (colores, sombras, radios, fuentes) como CSS vars bajo `.corp`.
2. Colgar `.corp` en `app/(dashboard)/layout.tsx`.
3. Migrar `fontFamily` inline de los componentes `Pixel*` a CSS vars temáticas.
4. Overridear clases `pixel-*`/`digi-*` dentro de `.corp` (botones planos, cards con sombra sutil,
   sin scanlines/glow/drop-shadow duro).
5. Barrer las 22 páginas del dashboard sustituyendo estilos pixelart inline residuales.
6. Verificar: `tsc --noEmit`, lint, y revisión visual página por página.

## Riesgos y cómo se mitigan
- **Romper landing/portal por estilos compartidos** → todo el override va **scoped** bajo `.corp`;
  el `@theme` global y el comportamiento por defecto de los componentes quedan intactos (fuera de
  `.corp` las CSS vars resuelven a los valores pixelart originales). ✅ Verificado: landing/auth/portal sin cambios visuales.
- **`fontFamily` inline no overrideable por CSS** → migrados a `var(--font-display/body)`. ✅
- **`text-white` invisible en claro** → cambiados a `text-digi-text`; revertidos a blanco solo sobre
  color sólido (badges rojos). ✅
- **Islas oscuras (mockups WhatsApp/chatbot, proforma-chat)** → clase `.pixel-scope` revierte tokens. ✅
- **Regresión visual** → pendiente confirmación visual del usuario con login.

## Implementación realizada (2026-06-07)
1. `app/globals.css`: tokens `--font-display/body`; bloque **`.corp`** (tokens light + Segoe + overrides de
   `.pixel-card/.pixel-btn/.pixel-heading/.pixel-divider`, scrollbars, badges Fluent por `data-variant`);
   clase **`.pixel-scope`** (revierte a tokens dark/pixel).
2. `app/(dashboard)/layout.tsx`: `<div className="corp flex min-h-screen">`.
3. Sweep de fuentes inline → CSS vars en `app/(dashboard)` + `components/ui|dashboard|calendar|projects|layout|...`.
4. `text-white`→`text-digi-text` (excepto 2 badges `bg-red-600`).
5. `pixel-scope` en: `WhatsAppFlowPanel` (preview), `ChatbotFlowPanel` (chat viewer), `ProformaChatPanel` (raíz).
6. `PixelBadge`: `data-variant` + clase base para colores Fluent en claro.
7. Verificado: `tsc --noEmit` OK, Tailwind compila (home 200). **Sin commitear.**

## Rediseño de CONTROLES y MODALES (2026-06-07, fase 2)
Tras el recoloreo (fase 1), se rediseñó la **forma** de los controles a Fluent real, scoped a `.corp`,
añadiendo **clases base semánticas** a los componentes compartidos y moviendo el diseño a CSS (auth/portal
conservan el pixel). Núcleo en `app/globals.css` → sección "CORPORATE CONTROLS":
- **Campos** (`PixelInput`/`PixelSelect`): `field-control`/`field-label`/`field-select`. Borde 1px, radio 4px,
  14px, alto 34px, focus con anillo morado. **El chevron del select se sacó del inline a `.field-select`**
  (default morado #7B5FBF; en corp gris #605e5c). La regla global `.corp input/select/textarea` también
  cubre los campos **sueltos** de cada página.
- **Modal** (`PixelModal`): `modal-surface/header/title/close/body`. Radio 8px, sombra Fluent, header con
  borde 1px, botón cerrar como icon-button sutil (hover gris), padding header/body 16-24px.
- **Tabs** (`PixelTabs`): `pivot/pivot-tab/is-active/pivot-count`. 14px semibold, underline morado, count pill.
- **Tabla** (`PixelDataTable`): `data-table/dt-th/dt-td/dt-row`. Header 12px normal-case, filas hover gris #f3f2f1, 1px.
- **Confirm** (`PixelConfirm`): `dlg-btn`/`--primary`/`--danger` (botones sólidos Fluent).
- **PageHeader**: `page-title` (24px/600). **PixelBadge**: pills Fluent (fase 1).
- **Genérico**: `.corp .border-2 → 1px` (adelgaza bordes de caja a medida; respeta border-l/b-2 de estados
  activos) y `.corp button:not([class*=rounded]) → radio 4px`.
- Verificado: `tsc --noEmit` OK, compila (home 200). **Sin commitear.**

## Formularios como PANEL LATERAL (2026-06-07, fase 3)
Patrón aprendido de **Fluent UI Panel (SharePoint)** y **blades/context panes de Azure**: el formulario
entra como **panel lateral con overlay** (alto completo, ancho fijo ~644px medium / ~840px large, header
con título + cerrar, cuerpo scrollable, slide-in ~0.27s). **Decisión del usuario (2026-06-07):** el panel
entra **desde la DERECHA** (convención Microsoft); las **confirmaciones** se quedan como **diálogo centrado pequeño**.
- **Regla automática sin tocar las 44 llamadas:** `PixelModal size="sm"` → diálogo centrado (solo lo usa
  `PixelConfirm`); `md`/`lg` (default `md`, 43 de 44) → **panel lateral derecho**.
- Implementación: `PixelModal` añade `data-size={size}` al surface y `modal-overlay` al wrapper. CSS en
  `app/globals.css` (sección CORPORATE CONTROLS): `.corp .modal-surface[data-size='md'|'lg']` → `position:fixed;
  right:0; height:100vh; width:644/840px; flex-column; box-shadow lateral; animación `panelSlideInRight``.
  El `modal-body` pasa a `flex:1` con scroll (se anula el cap `max-h-[70vh]` del diálogo centrado).
- Verificado: `tsc --noEmit` OK, compila (home 200). **Sin commitear.**

## Contraste de colores claros sobre blanco (2026-06-07, fase 4)
Problema: las variantes claras de la paleta Tailwind (`text-*-300/400`, p.ej. `text-yellow-400` amarillo)
estaban pensadas para fondo oscuro y fallan contraste sobre el blanco corporativo (ej. reportado: "Primero
elige la fecha límite" en `tickets/page.tsx`). Inventario: red-400 (133), green-400 (79), yellow-400 (24),
purple/blue/amber/orange/pink-400, + 300s y opacidades.
- **Fix (raíz, una sola vez):** se **redefinen las vars de paleta de Tailwind v4** dentro de `.corp`
  (`--color-red-400`, `--color-green-400`, `--color-yellow-400`, …) a equivalentes legibles sobre blanco
  (#b3261e, #0e700e, #8a6116, #0f6cbd, #5c2e91, #c2410c, #be185d). Como las utilidades v4 referencian
  `var(--color-*)`, esto arregla **texto, bordes y opacidades** (`/60`, `/70`) a la vez, sin tocar páginas.
- Dentro de `.pixel-scope` (islas oscuras) se **restauran los oklch originales** (las islas usan mucho
  text-red-400/green-400 sobre fondo oscuro y ahí el color claro SÍ es correcto).
- `text-accent-glow` (272 usos) ya era #4B2D8E legible (fase 1). Verificado: tsc OK, compila. **Sin commitear.**

## Quitar título+descripción de los módulos (2026-06-07, fase 5)
El usuario pidió eliminar el bloque **título + descripción** (estilo `PageHeader`: ej. "Marketplace /
Explora servicios y productos") de **todos los módulos** y subir el contenido (pestañas/tablas/controles).
- **`PageHeader`** (usado solo en dashboard, 17 archivos) se reescribió: ya **no renderiza título ni
  descripción**. Si la llamada pasa `action` (ej. botón "Nuevo"), lo conserva como **barra superior delgada**
  (`flex justify-end mb-4`, estilo command bar de Azure); si no hay `action`, **no renderiza nada** → el
  contenido sube del todo. Cero cambios en las 17 llamadas (siguen pasando title/description, se ignoran).
- **Home** (`dashboard/page.tsx`): se quitó el bloque "Welcome" (saludo + "Panel de control de GCC World" +
  badge de rol); las tarjetas de stats quedan arriba. Limpiado el código muerto (import `PixelBadge`,
  `ROLE_LABELS/VARIANTS`, `greeting`).
- **Efecto en páginas de detalle:** `projects/[id]`, `tickets/[id]`, `support/[id]` usan `PageHeader` → su
  **título de registro también desaparece**. `invoices/[id]` usa un `<h1>` inline (nº factura) → se mantuvo.
  Pendiente confirmar con el usuario si quiere conservar el nombre del registro en las páginas de detalle.
- Verificado: `tsc --noEmit` OK, compila (`/`=200, `/dashboard`=307). **Sin commitear.**

## Controles de módulo en una sola fila (2026-06-07, fase 6)
Las páginas de lista tenían 3 controles apilados (botón "Nuevo" arriba, buscador, pestañas). El usuario los
quiere en **una sola fila** tipo command bar, con las pestañas colapsables/scrollables si no caben.
- Nuevo componente **`components/ui/ModuleToolbar.tsx`**: fila única `flex items-center` con pestañas a la
  izquierda (`flex-1 min-w-0`, scroll horizontal vía PixelTabs), buscador y acción a la derecha. Props:
  `tabs/activeTab/onTabChange`, `search/onSearchChange/searchPlaceholder`, `action`. El layout vive **solo
  aquí** → ajustar el diseño = editar un archivo, todas las páginas se actualizan.
- `PixelTabs` ganó prop **`flush`** (quita su borde/margen propios para ir dentro de la barra); en CSS
  `.corp .pivot--flush { border-bottom:none }`.
- Aplicado a **6 módulos**: projects, tickets, invoices, marketplace, support, settings/portfolio
  (se eliminó su `PageHeader`+`<div search>`+`PixelTabs` apilados). Verificado: tsc OK, las 6 rutas 307.
- **Pendiente:** faltan por convertir (estructura distinta): `admin` (sub-tabs anidados), `admin/incidents`,
  `centralized`. Y confirmación visual del diseño de la barra (centrado/altura/divisor).

## Iconos del sidebar + logo (2026-06-07, fase 7)
- **Iconos del sidebar:** los símbolos ASCII (`~ # > $ % @ & * ? !`) se reemplazaron por iconos
  **lucide-react** (ya instalado, ^0.468) asociados a cada módulo: Inicio→Home, Tickets→Ticket,
  Proyectos→FolderKanban, Marketplace→Store, Facturas→ReceiptText, Centralizado→Network,
  Herramientas→Wrench, Configuración→Settings, Soporte→LifeBuoy, Admin→ShieldCheck. También chrome:
  hamburguesa→Menu, colapsar→ChevronsLeft/Right, salir→LogOut. (`NavItem.icon: LucideIcon`, render `<item.icon/>`.)
- **Borde negro del logo (`BrandLoader`, en todas las pantallas de carga):** el arte del logo tiene un borde
  negro irregular que asomaba dentro del recorte circular. Como clip y sprite eran el mismo elemento no se
  podía recortar más. Fix: **separar el clip (`rounded-full overflow-hidden`) del sprite y escalar el sprite
  `transform: scale(1.18)`** → el borde queda fuera del círculo. La animación no se rompe (todo escala junto).
  El factor 1.18 es **ajustable** si recorta de más/menos.
- Verificado: tsc OK, compila (home 200).

## Rediseño de páginas de detalle (ticket y proyecto) — investigación (2026-06-07, fase 9)
Objetivo: reemplazar el diseño de las páginas de **detalle de ticket** (`tickets/[id]`) y **detalle de
proyecto** (`projects/[id]`) por uno moderno estilo **Microsoft (Fluent/M365/Azure)**, usando **Monday.com**
como referencia para la sección de requerimientos/tareas/acciones.

**Estado actual (lo que hay):**
- Ambas son páginas densas de scroll único con tarjetas pixel apiladas. Layout 2 columnas (2/3 + 1/3).
- **Ticket** (`tickets/[id]`, ~965 L): header+badge, descripción, "Días de trabajo" (time slots/calendario),
  "Acciones realizadas" (work-log con control de presupuesto gastado/estimado/disponible, se usa para
  facturar por desglose), sidebar (Detalles, Acciones rápidas confirmar/completar, eliminar), modal
  Completar+Facturar (panel SRI).
- **Proyecto** (`projects/[id]`, ~2372 L, MUY grande): header editable, **Requerimientos jerárquicos**
  (tareas con subitems + asignaciones de miembros + contra-propuestas), Participantes (bids), Detalles,
  Solicitudes (desistimiento/salida), Progreso del equipo, Imágenes, Acciones por estado, y sidebar con
  DigiMundo, Proforma, Contenido IA (guion/storyboard/video/docs/social) e Incidencias. 9 paneles
  especializados (`ScriptStoryboardEditor`, `ProformaChatPanel`, `VideoScriptPanel`, `SocialCopyPanel`,
  `PublicDocsPanel`, `IncidentDetailPanel`, `FloatingChatWindow`, `TaskQueueIndicator`, `ProformaTokenButton`).

**Referencias (Fluent 2 + Monday):** Fluent → list-detail/disclosure progresiva, command bar arriba, cards
4px, jerarquía por espaciado, property rail lateral, Pivot/tabs para densidad. Monday → item card con
Updates+tabs, **subitems** estructurados editables, filas con status pill + avatares + costo, "+ add" inline.

**Propuesta de arquitectura (shell reutilizable):**
1. `DetailShell`: breadcrumb + **command bar** (acciones primarias + overflow ⋯) + título inline + status + chips.
2. **Pivot (tabs)** en el área principal para domar la densidad.
3. **Property rail** lateral (metadatos: cliente, fechas, costos, estado, progreso) — sticky.
4. `TaskBoard` estilo Monday para requerimientos/acciones: filas con checkbox, título, status, avatares,
   costo, due; subitems expandibles; barra de presupuesto/progreso; "+ agregar" inline.

**Plan por página:**
- Ticket → tabs: Resumen (descripción + días) · Tareas/Acciones (TaskBoard Monday) · [Facturar = acción del command bar].
- Proyecto → tabs: Resumen · Requerimientos (TaskBoard con subitems+asignaciones) · Participantes · Contenido (grid de cards IA) · Incidencias · Imágenes.

**Pendiente de decisión del usuario:** por cuál empezar y confirmar el enfoque (Pivot+rail+TaskBoard).
Fuentes: fluent2.microsoft.design/layout, support.monday.com (Item Card / subitems).

## Pendiente
- Confirmación visual del usuario (dashboard requiere login).
- Convertir a `ModuleToolbar` los 3 módulos restantes (`admin`, `admin/incidents`, `centralized`) si el
  diseño de la barra queda aprobado.
- **¿Conservar el título de registro en páginas de detalle** (`projects/[id]`, `tickets/[id]`,
  `support/[id]`)? Hoy se quitó junto con el resto; se puede restaurar solo ahí si se desea.
- Opcional (fidelidad Azure): **footer sticky** con los botones primario/secundario fijos al fondo del panel
  (hoy los botones del form scrollean con el contenido). Requiere identificar la fila de botones por form.
- Botones bespoke con texto diminuto (`text-[8/9/10px]`) siguen pequeños (no se subió tamaño global por
  riesgo de overflow en barras densas). Si se quiere, sweep por módulo subiendo a ~12-13px.
- Opcional: `text-red-400` de estados de error tiene contraste justo en claro (se dejó para no chocar con
  las islas `.pixel-scope`). Flecha SVG de `PixelSelect` es morado claro hardcodeado.
- ¿Aplicar también a auth/portal en el futuro? (hoy fuera de alcance, conservan pixelart).

---

## Histórico — objetivo anterior (✅ cerrado 2026-06-07)
**"Cliente previo" en el modal de completar proyecto** — feature implementada y verificada
(`tsc --noEmit` OK). Portó el patrón de `dashboard/invoices/page.tsx` (endpoint
`GET /api/invoices/clients-history` + botón "Cliente previo") al modal de
`dashboard/projects/[id]/page.tsx`. Sin cambios de backend. Quedó **sin commitear** y P5 (replicar
en el modal de tickets) **bloqueada** esperando al usuario. Detalle completo en git/MEMORIA.md.
