# Sistema de diseño — GCC World

> Fuente de verdad del ESTILO: tokens, reglas y el estándar de los controles. Se mantiene
> vivo. El diseño está VINCULADO: cambiar la fuente única propaga a toda la sección.
> Contexto de proyecto → `MEMORIA.md`.

La app tiene **tres lenguajes visuales** distintos (intencional):
1. **Landing / juego (pixelart oscuro):** fuente `Silkscreen`/`JetBrains Mono`, `var(--color-accent)`,
   clases `pixel-btn`, sombras duras. En `app/page.tsx`, `components/landing/*`, `app/globals.css`.
2. **Dashboard:** Next.js + Tailwind, **Microsoft Fluent claro** scoped en **`.corp`** (montado en
   `app/(dashboard)/layout.tsx`). Ver sección "Dashboard — Fluent (`.corp`)".
3. **Editor del mundo (Microsoft Fluent):** claro, `system-ui/Segoe UI`, azul `#0078d4`. **Este doc se
   centra aquí** (es lo estandarizado en 2026-06-28).

---

## Editor del mundo — Fluent (estandarizado)

### Stack de estilos
- **Inline styles** (no Tailwind) en `components/landing/world/*`. Fuente única de estilo:
  **`components/landing/world/editorUi.tsx`** (tokens + controles reusables) y
  **`components/landing/world/EditorIcons.tsx`** (íconos SVG de línea, 20×20, `currentColor`).
- Editores: `SceneManagerEditor.tsx` (contenedor + nav rail + sección Escenas), `MapEditor.tsx`
  (sección Capas/assets), `NpcEditor.tsx` (sección NPCs, embebida), `CinematicEditor.tsx`.

### Configuración global de color (fuente única) — objeto `E` en `editorUi.tsx`
`accent #0078d4` · `accentHover #106ebe` · `accentSoft #f3f9fd` · `surface #ffffff` ·
`canvas #faf9f8` · `subtle #f3f2f1` · `selected #deecf9` · `border #edebe9` ·
`borderStrong #d1d1d1` · `text #323130` · `textSoft #605e5c` · `textMuted #a19f9d` ·
`danger #a4262c` · `dangerSoft #fde7e9` · `radius 4`. **Cambiar un color aquí recolorea todo el
editor.** Regla: **NO** hex crudos nuevos en los componentes del editor → usar `E.*`.

### Tipografía
`system-ui, -apple-system, 'Segoe UI', sans-serif`. Título de sección: `0.78rem`,
`letterSpacing 0.14em`, uppercase, `weight 600`, color `accent`.

### Cómo está vinculado (single source of truth) — `editorUi.tsx`
| Control | Componente reusable | Usado en |
|---|---|---|
| Encabezado de sección | `PanelHeader` (title + actions + children) | Escenas, NPCs, Capas |
| Botón | `EditorButton` (variant primary/secondary/danger, icon) | Escenas, NPCs |
| Filtros segmentados | `SegmentedTabs` | Capas (Tiles/Items/Props/Colores) |
| Buscador | `SearchInput` | Capas |
| Fila de lista seleccionable | `ListRow` (active, icon, title, subtitle) | NPCs (escenas: estilo equivalente) |
| Estado vacío | `EmptyState` | Escenas, NPCs |
| Nav rail lateral | `SidebarTabButton` (SceneManagerEditor) | Escenas/NPCs/Capas/Cerrar |

**Regla:** un control nuevo del editor se define en `editorUi.tsx` y se referencia; no recomponer
estilos ad-hoc por archivo.

### Catálogo (estándar)
- **Nav rail (Fluent):** ancho 72px, vertical, **icono SVG + etiqueta** por sección, indicador de
  selección (barra azul 3px) + fondo `accentSoft`. Items: Escenas, NPCs, Capas, (spacer), Cerrar.
- **PanelHeader:** título uppercase azul + zona de acciones; debajo, contenido (botones/buscador).
- **EditorButton:** primario = azul `accent`/hover `accentHover`, **texto blanco**; secundario = blanco
  borde `borderStrong`; peligro = texto `danger`. Siempre con ícono opcional a la izquierda.
- **SegmentedTabs:** botones `flex:1`, activo azul sólido texto blanco, inactivo blanco texto `textSoft`.
- **ListRow:** activo `selected` + borde-izq azul; hover `subtle`. title (600) + subtitle (`textSoft`).
- **Íconos:** SVG de línea de `EditorIcons.tsx` (`IconScenes/Npcs/Layers/Map/Film/Add/Edit/Up/Down/
  Delete/Close/Location/Bolt/Warning`), grosor 1.6, `currentColor`. **NO emojis.**

### Reglas clave (do / don't)
- **NO** emojis como íconos → usar `EditorIcons` (SVG).
- **NO** hex crudos en componentes del editor → usar tokens `E.*`.
- **NO** recomponer botones/headers ad-hoc → usar `editorUi`.
- Texto **blanco** sobre fondos azules (contraste).
- Las tres secciones (Escenas/NPCs/Capas) comparten header, botones, íconos y listas.

---

## Dashboard — Fluent (`.corp`)

### Stack y fuente única
- Todo el dashboard se monta bajo el scope **`.corp`** (`app/(dashboard)/layout.tsx`), que en
  `app/globals.css` (bloque `.corp`, ~L684–990) **reescribe** las clases pixel/`digi-*` a Fluent
  claro. Cambiar los tokens ahí recolorea todo el dashboard.
- **Tokens (light):** `--color-accent #4B2D8E` (morado marca) · `--color-accent-hover #3A1F7A` ·
  `--color-accent-light #EDEBFA` · `--color-digi-card #ffffff` (tarjetas/sidebar/thead) ·
  `--color-digi-text #242424` · `--color-digi-muted` · `--color-digi-border`. Fondo shell `#faf9f8`.
  Fuente **Segoe UI**. Radios 4–6px. **Regla:** usar utilidades de estos tokens
  (`bg-accent`, `hover:bg-accent-hover`, `bg-accent-light`, `text-accent`, `bg-digi-card`,
  `border-digi-border`, `text-digi-muted`) — **no** hex crudos.

### Componentes compartidos (una definición por control)
| Control | Componente | Notas |
|---|---|---|
| Título de página | `components/ui/PageHeader` | title + description |
| Command bar de módulo | `components/ui/ModuleToolbar` | pivot tabs izq · buscador + acción der |
| Tabs (pivot) | `components/ui/PixelTabs` (`flush`) | `.corp .pivot` subrayado azul marca |
| Tabla | `components/ui/PixelDataTable` | `.corp .data-table`; `onRowClick`, orden por columna |
| Badge/estado | `components/ui/PixelBadge` | variantes success/warning/error/info/default |
| Modal / Panel | `components/ui/PixelModal` | md/lg se vuelven **panel lateral derecho** (Fluent) |
| Input / Select | `components/ui/PixelInput` · `PixelSelect` | `.corp .field-control` alto 34px |
| Rail de propiedades | `components/ui/PropertyRail` | panel sticky de metadatos clave/valor |
| Header de detalle | `components/ui/DetailHeader` | breadcrumb + título + command bar + overflow ⋯ |
| Confirmar | `components/ui/PixelConfirm` | NO usar `confirm()` del navegador (excepción puntual) |
- **Iconografía dashboard:** **`lucide-react`** (línea monocromo, serио tipo Microsoft), `currentColor`,
  16–20px. Es el estándar del dashboard (sidebar, tablas, command bars). **NO emojis.**

### Patrón "Explorador Azure" (rail + lista + panel) — estándar para módulos con jerarquía
Adoptado 2026-07-05 en **Centralizado** (`app/(dashboard)/dashboard/centralized/page.tsx`) para
navegar el **Modelo 4P** (16 celdas = 4 Pisos × 4 Pasos, cada una con N *sistemas*). Layout
`grid lg:grid-cols-[220px_minmax(0,1fr)_300px]`:
- **Rail izquierdo (Fluent nav):** tarjeta `bg-digi-card`; ítems con icono lucide + label + hint +
  badge de conteo; activo = `bg-accent-light` + borde-izq `border-accent` + texto `accent`. Aquí van
  los **Pisos** + "Todos".
- **Centro:** *command bar* (buscador con icono `Search` + `select` de filtro por Paso + botón
  primario `+ Nuevo` solo admin) sobre un `PixelDataTable` (columnas Sistema[icono+nombre+desc] ·
  Piso · Paso · Acceso[👥 n] · Estado[badge]); `onRowClick` selecciona.
- **Panel derecho (detalle):** tarjeta sticky con cabecera (icono+nombre+celda+cerrar), metadatos
  clave/valor, y acciones (**Abrir sistema** primario; admin: Compartir/Editar/Activar/Eliminar).
  Estado vacío cuando no hay selección.
- **Abrir** hace drill-in (reemplaza el centro por la vista del sistema, con breadcrumb). Cuando un
  sistema crezca (p. ej. Aprobación de candidatos) migrará a ruta propia `centralized/[id]`.
Reusar este patrón para otros módulos jerárquicos del dashboard.

**Módulos que lo usan:**
- **Centralizado** (`centralized/page.tsx`) — rail = Pisos (Modelo 4P); drill-in = vista del sistema.
- **Automatizaciones** (`components/dashboard/flows/FlowsTable.tsx`, 2026-07-05) — rail = **tipos de
  flujo** (Email/WhatsApp/Chatbot/Agente IA/Personalizado, iconos lucide `Mail/MessageCircle/Bot/
  Sparkles/Puzzle`); filtro command bar = **estado**; el botón **Configurar** del panel abre los
  editores grandes (`WhatsAppFlowPanel`/`ChatbotFlowPanel`/`FlowSidePanel`) como drill-in overlay.
- **Configuración** (`settings/page.tsx`, 2026-07-05) — **variante rail + contenido** (sin panel de
  detalle, porque no hay lista de registros): rail = secciones de ajustes (Perfil, Cuenta) como
  botones que cambian el contenido in-page + enlaces de miembro (Disponibilidad/CV/Portafolio/
  Calendario) como `RailLink` con chevron que navegan a subpáginas. Iconos lucide
  `User/CalendarClock/FileText/Briefcase/CalendarDays`. Es la adaptación del patrón para módulos de
  ajustes (estilo settings de M365/Azure). **La sección "Cuenta" se fusionó dentro del formulario de
  Perfil** (tras Redes sociales), ya no es un ítem de rail. La subpágina **Disponibilidad**
  (`settings/availability`) se llevó a corp: breadcrumb, tarjeta corp, toggle Activo/Inactivo en pill
  accent, inputs `field-control`.
- **Herramientas** (`tools/page.tsx`, 2026-07-05) — **variante galería de tarjetas** (estilo M365 app
  launcher): buscador + grid de tarjetas Fluent (icono `bg-accent-light` + nombre + descripción +
  "Abrir →"); cada tarjeta abre un modal-utilidad. Se usa cuando el módulo es un puñado de acciones/
  apps, no registros ni jerarquía. Modales restilizados a corp (dropzone `UploadCloud`, barra de
  progreso `bg-accent`, resultado con `CheckCircle2` + descarga primaria).

- **Tickets** (`tickets/page.tsx` + `tickets/[id]/page.tsx`, 2026-07-05) — **rail + lista** (2 paneles,
  sin panel de detalle: el detalle es página propia). Rail = **estado** (Todos/Pendientes/Confirmados/
  Completados/Cancelados, iconos `Inbox/Clock/CircleCheck/CheckCircle2/XCircle`) con **conteos** que
  vienen del API (`GET /api/tickets` ahora devuelve `counts` por estado). Fila → navega a la página de
  detalle. **Detalle** (`[id]`): ya usaba `DetailHeader` + `PropertyRail`; se de-pixelaron los formularios
  asociados (crear/editar ticket, calendario de días, registro de acciones, **modal Completar + factura
  SRI**, eliminar) a corp — se neutralizó la fuente pixel (`pf → var(--font-body)`), tamaños legibles,
  badges de estado en español, verdes/rojos corp, botones `pixel-btn`.

- **Proyectos** (`projects/page.tsx` + `projects/[id]/page.tsx`, 2026-07-05) — lista = **rail
  (Alcance: Mis proyectos/Invitado según rol · Estado) + lista**, con conteos del API (`GET
  /api/projects` devuelve `counts` respetando el control de acceso por rol). Detalle: header con
  botones `Button` compartidos + iconos, estado en español, y **de-pixelado completo** de sus
  formularios (invitar, propuesta/bid, requerimientos, asignación, y el **modal Completar + factura
  SRI**): `pf → var(--font-body)`, tamaños ≥11px, verdes/rojos/ámbar corp. El detalle usa **rail de
  secciones** (Resumen/Requerimientos/DigiMundo/Imágenes, iconos `LayoutList/ListChecks/Boxes/Image`)
  · contenido · panel PROPIEDADES (ancho fijo), igual que Tickets.

- **Suscripciones** (`subscriptions/page.tsx`, 2026-07-05) — **rail + lista + panel**: rail = estado
  (Todas/Activas/Pausadas/Canceladas, iconos `Layers/CheckCircle2/PauseCircle/XCircle`) con conteos del
  API (`GET /api/subscriptions` devuelve `counts`). El detalle de **meses** (antes un modal) ahora es el
  **panel de detalle derecho** (360px): meta, estado, error de cobro, lista de meses con Marcar pagado/
  Desmarcar/PDF y eliminar. Modal de creación restilizado a `PixelSelect`/`PixelInput`.

- **Marketplace** (`marketplace/page.tsx`, 2026-07-05) — **variante rail (categorías) + tabla**: rail =
  catálogo (Proyectos/Productos/Automatizaciones/Mis pedidos, iconos `FolderKanban/Package/Workflow/
  ShoppingBag`) como navegación (sin conteos; cargan por pestaña). Command bar con buscador; tablas
  `PixelDataTable` por categoría de-pixeladas (precios `text-accent`, botones Solicitar/Comprar corp,
  avatares `bg-accent-light`); estado de pedido en español; modales (galería, comprar, solicitar,
  pedido) a corp.

- **Clientes** (`clients/page.tsx`, 2026-07-05) — **rail + lista + panel**: rail = **tipo de
  identificación** (Todos/RUC/Cédula/Pasaporte/Consumidor Final/ID Exterior, iconos `Users/Building2/
  Contact/BookUser/UserRound/Globe`) con conteos calculados en cliente. El detalle (antes modal con
  pestañas) es el **panel de detalle derecho** (400px) con toggle segmentado **Datos/Consumos**: form
  editable + país (buscador), y consumos (totales + facturas con Origen/Factura). Resumen de total
  facturado movido a una línea bajo la tabla (se quitó la barra fija inferior). Modal de creación a
  campos `field-control`/`labelCls`.

- **Facturas** (`invoices/page.tsx` + `invoices/[id]/page.tsx`, 2026-07-05) — lista = **rail (estado:
  Todas/Pendientes/Enviadas/Pagadas/Fallidas/Canceladas, iconos `Receipt/Clock/Send/CheckCircle2/
  XCircle/Ban`) + tabla**, con conteos del API (`GET /api/invoices` devuelve `counts` global por estado);
  estado SRI y de factura en español; el **modal Factura Manual (SRI)** de-pixelado (mismos patrones que
  tickets). Detalle: **`DetailHeader`** (breadcrumb + nº factura + badges SRI/estado + **acciones en la
  command bar** con overflow ⋯) · contenido (tabla de ítems) · **rail derecho** (Detalles, SRI con copiar
  clave/autorización, rechazo SRI, comprobante de pago). Se movieron las acciones del stack de botones de
  la sidebar a la command bar del header (modelo de Tickets/Proyectos).

**Botón estándar del dashboard:** `components/ui/Button.tsx` — `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER`
(clases componibles) y `<Button variant icon>`. Es la fuente única del botón Fluent; reusar en todos
los módulos (evita `pixel-btn` ad-hoc en el header de detalle).

**Cuándo usar cada variante:** lista de registros con dimensión de agrupación → **rail + lista +
panel** (Centralizado, Automatizaciones) o **rail + lista** si el detalle es página propia (Tickets,
Proyectos). Ajustes con secciones → **rail + contenido** (Configuración). Puñado de acciones/apps →
**galería de tarjetas** (Herramientas).

---

## Desviaciones detectadas y resolución
- **2026-06-28:** las secciones del editor tenían títulos, botones de filtros e íconos distintos
  (emojis genéricos; NPCs con estilo propio). **Resuelto:** se creó `editorUi.tsx` (fuente única) +
  `EditorIcons.tsx`, y se migraron Escenas, NPCs y Capas al mismo estándar Fluent. NPCs pasó de editor
  aparte a **pestaña** del editor. Se quitó el botón "NPCs" del HUD del juego (acceso solo por el editor).
- **2026-07-05 — Centralizado fuera del estándar del dashboard:**
  `app/(dashboard)/dashboard/centralized/page.tsx` construía la matriz 4×4 y la vista de sistema con
  **clases pixelart crudas** (`text-accent-glow`, `bg-digi-darker`, `border-accent/40`, tipos
  `[8px]/[9px]`, `var(--font-display)`) → look oscuro/neón inconsistente con el resto del dashboard
  `.corp`. **Resuelto:** rediseñado al patrón **Explorador Azure** (rail Pisos + lista + panel de
  detalle) con tokens `.corp`, iconos `lucide-react` y componentes compartidos; se documentó el
  patrón arriba. Backend: `GET /api/centralized/systems` ahora devuelve `access_count`.
- **Pendiente:** auditar el resto del **dashboard** en detalle (documentar cada control) y migrar las
  listas internas de `MapEditor` (categorías de sheets, capas) a `ListRow` para consistencia total.
