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
| Menú de acciones (⋮) | `components/centralized/ActionsMenu` | botón solo-icono `MoreVertical` → menú desplegable de acciones (items `{label,icon,onClick,danger,disabled}`); cierra al clic fuera. Reemplaza botones sueltos en cabeceras de detalle |
| Lista de usuarios | `components/centralized/UsersList` | candidatos + miembros en **2 grupos colapsables**; selección única (`SelectedUser`). Reusada por Horario de Vida y Apoyo y Autoayuda |
- **Iconografía dashboard:** **`lucide-react`** (línea monocromo, serио tipo Microsoft), `currentColor`,
  16–20px. Es el estándar del dashboard (sidebar, tablas, command bars). **NO emojis.**
- **Botón cerrar (X) junto a acciones:** ambos como botones **32×32** (`w-8 h-8 flex items-center
  justify-center rounded-md`) en un contenedor `flex items-center` para que queden a la misma altura.

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

- **Admin** (`admin/page.tsx` + subrutas `incidents`/`world`/`sprites`/`digimundo-projects`, 2026-07-05)
  — **variante rail + contenido** (como Configuración): rail de secciones (Equipo/Clientes/Postulaciones/
  DigiMundo, iconos `Users/UserRound/UserPlus/Gamepad2`). DigiMundo usa un **segmented control** para sus
  sub-vistas (Dashboard/Mundo/Proyectos/Incidentes/Sprites). Tablas de-pixeladas (Equipo/Clientes/
  Postulaciones/Incidentes) con badges + labels en español; **Postulaciones** con acciones Aprobar
  (verde)/Rechazar (rojo) con icono y aviso en banner corp; **DigiDashboard** con StatCards de icono.
  Los **editores de Proyectos y Sprites** (`(main)/projects/page.tsx`, `(main)/sprites/page.tsx` +
  subcomponentes `components/sprites/*` y `components/shared/{DropZone,AnimatedSprite}`) fueron
  **reformulados a Fluent maestro-detalle** (2026-07-05): se quitó `font-pixel` (→ `font-semibold`) y el
  tema **verde `digi-green` pasó al `accent` de marca**; **amber/red se conservan** (los remapea `.corp`
  a tonos legibles claro/oscuro). Ambos son ahora **lista (izq) + editor a ancho completo (der)** y se
  muestran **como parte de la página** (sin marco incrustado): **Proyectos** = lista de proyectos +
  editor del **árbol** módulo→sección→subsección (edición inline con foco visible, chips de conteo,
  "Guardar" global, botones "agregar" punteados); **Sprites** = lista de ciudadanos + editor del
  ciudadano (escala, flip, hoja de caminado, animaciones, Ajustar frames/Y-shift) que fluye con el scroll
  de la página. El **`WorldViewer`** (visor de mundo) sí **mantiene su identidad pixelart**. Subrutas con
  breadcrumb corp (`ChevronLeft`).
- **Soporte** (`support/page.tsx` + `support/[id]/page.tsx`, 2026-07-05) — lista = **rail (estado:
  Todos/Abiertos/En proceso/Resueltos/Cerrados, iconos `LifeBuoy/DoorOpen/Loader/CheckCircle2/Archive`)
  + lista + panel de vista previa**, con conteos del API (`GET /api/support` devuelve `counts`),
  `singleLine` y estado como **punto de color** en el asunto. Detalle: `DetailHeader` (breadcrumb +
  asunto + badges tipo/estado + acciones **Resolver**/**Cerrar** en la command bar) · **hilo de
  conversación** (tarjetas corp con avatar `rounded-full`, componente `MessageCard`) + formulario de
  respuesta · **`PropertyRail`** de detalles a la derecha (ancho completo, sin `max-w`). Estados en
  español.
- **Facturas** (`invoices/page.tsx` + `invoices/[id]/page.tsx`, 2026-07-05) — lista = **rail (estado:
  Todas/Pendientes/Enviadas/Pagadas/Fallidas/Canceladas, iconos `Receipt/Clock/Send/CheckCircle2/
  XCircle/Ban`) + tabla**, con conteos del API (`GET /api/invoices` devuelve `counts` global por estado);
  estado SRI y de factura en español; el **modal Factura Manual (SRI)** de-pixelado (mismos patrones que
  tickets). Detalle: **`DetailHeader`** (breadcrumb + nº factura + badges SRI/estado + **acciones en la
  command bar** con overflow ⋯) · contenido (tabla de ítems) · **rail derecho** (Detalles, SRI con copiar
  clave/autorización, rechazo SRI, comprobante de pago). Se movieron las acciones del stack de botones de
  la sidebar a la command bar del header (modelo de Tickets/Proyectos).

- **Sidebar del dashboard** (`components/dashboard/DashboardSidebar.tsx`, 2026-07-05) — nav **agrupada**
  en secciones (Principal · Operación · Plataforma · Sistema) con etiquetas `uppercase` tenues; ítems
  Fluent (Segoe, `text-[13px]`, `rounded-md`, activo = `bg-accent-light text-accent` + barra izq accent),
  iconos lucide 18px. Marca con logo + "GCC WORLD" semibold. Usuario con avatar `rounded-full` + rol.
  Colapsar/Salir corp (Salir en rojo). Filtra por rol y **oculta grupos vacíos**.
- **Inicio** (`dashboard/page.tsx`, 2026-07-05) — saludo por hora ("Buenos días, {nombre}") + grid de
  **StatCards con chip de icono** (Tickets/Proyectos/Clientes en accent; Ingresos/Egresos/Ahorro en
  verde/rojo/accent). Tabla financiera de-pixelada; **modal de estado mensual** (ingresos/egresos
  editables + resúmenes de ahorro) a corp (`field-control`, `+ Ingreso/Egreso`, botones `pixel-btn`).

**Botón estándar del dashboard:** `components/ui/Button.tsx` — `BTN_PRIMARY`/`BTN_SECONDARY`/`BTN_DANGER`
(clases componibles) y `<Button variant icon>`. Es la fuente única del botón Fluent; reusar en todos
los módulos (evita `pixel-btn` ad-hoc en el header de detalle).

**Badges / Tags — estilo Fluent "serio" (2026-07-05):** `components/ui/PixelBadge` es la fuente única
de TODAS las etiquetas del dashboard (estados de tickets/proyectos/facturas, columna **SRI**, tags de
detalle, etc.). Se rediseñó a estilo Azure/M365: **píldora neutra** (fondo `#f3f2f1`, sin borde) +
**punto semántico** (`.pixel-badge-dot`, `bg-current`) + **texto semántico** (verde/ámbar/rojo/accent),
fuente body 11px. Los colores viven en `.corp .pixel-badge[data-variant]` (globals.css) — cambiar ahí
recolorea todas las etiquetas. **NO** crear tags ad-hoc: usar `<PixelBadge variant>`.

**Modo oscuro del dashboard (`.corp.dark`, 2026-07-05):** el layout (`app/(dashboard)/layout.tsx`)
mantiene el estado `dark` (persistido en `localStorage 'gcc_dash_theme'`) y añade la clase `dark` al
shell `.corp`; el toggle (Sol/Luna) vive al pie del sidebar (`DashboardSidebar` recibe `dark` +
`onToggleTheme`). Arquitectura: **`.corp.dark` REDEFINE los tokens** (`--color-digi-*`, `--color-accent*`,
paleta `--color-*-400`) → todos los utilitarios `digi-*`/`accent` y `var(--…)` se adaptan solos. Los
pocos **literales Tailwind hardcodeados** usados en los módulos se sobreescriben en `.corp.dark`
(`bg-white`, `bg-black/[0.0x]`, `bg-green-50`/`red-50`/`amber-50`, `text-green/red/amber-6/700`,
`border-*-300`, `bg-green/red-600`, `bg-[#f3f2f1]`…) y las reglas `.corp` con blanco fijo
(`.pixel-card`, `.pixel-btn-secondary`, `.modal-close:hover`, `.dt-row:hover`). **Regla:** preferir
tokens `digi-*`/`accent` sobre literales; si usas un literal semántico, verifica que tenga override en
`.corp.dark`. **Gotcha:** en comentarios CSS evitar la secuencia `*/` (p. ej. escribir "digi- y accent",
no "digi-*/accent") — cierra el comentario y rompe el build.

**Panel de vista previa en listas + galería (2026-07-05):** estándar en listas cuyo detalle es página
propia (Tickets, Proyectos, Facturas) y en catálogos (Marketplace): al hacer **click en una fila** se
selecciona y se abre un **panel de detalle a la derecha** (340–360px, sticky) con un resumen (metadatos
+ badges) y un botón primario **"Ver detalle/factura"** que navega a la página completa (`ArrowRight`).
Marketplace añade una **galería de imágenes** con controles prev/next: `components/ui/ImageGallery`
(imagen + flechas + indicadores + contador; click abre la galería a pantalla completa). Regla: las
filas ya **no** navegan directo; seleccionan → panel → botón. Reusa el layout `grid
xl:[minmax(0,1fr)_340px]` list · panel.
- **El panel puede cargar el detalle on-demand** (fetch a `/api/<módulo>/[id]`) para mostrar más que la
  fila: **Proyectos** → barra de avance de requerimientos + lista compacta (título truncado + avatar del
  asignado, sin nombre); **Tickets** → barra de presupuesto/avance + días de trabajo + acciones. Ambos
  ofrecen **acceso a la factura** desde el panel (botón "Ver factura", se quitó la columna Factura de las
  tablas). Tablas con muchas columnas usan `singleLine` (una línea + elipsis, no crecen con el texto).
- **Tablas/listas densas:** preferir avatar + tooltip (`title` o hover) en vez de nombres completos; en
  Participantes de proyecto los requerimientos del bid van en un **tooltip** ("N req." al hover), no como
  chips inline. Filas de requerimiento compactas (padding reducido, sin etiqueta de nombre del miembro).

**Estado como punto de color en tablas (2026-07-05):** para ahorrar espacio, en las tablas de lista se
**quita la columna "Estado"** y el estado se muestra como un **punto de color** (`w-2 h-2 rounded-full`)
antes del texto principal, con **tooltip** (`title`) del estado. El color sale de un mapa
`STATUS_DOT` por variante (`success→bg-green-500`, `warning→bg-amber-500`, `error→bg-red-500`,
`info→bg-accent`, `default→bg-digi-muted`). Usado en Tickets/Proyectos/Suscripciones/Facturas/Soporte.
El panel de detalle sigue mostrando el badge completo. En **Suscripciones** el círculo refleja el
**estado de cobro** (vencido/por vencer/al día) y el estado activo/pausado/cancelado se distingue con
**relleno de fila** vía el prop **`rowClassName(item)`** de `PixelDataTable` (pausada `bg-amber-50`,
cancelada `bg-red-50 opacity-60`).
- **`PixelDataTable` props útiles:** `singleLine` (una línea + elipsis, table-fixed), `rowClassName(item)`
  (clases por fila, p. ej. relleno por estado), `bottomReserve` (acorta la altura dinámica para dejar
  visible un pie de tabla —p. ej. el recuento de totales de Clientes— sin scroll), `sortBy/sortDir/onSort`.

**Variante maestro-detalle (lista + editor a ancho completo, 2026-07-05):** para **editores** de un
registro a la vez (los editores DigiMundo: Proyectos, Sprites): `grid lg:[260-280px_minmax(0,1fr)]` con
**lista seleccionable** a la izquierda (ítem = avatar/inicial o icono + nombre + subtítulo mono + chip de
conteo; activo = `bg-accent-light` + barra izq accent) y **panel de edición a ancho completo** a la
derecha. Se prefiere sobre grillas de tarjetas/kanban cuando cada registro tiene muchos controles.

**Aprovechamiento del espacio — sin `max-w` flotante (2026-07-05):** las páginas del dashboard **no**
deben quedar flotando centradas con `max-w-*`; deben ocupar todo el ancho disponible (rail + contenido
a ancho completo). Se quitaron los `max-w-*` de Perfil, Disponibilidad, CV, Calendario, detalle de
soporte y detalle de factura. Excepción: formularios internos dentro de una tarjeta pueden acotar su
ancho, pero la página contenedora llena la pantalla.

**Presentación numérica es-ES (2026-07-05):** **fuente única `lib/format.ts`** (`fmt2`, `fmtNum`,
`fmtInt`, `money`, vía `Intl.NumberFormat('es-ES')`) → miles con `.` y decimales con `,` (`$1.234,56`).
**Regla:** al mostrar cantidades en la UI usar estos helpers, **no** `.toFixed()` crudo. **NO** aplicar
en `app/api` (el **XML del SRI** y los **PDFs** exigen **punto decimal**) ni en los editores `(main)`
(números acoplados a **CSS**: px/%/keyframes); tampoco a IDs/nº de factura/años (no son cantidades).

**Vitrina de tarjetas (storefront) — Marketplace (2026-07-05):** catálogo tipo tienda: **rail de
categorías** ("Catálogo": Proyectos/Productos/… + Mis pedidos) + buscador + **grid de tarjetas**
(`grid md:grid-cols-2 2xl:grid-cols-3`) + **panel de detalle** derecho al seleccionar (con
`ImageGallery`). Tarjeta = media 16/9 (imagen `object-cover` o **placeholder** con icono de categoría +
chip de tipo + **contador de fotos**→galería), título (`line-clamp-2`), **precio** destacado, descripción,
tags, miembro/equipo (avatares), y **acción** primaria (Solicitar/Comprar/Editar). **Regla:** el bloque
inferior (meta + acción) se ancla con **`mt-auto`** y el grid estira las tarjetas a igual alto → **el
botón queda siempre en la misma posición** sin importar el largo de la descripción. Miniaturas: si el
listado no trae imágenes eager, el API devuelve una **`cover_image`** (evita fetch por tarjeta).
Portafolio reusa este catálogo (rail) pero con **tabla + panel** (no grid) — mismo rail "Catálogo".

**Barra de ruta (breadcrumb) fija — dashboard (2026-07-05):** `components/dashboard/DashboardBreadcrumb`
montado en `app/(dashboard)/layout.tsx`: barra `fixed bottom-0` (offset `lg:left-16/56` que reflowe con
el colapso del sidebar) con la ruta actual (Inicio › Sección › Subpágina), ids como `#n`, segmentos
intermedios enlazables. `main` lleva `pb-12` para no taparse.

**Cuándo usar cada variante:** lista de registros con dimensión de agrupación → **rail + lista +
panel** (Centralizado, Automatizaciones) o **rail + lista** si el detalle es página propia (Tickets,
Proyectos). Ajustes con secciones → **rail + contenido** (Configuración). Catálogo tipo tienda →
**vitrina de tarjetas** (Marketplace) o **rail + tabla + panel** (Portafolio). Puñado de acciones/apps →
**galería de tarjetas** (Herramientas). **Editor de un registro a la vez** con muchos controles →
**maestro-detalle** (lista + editor a ancho completo; editores DigiMundo).

---

### Grafo de conocimiento (canvas oscuro + panel "glass") — estándar para relaciones tipo Obsidian
Adoptado 2026-07-07 en **Apoyo y Autoayuda** (`components/centralized/apoyo/KnowledgeGraph.tsx`,
`ApoyoAutoayudaSystem.tsx`). Para visualizar entidades conectadas (situaciones/problemas/causas/
soluciones) tipo *graph view* de Obsidian.
- **Librería:** **`react-force-graph-2d`** (motor **d3-force** + render **canvas**, misma arquitectura
  que Obsidian —cerrado— que usa d3-force + PIXI/WebGL). Se **carga solo en cliente** (`import()` en
  `useEffect` + render del componente real; `next/dynamic` NO reenvía refs, y el `ref` se necesita para
  `d3Force`/`zoomToFit`/`zoom`). Mide **ancho y alto** del contenedor con `ResizeObserver`.
- **Lienzo:** fondo **negro** (`#000000`). Los nodos aportan el color; **NO** poner nebulosa/tinte de
  fondo (se probó morado y tapaba/desentonaba).
- **Iconos de DIMENSIÓN (consistentes app-wide):** cada dimensión usa **el mismo icono lucide** en todas partes —
  Laboral=`Briefcase`, Corporal=`Dumbbell`, Mental=`Brain`, Social=`Users`— con su color de `DIMENSION_COLOR`. En el
  **grafo** (canvas) el badge del problema pre-renderiza el icono a imagen (`renderToStaticMarkup` → data-URL → `drawImage`,
  dark para contraste; letra L/C/M/S como respaldo mientras carga); en el **Horario de Vida** (chips de tarea manual) se usa el
  componente lucide coloreado. Regla: si cambias el icono de una dimensión, cámbialo en ambos (mapa `DIM_ICON`/`DIM_ICON_COMP`).
- **Badge de ASOCIACIÓN en el grafo:** una alternativa/solución con ticket o proyecto asociado lleva un **badge celeste** con el
  **icono del módulo** correspondiente — **Ticket** (`Ticket`) o **Proyecto** (`FolderKanban`), los MISMOS del menú de módulos
  (`DashboardSidebar`) — pre-renderizado a imagen igual que los de dimensión (`GraphNode.linkSource: 'ticket'|'project'`).
- **Distinción por TIPO = color + FORMA + tamaño** (no solo color): Situación = **hexágono** (grande,
  ancla), Problema = **triángulo**, Solución = **cuadrado redondeado**, Causa = **círculo** (pequeño,
  raíz). Formas trazadas en canvas (`traceShape`) y replicadas en leyenda/chips/panel con `clip-path`
  (helper `shapeStyle`). Tamaño base por tipo + extra por nº de conexiones (grado).
- **Nodo:** orbe de color **saturado** con leve oscurecido al borde (radial-gradient centro=color →
  borde=`mix(color,#000,0.3)`) + **halo de luz** (glow radial del color) + borde fino oscuro. **SIN
  núcleo blanco** (se veía "infantil"). Guardar contra `x/y/r` no finitos antes de `createRadialGradient`.
- **Resalte:** hover/selección ilumina el nodo + **vecinos** (atenúa el resto); aristas **curvas** con
  **flechas** direccionales y **partículas** animadas ("energía") en las del nodo activo; clic **centra**
  la cámara. Controles flotantes (ajustar/zoom±/reorganizar) en `bg-white/10 backdrop-blur`.
- **Panel de detalle "glass" flotante:** sobre el canvas oscuro, **anclado abajo-derecha**
  (`absolute bottom-3 right-3 max-h-…`), **fondo transparente**; el contenido va en **bloques glass**
  (`rounded-xl bg-black/40 backdrop-blur-md border border-white/12`) con **texto claro**, inputs/botones
  adaptados a oscuro (`bg-black/40 border-white/15 text-white`, `bg-white/[0.08] hover:bg-white/[0.18]`).
  Incluye sección **"Conexiones"** con chips clicables de los nodos vinculados (navega el grafo).
- **Rendimiento:** mutaciones de aristas son **optimistas** (actualizar estado local, sync en 2º plano) y
  el grafo **reutiliza los objetos-nodo por key** (conserva posiciones → no reinicia el layout); el
  `zoomToFit` solo se dispara cuando cambia el **conjunto de nodos**, no al cambiar aristas.
- **Popovers/burbujas que salen del panel glass = tokens `.corp` (NO glass blanco):** un menú/selector
  que se dispara desde el panel glass pero se renderiza por **portal a `document.body`** (para escapar del
  recorte de `overflow`/`backdrop-blur`) cae en el shell **`.corp`**, así que debe usar los **tokens Fluent**
  (`bg-digi-card`, `text-digi-text`, `text-digi-muted`, `border-digi-border`, filas `bg-accent-light`/
  `text-accent` + borde-izq accent, hover `bg-black/[0.03]`) — **no** `text-white/*` ni `bg-digi-darker`
  hardcodeados (esos solo valen para bloques glass sobre el canvas negro). Así adapta a claro/oscuro.
  Ejemplo: `components/centralized/apoyo/AlternativeLinks.tsx` (asociar 1 proyecto **o** 1 ticket a una
  alternativa) — chip/label/botón dispatch quedan glass (están sobre el panel), pero la **burbuja** es
  Fluent. **Gotcha:** `position:fixed` dentro de un ancestro con `backdrop-filter` se ancla a ese ancestro
  (no al viewport) → por eso el portal.

### Botones de estado de tarea (Completada/Fallida/Pendiente) — reusable
Control ÚNICO **`components/centralized/TaskStatusButtons.tsx`** (`<TaskStatusButtons value onChange />`): grid de 3 botones
columna (icono + label): Completada (`CheckCircle2`, verde), Fallida (`XCircle`, rojo), Pendiente (`CircleDashed`, neutro);
el activo se rellena con su tono. Lo usan el **Horario de Vida** (detalle de tarea) y **Mi día** (rail de tareas). Regla:
cualquier lugar que marque estado de tarea usa este componente (no recomponer los 3 botones a mano).

### Chip de etiquetas (icono + contador con burbuja al hover) — patrón reusable
Para mostrar valores/talentos de una tarea SIN alargar la tarjeta: un chip compacto **icono + contador**
(Valores = `Gem` violeta `bg-violet-500/15 border-violet-400/30 text-violet-300`; Talentos = `Sparkles`
celeste `bg-sky-500/15`); al pasar el puntero abre una **burbuja flotante** (`fixed`, posicionada con
`getBoundingClientRect`, `-translate-x-1/2 -translate-y-full`) con la lista de etiquetas. Se usa en el panel
de tareas del **Horario de Vida** y en el **panel de tareas agregadas del modal Generar tareas**
(`GenerateTasksModal`: layout de 3 columnas — usuarios · formulario · panel de tareas a la derecha estilo
Horario de Vida; la burbuja usa `z-[80]` para quedar sobre el `FloatingWindow` `z-[70]`). En ese panel, cada
tarjeta es **clicable para editar** la tarea en el formulario (resalta con `ring-accent`; el botón pasa de
"Agregar tarea" a "Guardar cambios" y aparece "Cancelar edición"; el ⋯ eliminar hace `stopPropagation`).

### Entradas de tarea FIJAS en el Horario/Mi día (auto de ticket/proyecto · generada por política)
Patrón para tareas que el usuario **no puede quitar** (fijadas por lógica externa); solo cambia estado (y, si aplica,
etiquetas). Tarjeta con **borde `border-dashed`** y color por **fuente**, que vira a verde/rojo según estado
(`completed`/`failed`), y un **icono de fuente** a la izquierda + `MoreVertical` (⋮) que abre el panel de detalle. Dos variantes:
- **Auto (ticket/proyecto)** — color **sky** (`border-sky-400/40 bg-sky-500/10`, texto `text-sky-300`), icono `Ticket`/
  `FolderKanban` (o `Lock` en Mi día). Estado vive en fila `locked` de `hv_schedule`.
- **Generada por política (Comandos Violeta)** — color **violeta** (`border-violet-400/40 bg-violet-500/10`, texto
  `text-violet-300`), icono **`ShieldCheck`**. Filas de `cv_generated_tasks`; el panel muestra la política de origen + horario
  (`Clock`) y permite **editar etiquetas** (aplican a todos sus días). Estado/etiquetas vía `PATCH /api/centralized/horario/generated`.
Ambas usan `TaskStatusButtons` en el panel y muestran la nota "Fijada …; no se mueve ni se quita, pero puedes marcar su estado".
Archivos: `components/centralized/systems/HorarioDeVidaSystem.tsx` (calendario semanal + panel) y `app/(dashboard)/dashboard/mi-dia/page.tsx` (rail).
- **Como BLOQUES en el calendario de Mi día (2026-07-08):** además del rail, las tareas generadas se pintan en la grilla
  (`CalendarView`, mes/semana/día) como bloques **punteados** en su franja horaria (o todo el día) los días activos. Se
  construyen como `EventInstance` sintéticos (`generated:true`, `generatedId`, `generatedStatus`) y se marcan con **color por
  estado** vía `color` (completada `#22c55e` · fallida `#ef4444` · pendiente violeta `#7c3aed`). No cuentan como horas del día
  (`dayTotals` los excluye). **Clic → popover** posicionado en el punto del clic con `TaskStatusButtons` (`onGeneratedClick`);
  no abren el `EventModal`. Regla: para inyectar "bloques no-evento" en el calendario, usar `EventInstance` con `generated` +
  un `onGeneratedClick` propio, nunca el flujo de edición de eventos reales.

### Configuración — Perfil fijo + pestañas (estándar de la página de ajustes)
`settings/page.tsx` = **Perfil fijo a la izquierda** (`ProfilePanel`, `w-[400px]`) + a la derecha una tarjeta con **pestañas
horizontales** (CV · Disponibilidad · Portafolio). Ambos lados **misma altura** (`items-stretch`). El contenido de cada pestaña
usa **todo el ancho** en layouts multi-columna y **SIN scroll interno** (la página se desplaza si hace falta — pedido del usuario:
nunca ocultar campos tras scroll de un componente). Los paneles CV/Disponibilidad/Portafolio son **contenido "bare"** (sin shell);
`SettingsPanel` (shell con cabecera) es de **altura natural** y solo lo usa Perfil. Portafolio = **tabla** (no grilla).

### Banner flotante de políticas (Comandos Violeta) — header morado + pestañas
`components/dashboard/PolicyBanner.tsx` (solo /dashboard/, montado en el layout). **FIJO arriba, fuera del flujo** (`fixed`,
`pointer-events-none` salvo el card) → **no desplaza el contenido** (nunca ponerlo dentro de `<main>`). Estructura tipo pestañas de
navegador: **header morado** (`linear-gradient(100deg,#4c1d95,#5b21b6,#6d28d9)`) con megáfono + pestañas + ocultar (↑); **zona
inferior** color tarjeta (`bg-digi-card`/`text-digi-text`, buen contraste). Con varias políticas → **pestañas** alineadas
(`items-center`, sin puntos); la **activa toma el color de la zona inferior** (colores por **estilo inline**, no `bg-white`, para
que no los pise `.corp` oscuro). Fecha de activación **corta** y discreta; enlace(s) al detalle; se oculta (persistido en
localStorage) dejando una **pestañita ↓**. Movimiento **sutil** (flotado; nada de "luz que se mueve" — es un aviso serio). El
detalle se lee en `PolicyDetailViewer` sobre **`FloatingWindow`** (movible/redimensionable). Utilidad **`.no-scrollbar`** (globals.css)
para la fila de pestañas.

### Grafo de políticas (Comandos Violeta) — formas propias
`components/centralized/comandos/PolicyGraph.tsx` reusa el motor del grafo de conocimiento (react-force-graph, canvas negro) pero con
**formas NO usadas en Apoyo**: **política = ESTRELLA**, **función = PENTÁGONO**, **detalle/términos = DOCUMENTO** (rect con esquina
doblada, ámbar). Forma/color por tipo vía `shapeOf`/`colorOf` (`FUNCTION_TYPE_META` en `lib/centralized/comandos.ts`); política
inactiva en gris. Regla: cada sistema con grafo elige formas distintas para no confundirse entre sistemas.
- **Política ACTIVA (2026-07-08):** ya NO se marca con un punto verde. Se dibuja un **aura esmeralda** + un **anillo
  esmeralda con resplandor** (`shadowBlur`, `#34d399`) trazando la estrella → la política se ve "encendida/energizada"
  (estilo de glow coherente con Apoyo). El punto verde quedó obsoleto.
- **Leyenda-filtros interactiva (2026-07-08):** igual que Apoyo — hover **previsualiza**, clic **fija/quita**
  (`hoverFilter ?? pinFilter`, prioriza hover; fijado = `ring-1 ring-inset ring-white/25`). Dos grupos: **Tipos**
  (Políticas ★ · Funciones ⬠ · Detalle/Términos 🖹) y **Estado** (Políticas activas = estrella esmeralda · inactivas =
  estrella gris). El filtro se pasa al grafo como `filter={kind:'type'|'state', value}`; `PolicyGraph.matchesFilter`
  resalta esos nodos y atenúa el resto (alpha 0.07). Formas de la leyenda vía `shapeStyle` (STAR/PENTAGON/DOC clip-path).

## Desviaciones detectadas y resolución
- **2026-07-08 — `MultiSelectSearch`: chips encima del buscador descolocaban el layout.** Los chips de
  seleccionados se renderizaban ARRIBA del input, empujándolo hacia abajo y desalineando columnas vecinas
  (p. ej. Valores vs Talentos en el modal Generar tareas). **Resuelto:** los chips ahora van **DEBAJO** del
  buscador (`mt-1.5`) y el desplegable se ancla al input con `top-full`. Regla: en selects con búsqueda, la
  selección se lista bajo el control, nunca encima. Afecta a `GenerateTasksModal` y al editor de etiquetas
  del Horario de Vida.
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
- **2026-07-05 — Editores DigiMundo (Proyectos/Sprites) en pixelart verde e incrustados:**
  `app/(main)/{projects,sprites}/page.tsx` usaban `font-pixel` + tema `digi-green` y se mostraban
  embebidos en un marco con scroll propio dentro de Admin → inconsistentes y "como widget". **Resuelto:**
  reformulados a **Fluent maestro-detalle** (lista + editor a ancho completo), sin marco (parte de la
  página); `digi-green → accent`, sin fuente pixel; amber/red se conservan (adaptan por token). El
  `WorldViewer` se dejó pixelart a propósito. Documentado en la entrada de Admin y la variante
  maestro-detalle.
- **2026-07-05 — números sin separadores es-ES:** las cantidades se mostraban con `.toFixed()` (punto
  decimal, sin miles). **Resuelto:** helper único `lib/format.ts` y sweep de las 73 presentaciones
  `.toFixed(2)` del dashboard → `fmt2(...)`. Excluidos `app/api` (SRI/PDF) y editores `(main)` (CSS).
- **2026-07-06 — Marketplace: navegación como componente reusable + vista pública:** la navegación del
  marketplace (rail "Catálogo", buscador, tarjetas, panel de detalle, galería) se extrajo a
  **`components/marketplace/MarketplaceCatalog.tsx`** = **fuente única** de ese diseño. La usan
  `/dashboard/marketplace` (con sesión) y **`/marketplace-publico`** (sin sesión, sin sidebar). La
  pública se envuelve en **`<div className="corp">`** para heredar los tokens Fluent (fondo `digi-dark`,
  cards/inputs blancos); tiene su **propio top-bar** (logo `icon.png` + botón "Iniciar sesión / Crear
  cuenta") en `.corp` en vez del `DashboardSidebar`. Un cambio de diseño en el componente refleja en
  ambas vistas (principio de diseño vinculado/reusable). El botón principal de tarjeta se parametriza por
  prop (`onPrimaryAction`): Comprar/Solicitar con sesión, gate "solo clientes" en público.
- **2026-07-06 — Calendario (`settings/calendar`) en pixel-art oscuro:** la página y sus componentes
  (`components/calendar/*`) estaban con el tema pixel (fuente display, `text-accent-glow`, `border-2`,
  `pixel-card`, textos 9–10px, colores de texto hardcodeados `#e5e7eb`/`#f3f4f6` **ilegibles** sobre el
  fondo claro `.corp`, emojis ⏳). **Resuelto:** reformulado a Fluent — command bar con breadcrumb +
  segmented Mes/Semana/Día + Hoy/chevrons lucide + disponibilidad como pill + `BTN_*`; grilla
  (`CalendarView`) con bordes simples redondeados, tipografía de cuerpo, "hoy" como círculo accent, chips
  de evento legibles (`digi-text` sobre tinte del color), línea de "ahora" roja; modales (`EventModal`,
  `EventDetailsModal`, `ShareDialog`, `ProposalModal`) y `ProposalsPanel` con `field-control`, `BTN_*` e
  iconos lucide (sin emojis). Solo presentación; la lógica quedó intacta.
- **2026-07-08 — Tipos de evento y campo "Tarea del horario" (EventModal):** los dos tipos de evento son
  **Progreso** (morado `#7B5FBF`, muestra Cliente) y **Personal** (verde) — fuente única `EVENT_TYPE_LABELS_ES`/
  `EVENT_COLORS` en `lib/calendar/recurrence.ts` (usar SIEMPRE estas constantes para color/etiqueta, no hardcodear
  "Laboral"/hex). El campo **"Tarea del horario"** dejó de ser un `PixelSelect` editable: solo aparece **de solo
  lectura** (caja `bg-digi-darker` `opacity-80 cursor-not-allowed`) cuando el modal se abre desde **"Registrar
  tiempo"** del rail de tareas; en alta normal y en edición no se muestra.
- **Estado del dashboard:** **estandarización de diseño COMPLETA** en todos los módulos
  (Inicio/Tickets/Proyectos/Suscripciones/Clientes/Facturas/Marketplace/Centralizado/Automatizaciones/
  Herramientas/Configuración/Soporte/Admin + editores DigiMundo). Con **modo oscuro** y **es-ES**.
- **Pendiente:** migrar las listas internas de `MapEditor` (categorías de sheets, capas) a `ListRow`
  para consistencia total del editor del mundo.
