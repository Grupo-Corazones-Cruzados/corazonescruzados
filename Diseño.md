# Sistema de diseño — GCC World

> Fuente de verdad del ESTILO: tokens, reglas y el estándar de los controles. Se mantiene
> vivo. El diseño está VINCULADO: cambiar la fuente única propaga a toda la sección.
> Contexto de proyecto → `MEMORIA.md`.

La app tiene **tres lenguajes visuales** distintos (intencional):
1. **Landing / juego (pixelart oscuro):** fuente `Silkscreen`/`JetBrains Mono`, `var(--color-accent)`,
   clases `pixel-btn`, sombras duras. En `app/page.tsx`, `components/landing/*`, `app/globals.css`.
2. **Dashboard:** Next.js + Tailwind (panel administrativo). *(Pendiente de auditar en detalle.)*
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

## Desviaciones detectadas y resolución
- **2026-06-28:** las secciones del editor tenían títulos, botones de filtros e íconos distintos
  (emojis genéricos; NPCs con estilo propio). **Resuelto:** se creó `editorUi.tsx` (fuente única) +
  `EditorIcons.tsx`, y se migraron Escenas, NPCs y Capas al mismo estándar Fluent. NPCs pasó de editor
  aparte a **pestaña** del editor. Se quitó el botón "NPCs" del HUD del juego (acceso solo por el editor).
- **Pendiente:** auditar/estandarizar el **dashboard** (Tailwind) y migrar las listas internas de
  `MapEditor` (categorías de sheets, capas) a `ListRow` para consistencia total.
