# Sistema de diseño — GCC World

> Fuente de verdad del ESTILO: tokens, reglas y el estándar de los controles. Se mantiene
> vivo. El diseño está VINCULADO: cambiar la fuente única propaga a toda la sección.
> Contexto de proyecto → `MEMORIA.md`.
>
> **Paleta visual:** `PALETA.html` (raíz, abrir en el navegador) — muestrario de TODOS los
> colores de la organización agrupados por lenguaje visual (marca, dashboard claro/oscuro,
> landing pixelart, editor del mundo, correos, paleta semántica remapeada), con token,
> uso, ratio de contraste calculado y copiar-al-clic. Generado desde el código real
> (`app/globals.css`, `editorUi.tsx`, `lib/integrations/email.ts`): si cambia un token,
> actualizar también ese archivo.

La app tiene **cuatro lenguajes visuales** distintos (intencional):
1. **Landing / juego (pixelart oscuro):** fuente `Silkscreen`/`JetBrains Mono`, `var(--color-accent)`,
   clases `pixel-btn`, sombras duras. En `app/page.tsx`, `components/landing/*`, `app/globals.css`.
2. **Sitio público (oscuro sobrio + violeta):** `#0b0d14`, **Inter**, tarjetas de borde tenue.
   `/negocio`, `/recursos`, `/contacto` y las páginas legales. Fuente única:
   `components/sitio/piezas.tsx`. Ver sección "Sitio público".
3. **Dashboard:** Next.js + Tailwind, **Microsoft Fluent claro** scoped en **`.corp`** (montado en
   `app/(dashboard)/layout.tsx`). Ver sección "Dashboard — Fluent (`.corp`)".
4. **Editor del mundo (Microsoft Fluent):** claro, `system-ui/Segoe UI`, azul `#0078d4`. **Este doc se
   centra aquí** (es lo estandarizado en 2026-06-28).

---

## Landing / juego — pixelart oscuro

### Pantalla de carga del juego — definición ÚNICA (2026-07-26)
**Componente:** `components/game/GameLoadingScreen.tsx`. Es lo primero que ve el jugador tras
iniciar sesión (la monta `GodotGame` mientras baja el motor). **Cualquier pantalla de espera del
juego usa este componente**, no un `<p>Cargando…</p>` suelto.

- **`BrandLoader size="lg"`** arriba. Regla del sistema: **el logo animado va en TODA pantalla de
  carga** (antes esta pantalla no lo tenía → desviación corregida).
- Título `GCC World` con `pixel-heading pixel-glow`, `var(--font-display)` (Silkscreen), versalitas
  y `tracking` ancho.
- **Barra `.pixel-progress`** (ver abajo) + fila de estado: texto de fase a la izquierda, `%` a la
  derecha, ambos en Silkscreen 10 px sobre `var(--color-accent-glow)`.
- **Peso real** debajo (`17,2 de 50,3 MB`) con `fmtNum` (formato es-ES) mientras descarga.
- Fondo `var(--color-void)`.
- **Fases con nombre honesto:** `preparando` → `descargando` (única con barra medible) →
  **`listo`** → `iniciando`. Nunca se finge progreso: si no se conoce el total, la barra va
  indeterminada.
- **Fase `listo` = botón "Toca para empezar" (2026-07-28).** No es decoración ni una pantalla de
  bienvenida: **el navegador bloquea el audio hasta que el jugador hace un gesto en esa página**,
  y `/juego` es una navegación aparte, así que el login de la portada no cuenta. Sin ese toque el
  prólogo se ve **mudo** (medido: el `AudioContext` nace `suspended` y su reloj se queda en 0).
  El botón va en `pixel-btn` + Silkscreen, con la nota *"El prólogo va con música: sube el
  volumen"*, y la cortina recupera `pointer-events` **solo** en él. **Regla del sistema:
  cualquier pantalla del juego que vaya a sonar debe pedir un gesto ANTES de arrancar el motor**
  — no vale confiar en que el jugador toque algo por su cuenta, y menos en una cinemática.

### Barra de progreso pixel — `.pixel-progress` / `.pixel-progress-fill` (`app/globals.css`)
La del dashboard es la redondeada de Fluent; **esta es la de landing/juego**: borde duro de 3 px
en `--color-accent-glow`, sin redondeos, relleno a franjas y `transition: width steps(12)` para
que avance "de píxel en píxel". Modificador `.pixel-progress-fill--idle` = indeterminada
(reutiliza el keyframe `progressPulse`).

```html
<div class="pixel-progress"><div class="pixel-progress-fill" style="width:42%"></div></div>
<div class="pixel-progress"><div class="pixel-progress-fill pixel-progress-fill--idle"></div></div>
```

### Token `--color-void` (`app/globals.css`, `@theme`)
`#0D0B14` — el negro del mundo. **Debe coincidir exactamente con
`environment/defaults/default_clear_color` de `godot/project.godot`**: la pantalla de carga, el
contenedor del canvas y el motor lo comparten, así al arrancar Godot no se ve un salto de color.
Antes estaba escrito a mano tres veces en `GodotGame.tsx` (desviación corregida): ahora es token.

---

## Sitio público — oscuro sobrio + violeta (`/negocio`, `/recursos`, `/contacto`)

> Documentado el 2026-08-03 al abrir el objetivo de SEO. **Existía desde el 2026-08-02
> (`bb9f7f0`) y no estaba en este documento**: era el cuarto lenguaje visual sin registrar.
> Ver "Desviaciones detectadas y resolución".

Es la web que ve **quien todavía no ha entrado**: una empresa que quiere contratar, un
buscador, un revisor de Meta. No es el pixel art de la portada ni el Fluent claro del panel.

### Por qué es un lenguaje aparte y no reusa nada del panel
- El panel (`.corp`) es **claro** y vive tras una sesión. Estas páginas se sirven a terceros
  y **deben verse igual pase lo que pase con el tema del dashboard** → colores **literales**,
  no tokens (misma razón que las páginas legales).
- La portada es una experiencia a pantalla completa con pixel art. Estas son páginas de
  lectura, con ritmo de web corporativa.

### Fuente única — `components/sitio/piezas.tsx`
**Ninguna página del sitio compone clases a mano.** Todo sale de aquí:

| Pieza | Qué es |
|---|---|
| `Contenedor` | Ancho de lectura: `mx-auto max-w-6xl px-5 sm:px-6`. Lo usan TODAS las secciones |
| `Seccion` | Bloque con su aire: `py-20 sm:py-28`; `tono="realce"` añade `bg-white/[0.02]` para separar dos secciones seguidas **sin dibujar una línea** |
| `TituloSeccion` | Etiqueta violeta en versalitas + `h2` de 30/38 px + entradilla. `centrado` opcional |
| `Tarjeta` | `rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-7`, realce al hover **de borde**, nunca de sombra |
| `IconoCuadro` | Icono lucide de 20 px en cuadro de 44 px con borde y fondo violeta |
| `FondoHeroe` | Resplandor radial violeta + rejilla de 64 px con máscara de desvanecido. **Cero peticiones de red**: son dos degradados CSS |
| `BotonPrimario` / `BotonSecundario` | `h-11 px-6 rounded-lg`; primario `bg-[#7B5FBF]`, secundario borde `white/15` |
| `conNegritas` | Convierte los `**dobles asteriscos**` del contenido en `<strong>` |
| `ICONOS` | Mapa nombre→icono lucide, para que el contenido nombre iconos sin importarlos |
| `RejillaAccesos` | Tarjetas de acceso que **se reparten solas según el ancho**. Ver abajo |

#### `RejillaAccesos` — tarjetas que se reparten solas (2026-08-04)

La cabecera de `/negocio`. Cinco puertas de entrada al proyecto: tres arriba y dos
**centradas** debajo en pantalla grande, dos y dos y una en tableta, una por fila en el
móvil. Los datos salen de `ACCESOS` en `lib/sitio/contenido.ts`.

```tsx
<RejillaAccesos accesos={ACCESOS} etiqueta="Lo que puedes hacer en GCC World" />
```

- **`flex flex-wrap justify-center`, NO `grid`.** Con `grid-cols-3` las dos últimas quedan
  pegadas a la izquierda con un hueco a la derecha. Con `flex-wrap` la última fila **se
  centra sola**, y el reparto **no depende de que sean cinco**: con seis o con cuatro se
  recoloca sin tocar el componente.
- **`w-full sm:w-[280px]`** — ancho fijo para que todas midan igual aunque sus textos no; a
  ancho completo en el móvil, que es lo natural.
- **`items-stretch` + `mt-auto` en el enlace.** Sin eso, la única tarjeta con botón deja el
  enlace a otra altura y la fila se ve descuadrada.
- **Una frase, sin titular.** El icono hace de rótulo. Meterle título alarga la tarjeta y
  obliga a inventar palabras que Fernando no dijo.
- **El botón aparece solo si la tarjeta trae `enlace`** — hoy solo el marketplace. Añadir
  otro es tocar `contenido.ts`, no el componente.
- **Sin JavaScript**, Server Component: las frases están en el HTML crudo. Nació como una
  tira que se arrastraba y Fernando la cambió a esto sobre la marcha.

Marco compartido: `app/(sitio)/layout.tsx` → `CabeceraSitio` + `main pt-16` + `PieSitio`.

### Los valores (literales, a propósito)
| Uso | Valor |
|---|---|
| Fondo de página | `#0b0d14` |
| Fondo del pie | `#080a10` |
| Violeta de marca | `#7B5FBF` (fondos, bordes al 30 %) |
| Violeta de texto | `#a78bfa` (enlaces, etiquetas de sección) · `#c4b5fd` (píldoras, hover) |
| Texto | `white` titulares · `white/55` cuerpo · `white/45`–`white/35` secundario |
| Bordes | `white/[0.08]` en reposo · `white/[0.16]` al hover |
| Tipografía | **Inter**, fijada en el `style` del layout, no heredada del tema |

Escala tipográfica: `h1` 38/56 px · `h2` 30/38 px · `h3` 22 px · `h4` 18 px · cuerpo
14,5–18,5 px. **El contraste de tamaño es lo que hace que la página respire**; no hay
librería de UI detrás.

### ⛔ El diseño de estas páginas lo decide Fernando, conmigo, ANTES (2026-08-03)

Textual: *«no hagas nada en la página de negocio, no quiero que hagas el diseño por tu
cuenta porque tengo que ver contigo el diseño específico de esa página y todas otras»*.

Aplica a `/negocio`, `/recursos`, `/contacto` y cualquier página pública que venga. Se parte
en dos, y **solo la primera mitad se hace sin preguntar**:

- **Fontanería** —metadatos, `canonical`, mapa del sitio, `robots`, JSON-LD, rendimiento,
  accesibilidad, imagen al compartir—: se propone, se hace y se avisa.
- **Diseño y contenido visible** —encabezados, secciones nuevas, textos, maquetación, qué se
  cuenta y en qué orden—: **se acuerda con él antes de escribir una línea.** Y no vale
  dejarle «una propuesta ya montada» para que la mire: quiere verlo **antes de que exista**.

Las piezas de `piezas.tsx` y las reglas de abajo siguen siendo el estándar **cuando ya hay
un diseño acordado** — dicen *cómo* se construye, no *qué* se construye.

### Ventana de detalle de una tarjeta — `VentanaTarjeta` (2026-08-06)

Al pulsar una tarjeta de la galería se abre con su título, de qué se trata, «Qué gana tu
empresa» en tres puntos y —cuando la haya— una ilustración a la derecha.

- **`<dialog>` NATIVO, no un `div` con `position: fixed`.** Trae hecho lo que un diálogo
  casero olvida: atrapa el foco dentro, cierra con Escape, vive en la capa superior del
  navegador —ningún `z-index` puede taparlo— y deja el resto de la página inerte.
- **Lo que sí hubo que añadir:** cerrar al pulsar fuera —comparando el clic con el
  **rectángulo** del panel, porque `e.target === dialog` falla cuando el diálogo tiene
  relleno— y bloquear el desplazamiento del fondo.
- **⚠️ `m-auto` para centrarla.** El `<dialog>` se centra solo, pero el reajuste de Tailwind
  le pone `margin: 0` y la deja pegada arriba a la izquierda.
- **Dos columnas solo si hay imagen**; sin ella queda a una y no se pinta un recuadro vacío.
- **⚠️ QUE NEXT RENDERICE EN EL SERVIDOR NO BASTA — y es una trampa fácil.** La galería es
  `'use client'` y di por hecho que sus descripciones quedaban en el HTML. **No:** solo
  viajan como **props**, y eso acaba dentro del `<script>` de hidratación, que un buscador no
  lee como contenido. Medido: la frase larga aparecía 1 vez en el HTML, la 1 dentro de
  `<script>`, y **0 en el marcado visible**.
  Se arregla con un bloque `hidden` que las pinta como nodos de verdad — el mismo remedio de
  las respuestas de las preguntas frecuentes. **Regla: lo que solo se pasa como prop a un
  componente de cliente no existe para el buscador.**
- **Las tarjetas son `<button>`**, no `div` con `onClick`: se alcanzan con el tabulador y se
  activan con Intro. La copia de la tira deslizante lleva `tabIndex={-1}` además de
  `aria-hidden`, o el tabulador pararía en once botones invisibles.

### Galería de tarjetas — `GaleriaTarjetas` (2026-08-04)

Para **enumerar** muchas cosas, frente a los temas, que **explican un flujo**. Estrenada en
Automatización con once tarjetas: icono, título y una línea. Sale del campo `galeria` de la
puerta.

- **`flex-wrap` centrado, no rejilla.** Once no es múltiplo de tres: con `grid-cols-3` la
  última fila deja dos pegadas a la izquierda. Envolviendo y centrando **se centra sola**, y
  aguanta si mañana son nueve o catorce.
- **Ancho fijo de 300 px**; a ancho completo en el móvil.
- **El encabezado (`etiqueta` · `titulo` · `entradilla`) es OPCIONAL.** Fernando lo quitó de
  Automatización el 2026-08-05: las once tarjetas se explican solas y el titular repetía con
  más palabras lo que ya dice el nombre de la puerta. Sin `titulo`, van las tarjetas y ya.
- **Al pasar el puntero:** la tarjeta sube 2 px, el borde se tiñe de violeta y el cuadro del
  icono se enciende. **Nada de sombras** — el realce de este sitio es de borde. `focus-within`
  hace lo mismo con el teclado.
- **Modo `desliza`** (Automatización, 2026-08-06): las tarjetas cruzan la pantalla **de
  derecha a izquierda en bucle**, de borde a borde de la ventana.
  - **La lista va DUPLICADA** y la animación recorre exactamente `-50 %`: al terminar, la
    copia está donde estaba el original y el bucle no da tirón. La segunda pasada lleva
    `aria-hidden` para que un lector de pantalla no lea las once dos veces.
  - **De borde a borde:** `left-1/2 -translate-x-1/2 w-screen`. ⚠️ `100vw` incluye la barra
    de desplazamiento, así que el `<section id="detalle">` necesita **`overflow-x-clip`** o
    la página entera gana barra horizontal. `clip` y **no** `hidden`: `hidden` crearía un
    contenedor de scroll y rompería el salto a las anclas de los temas.
  - **Máscara de degradado** en los bordes para que las tarjetas se desvanezcan al entrar y
    salir en vez de aparecer cortadas.
  - **Se para** al acercar el puntero y al llegar con el teclado. Con `prefers-reduced-motion`
    no se mueve y el marco pasa a `overflow-x: auto`, o las últimas serían inalcanzables.
  - 55 s la vuelta: es un fondo vivo, no un carrusel para leer al vuelo.
- **Entrada escalonada al desplazarse** (`.galeria-anima`), con el mismo motor que los temas.
  El escalón va **por columna** (`nth-child(3n+1/2/3)`) y no por tarjeta: con once, un retardo
  por posición dejaría la última entrando mucho después y se sentiría lento.

### Temas de `/negocio/<id>` — `BloqueTema` (2026-08-04)

Cada página de puerta lleva N **temas** cortos entre el vídeo y las preguntas: rótulo,
pregunta grande, respuesta en una o dos frases y unos pasos numerados. Salen del campo
`temas` de cada puerta en `contenido.ts`; sin temas, no se pinta nada.

- **Cada tema tiene su ancla** — `/negocio/<puerta>#<id>` — y **su título es un enlace a sí
  mismo**: al pulsarlo, el ancla queda en la barra del navegador lista para copiar. La
  almohadilla solo asoma al acercar el puntero, pero el enlace existe siempre (funciona con
  teclado).
- **Anclas y no páginas propias** (decisión de Fernando): los temas son cortos, y una página
  corta en un dominio nuevo acaba en «rastreada, sin indexar». Acumulándolos, la página de
  la puerta **se hace densa**, que es lo que Google pide como «calidad suficiente».
- **⚠️ El `id` es media URL.** Cambiarlo rompe los enlaces que ya circulen.
- **Qué le da el golpe de vista**, y ninguna es un efecto: pregunta a 30/44 px contra
  cuerpo de 14-17 · la pregunta habla del problema de quien lee, no de nosotros · resplandor
  violeta propio, más marcado que el de la página · pasos con número grande y tenue, que
  convierten una promesa en un mecanismo.
- `scroll-mt-24` para que la cabecera fija no tape el título al abrir un enlace con ancla.

### Los temas aparecen al desplazarse — `.tema-anima` (2026-08-04)

Animación ligada al scroll con **`animation-timeline: view()`**, CSS nativo. El tema entra
subiendo y fundiéndose, sus pasos lo siguen en cascada, y solo al final del recorrido de
salida se atenúa a 0,25.

- **⚠️ SIN JAVASCRIPT, Y ES LO QUE MÁS IMPORTA.** El truco habitual —empezar en opacidad 0 y
  revelar con un `IntersectionObserver`— **deja el contenido oculto si el script no llega a
  ejecutarse**. Y el contenido de estos bloques es justo lo que puede posicionar la página.
- **Todo dentro de `@supports (animation-timeline: view())`.** Donde no exista —Firefox hoy—
  no se aplica nada y el bloque se ve quieto y entero. El efecto es un extra, nunca un
  requisito para leer.
- **`prefers-reduced-motion`**: verificado que no se crea **ninguna** animación.
- **La salida es muy suave a propósito** (`exit 55%`, mínimo 0,25): un tema mide unos 700 px
  y ya está «saliendo» mientras se lee. Un fundido en todo el recorrido apagaría el texto
  justo mientras alguien lo lee.
- **La cascada de los pasos se hace por recorrido, no por tiempo** (`animation-range`
  escalonado por `nth-child`): si se para el scroll, se paran ellos. Es lo que hace que se
  sienta ligado al gesto y no a un reloj.
- **Las ilustraciones de los pasos van de MARCA DE AGUA**, no como elemento: al pie de cada
  paso, en una caja de 200x92 al 16 % de opacidad, con `aria-hidden` y `pointer-events-none`.
  Llegaron ahí tras cuatro intentos —debajo del texto a ancho completo, encajadas en una
  caja, arriba junto al número— y el motivo del fracaso fue siempre el mismo: **como figura,
  tres dibujos de proporciones muy distintas (uno de 4:1 junto a dos casi cuadrados) nunca se
  ven del mismo tamaño**. Como fondo deja de importar: lo que se percibe es textura. El
  `pb-24` del paso es su banda; sin él, el texto se le sienta encima.
- **⚠️ Al verificarlo:** `getComputedStyle().opacity` devuelve **siempre el valor base**,
  porque estas animaciones corren en el compositor. Para comprobar que funciona hay que
  mirar `getAnimations()[0].effect.getComputedTiming().progress`, o medir el brillo de una
  captura.

### Preguntas frecuentes de `/negocio/<id>` (2026-08-04)

**En la web** (`components/sitio/FaqsNegocio.tsx`): buscador arriba; debajo, dos columnas —
lista de preguntas a la izquierda, respuesta completa a la derecha (`lg:sticky lg:top-24`).
**Debajo de `lg` no hay dos columnas**: la respuesta se despliega bajo su propia pregunta,
que es el gesto que se espera en un teléfono.

- Es la **única isla de cliente** de la sección; el buscador y la selección necesitan estado.
- ⚠️ **Las respuestas van TODAS en el HTML**, también las no seleccionadas, en un bloque
  `hidden`. Es lo que hace que un buscador las lea sin pulsar nada. Si algún día se cambia a
  pedirlas por red, se pierde el contenido con más valor de la web.
- El buscador filtra **también por el texto de la respuesta**: quien escribe «factura»
  quiere encontrar la pregunta que la menciona dentro.

**En el Admin** (`components/admin/FaqsPanel.tsx`, pestaña «FAQs»): es el patrón
**«Explorador Azure»** de siempre, con `FilterRail` + `PixelDataTable` + panel de detalle —
`grid lg:grid-cols-[220px_minmax(0,1fr)_340px]`. **No se escribió un rail nuevo.**
- La tabla **no enseña la respuesta**: una respuesta ocupa párrafos y haría filas de cinco
  líneas. La tabla es para **encontrar**; el panel derecho, para **leer**.
- Orden manual con flechas; se manda la lista completa reordenada, no «sube uno».
- La edición va en `EditPanel` (panel lateral con overlay), que es lo que manda el sistema
  para un formulario con un campo largo.

**El vídeo** (`components/sitio/VideoYouTube.tsx`): acepta la URL tal cual se copia del
navegador, carga diferida y `youtube-nocookie`. **Si no hay enlace, no se pinta nada.**

### El pie, siempre al fondo (2026-08-06)

`app/(sitio)/layout.tsx` es `min-h-screen **flex flex-col**` y el `<main>` lleva `flex-1`.

⚠️ **`min-h-screen` por sí solo NO basta**, y es un malentendido habitual: estira el
envoltorio a la altura de la pantalla, pero sus hijos siguen apilándose uno tras otro, así
que en una página corta el pie quedaba pegado al final del contenido con un vacío debajo. Lo
vio Fernando en `/negocio` sin ninguna puerta abierta.

Con `flex-1` el cuerpo se queda todo el espacio que sobre y empuja el pie al fondo. En una
página larga no cambia nada, porque no sobra espacio que repartir. La cabecera es `fixed`, no
entra en el reparto, y el `pt-16` del `<main>` compensa su alto.

Comprobado a 1200 y 1600 px de alto en las seis páginas de la sección y en los legales.

### Reglas del sitio público
- **Server Components, sin `use client`.** El contenido tiene que estar en el HTML crudo:
  un buscador y un revisor pueden no ejecutar JavaScript. Lo que necesita estado se saca a
  una **isla** (`app/(sitio)/negocio/AltaCliente.tsx` es la única que hay).
- **El texto no vive en la página**, vive en `lib/sitio/contenido.ts`. Un servicio se edita
  en un sitio y cambia en todos.
- **Nada que no sea verificable.** Sin cifras de clientes, sin años de experiencia, sin
  premios. Una lista vacía (`CLIENTES`, `VIDEOS`) hace que **la sección entera no se pinte**:
  no queda un hueco ni un «próximamente».
- **La cabecera no lleva «Crear cuenta»** (Fernando, 2026-08-02): empujaba a registrarse
  antes de haber contado nada. El alta está al final de `/negocio`.
- **El pie es una sola línea** —copyright + `/legal`—: no repite la navegación ni el logo,
  que ya presiden la cabecera fija, y **no lleva la dirección**, que es el domicilio
  particular de Fernando.
- **La identidad legal NO puede faltar de `/negocio`** — es la URL declarada a Meta. Se
  perdió una vez al reorganizar la página y se detectó revisando el HTML compilado.

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

### Tablas a pantalla completa y el pie de la ruta
`PixelDataTable` se estira desde su borde superior hasta abajo de la ventana y **scrollea por
dentro** (la página no scrollea). El pie con la ruta (`DashboardBreadcrumb`) es
`fixed bottom-0 h-9`, así que hasta el 2026-07-30 **todas** las tablas del dashboard terminaban
36 px POR DEBAJO del pie y sus últimas filas quedaban tapadas.
- La tabla **mide el pie** (`document.querySelector('[data-app-footer]')`) y lo descuenta. Se
  mide en vez de codificar los 36 px por dos razones: si el pie cambia de alto sigue saliendo
  bien, y en las páginas que **no** lo tienen (`members/[id]`, fuera del dashboard) no sobra
  hueco. El atributo `data-app-footer` vive en `DashboardBreadcrumb`.
- **`bottomReserve` es para lo que TÚ pongas debajo de la tabla** (una fila de totales, el
  padding de una tarjeta), nunca para el pie de la app. Si alguna pantalla lo estaba usando
  para compensar el pie, hay que restarle esos 36 px o quedará hueco muerto.
- Comprobado el 2026-07-30 a 700 y 1000 px de alto en tickets, proyectos, facturas,
  recordatorios y clientes: **todas cierran 16 px por encima del pie** (el `BOTTOM_GAP` de aire).

## Reglas clave (do / don't)
- **NO** escribir un control «parecido» al que ya existe en otra pantalla → **usar el
  componente**. Un rail se hace con `FilterRail`, no copiando su marcado; las listas de
  contactos con `PanelListasContactos`. Pasó el 2026-08-03 con la pantalla de plantillas:
  se escribió una columna equivalente —casilla nativa en vez de botón con `Check`, acciones
  con borde y siempre visibles en vez de iconos al borde derecho que aparecen al pasar el
  puntero— y hacía lo mismo pero se veía distinta. Se notó al poner las dos pantallas
  juntas. **Equivalente no es igual.**
- **NO** estirar un bloque a `100vh` ni a un `calc(100vh - N)` a ojo dentro del panel: el pie
  de la app (`DashboardBreadcrumb`) es `fixed bottom-0` y **flota por encima**, así que el
  bloque termina por debajo y su última franja queda tapada. → usar
  **`useAltoHastaElPie()`** (`lib/hooks`), que mide el hueco real y descuenta el pie
  buscándolo por `[data-app-footer]`. Ha mordido dos veces: en las tablas (2026-08-01) y en
  los paneles del Estudio del agente (2026-08-03).
- **NO** `max-h-[Nvh]` cuando lo que se quiere es *llenar*: un `max-h` es un TECHO, no un
  relleno — con poco contenido el bloque mide lo que su contenido y deja media pantalla
  muerta. → alto medido + `flex-1 min-h-0` en la zona que se desplaza, y `shrink-0` en el
  resto (cabecera, pie del panel).
- **NO** un `setInterval` a mano para refrescar datos → usar **`useSondeo()`** (`lib/hooks`):
  para con la pestaña oculta, no solapa vueltas y calla los fallos.
- **NO** cajas de advertencia permanentes ocupando media pantalla para algo que se lee una
  vez → detrás de **`BotonAyuda`**, colgando del dato al que se refieren.
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
| Listas de contactos + su tabla | `components/dashboard/flows/PanelListasContactos` | La columna de listas (con casilla de asociación, y renombrar/compartir/borrar al borde derecho) y la tabla de contactos con importar/exportar Excel. Extraído del correo masivo el 2026-08-03 al pedir Fernando la misma disposición para las plantillas de WhatsApp. ⚠️ **PENDIENTE:** `EmailFlowWorkspace` todavía tiene su propia copia dentro de sus 1.500 líneas; migrarlo es el siguiente paso |
| Estilos de las superficies de acceso | `components/landing/authEstilos` | `PANEL_AUTH`, `TITULO_AUTH`, `SUBTITULO_AUTH`, `CAMPO_AUTH`, `ENLACE_AUTH`. Los del diálogo de acceso de la portada, que es el aspecto canónico: campos **sin etiqueta** (el marcador de posición hace de rótulo) y primario a ancho completo. Los importa `ClientLoginModal`, para que no haya dos |
| Alto hasta el pie | `lib/hooks/useAltoHastaElPie` | Mide el hueco real hasta el pie fijo (`[data-app-footer]`) y el fondo del contenedor con desplazamiento. **Referencia como FUNCIÓN** y observador sobre el PADRE: con `useEffect` + `ResizeObserver` sobre `document.body` no funciona (ver la regla de abajo) |
| Sondeo periódico | `lib/hooks/useSondeo` | Para con la pestaña oculta, refresca al volver, no solapa vueltas y calla los fallos |
| Rail de filtro | `components/ui/FilterRail` | **único** rail de filtro: icono + label + conteo, activo con barra izq. accent. Admite `hint` (2ª línea) y `sections` (grupos con encabezado y separador). Ancho 220px. **Un rail nuevo se hace con este componente, nunca copiando el marcado** — estaba duplicado en 12 pantallas y por eso unas y otras se veían distintas (migradas todas el 2026-07-26) |
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

### Botón de advertencias con burbuja flotante (`BotonAvisos`) — definición ÚNICA (2026-08-01)
`components/ui/BotonAvisos.tsx`. Para avisos que hay que **poder consultar** pero que no deben
ocupar la pantalla mientras se trabaja. Decisión del usuario: los banners apilados sobre el
contenido empujaban lo importante hacia abajo y, en cuanto eran más de uno, se dejaban de leer.
- **El botón** va en la barra de comandos del `DetailHeader`, **a la izquierda de la acción que
  la mayoría de avisos condiciona** (en el agente IA, «Activar»). Cuadrado de **36×36**
  (`w-9 h-9`) para igualar la altura de `BTN_SECONDARY` (`px-3 py-2`), y **`rounded`** (4 px)
  como sus vecinos — no `rounded-md`. Lleva el **conteo en burbuja** arriba a la derecha.
- **El color lo fija el aviso más grave:** rojo si hay alguno de tono `error`, ámbar si solo hay
  `aviso`. Con cero avisos **el botón no se pinta**: un icono permanente en gris se vuelve
  invisible y deja de avisar.
- **La burbuja sale a la IZQUIERDA del botón**, en `createPortal` sobre `document.body`, `fixed`
  y posicionada con `getBoundingClientRect` (`right: innerWidth - r.left + 8`). **`z-[80]`** para
  quedar sobre el banner de Comandos Violeta (`z-[60]`) y los paneles deslizantes (`z-[70]`).
- ⚠️ **Centrarla en el botón con `-translate-y-1/2` NO vale, y se descubrió MIDIENDO** en Chrome
  headless, no a ojo: el botón vive en la cabecera, cerca del borde superior, y con cuatro o
  cinco avisos la burbuja es más alta que el hueco que queda encima — se salía por arriba
  (`top: -41`) y los primeros avisos quedaban fuera de la pantalla. Se **acota al viewport**
  (`max(8, min(centro - alto/2, innerHeight - alto - 8))`) y **la punta se mueve dentro de la
  burbuja** para seguir señalando al botón. Posicionado en **dos pasadas**: la primera renderiza
  con `visibility: hidden` para poder medir el alto real, la segunda coloca; así no hay salto.
  Comprobado con puppeteer a 400 px y 900 px de alto: 14 medidas, 0 fallos.
- **Se cierra** al pulsar fuera, con `Escape`, y **al desplazar o redimensionar**: perseguir el
  botón mientras la página se mueve se ve peor que cerrar.
- Se posiciona en `useLayoutEffect`, antes de pintar, para que no dé un salto visible.
- **Quién calcula los avisos:** el espacio de trabajo, que es quien tiene los datos, y los sube a
  la página con una prop `onAvisos`. Es el complemento del `controlRef` del correo: allí la
  página dispara una acción del contenido; aquí el contenido alimenta la cabecera.
- **No es una superficie de edición**, así que no le aplica la regla del panel lateral: solo
  muestra, no pide datos.
- ⚠️ **Sustituye al patrón copiado inline** en el Horario de Vida y en `GenerateTasksModal`
  (chip + burbuja al hover, posicionada a mano). Aquello estaba duplicado y se veía distinto en
  cada sitio. **Una burbuja nueva se hace con este componente, no copiando el marcado.**

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
- **También en el panel "Eventos" (izq) de Mi día (2026-07-09):** `eventGroups` usa `allInstances`, así que las
  tareas generadas se listan junto a los eventos, con icono `ShieldCheck` violeta + sufijo "· política" y su color
  por estado; su clic abre el popover de estado (no el `EventModal`). Aparecen en los 3 sitios: panel Eventos,
  grilla del calendario y rail de Tareas.

### Rail de filtro (`FilterRail`) — definición ÚNICA
`components/ui/FilterRail.tsx` (2026-07-19). Es el rail del patrón "Explorador Azure" extraído a
componente. **Cualquier lista con filtro por estado/categoría lo usa**; no se recompone a mano.
```tsx
const FILTERS: FilterRailItem<string>[] = [
  { value: 'all', label: 'Todos', Icon: Layers },
  { value: 'published', label: 'Publicados', Icon: Megaphone },
];
<FilterRail title="Estado" items={FILTERS.map(f => ({ ...f, count: counts[f.value] }))}
            value={filter} onChange={setFilter} />
```
Clases (las del estándar): tarjeta `w-full lg:w-[200px] shrink-0 bg-digi-card border
border-digi-border rounded-lg p-2` · título `text-[10px] font-semibold text-digi-muted uppercase
tracking-wide px-2 pt-1 pb-2` (`--font-display`) · ítem `w-full flex items-center gap-2.5 px-3
py-2 rounded-md border-l-2`; activo `bg-accent-light border-accent text-accent`, inactivo
`border-transparent text-digi-text hover:bg-black/[0.03]` · badge `text-[10px] px-1.5 py-0.5
rounded-full tabular-nums`. `hideZeroCounts` oculta la burbuja en 0.

### Tarea de EVENTO (Gestión Social) en Mi día — 3ª variante de entrada FIJA
Añadida 2026-07-19 junto a las dos de la sección anterior (auto sky · política violeta). Color
**ámbar** y **`border-dashed`**, icono **`PartyPopper`**. Bajo el título, un chip de origen
`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border
border-amber-400/30 text-amber-600` con el texto **"Gestión Social"**, seguido del **nombre del
evento** y el horario (`Clock`). Mientras el evento no esté `active`, `TaskStatusButtons` recibe
**`disabled`** y se muestra la nota `Lock` + "Bloqueada hasta que inicie el evento". Filas de
`gs_task_signups`; estado vía `PATCH /api/centralized/horario/social`.
- **También como BLOQUES en el calendario** (2026-07-19), igual que las de política: `EventInstance`
  sintéticos punteados en su franja, color por estado (**ámbar `#f59e0b` pendiente** · verde
  completada · rojo fallida), excluidos de las horas del día; clic → **popover** con
  `TaskStatusButtons` (deshabilitados y con la nota de bloqueo si el evento no ha iniciado). Y en el
  panel "Eventos" izquierdo con `PartyPopper` ámbar + sufijo **"· evento"**. Aparecen en los 3
  sitios: panel Eventos, grilla y rail de Tareas.
- **`EventInstance` generalizado:** `generated` pasó a significar "bloque sintético de una tarea"
  y se añadió **`taskKind: 'policy' | 'social'`** (+ `socialLocked`) para distinguir el origen.
  Regla: para inyectar un nuevo tipo de bloque no-evento, añadir un valor a `taskKind` — no crear
  otro flag booleano paralelo.
- **`TaskStatusButtons` gana `disabled`** (2026-07-19): conserva el color del estado activo para
  poder leerlo, quita hover y añade `opacity-60 cursor-not-allowed`. Regla: para bloquear el
  marcado de una tarea, usar esta prop — nunca ocultar los botones (el usuario perdería el estado).

### Gráficos (SVG a mano) — estándar del módulo Pensamientos
No hay librería de gráficos en el repo (solo `react-force-graph-2d` para el grafo) y no se añade
una: los gráficos se dibujan en **SVG inline** con `viewBox` + `w-full h-auto` (responsive), ejes y
rejilla en `var(--color-digi-border)` y textos en `var(--color-digi-muted)`, así que funcionan en
claro y oscuro sin código extra. Canónico: `components/pensamientos/ThoughtCharts.tsx`.
- **Puntos unidos (línea + marcador)**: `<polyline stroke-width={2}>` + un marcador por punto con
  anillo de 2px del color de la superficie (`stroke="var(--color-digi-card)"`) para separarlo de la
  línea. Zonas de hover (`<rect fill="transparent">`) **más anchas que el punto**, con una guía
  vertical en el punto activo.
- **Nunca dos ejes Y en un mismo plot.** Alinear dos escalas distintas inventa una correlación que
  no está en los datos. Cuando hay dos medidas: o se codifica la segunda en un canal distinto
  (**tamaño del punto** = intensidad, con área ∝ valor → radio `√`), o va en un **gráfico aparte**
  (así está "Intensidad por mes", separado de las líneas por categoría).
- **Números** con `tabular-nums` y `Intl.NumberFormat('es-ES')`; sin dato → `—` en `text-digi-muted/50`.

### Color en gráficos — la identidad nunca depende solo del color
La paleta de dimensiones (`DIMENSION_COLOR`) se validó con un comprobador de daltonismo y **no
supera la separación mínima**: **mental `#ec4899` ↔ corporal `#14b8a6` dan ΔE 3.7 en deuteranopia**
(el mínimo es 8), y sobre fondo claro `#14b8a6` y `#eab308` quedan por debajo de 3:1 de contraste.
**No se cambian esos colores** — son canónicos y repintarían el grafo de Apoyo, Mi día y el Horario.
En su lugar, todo gráfico por dimensión **añade canales no cromáticos**:
1. **Forma del marcador** por categoría — `DIMENSION_SHAPE` (laboral círculo · corporal cuadrado ·
   mental triángulo · social rombo). Mismo recurso que ya usa `KnowledgeGraph` (la forma codifica
   el tipo además del color).
2. **Icono** en la leyenda — `DIMENSION_ICON`.
3. **Vista de TABLA** conmutable, obligatoria por el aviso de contraste: el dato siempre se puede
   leer sin depender del color.
Regla: si añades un gráfico con estos 4 colores, replica los tres canales. No basta el color.

### Iconos de dimensión — definición única
`components/centralized/dimensionIcons.ts` exporta **`DIMENSION_ICON`** (Briefcase/Dumbbell/Brain/
Users) y **`DIMENSION_SHAPE`**. Este mapa estaba **copiado literalmente en 3 archivos**
(`mi-dia/page.tsx`, `HorarioDeVidaSystem.tsx`, `KnowledgeGraph.tsx` como `ICON_COMP`); los tres se
migraron a esta definición el 2026-07-19. Vive en `components/` y no en `lib/centralized/apoyo.ts`
para no arrastrar `lucide-react` a los módulos de servidor que importan las dimensiones.

### Configuración — Perfil fijo + pestañas (estándar de la página de ajustes)
`settings/page.tsx` = **Perfil fijo a la izquierda** (`ProfilePanel`, `w-[400px]`) + a la derecha una tarjeta con **pestañas
horizontales** (CV · Disponibilidad · Portafolio). Ambos lados **misma altura** (`items-stretch`). El contenido de cada pestaña
usa **todo el ancho** en layouts multi-columna y **SIN scroll interno** (la página se desplaza si hace falta — pedido del usuario:
nunca ocultar campos tras scroll de un componente). Los paneles CV/Disponibilidad/Portafolio son **contenido "bare"** (sin shell);
`SettingsPanel` (shell con cabecera) es de **altura natural** y solo lo usa Perfil. Portafolio = **tabla** (no grilla).

### Lista compacta + formulario en modal (colecciones dentro de un panel) — estándar reusable
Adoptado 2026-07-09 en **Mi CV** (`components/settings/CvPanel.tsx`, secciones Educación/Experiencia/Servicios por talento).
Para colecciones de sub-ítems **NO usar formularios inline por ítem** (ocupan demasiado alto). En su lugar:
- **Encabezado de sección** (`ListSection`): icono + título + botón `Agregar` (`addBtn`, dashed) a la derecha; texto de vacío
  suave (`text-digi-muted/60`) cuando no hay ítems; `pt-3 border-t` entre secciones (`topBorder`).
- **Fila compacta** (`ItemRow`): `rounded-lg border border-digi-border bg-digi-darker/40`, **clic = editar**; muestra
  **título** (font-medium) + **subtítulo** truncado (`text-digi-muted`) + **meta** a la derecha (año/precio, `tabular-nums`) +
  opcional **badge** ("Inactivo") + acciones **lápiz** (editar) y **tacho** (eliminar). Hover `border-accent/60`.
- **Formulario en modal** (`PixelModal` size md → **panel lateral derecho con overlay**, el estándar de formularios): dentro,
  `FormShell` = campos + **pie fijo Cancelar (`BTN_SECONDARY`) / Guardar (`BTN_PRIMARY`)**; `submit` guarda y cierra. Un solo
  estado de draft por colección (`{idx|id, draft}`), `null` = cerrado. Sirve para agregar y editar (mismo modal).
Precios/números en la fila con `money()`/`fmt2` de `lib/format.ts`. Reusar este patrón para cualquier lista editable embebida.

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

## Correos electrónicos (tema corporativo, fuente única)
Todos los correos usan el **tema `.corp` del dashboard** (serio, NO videojuego): fondo `#faf9f8`, tarjeta
blanca `#ffffff` con borde `#e1dfdd` y radio 12px, texto `#242424`/`#605e5c`, acento `#4B2D8E`, **tipografía
Segoe UI** (monoespaciado SOLO en cajas de código/contraseña). Estilos **inline** (los clientes de correo no
soportan variables CSS ni `<style>`).
- **Fuente única de helpers:** `lib/integrations/resend.ts` — `emailShell`, `emailHeading`, `emailParagraph`,
  `emailButton` (primary/danger), `emailBadge`, `emailInfoBox`, `emailNote`, `accentStrong`, `emailCodeBox`, y
  el objeto `EMAIL_THEME`. Todos los correos de auth/verificación/calendario/propuestas se componen con ellos.
- **Correos con plantilla propia** (facturas, suscripciones, campañas, tickets, proyectos, proformas — con
  tablas/PDF) quedaron **alineados a los mismos tokens** (Segoe UI + `#faf9f8`/`#e1dfdd`/`#242424`/`#4B2D8E`).
  A futuro, cualquier correo nuevo debe reusar los helpers de correo o al menos sus tokens; **nunca** el
  viejo estilo videojuego (Courier, fondo oscuro, morado `#7B5FBF`, bordes 2px pixel).
  > **CORRECCIÓN (verificado 2026-07-22):** ya **no existe `resend.ts`** (Resend se eliminó). La fuente única de
  > correos es **`lib/integrations/email.ts`** → `deliver()` que envía por **Gmail API** (`sendViaGmail`,
  > `lib/integrations/google-workspace.ts`). Los helpers (`emailShell`, `emailHeading`, `emailParagraph`,
  > `emailButton(url,label,variant)`, `emailBadge`, `emailInfoBox`, `emailNote`, `accentStrong`) están en ese
  > archivo con los mismos tokens `.corp`. `EMAIL_FROM`/`NEXT_PUBLIC_APP_URL` por env.

### Módulo Cotizaciones — patrones nuevos (2026-07-22)
Estándares introducidos con el módulo de Cotizaciones (proyectos en estado `cotizacion`). Reusar en otros módulos.

- **Formularios = panel lateral DERECHO con overlay (reforzado como regla firme).**
  > Ampliado el 2026-07-31 con la ventanita centrada para 1-2 campos y con la definición única
  > `components/ui/EditDialog.tsx` → ver **"DÓNDE SE EDITA"** más abajo, que es hoy la regla vigente.
  El usuario pidió que
  **nunca** se edite inline: todo formulario (crear cotización, editar descripción, costos adicionales, compartir)
  se abre como **panel lateral derecho con overlay** — `PixelModal size="md"` (que en `.corp` se renderiza como
  panel derecho). Para un **drawer a medida** (p. ej. "Nueva cotización"): `fixed inset-0 flex justify-end` +
  backdrop `bg-black/40` + `<aside className="w-full max-w-md h-full bg-digi-card border-l ml-auto overflow-y-auto">`.
  El drawer de la izquierda (`justify-start` + `border-r`) se probó y se descartó (tapaba el sidebar).
- **`DetailHeader` gana prop `trailing`** (`components/ui/DetailHeader.tsx`): botones a la **DERECHA** del menú ⋯
  (los `actions` van a la izquierda del ⋯). Se usa para "Compartir acceso". Patrón: acciones primarias/estado en
  `actions`, secundarias/destructivas en `overflow` (⋯), y una acción contextual clave en `trailing`.
- **Accesos como botones del header en vez de tarjetas del rail.** En un detalle con rail derecho saturado,
  reformular secciones (Progreso, Imágenes) a **botones del header** (junto al ⋯) que abren su contenido en
  `PixelModal size="md"`; mover acciones secundarias (participación del miembro, Marketplace) al **⋯**. Deja el
  rail limpio y aprovecha el header. (Detalle de proyecto, 2026-07-22.)
- **Requerimientos/ítems colapsables:** lista de ítems con cabecera **siempre visible** (título + descripción +
  resumen compacto "N subtareas · N asignados") y **chevron** (`ChevronDown` con `rotate-180`); **contraídos por
  defecto** (estado `Set<number>` de expandidos). Al desplegar aparecen los controles (asignar/subtareas) y el
  detalle (miembros, subtareas). Clic en el título o el chevron alterna.
- **Chat flotante de agente en el "dock" de chats (`GccBotChat`, modo `dock`):** para no chocar con los
  lanzadores del `ChatDock` (Chat / Mis chats, `fixed bottom-11 right-3`, botones `h-10 rounded-full`), un botón
  de chat adicional debe: (1) usar el **mismo tamaño** (`h-10 pl-3 pr-4 rounded-full text-[12.5px]`), y (2)
  **medir** el ancho real del dock para posicionarse a **8px a su izquierda** — `ChatDock` marca su fila de
  lanzadores con `data-chatdock-launchers`; el otro botón mide `window.innerWidth - rect.left + 8` (con `resize`
  listener) y lo aplica como `style={{ right }}`. Evita offsets fijos frágiles.
- **Página pública compartida por token (`.corp`, solo lectura):** `app/cotizacion/[id]/page.tsx` — contenedor
  `className="corp min-h-screen bg-digi-dark"`, tarjetas `rounded-xl`, y **botones de decisión GRANDES** (`py-3.5
  rounded-lg text-[15px] font-semibold`): Rechazar (outline rojo), acción secundaria (outline accent), Aceptar
  (verde sólido). El externo **no edita** la interfaz; solo acciona. Reusa el patrón token/expiración de proforma.
- **`AdditionalCostsCard`** (`components/cotizaciones/`): tarjeta de lista + total con "Editar" → panel derecho
  con filas (input label + monto + descripción + quitar) y "Agregar costo" (botón dashed). Patrón para editar una
  **colección simple** dentro de un panel.

### Modales de la landing en tema del dashboard — isla `.corp dark` (2026-07-25)
Los **dos modales de la página de inicio** (`components/landing/EntryChoiceModal.tsx` = "¿Cómo quieres
ingresar?" y `components/landing/OnboardingSlidersModal.tsx` = los 8 pasos de postulación) dejaron el
pixelart y usan el **diseño del dashboard** en su **variante oscura** (pedido del usuario: "al estilo
del modo oscuro"), para no chocar con la landing oscura.
- **Cómo se monta una isla corp fuera de `/dashboard`:** el overlay lleva
  `className="corp dark corp-overlay …"`. **`.corp-overlay`** es una utilidad nueva de `globals.css`
  (`.corp.corp-overlay { background: transparent; min-height: 0; }`) que hereda tokens y tipografía
  Fluent **sin** imponer el fondo de página ni el `min-height:100vh` de `.corp` — el velo lo pone el
  propio overlay (`rgba(6,7,12,0.7)` + `backdrop-filter`). **Reusar esta clase** para cualquier
  diálogo corp montado sobre la landing/juego. Quitar `dark` lo pasa a claro sin más cambios.
- **Anatomía del diálogo simple** (EntryChoiceModal): tarjeta `bg-digi-card border border-digi-border
  rounded-lg` con **cabecera** (chip de icono `bg-accent-light text-accent` 36×36 + título 17px
  semibold + subtítulo `text-digi-muted` + cerrar **32×32** `hover:bg-[#f3f2f1]`), **cuerpo con fondo
  de página** (`bg-digi-dark`, para que las tarjetas de opción se separen del diálogo) y **footer** con
  la acción secundaria a la derecha (`<Button variant="secondary">`). Cierra con **Escape** y con clic
  en el velo.
- **Fila de opción** (patrón reusable para menús de elección): `group w-full flex items-start gap-3
  rounded-md border p-3.5` + chip de icono + título 13.5px semibold + descripción 12.5px muted +
  `ChevronRight`; hover `border-accent hover:bg-accent-light`. **Tonos**: `success` (`bg-green-50
  border-green-300`) para "postulación aprobada" y `warning` (`bg-amber-50 border-amber-300`) para
  estados en espera, con `PixelBadge` de estado ("Aprobada", "En revisión", "Verificación pendiente").
  Carga = `Loader2` girando + texto muted (nunca spinners pixel).
- **Anatomía del asistente de 8 pasos** (OnboardingSlidersModal) = **patrón "Explorador Azure"
  adaptado a wizard**: `grid lg:[248px_minmax(0,1fr)]`.
  - **Rail de pasos** (izquierda, `hidden lg:flex`): marca (`BrandLoader` + "GCC WORLD" + "Postulación
    de candidato"), lista de los 8 pasos con **icono lucide por paso** (`Layers3/Wrench/Heart/Gavel/
    TrendingUp/RefreshCw/BadgeCheck/Send`), activo `bg-accent-light border-l-2 border-accent
    text-accent`, **`Check` verde** en los ya aceptados, número a la derecha en los pendientes, y
    **deshabilitado** (`opacity-50`) mientras el paso no sea alcanzable (`canGoTo`: visitado o con
    todos los anteriores aceptados). Al pie, **barra de progreso** + "Paso N de 8".
  - **Contenido:** cabecera (chip del icono del paso + kicker "PASO N DE 8" + título + cerrar 32×32;
    en móvil, donde el rail se oculta, aparecen los **segmentos de progreso**), cuerpo `bg-digi-dark`
    con scroll, **franja de aceptación** (`AcceptTerms`: casilla 18px con `Check`, se tiñe
    `bg-accent-light` al marcar) y **footer** con `Atrás` (secundario, izquierda) / `Siguiente ·
    Postularme · Comenzar mi aventura` (primario, derecha, `flex-row-reverse` para que la flecha vaya
    después del texto).
  - **Fuente única de estilo del contenido:** las constantes del final del archivo (`pStyle`,
    `cardBase`→tarjetas, `cardTitle`, `cardDesc`, `chip`, `noteBox`, `stepNum`, `kickerStyle`) apuntan
    **todas a tokens** (`var(--color-digi-*)`, `var(--color-accent*)`), así que retematizan los 8 pasos
    de una vez y funcionan en claro y oscuro. **NO** hex crudos en los sliders.
- **Composiciones de contenido (aprovechar el ancho, evitar huecos):** los 4 **Pisos** se muestran como
  **edificio** (tarjeta única con 4 filas separadas por `border-t`, chip numerado) en vez de la grilla
  3+1 que dejaba un hueco; los 4 **Pasos** y las 6 indicaciones de **Afiliación** como **línea de
  tiempo** (`ol` con conector `absolute left-4 top-9 bottom-0 w-px bg-digi-border` + burbuja
  `rounded-full bg-accent text-white`); los valores de la Regla 1 en `grid sm:grid-cols-2`; pestañas
  Pisos/Pasos con **`PixelTabs`** (pivot Fluent); acordeones con `ChevronDown` que rota y borde
  `border-accent` al abrir; aviso rojo con `AlertTriangle` (`WarnBox`, `bg-red-50/border-red-300/
  text-red-700` — literales con override en `.corp.dark`).
- **SVG con tokens:** el diagrama de "Lideración sobre Acciones" colorea por **`style`**
  (`style={{ fill: 'var(--color-accent)' }}`), **no** por atributos de presentación (`fill="var(…)"`
  no es fiable en SVG), y hereda la tipografía con `style={{ fontFamily: 'var(--font-body)' }}` en el
  `<svg>`. Así el diagrama se adapta a claro/oscuro sin duplicar colores.
- **Se añadió `hover:bg-amber-100` a los overrides de `.corp.dark`** (faltaba; regla: todo literal
  semántico usado debe tener su override oscuro).

### Botón de información (ⓘ) por módulo del sidebar (2026-07-25)
Cada ítem del sidebar (`components/dashboard/DashboardSidebar.tsx`) es ahora un `div.relative` con el
`<Link>` (padding `pl-2.5 pr-9` para dejar sitio) y, como **hermano**, un botón `absolute right-1
top-1/2 -translate-y-1/2 w-7 h-7 rounded-md` con el icono lucide `Info` (15px). **Nunca anidar un
`<button>` dentro del `<Link>`** (HTML inválido y el clic se traga la navegación) — por eso son hermanos.
- **Estado del icono:** `text-accent` si el módulo YA tiene videos publicados, `text-digi-muted/40` si no;
  hover `hover:bg-accent-light hover:text-accent`. El conteo viene de `/api/tutoriales?counts=1` (una sola
  petición al montar el sidebar).
- **Se oculta con el sidebar colapsado** (`w-16`): no hay ancho para dos objetivos de clic.
- Abre `components/dashboard/ModuleTutorialsModal.tsx`, que **se monta solo cuando hay módulo elegido**
  (`{tutorialFor && <…/>}`) para que al cerrar se desmonte el `<iframe>` y el video **deje de sonar**.
- **Incrustar YouTube:** `https://www.youtube-nocookie.com/embed/<id>?rel=0&modestbranding=1` dentro de un
  contenedor `aspect-video rounded-lg border border-digi-border bg-black`. Miniaturas de lista:
  `https://i.ytimg.com/vi/<id>/mqdefault.jpg`.

### Lista de candidatos con acción por fila (modal "Buscar reuniones") — patrón reusable (2026-07-29)
Estándar para **"buscar algo fuera de la app y traerlo dentro"**: el usuario abre un modal, elige el
periodo, ve una lista de candidatos con su **estado** y acciona **fila por fila**. Implementado en
`app/(dashboard)/dashboard/recordatorios/page.tsx` (reuniones de Meet → recordatorio).
- **Disparador:** botón **secundario** (`BTN_SECONDARY`) en la barra de comandos del módulo, **a la
  izquierda del primario**. Regla de distribución: buscador a la izquierda (`flex-1`), luego
  secundarias, y la **acción primaria siempre al final** (más a la derecha).
- **Modal `PixelModal size="lg"`** (→ panel lateral derecho) con `busy` atado a la acción en curso,
  para que no se cierre mientras se genera. Dentro, en este orden:
  1. **Párrafo de intención** `text-[12px] text-digi-muted leading-relaxed` (qué hace y qué se obtiene).
  2. **Fila de control:** `PixelSelect` de periodo envuelto en `<div className="w-48 shrink-0">`
     (**nunca** pasarle `w-auto` por `className`: pelea con su `w-full` y el resultado depende del orden
     del CSS) + botón `Actualizar` con `RefreshCw` que gira (`animate-spin`) mientras carga.
  3. **Aviso** de configuración faltante: `border-amber-500/40 bg-amber-500/10` + `AlertTriangle`.
  4. **Filas** (patrón `ItemRow`): `flex items-center gap-3 px-3 py-2 rounded-lg border border-digi-border
     bg-digi-darker/40`; título `text-[13px] font-medium` con **icono de tipo** delante y subtítulo
     `text-[11px] text-digi-muted` (fecha · duración · identificador).
  5. **Pie explicativo** `pt-2 border-t` que aclara el estado "no accionable" (aquí, por qué una reunión
     puede no tener transcripción). Evita que el usuario crea que es un error de la app.
- **Un estado ⇒ un control a la derecha** (nunca los tres a la vez):
  | Estado | Control |
  |---|---|
  | accionable | botón primario compacto `${BTN_PRIMARY} px-2.5 py-1.5 text-[12px]` con `Sparkles`; mientras corre, `RefreshCw animate-spin` + "Generando…" |
  | ya traído | **enlace** `text-accent hover:underline` con `CheckCircle2` + `ArrowRight` que cierra el modal y **selecciona el registro** en el panel de detalle |
  | no accionable | `PixelBadge variant="default"` con el motivo ("Sin transcripción") |
- **Icono de tipo por fila** envuelto en `<span title="…">`: **no** pasar `title` a un icono de
  lucide (no es atributo válido de `<svg>` en los tipos de React). Aquí `CalendarDays` = agendada ·
  `Radio` = iniciada sin agendar.
- **Estado vacío** dentro del modal: cuadrito `w-10 h-10 rounded-lg bg-black/[0.03]` + icono
  `text-digi-muted` + frase; el texto distingue "no hay resultados" de "aún no se ha buscado".
- El escaneo se lanza **al abrir** (una sola vez, `meetScanned`) y a demanda con Actualizar; tras
  accionar se actualiza la fila **en memoria** y se refresca la lista del módulo.

### Detalle de flujo — página completa con rail + listas + contactos (2026-07-30)
`/dashboard/automatizaciones/[id]` (`FlowDetail.tsx` + `EmailFlowWorkspace.tsx`). Decisión del
usuario: **"Configurar" abre una PÁGINA**, no un panel deslizante — mismo criterio que el
detalle de un ticket. Es la variante de **tres columnas** del patrón "Explorador Azure":
- **Cabecera:** `DetailHeader` (breadcrumb "Automatizaciones" → nombre del flujo, badge de
  estado, chip de tipo con su icono, Activar/Pausar, **la acción primaria del módulo a su
  derecha** —"Nueva campaña"— y "Eliminar flujo" en el menú ⋯). La primaria vive arriba, no
  sobre el rail (decisión del usuario, 2026-07-30): el rail se queda solo con la lista.
  - **Cómo se acciona algo del contenido desde la cabecera:** el estado del modal pertenece al
    espacio de trabajo, así que este expone un `controlRef`
    (`EmailWorkspaceHandle { openNewCampaign }`) con `useImperativeHandle` y la página lo
    dispara. Se evita duplicar el modal fuera o subir estado que no le toca a la página.
- **Columna 1 — rail de registros con acciones:** `FilterRail` con **`wrapLabels`** (nuevo) y
  ancho propio vía `className="w-full"` sobre un contenedor de 268px. Regla aprendida: un rail
  cuyos ítems son **nombres largos** (el asunto de una campaña) necesita 2 líneas y **sin
  burbuja de conteo** — con 220px + burbuja + 2 iconos el título se quedaba en "Docente ...".
  El dato numérico se baja al `hint` ("Enviada · 24 destinatario(s)").
  `FilterRailItem.actions` (nuevo) pinta lápiz/tacho a la derecha, **fuera** del botón de
  selección para que no se traguen el clic; aparecen al hover o cuando el ítem está activo.
- **Barra del registro seleccionado:** tarjeta a lo ancho de las dos columnas restantes con
  título + subtítulo, badge de estado y **un menú ⋯** (`components/centralized/ActionsMenu`)
  con TODAS las acciones. En fila ocupaban el ancho entero de la barra (5 botones), así que
  desde 2026-07-30 van al menú — es justo el uso para el que existe ese control. Debajo, una
  línea informativa (p. ej. la próxima salida programada).
- **Las tres columnas arrancan a la MISMA altura** (2026-07-30): la barra del registro
  seleccionado ocupa solo la 3ª columna, encima de su detalle, no el ancho de las dos. Antes
  empujaba hacia abajo la columna 2, que quedaba desalineada del rail sin motivo.
- **El pie con la ruta ya lo descuenta la tabla sola** (2026-07-30): ver "Tablas a pantalla
  completa" en las reglas clave. En esta pantalla `bottomReserve` solo cubre el padding de la
  tarjeta.
- **Columna 2 — lista con casilla + selección (dos gestos en la misma fila):** la **casilla**
  asocia/desasocia; el **clic en el resto de la fila** selecciona (y resalta con
  `bg-accent-light` + `border-l-2 border-accent`). Son botones **hermanos**, nunca anidados.
  Dos grupos: los asociados arriba **sin encabezado** (van justo bajo el título del panel, no
  hace falta repetirlo) y el resto bajo "Otras listas del flujo". **Un grupo vacío no pinta ni
  su encabezado**: un título suelto sin nada debajo es ruido.
- **Columna 3 — detalle de la selección:** `SectionBar` (título + conteo + acción primaria),
  fila de acciones secundarias en `BTN_ROW`, y `PixelDataTable` con lápiz/tacho por fila.

### Editores de Automatizaciones — panel drill-in "extra grande" (`FlowPanelUI`, 2026-07-30)
`components/dashboard/flows/FlowPanelUI.tsx` es la **definición única** del lenguaje de los tres
editores grandes de Automatizaciones (Email masivo, WhatsApp, Chatbot). Antes cada panel traía su
propio overlay, cabecera, pasos y botones **en pixel antiguo** (bordes 2px, textos de 8-9px,
`pixel-btn-*`, siglas de texto en vez de iconos) → los tres se veían distinto entre sí y distinto
del resto del dashboard. Ahora los tres importan de aquí.
- **`FlowPanelShell`** — overlay + panel deslizante desde la derecha. Es la variante
  **extra-grande** del panel lateral estándar (`.corp .modal-surface[data-size=lg]` mide 840px):
  estos editores llevan tablas y asistentes, así que usan **1040px**. Superficie `bg-digi-card`,
  `border-l` de 1px, animación `panelSlideInRight` (la misma del panel estándar).
  - **`z-[70]` a propósito:** el banner de Comandos Violeta es `fixed z-[60]` y **se comía la
    cabecera** del panel (la pestañita del megáfono se superponía a "Volver"). Los `PixelModal` que
    se abren desde dentro siguen quedando encima porque `<dialog showModal>` vive en el *top layer*
    del navegador, que gana a cualquier z-index. **Regla:** un overlay a pantalla completa del
    dashboard va por encima de `z-[60]`, o el banner lo tapa.
  - **Cabecera:** botón volver 32×32 (`ArrowLeft`) · tile de icono 36×36 `bg-accent-light` · título
    17px/600 + subtítulo 12px · cerrar (X) 32×32. Mismo patrón que el resto de cabeceras de detalle.
- **`PanelSubHeader`** — volver + título + subtítulo + acciones (los pasos, un badge…). Sustituye
  los `< Campanas` sueltos que había repetidos 8 veces.
- **`SectionBar`** — título de sección (15px/600) + hint opcional a la izquierda, **acciones a la
  derecha** (secundarias antes de la primaria).
- **`PanelFooter`** — pie de formulario con `border-t` de 1px; `between` (volver ← → guardar) o `end`.
- **`Steps`** — indicador de pasos ÚNICO para los tres asistentes (antes: `StepIndicator` +
  dos `StepDot` distintos). Círculo 24px: activo `bg-accent` blanco · hecho `bg-accent-light` con
  check · pendiente borde neutro; etiqueta 12px al lado (no debajo).
- **`StatCards`** — las 5 tarjetas de resumen de estadísticas, con tonos semánticos.
- **`FileRow`** / **`PanelEmpty`** / **`formatSize`** — fila de archivo con `Paperclip` + tacho,
  estado vacío con el cuadrito estándar, y formato de bytes consistente.
- **Clases compartidas:** `FIELD` (campo estándar), `FIELD_SM` (campo compacto de filas
  "agregar"), `LABEL`, **`BTN_ROW`** y **`BTN_ROW_DANGER`** (botón pequeño de acción **dentro de una
  fila de tabla**: 1px de borde, radio, 12px, icono lucide de 14px). Los botones grandes salen de
  `components/ui/Button` (`BTN_PRIMARY`/`BTN_SECONDARY`).
- **Reglas que se aplicaron al migrar:** nada de `text-[8px]`/`text-[9px]` (mínimo **11px**, cuerpo
  12-13px) · nada de `border-2` (1px) · **iconos lucide en vez de siglas** (la barra del editor HTML
  pasó de `B I U H1 H2 P <> IMG HR BTN` a `Bold/Italic/Underline/Heading1/Heading2/Pilcrow/Link2/
  Image/Minus/MousePointerClick`) · `X` de borrar → `Trash2` · `v`/`>` de expandir →
  `ChevronDown`/`ChevronRight` · selects a `PixelSelect` e inputs a `PixelInput` · pestañas a
  `PixelTabs` · y **acentos y ñ en toda la copia** (Campañas, Estadísticas, Reenvío, Configuración,
  Previsualización, conexión, Tamaño…), que faltaban en los tres archivos.

### Utilidades de administrador — pestañas del módulo Admin (2026-07-25)
Las pestañas horizontales de `admin/page.tsx` son el sitio donde viven las **funciones de administrador**
(no un módulo nuevo por cada una). Se añadieron **Fuentes** (`Database`) y **Tutoriales** (`Video`) tras
Razones. Ambas reusan el **patrón "Explorador Azure" en su variante rail + contenido**:
`grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4`, rail = tarjeta `bg-digi-card border rounded-lg` con
cabecera (icono accent + título + conteo a la derecha), buscador opcional y lista de botones cuyo activo es
`bg-accent-light text-accent border-l-2 border-accent`.
- **Rail a pantalla completa (patrón reusable):** cuando un rail debe ocupar todo el alto disponible se
  **mide su borde superior** contra el alto de la ventana en vez de usar `vh` fijos (que no descuentan el
  header ni las pestañas): `ref` en el `<aside>`, `height = max(innerHeight - rect.top - 16, 280)`,
  recalculado en `resize`. El `<aside>` va `flex flex-col` con cabecera/buscador/leyenda `shrink-0` y la
  lista `flex-1 overflow-y-auto`. **No** usar `self-start` (impide estirarse).
- **Árbol de carpetas (rail de Fuentes):** filas con sangría por profundidad
  (`paddingLeft: 6 + depth*12`), `ChevronRight` que rota 90° al abrir, **un icono por tipo de nodo**
  (`Boxes` módulo · `Network` sistema · `GitBranch` subsistema · `Folder` otras · `Table2` tabla; las
  carpetas de módulo/sistema en `text-accent`, el resto en `text-digi-muted`) y conteo a la derecha.
  Hoja seleccionada = `bg-accent-light text-accent border-l-2 border-accent`, igual que el rail plano.
  Al pie, **leyenda** de iconos (11px) para que el usuario sepa qué es cada cosa; en la cabecera,
  desplegar/contraer todo (`ChevronsUpDown`/`ChevronsDownUp`). **Buscar despliega automáticamente** solo
  las ramas que casan (si no, los resultados quedan escondidos tras carpetas cerradas).
- **Muelle inferior derecho (orden y anclaje).** De derecha a izquierda: **🔔 campanita ·
  Mis chats · Chat · GCC Bot** (este último solo en cotizaciones). El **ancla es la campanita**
  (`NotificationsDock`, `fixed bottom-11 right-3 lg:right-4`, marcada con
  `[data-notifications-dock]`); `ChatDock` la mide y se coloca **8 px a su izquierda**, y
  `GccBotChat` mide `[data-chatdock-launchers]` y se coloca a la izquierda de ese. **Nunca usar
  offsets fijos**: al añadir o quitar un lanzador la fila se recoloca sola. Cada uno cae a
  `right-3/4` si el de su derecha no está montado.
- **Contador de no leídos:** burbuja roja `-top-1 -right-1 min-w-[18px] h-[18px]` con borde
  `border-2 border-digi-card`. **Si no hay no leídos la burbuja NO se renderiza** (nunca un "0"),
  pero el botón sigue activo. Tope visual `99+`.
- **Alto disponible = ventana − barra de ruta.** El dashboard tiene una **barra de ruta FIJA abajo**
  (`nav[aria-label="Ruta"]`, `fixed bottom-0 h-9`). Cualquier panel que quiera ocupar "todo el alto" debe
  **descontarla**, o su contenido queda por debajo y se corta:
  `height = innerHeight - rect.top - barraRuta.height - 12`. Medir la barra por su selector (no un 36
  hardcodeado). Pasó con la leyenda del rail de Fuentes.
- **Grafo "universo" (reusable).** Motor: `react-force-graph-2d` con importación dinámica
  (`import('react-force-graph-2d')` en un `useEffect`, nunca en el bundle inicial), fondo negro,
  controles Ajustar/Acercar/Alejar/Reorganizar arriba a la derecha como botones
  `bg-white/10 border-white/10 backdrop-blur`, y **leyenda-filtro** arriba a la izquierda donde el puntero
  previsualiza el resaltado y el clic lo fija (`hoverFilter ?? pinFilter`). Reglas aprendidas:
  (1) **cachear los objetos de nodo por id** entre renders o d3 pierde las posiciones y el grafo salta;
  (2) **etiquetas de las hojas solo con zoom, hover o selección** (cientos de nombres a la vez se solapan);
  (3) si hay selección al montar, **centrar en ella en vez de encuadrar** (el `zoomToFit` pisa el centrado);
  (4) al resaltar, subir también el **grosor y la opacidad de las aristas** y atenuar el resto casi a cero,
  o el resaltado de nodos se pierde entre las líneas. Referencias vivas: `GdGraph.tsx` (Gestión de Datos),
  `PolicyGraph` (Comandos Violeta).
  > **Se probó y se DESCARTÓ** llevar este patrón al esquema de la base (pestaña Fuentes): ver el log de
  > desviaciones. Fuentes se quedó solo con la vista de tabla.
- **Tabla genérica (Fuentes):** cuando las columnas son dinámicas NO se usa `PixelDataTable` (asume columnas
  fijas y alto calculado); se compone un `<table>` propio con las clases estándar `data-table` / `dt-th` /
  `dt-row` / `dt-td` (así hereda el estilo Fluent de `globals.css`) dentro de un contenedor
  `overflow-x-auto max-h-[58vh] overflow-y-auto` y `<thead className="sticky top-0 z-10 bg-digi-card">`.
- **Reusar el panel de un módulo en otro sitio (en vez de duplicarlo).** Cuando una utilidad ya existe como
  componente (p. ej. el editor de listas globales de Encuadre Condiciológico) y hace falta también en Admin,
  se **monta el mismo componente**, no se reescribe: se le añade una prop mínima para que el alto lo ponga el
  contenedor (`fill` → `h-full` en vez de su `calc(100dvh-…)` propio) y el host mide el espacio disponible.
  Así una mejora del editor aparece en los dos sitios y no hay dos diseños que se separen con el tiempo.
  Ejemplo: `components/admin/ListasPanel.tsx` monta `EncuadreCondiciologicoSystem`.
- **Formularios en panel derecho:** se reusa `PixelModal size="md"` (en `.corp` ya se renderiza como panel
  lateral derecho con overlay), en vez de un drawer a medida. Footer con la acción **destructiva a la
  izquierda** y `Cancelar` + primaria a la derecha.
- **Campos dinámicos:** `field-control` + `field-label` (las clases compartidas), con `select` para
  booleanos, `textarea` para texto largo/JSON/arreglos e `input` para el resto; cada campo lleva una línea
  de ayuda `text-[11px] text-digi-muted` con el tipo y si es obligatorio.

### DÓNDE SE EDITA — regla firme del sistema (2026-07-31)
> **Nunca se edita "por encima".** Está prohibida la edición **inline**: sustituir el contenido que
> el usuario está mirando (una fila, un valor del rail, el título de la cabecera) por sus inputs.
> Toda edición aparece en una **superficie propia sobre un overlay**. Decisión del usuario, sin
> excepciones nuevas.

| Qué se edita | Superficie | Componente |
|---|---|---|
| Un **formulario** (3+ campos, o campos ricos: descripción larga, multi-select, listas) | **Panel lateral DERECHO** con overlay | `EditPanel` (`PixelModal size="md"`) |
| **Uno o dos campos** sueltos que no forman un formulario (cliente, fecha límite, presupuesto min/max, un nombre) | **Ventanita centrada** | `QuickEditDialog` (`PixelModal size="sm"`) |
| Confirmar una acción | Ventanita centrada | `PixelConfirm` |

**Definición única: `components/ui/EditDialog.tsx`.** Exporta `EditPanel`, `QuickEditDialog`,
`EditField` (label + control + ayuda) y `EDIT_INPUT` (clase del campo). Ambas superficies comparten
el **mismo pie**: acción destructiva opcional a la izquierda, `Cancelar` (secundario) + primaria a la
derecha; `Enter` en un `input` guarda (en un `textarea` no, ahí Enter es salto de línea); `busy`
bloquea el cierre mientras guarda. **No** recomponer un panel/modal de edición a mano ni volver a
inputs inline.

```tsx
<EditPanel open={editing} title="Editar requerimiento" onClose={close} onSave={save}
           saving={saving} canSave={!!form.title.trim()}>
  <EditField label="Título"><input className={EDIT_INPUT} … /></EditField>
</EditPanel>

<QuickEditDialog open={editingDeadline} title="Editar fecha límite" onClose={close} onSave={save}>
  <EditField label="Fecha límite" hint="Déjala vacía para quitar el límite.">
    <input type="date" className={EDIT_INPUT} … />
  </EditField>
</QuickEditDialog>
```

Detalles aprendidos al aplicarla:
- El **valor del rail de propiedades** sigue siendo clicable (`cursor-pointer hover:text-accent`); lo
  que cambia es que el clic **abre la ventanita**, no convierte el valor en un input.
- Un **selector con desplegable** (p. ej. `ClientPicker`) dentro de una ventanita centrada necesita
  `min-h-[260px]` en su contenedor: el cuerpo del diálogo es `overflow-y-auto` y, si el alto lo pone
  el contenido, la lista queda recortada.
- Una ventanita **sobre** un panel abierto funciona (editar una subtarea desde el panel "Subtareas"):
  `<dialog showModal>` vive en el *top layer* del navegador.
- **Fuera de `/dashboard`** (portal del cliente, páginas `(main)`/`(public)` con su propio tema
  oscuro) el panel se monta como **isla corp**: envolverlo en
  `<div className="corp dark corp-overlay contents">`. `corp-overlay` evita que la isla imponga el
  fondo y el `min-height` de `.corp`, y **`contents`** (display:contents) la saca del flujo para que
  no altere el `space-y-*` del contenedor — el `<div>` es solo el **ámbito CSS** del diálogo, y el
  selector `.corp .modal-surface` sigue casando porque `<dialog>` permanece en el árbol DOM aunque
  se pinte en el *top layer*.
- **Formularios largos**: dentro del panel no hacen falta límites de ancho (`max-w-sm`) heredados de
  cuando el editor vivía en una tarjeta estrecha — el panel ya acota a 644 px.

### Páginas legales públicas — fuera del tema `.corp`, con definición única (2026-08-01)

`/legal` y `/legal/whatsapp` **no usan el tema `.corp` ni los componentes del panel**, y es
deliberado: las abre gente que no ha entrado nunca a la app —candidatos, empresas clientes y los
revisores de Meta— y deben verse igual pase lo que pase con el tema del dashboard. Por eso llevan
colores literales, no tokens.

Pero "estilo propio" no significa "estilo suelto". Al aparecer la segunda página, lo que estaba
inline en la primera se extrajo:

| Archivo | Qué centraliza |
|---|---|
| `app/legal/estilos.ts` | `pagina`, `articulo`, `h1`, `h2`, `h2Parte`, `ul`, `b`, `link`, `sutil`, `recuadro(tono)`, `tabla`/`th`/`td` |
| `app/legal/datos.ts` | Identidad legal: razón social, nombre comercial, RUC, dirección, contacto |

**Por qué `datos.ts` importa tanto como los estilos:** la dirección de estas páginas ya se había
corregido una vez (decía «Tabacundo, código postal 090102», confundiendo la calle con la ciudad).
Con dos páginas legales y las constantes duplicadas, la siguiente corrección se aplicaría en una y
no en la otra — y eso es una **contradicción publicada** en un documento que lee un revisor de Meta.
Los valores salen de `documentos-negocio/DATOS-NEGOCIO.md`, que a su vez sale del certificado del SRI.

Piezas del catálogo que nacen aquí y son reusables en cualquier página legal futura:
- **`h2Parte`** — encabezado de PARTE, con línea superior. Separa bloques dirigidos a **públicos
  distintos** dentro de un mismo documento (la persona que escribe por WhatsApp / la empresa
  cliente), que es más fuerte que un simple salto de sección.
- **`recuadro('aviso' | 'nota')`** — destacado de una sola definición, en vez de un `div` con
  estilos a ojo cada vez. `aviso` (ámbar) para lo que puede salir mal —el paso irreversible del
  alta—; `nota` (morado) para orientar.
- **`tabla`/`th`/`td`** — inventarios (qué datos se tratan, qué subencargados). Una tabla dice en
  cuatro filas lo que en prosa legal se vuelve ilegible.

### Tonos semánticos (`components/ui/tonos.ts`) — definición ÚNICA de error/aviso/éxito (2026-08-01)

**El tema `.corp` NO remapea toda la paleta de Tailwind.** Solo un conjunto concreto de tonos tiene
override en claro y en oscuro (`app/globals.css`). Escribir `text-red-800` o `text-amber-900`
compila y se ve "más o menos rojo" en claro, pero **queda fuera de la paleta**: en oscuro acaba casi
negro sobre fondo oscuro, y no es ninguno de nuestros colores. Pasó con los avisos del detalle de
flujo, y lo detectó el usuario.

**Los únicos tonos semánticos que el tema redefine en AMBOS temas:**

| | claro (`.corp`) | oscuro (`.corp.dark`) |
|---|---|---|
| `red-400` / `red-300` | `#b3261e` | `#f1707b` |
| `amber-400` / `amber-300` | `#8a6116` | `#e0b34d` |
| `green-400` | `#0e700e` | `#6bb700` |
| `blue-400` | `#0f6cbd` | `#4aa3f0` |

Más overrides explícitos de `bg-*-50`, `border-*-300` y `text-*-600/700`.

**Regla:** el color de un aviso **sale de `TONO`**, nunca escrito a mano en el componente.

```tsx
import { TONO, type Tono } from '@/components/ui/tonos';
<div className={`rounded-lg border ${TONO.aviso.caja} p-4`}>
  <AlertTriangle className={`w-5 h-5 ${TONO.aviso.icono}`} />
  <p className={TONO.aviso.texto}>…</p>
</div>
```

Campos: `texto` · `icono` · `punto` (viñeta) · `caja` (borde + superficie) · `control` (botón) ·
`anillo` (foco). Tonos: `error` · `aviso` · `exito` · **`info` = el morado de marca**, no azul — un
azul suelto sería otro color fuera de la identidad.

**Prohibido:** `-800`, `-900`, `-500`, `emerald-*`, `gray-*` para semántica. No tienen override.
Para neutros, los tokens `digi-*`.

**Detalle de contraste que obligó a un cambio de diseño:** el contador del `BotonAvisos` iba relleno
de color con texto blanco. No funciona: el ámbar del tema es **oscuro en claro** pero **dorado claro
en oscuro**, así que el blanco deja de leerse en uno de los dos. Ahora el contador va sobre
`bg-digi-card` con el tono en el texto y el borde — legible en ambos sin excepciones.

### 📌 REGLA DE FORMULARIOS: solo el título del campo y el campo (Fernando, 2026-08-01)

> **En un formulario se ve el título del campo y el campo a rellenar. Nada más.** Toda
> explicación —para qué sirve, rangos, recomendaciones, avisos, estado— va **dentro del botón de
> ayuda (?)** que se pone a la izquierda del título.

**Por qué.** Un texto de ayuda permanente lo lee todo el mundo una vez y nadie más, pero sigue
ocupando sitio: con cinco o seis campos duplica el alto del formulario y empuja hacia abajo el
botón de guardar. La información **no se pierde** — se mueve a un clic de distancia, y quien ya la
sabe deja de verla.

**Dónde está implementada:** `EditField` (`components/ui/EditDialog.tsx`) y `Campo`
(`AgenteFlowWorkspace`). `EditField` es la definición única de los paneles de edición, así que el
cambio llegó a los **siete** archivos que la usan sin tocar ninguno.

```tsx
// ✅ Así
<EditField label="Clave" hint={<>Identificador corto y estable, en minúsculas: <code>empresa</code>…</>}>
  <input className={EDIT_INPUT} … />
</EditField>

// ❌ Así no
<label>Clave</label>
<input … />
<p className="text-[11px] text-digi-muted">Identificador corto y estable…</p>
```

**Qué SÍ puede quedarse fuera del (?):**
- El **marcador de posición** del campo, cuando lleva estado real (`•••••••• (ya guardada)`).
- Un **contador o dato** en la barra de sección (`14 bloques · 18.396 caracteres`) — es dato, no prosa.
- Los **avisos**, que van al `BotonAvisos` de la cabecera, no repetidos bajo el campo.

**Aplica igual a las barras de sección:** si el `hint` de un `SectionBar` es una frase explicativa
y no un dato, va al (?).

### Botón de ayuda (?) y la burbuja compartida (2026-08-01)

**`components/ui/BotonAyuda.tsx`** — definición ÚNICA para las explicaciones que hacen falta *la
primera vez* y estorban todas las demás. Un párrafo permanente lo lee todo el mundo una vez y nadie
más, pero sigue empujando hacia abajo lo que se viene a usar. Detrás de un (?) sigue a un clic.

**Hermano de `BotonAvisos`, y la diferencia es deliberada:**

| | `BotonAvisos` | `BotonAyuda` |
|---|---|---|
| Propósito | alertar | explicar |
| Color | del tono más grave (rojo/ámbar) | `digi-muted`, accent al pasar |
| Contador | sí | no |
| Sin contenido | **no se pinta** | siempre está |

**`components/ui/burbuja.tsx`** — la mecánica compartida: `usarBurbuja()` (posición en dos pasadas,
acotado al viewport, cierre por clic fuera / Escape / scroll / resize) y `<Burbuja>` (el contenedor
en portal, `z-[80]`). Se extrajo al aparecer el segundo botón: copiar cien líneas de medidas
garantiza que las dos versiones se separen en la primera corrección. Admite `lado`
(`'izquierda' | 'derecha'`).

**Dos correcciones que solo salieron midiendo en el navegador:**

1. **Acotado horizontal.** El vertical ya estaba (la burbuja se salía por arriba). Al añadir el lado
   derecho hacía falta el mismo acotado en X: `max-width` **no basta**, porque solo encoge — no
   reposiciona. Un botón cerca del borde derecho mandaba la burbuja fuera.
2. **El (?) a la izquierda de una etiqueta de campo.** El primer intento lo sacaba fuera con
   `-ml-[26px]` para que la etiqueta siguiera alineada con su campo. Medido: eso deja el botón
   **2px fuera de su columna**, invisible en el ancho de prueba y recortado en cuanto el panel
   tenga menos margen. Y sin `min-h-6` en la fila de la etiqueta, la fila con (?) es **3px más
   alta** y **desalinea los campos de la rejilla**. La forma correcta:

```tsx
<div className="flex items-center gap-1 mb-1 min-h-6">
  {ayuda && <BotonAyuda titulo={label} lado="derecha">{ayuda}</BotonAyuda>}
  <label className="block text-[12px] font-semibold text-digi-text">{label}</label>
</div>
```

La etiqueta queda indentada 28px respecto a su campo cuando lleva ayuda — se lee como intencional,
y **el campo no se mueve**, que es lo que no puede pasar en una rejilla de dos columnas.

> **Gotcha de Tailwind v4:** `min-h-[24px]` **no se generó** en el bundle; `min-h-6` sí. Ante una
> clase que "no hace nada", lo primero es comprobar que existe en el CSS compilado
> (`grep '\.min-h-6{' .next/static/css/*.css`), no revisar el JSX.

### Estudio del agente — lienzo de pipeline (React Flow + ELK, 2026-08-02)

**Qué es:** un **visor del pipeline real** del agente, no un editor de flujos. Cada tarjeta es un
paso que el código ejecuta de verdad y lleva anotado su archivo. Sustituye a las pestañas
«Parámetros» y «Conexión», que pasan a ser **fuentes del propio grafo**.

**La regla que lo gobierna:** *nada se dibuja si no está en el código*, y el contenido de las
fuentes lo sirven **las mismas funciones que usa el runner**. Si la pantalla y el modelo vieran
cosas distintas, el diagrama mentiría — y se usa para decidir.

De ahí la regla visual: **el dato manda sobre la explicación**. En las tarjetas no hay prosa; hay
esquemas reales de entrada/salida y **chips navegables**: dentro de un esquema, cualquier cadena
`"@fuenteId"` se pinta como chip que abre ese recurso. Así se nombra el recurso *dentro del campo
donde interviene*.

**Interacción, y por qué:**
| Decisión | Motivo |
|---|---|
| Los nodos **no se arrastran** | Mover una tarjeta daría a entender que se cambia el flujo |
| Los nodos **no se conectan** | No es un constructor |
| La rueda hace **pan, no zoom** | El diagrama es largo; el zoom vive en los botones |
| Al pulsar un nodo, **la vista viaja hasta él** (`setCenter`, 520 ms) | Recorrer un diagrama largo se siente continuo en vez de a saltos |
| Editar abre el **panel lateral con overlay** | Es la superficie de edición estándar del proyecto; el panel derecho muestra, no pide datos |

**Paleta:** solo tokens de `.corp`. `accent` para la marca y para los pasos con **IA** —que llevan
distintivo propio porque cuestan dinero, tardan y pueden variar entre corridas—, `blue-400` para la
ingesta, `green-400` para el cierre. Nada de hexes propios.

**Archivos:** `lib/agente/estudio/{tipos,pipeline}.ts` (contrato y pipeline declarativo, en el
servidor) · `components/dashboard/flows/estudio/{pipeline-layout,satelites-layout}.ts` (ELK) ·
`PipelineFlow.tsx` (lienzo) · `AgenteEstudio.tsx` (los tres paneles).

**Los cinco gotchas, todos comentados en su sitio:**
1. **`elementsSelectable` TIENE que estar activo.** React Flow pone `pointer-events: none` a un nodo
   que no es seleccionable ni arrastrable ni conectable, y los botones de dentro nunca reciben el
   clic. Cuesta descubrirlo porque el nodo se ve perfectamente.
2. **En los contenedores de ELK, solo espaciados — nunca opciones de algoritmo.** Los espaciados hay
   que repetirlos (no se heredan); repetir `considerModelOrder`/`edgeRouting` hace **reventar** a ELK
   con aristas que cruzan contenedores.
3. **Puertos `FIXED_POS` al centro de la TARJETA, sin `elk.port.side`.** Con abanico, el centro de la
   caja cae en medio del abanico; y declarar el lado hace que ELK ignore la `y` dada.
4. **Las coordenadas de una arista son relativas al ANCESTRO COMÚN de sus extremos**, no al nodo
   donde ELK la guarda. Sumar lo otro deja las aristas internas corridas justo lo que mide su grupo.
   Además hay que concatenar **todas** las secciones y descartar los puntos duplicados: dos idénticos
   meten un `NaN` en el `path` y el navegador descarta la línea entera.
5. **Carga con `dynamic(..., { ssr: false })`.** ELK pesa 1,4 MB. Comprobado que queda en su propio
   trozo: solo se descarga al abrir el Estudio.

**Correcciones tras verlo funcionando (2026-08-02, Fernando):**
- **Los controles de zoom en modo oscuro salían BLANCOS.** React Flow trae su propia hoja con
  blancos fijos, y quedaba un bloque luminoso en mitad del diagrama. Reescritos con los tokens en
  `globals.css` (`.corp .react-flow__controls*`), así que se adaptan solos. Ganan por especificidad
  aunque su hoja cargue después, porque van prefijados con `.corp`.
- **`elk.spacing.edgeNode` de 28 → 44.** Con 28 las líneas pasaban ROZANDO la tarjeta y parecían
  salir de su borde en vez de esquivarla. También subieron `nodeNodeBetweenLayers` (56→76) y
  `nodeNode` (44→64): un diagrama de 18 pasos necesita aire para leerse.
- **Alto: `max(560px, calc(100vh - 250px))`** en vez de un `min(72vh, 780px)` a ojo, que dejaba una
  franja muerta abajo. El mínimo evita que en pantallas cortas quede una rendija.
- **Parámetros y Conexión se editan EN el panel derecho**, sin overlay y sin botón «Editar». Para
  esos dos, ver el JSON y tener que abrir un panel encima es un paso de más: lo que se quiere es
  cambiar el modelo o conectar el número. El panel se ensancha a 460 px y los formularios se fuerzan
  a una columna con `.estudio-en-sitio` — vienen de pestañas a ancho completo. El overlay se reserva
  para lo que necesita sitio de verdad: prompts largos y conocimiento.

**Cómo se comprueba:** `node --import ./scripts/registrar-ts.mjs scripts/probar-estudio-layout.mjs`
— ejecuta **el mismo archivo de colocación que usa la app** y verifica que cada arista nace en el
borde inferior de su origen y muere en el superior de su destino (es la que caza el fallo del
ancestro común), que ningún nodo pisa a otro contando abanicos, y que el hueco declarado a ELK
coincide con lo dibujado.

### Ranura de acciones del pie (`components/dashboard/PieAcciones.tsx`, 2026-08-02)

Los lanzadores de **chat, mis chats, notificaciones y GCC Bot** ya no flotan: viven **dentro de la
barra de ruta**, a la derecha. Sus paneles siguen abriéndose flotando justo encima.

**Qué resolvía flotar, y qué costaba:** eran cuatro píldoras de 40 px con sombra ancladas abajo a la
derecha, **encima del contenido**. Y se colocaban **midiéndose entre ellas**: `NotificationsDock` era
el ancla y los otros dos leían su `getBoundingClientRect()`, con dos temporizadores de reintento y un
valor de reserva escrito a mano (`232`) por si el ancla no se pintaba — que no siempre se pinta.

**Ahora:** cada lanzador se **porta** a `#pie-acciones` con `<EnElPie orden={n}>`, y el orden lo da un
`flex`. **Cero mediciones, cero valores de reserva, cero temporizadores.**

```tsx
<EnElPie orden={20}>
  <BotonPie Icon={Inbox} label="Mis chats" activo={abierto} sinLeer={7} onClick={…} />
</EnElPie>
```

`orden` fija la posición de izquierda a derecha **independientemente del orden de montaje**, que
cambia según la página (el bot de cotizaciones solo existe en el detalle de un proyecto).

**El botón del pie (`BotonPie`) no es la píldora de antes.** Alto 26 px para caber en los 36 del pie,
**sin sombra y sin relleno de color**: aquí ya no flota sobre el contenido, forma parte de la barra, y
una píldora morada con sombra dentro de una barra fina se lee como un parche. El acento aparece al
pasar por encima y cuando está abierto. La etiqueta se esconde por debajo de `sm`; el icono basta.

**Dos detalles medidos, no supuestos:**
- La barra pasó de `overflow-x-auto` a `overflow-visible`, con el desplazamiento movido al contenedor
  de las migas. Con el anterior, **el contador de sin-leer quedaba recortado** por arriba.
- Comprobado a 1440, 1024 y 640 px: los cuatro botones caben dentro de los 36 px del pie, el contador
  no se recorta y el orden se mantiene.

**Si la ranura no existe** —una página fuera del panel— `EnElPie` **no pinta nada**, en vez de caer a
una posición flotante: un botón que asoma un instante en una esquina y salta al pie se ve peor que uno
que aparece ya en su sitio.

### Detalle del agente IA — dos vistas, sin rail (2026-08-02)

**Fuera el rail lateral.** Tenía cuatro secciones —Bandeja, Conocimiento, Prompts, Estudio— y tres
de ellas **ya se alcanzaban desde el Estudio**, donde conocimiento, prompts, parámetros y conexión
son recursos del propio grafo. El rail se había convertido en un índice de cosas que ya estaban
dentro, y se comía 240 px de ancho en todas las pantallas.

Quedan **dos vistas** y un conmutador:

| | |
|---|---|
| **Bandeja** | Lo que se ve al abrir. Es donde se trabaja a diario |
| **Estudio del agente** | El pipeline, y desde ahí todos los recursos |

**El conmutador va a la altura del título de cada vista**, dentro de su `SectionBar` —no en una
barra propia: una franja más solo para dos botones es alto que se le quita al contenido. Cada vista
pone su propio título y su propio resumen, así que al cambiar cambia todo el encabezado, no solo el
cuerpo.

```tsx
<SectionBar title="Conversaciones" hint="…">{conmutador}</SectionBar>
<SectionBar title="Estudio del agente" hint="18 pasos · 12 recursos">{conmutador}</SectionBar>
```

### `LongTextDialog` — ventanita centrada ANCHA (2026-08-02)

Variante nombrada de `QuickEditDialog` para **un solo campo de texto largo**: un prompt, una
plantilla, un fragmento de código.

**Sigue siendo centrada** porque lo que decide la superficie es *si es un formulario*, y un prompt no
lo es: es un campo. Pero `max-w-sm` (384 px) es inservible para un texto de miles de caracteres —
cada línea se parte tres veces y no se puede leer lo que se escribe. Usa `max-w-2xl`.

> **Si dentro va más de un campo, esta no es la superficie:** `EditPanel` (panel lateral).

Los prompts del agente se editan así desde el Estudio. El conocimiento, que sí es un formulario con
lista, sigue yendo al panel lateral.

### Diálogos de acceso y alta — `AuthSurface` (2026-08-02)

**`components/landing/AuthSurface.tsx`** es la definición única del armazón y los campos de los
cinco diálogos de la portada: alta de cliente, acceso de cliente, acceso de miembro, recuperación de
cuenta y cuenta de candidato.

**Qué había antes:** cinco formularios escritos cada uno con su propio pixel art —`Silkscreen` en las
etiquetas, bordes de 2 px, botones en mayúsculas—. Parecidos pero no iguales, y **ninguno se parecía
al panel al que llevan**.

**Cómo se resolvió:** con el patrón que el proyecto ya tenía —**isla `.corp dark`** sobre la
portada—. `corp-overlay` hereda tokens y tipografía del panel sin imponer el fondo de página ni el
`min-height:100vh` de `.corp`; el velo lo pone el propio overlay.

> **Descubrimiento útil:** dentro de la isla, `.corp` **ya reescribe `pixel-btn` a Fluent**
> (`globals.css`). Los tres diálogos de acceso conservan sus clases de botón y se ven correctos sin
> tocarlas — bastó con retematizar sus constantes de estilo en línea para que leyeran
> `var(--color-digi-*)` y meter el velo en la isla. No hizo falta reescribir su JSX ni su lógica de
> pasos.

**Piezas:** `AuthDialog` (velo, tarjeta, cabecera con chip de icono, cuerpo `bg-digi-darker`, pie) ·
`Campo` · `Casilla` (se tiñe `bg-accent-light` al marcar) · `ErrorAuth` · `BotonAuth` (con `Loader2`,
nunca un spinner pixel) · `EnlaceAuth` · `INPUT`.

**Detalles de comportamiento que se ganaron de paso:**
- Cierra con **Escape** y con clic en el velo, como el resto de diálogos.
- **Bloquea el desplazamiento del fondo**: sin eso la portada se movía detrás al usar la rueda.
- El aviso de «las contraseñas no coinciden» aparece **mientras se escribe**, no al enviar:
  descubrirlo después de pulsar el botón obliga a volver a los dos campos.
- Los `autoComplete` correctos (`name`, `email`, `tel`, `street-address`, `new-password`), que el
  pixel art no tenía y hacen que el gestor de contraseñas funcione.

### Centro de documentación legal — un registro, no páginas sueltas (2026-08-02)

Cada servicio nuevo trae su parte legal. Sin un registro, eso acaba en páginas repartidas por el
sitio, enlazadas de formas distintas desde sitios distintos, y con la navegación de cada una escrita
a mano. A los tres servicios ya nadie sabe qué documentos existen ni si el enlace que se puso en un
formulario sigue siendo el bueno.

**`lib/negocio/legal.ts`** declara cada documento una vez: ruta, a quién habla, **qué papel jugamos**
—responsable o encargado, que es lo que más confunde— y **qué puntos se enlazan desde fuera**.

De ese registro salen los tres sitios, así que **añadir un servicio es tocar un solo archivo**:

| Sale del registro | Qué muestra |
|---|---|
| El índice de `/legal` | Todos los documentos, con su público y sus puntos destacados |
| La barra lateral de **todos** los documentos | La lista completa, con el actual marcado — se navega entre documentos como en una documentación, sin volver atrás |
| `sitemap.xml` | Las URLs, sin escribirlas a mano |

**Cómo se añade un servicio:** crear `app/(sitio)/legal/<id>/page.tsx` con `DocumentoLegal` y añadir
su entrada al registro. **No hay un tercer sitio que tocar** — comprobado metiendo un documento de
prueba y verificando que los tres lo recogen sin editarlos.

**`enlaceLegal(documento, punto?)`** da la URL estandarizada para enlazar desde donde sea —un
formulario de alta, el aviso de cookies, el panel de Meta, un contrato—: el enlace sale de una
función y no de la memoria de quien escribe.

> ⚠️ **Una URL publicada no se cambia.** `/legal` y `/legal/whatsapp` con sus anclas están declaradas
> en la app de Meta y enlazadas desde formularios. Reorganizar la navegación **añade puertas, no
> mueve habitaciones**.

## CV público — `/cv/<token>` (2026-08-14) · **TEMA CLARO**

⚠️ **Es el ÚNICO sitio público en claro, y es a propósito.** Decisión de Fernando
(2026-08-14): *«el tema oscuro es propio interno de la app»*, así que **lo que se comparte
por un enlace va en claro**. Un currículum se lee, se compara con otros y a veces se
imprime; en negro deja de parecer un documento.

**Alcance: solo `/cv`.** `/negocio`, los legales, el calendario público y las listas de
contactos **siguen como están** — «ya funcionan bien con esa normalidad». No se generalice
esta paleta sin preguntarle.

### La paleta (literal, como todo lo que se sirve a terceros)
| Uso | Valor |
|---|---|
| Papel | `#f6f5f9` · tarjetas `#ffffff` · huecos de imagen `#f2f0f7` |
| Violeta de marca | `#4b2d8e` (botones, cifras) · `#7b5fbf` (iconos, bordes, fondos al 7-10 %) |
| **Violeta de TEXTO** | **`#5b3fa8`** |
| Texto | `#1c1b22` titulares · `#56545f` cuerpo · `#86838f` secundario · `#a3a0ac` tenue |
| Líneas | `#e6e3ee` · `#cfc9de` la fuerte |
| Tipografía | **Inter**, fijada en el `style` del layout |

⚠️ **Dos trampas al pasar de oscuro a claro, y las dos se ven en cuanto lo miras:**
- **El violeta de texto tiene que ser OTRO.** El `#a78bfa` que funciona sobre `#0b0d14` no
  llega a AA sobre blanco. Sobre papel se usa `#5b3fa8`.
- **En claro hace falta sombra.** El realce del sitio oscuro es solo de borde; sobre blanco,
  una tarjeta con borde y sin sombra **no se despega del fondo**. `.cv-tarjeta` lleva
  `0 1px 2px` en reposo y `0 6px 18px` violeta al hover, además del borde.

### ⛔ EXCEPCIÓN PUNTUAL a la regla «el diseño de lo público se acuerda antes»
Fernando la levantó **para esta página y solo para esta** el 2026-08-14: *«esta vez propón tú
el diseño»*. Para `/negocio`, `/recursos`, `/contacto` y cualquier página pública futura,
**la regla de §«El diseño de estas páginas lo decide Fernando, conmigo, ANTES» sigue vigente**.

### Ficha a la izquierda + UNA pestaña a la derecha (2026-08-14, 2ª pasada)
Fernando lo reorganizó al verlo funcionando. **La ficha concentra lo que se consulta** y el
panel **enseña solo la pestaña activa**, no todo seguido.

| Zona | Qué lleva |
|---|---|
| **Ficha** (izquierda, `sticky top-0 h-screen overflow-y-auto`) | Foto · nombre · titular · ubicación · **aspiración salarial** · **Disponibilidad** (estado, jornada, modalidad, nota y el horario de atención como detalle) · **Aptitudes** (skills e idiomas) · contacto · botón de PDF · pestañas |
| **Panel** (derecha) | Franja de cifras (siempre) + **una** de: Perfil · Trayectoria · Portafolio |

**Por qué disponibilidad y aptitudes bajaron a la ficha:** son bloques cortos que en el panel
grande dejaban medio ancho vacío, y son justo lo que alguien vuelve a mirar. **Por qué la
ficha es fija:** quien lee un CV vuelve todo el rato a «quién es y cuánto pide»; si eso se va
con el scroll, hay que subir para comprobarlo.

| Ancho | Maqueta |
|---|---|
| `lg+` | `grid [360px_1fr]` (`xl`: 400). Ficha fija a la izquierda; pestañas **verticales** con filete violeta bajo el botón de PDF |
| `md` | Una columna. La ficha se apila arriba; las pestañas pasan a **píldoras en una barra pegajosa** (`sticky top-0` + `backdrop-blur`) |
| `< md` | Una columna, pestañas deslizables y **barra inferior fija** con «Descargar en PDF» + correo + teléfono. El contenedor lleva `pb-28` para que la barra no tape el pie |

⚠️ **Los tres paneles siguen en el DOM, ocultos con `hidden`.** Desmontarlos dejaría un CV de
una sola sección para quien no ejecute JavaScript o recorra el documento con un lector.

⚠️ **`mt-auto` en el pie del panel.** En «Perfil» —tres líneas de biografía— quedaba colgado a
media pantalla con un vacío enorme debajo. El `<main>` es `flex flex-col lg:min-h-screen`.

### Una tarjeta sin imagen NO pinta un recuadro gris
Con cuatro de once proyectos sin foto, esos marcos vacíos ocupaban media rejilla y el
portafolio parecía roto. Misma regla que el sitio público: **una lista vacía no deja hueco ni
«próximamente»**.

### La franja de cifras — el «de un vistazo»
Cuatro recuadros bajo la portada: **Disponibilidad · Trayectoria · Talentos · Portafolio**. Un
recuadro **no se pinta si su cifra es 0** (misma regla que el sitio: una lista vacía no deja
hueco ni «próximamente»). Los años salen del primer año declarado en cualquier experiencia.

### ⚠️ ANIMACIÓN LIGADA AL SCROLL: **NUNCA** TOCAR LA OPACIDAD
`.cv-anima` y `.cv-cascada` usan `animation-timeline: view()` dentro de
`@supports` + `prefers-reduced-motion: no-preference`, como `.tema-anima`. **Pero animan solo
`translateY`, no `opacity`, y esa diferencia no es de gusto.**

Un `animation-timeline: view()` cuyo recorrido **no avanza** se queda en el primer fotograma.
Pasa siempre que la página no se desplaza: ventana muy alta, contenido corto, o el modo de
captura de página completa de un navegador. Con `opacity: 0` de partida, eso es **la página en
blanco**. Medido: captura a 390 px con todo lo que había bajo la portada vacío.

La regla de `/negocio` («el truco de opacidad 0 + IntersectionObserver deja el contenido
oculto si el script no llega») **se aplica igual a las animaciones nativas**: no es el
JavaScript lo que falla, es empezar en invisible. **El peor caso admisible es un bloque 18 px
descolocado.**

`.cv-entra` (la portada) sí va de `opacity: 0` a `1`, y ahí es correcto: es una animación **por
tiempo**, que siempre termina, y el elemento está en pantalla desde el primer fotograma.

### Catálogo propio de la página
| Pieza | Qué es |
|---|---|
| `.cv-tarjeta` | `border white/[0.08]` + `bg white/[0.02]`, realce de **borde violeta** y `-2px` al hover / `focus-within` |
| `Cifra` | Recuadro de la franja: rótulo en versalitas + icono violeta + valor de 17 px |
| `Hito` | Entrada de trayectoria: filete a la izquierda que se tiñe al hover, título 16 px, empresa en violeta, fecha a la derecha en `tabular-nums`. **Filete y no caja**: a diez entradas, diez recuadros cansan |
| `Chips` | Skills (violeta, destacado) e idiomas (neutro) |
| `PildoraDisponibilidad` | Punto + texto; verde si está libre, gris si no |
| Pestañas | `.cv-pestanas` + `-v` (filete a la izquierda) / `-h` (píldoras). Son `<button role="tab">` con `aria-selected` y `aria-controls`, no `div` con `onClick` |
| `FichaBloque` | Tarjeta de la ficha: rótulo en versalitas violeta sobre fondo blanco |
| `PortafolioPublico` | Rejilla + visor. `<dialog>` **nativo** (foco atrapado, Escape, capa superior) con `m-auto` — el reajuste de Tailwind le pone `margin: 0` y lo deja arriba a la izquierda |

### El PDF es OTRO diseño, no esta página impresa
`lib/members/cv-pdf.ts`, PDFKit. Columna lateral **a sangre** de 196 pt en `#181231` con la foto
y los datos de decisión; contenido en blanco a la derecha. De la página 2 en adelante **no se
arrastra la columna** —sería un tercio del papel en blanco—: un filete violeta arriba cose las
páginas y el contenido va a ancho completo. Pie con nombre + fecha + `n / total`, **medido y
recortado a mano** con `widthOfString` (`lineBreak: false` y `ellipsis` no bastaron).
Hay un `@media print` en la hoja de la página, pero solo como red de seguridad para quien pulse
Ctrl+P: **el documento bueno es el del botón.**

## Desviaciones detectadas y resolución

### 2026-08-03 · El sitio público era un lenguaje visual sin documentar · **ADOPTADO como estándar**
`components/sitio/piezas.tsx` nació el 2026-08-02 con el sitio público y montó un lenguaje
visual completo —fondo `#0b0d14`, Inter, tarjetas de borde tenue, héroe con resplandor
radial— que **no estaba en este documento**, que seguía diciendo que la app tenía tres.
No es una desviación accidental: es un lenguaje **necesario y bien construido** (una sola
fuente de piezas, sin librería de UI, Server Components). Resuelto **adoptándolo**: sección
"Sitio público" nueva y el índice de arriba pasa a cuatro lenguajes. Detectado al abrir el
objetivo de SEO de `/negocio`.

### 2026-08-03 · La pantalla de Plantillas se escribió «parecida» y no igual · **CORREGIDO**
La columna de plantillas y la de listas hacían lo mismo que las del correo masivo pero se
veían distintas: botones siempre visibles, con borde y en otro color, en vez de iconos
pegados al borde derecho que aparecen al pasar el puntero; y `<input type=checkbox>` nativo
en vez del botón con `Check` dentro. **La causa no fue el detalle sino el método**: se
escribió un marcado equivalente en lugar de usar el control. Lo vio Fernando al poner las
dos pantallas juntas. Resuelto usando `FilterRail` de verdad y replicando el marcado de
`ListGroup`, con nota en el código de que se copió a propósito. → regla nueva en «do/don't».

### 2026-08-03 · Páginas de acceso con formulario propio · **CORREGIDO, y eliminado**
`/auth/{tipo}` se hizo como páginas con un formulario escrito aparte que imitaba al diálogo
de la portada. Se parecía, no era. El problema de fondo eran **dos formularios de acceso
que mantener**. Resuelto convirtiendo las rutas en **redirecciones** a `/?acceso={tipo}`:
la portada abre el diálogo que ya existe. Cero duplicación.

### 2026-08-03 · `max-h-[Nvh]` usado para «llenar» · **CORREGIDO**
La Bandeja del agente y los paneles del Estudio usaban un techo donde querían un relleno.
Con poco contenido medían lo que su contenido y dejaban media pantalla muerta. → alto
medido con `useAltoHastaElPie` + `flex-1 min-h-0` en la zona que se desplaza.

### 2026-08-03 · Caja de aviso permanente en la pantalla de Conexión · **MOVIDA**
La advertencia sobre comprobar la coexistencia ocupaba media pantalla y repetía en cada
visita algo que se lee una vez, el día del alta. Pasó detrás de `BotonAyuda`, colgando del
dato «Coexistencia»; el estado sigue a la vista en su insignia.
- **2026-08-01 — AUDITORÍA DE COLOR del ámbito `.corp`: 117 usos fuera de paleta en 26 archivos.**
  La disparó Fernando al ver los avisos del detalle de flujo. El barrido completo se hizo con un
  script que compara cada clase contra los tonos que `globals.css` remapea en claro **y** en oscuro.
  Clasificación y resolución:

  | Qué | Cuántos | Clasificación | Resolución |
  |---|---|---|---|
  | `text-red-800`, `text-amber-900`, `text-amber-500/800`, `text-green-500`, `text-blue-300` | ~15 | **(b) Desviación** — sin override, casi negros sobre fondo oscuro | ✅ **Corregidos** al `-400` remapeado, y extraído `components/ui/tonos.ts` |
  | `violet-*`, `sky-*`, `emerald-*` | ~12 | **(b) Desviación grave** — son **otros colores**, no versiones de los nuestros | ✅ **Corregidos**: `violet→accent`, `sky→blue-400`, `emerald→green-*` |
  | `bg-red-500/10`, `bg-amber-500/15`, `bg-green-500` como punto | ~85 | **(c) Ambiguo** — funcionan en ambos temas | ⏸ **Se dejan**, decisión de Fernando (2026-08-01) |
  | `PixelBadge`, `PixelConfirm` (`-900/20`, `-700/50`) | ~10 | **No es drift** | Los gobierna `.corp .pixel-badge` en CSS; esas clases son el respaldo fuera de `.corp` |

  **El hallazgo que más importa:** `text-violet-400` (#a78bfa) y `text-violet-500` (#8b5cf6) se
  usaban donde tocaba el **accent de marca** (#4B2D8E claro / #8267d4 oscuro). Es decir, un violeta
  **distinto del nuestro** en la app de un grupo cuya identidad ES el violeta. No lo caza ningún
  linter: compila y «se ve morado».

  **Trampa al corregir en masa, y cómo se cazó:** sustituir `border-violet-400/30` por
  `border-accent/40` deja `border-accent/40/30` — dos opacidades encadenadas, clase inválida que
  Tailwind ignora en silencio. Salieron 4. Se detectaron **releyendo el resultado**, no confiando en
  el `subn`. Regla: tras un `sed`/regex masivo sobre clases, **buscar el patrón roto** antes de dar
  nada por hecho.

- **2026-08-01 — `STAT_TONE` de `FlowPanelUI` duplicaba el vocabulario semántico.** Tenía su propio
  mapa `success/info/warning/danger` con las clases escritas a mano. **Corregido:** ahora referencia
  `TONO`, así que el verde de «éxito» es el mismo en las tarjetas de resumen y en los avisos.

- **2026-07-31 — Detalle de proyecto: SEIS ediciones inline ("por encima") → CORREGIDAS.**
  `projects/[id]` editaba el **requerimiento** sustituyendo la fila por tres inputs (captura del
  usuario), el **cliente**/**presupuesto**/**fecha límite** convirtiendo el valor del rail en campos
  con botones `OK`/`X` de 11px, el **nombre** reemplazando el `DetailHeader` entero, y la
  **subtarea** dentro del panel de Subtareas. **Resuelto:** se creó la definición única
  `components/ui/EditDialog.tsx` y las seis pasaron a panel derecho (requerimiento y descripción) o
  ventanita centrada (cliente, presupuesto, límite, nombre, subtarea). De paso, el panel del
  requerimiento gana **Talentos** y **Plazas**, que solo se podían fijar al crearlo — por eso salían
  requerimientos con "plazas sin definir" imposibles de arreglar desde la UI. Verificado `tsc` +
  `next build`.
- **2026-07-31 — Barrido del resto de ediciones inline de la app → CORREGIDAS.** Mismo defecto en
  cinco archivos más, todos migrados a `EditPanel`:
  - **`tickets/[id]`** — el editor de **días de trabajo** sustituía la tarjeta de 300 px del panel
    izquierdo y, mientras editaba, **escondía las acciones de la cabecera** y el banner de solicitud
    (`!editingSlots` repartido por el archivo). Ahora es panel derecho; el título y el botón primario
    cambian según el caso (`Aceptar (N días)` cuando es una solicitud del cliente, `Guardar (N días)`
    si no). Se quitaron los `max-w-sm` que venían de la tarjeta estrecha.
  - **`components/projects/IncidentDetailPanel.tsx`** (pestaña Incidentes del detalle de proyecto) —
    el modo edición reemplazaba la vista completa; además sus campos y botones estaban en pixel
    antiguo (`text-[8px]`/`text-[9px]`). Panel derecho con `EditField`, severidad como grupo de 4
    botones con **etiquetas en español** (Baja/Media/Alta/Crítica, antes `low`/`medium`/…).
  - **`app/portal/[projectId]`** (portal del cliente) — al editar una incidencia, el acordeón
    desplegado se convertía en el formulario (título, criticidad, descripción y **gestión de
    imágenes**). Ahora abre el panel como **isla `corp dark`**; el acordeón se queda en modo vista.
  - **`app/(main)/tasks` y `app/(public)/panel/tasks`** (son el **mismo archivo duplicado**) — el
    título y la descripción se editaban sobre la tarjeta. Panel derecho, también como isla corp.
  Verificado `tsc` + `next build`. **Ya no queda edición inline en la app**, con una excepción
  consciente: en `GestionDeDatosSystem` el selector de premisas de un código se despliega dentro del
  panel *glass* del grafo — es una **selección** dentro de la superficie de detalle, no un formulario
  que tape contenido.
- **2026-07-30 — Automatizaciones: borrar un flujo usaba `confirm()` del navegador → CORREGIDO.**
  `FlowsTable.handleDelete` abría el diálogo nativo, que el sistema prohíbe explícitamente
  (fila "Confirmar" del catálogo). Y el texto se había quedado corto: desde la relación N:M,
  borrar un flujo **arrastra sus campañas, listas de contactos y contactos**, y el aviso no lo
  decía. Sustituido por `PixelConfirm` en rojo, con el alcance real del borrado — el mismo
  mensaje que ya usa la página de detalle del flujo.
- **2026-07-30 — Automatizaciones: los TRES editores de flujo seguían en pixel antiguo → CORREGIDOS.**
  `FlowsTable` se migró a Fluent el 2026-07-05, pero los paneles que abre con "Configurar"
  (`FlowSidePanel` email masivo · `WhatsAppFlowPanel` · `ChatbotFlowPanel`, ~2.750 líneas) se
  quedaron fuera: bordes de 2px, textos de **8-9px**, `pixel-btn-*`, botones de tabla como cajitas
  de color, siglas de texto en lugar de iconos, `X` para borrar, y **cada archivo con su propio
  overlay, cabecera y pasos** (tres versiones distintas del mismo control). Además el banner de
  Comandos Violeta (`z-[60]`) se superponía a la cabecera del panel (`z-40`).
  **Resuelto:** se extrajo `FlowPanelUI` como definición única (shell, sub-cabecera, sección, pie,
  pasos, tarjetas de resumen, fila de archivo, estado vacío y clases de campo/botón-de-fila) y los
  tres paneles se reescribieron sobre ella; el overlay subió a `z-[70]`. Verificado `tsc` +
  `next build`. **Pendiente de revisión visual del usuario** en los tres tipos de flujo.
- **2026-07-29 — Recordatorios: el botón "Nuevo recordatorio" recomponía las clases de `BTN_PRIMARY`
  a mano → CORREGIDO.** `recordatorios/page.tsx` tenía la cadena completa (`inline-flex … bg-accent
  text-white … hover:bg-accent-hover …`) escrita inline en vez de usar la constante, aunque el mismo
  archivo ya importaba `BTN_PRIMARY`/`BTN_SECONDARY` y los usaba en el panel de detalle. Es
  exactamente lo que rompe el diseño vinculado: un cambio en `components/ui/Button.tsx` no habría
  llegado a ese botón. Sustituido por `${BTN_PRIMARY} shrink-0`. **Regla:** nunca recomponer las
  clases de un botón — usar la constante y añadir solo modificadores de layout.
- **2026-07-26 — Pantalla de carga del juego, fuera del estándar → CORREGIDA.** `GodotGame.tsx`
  pintaba su propia espera: texto gris genérico, barra **redondeada** del lenguaje del dashboard,
  morado `#7c5ad0` **a mano** (ni siquiera el token de marca), fondo `#0d0b14` repetido en tres
  sitios y **sin `BrandLoader`**, que el sistema exige en toda pantalla de carga. Se extrajo a
  `GameLoadingScreen` (definición única), la barra pasó a `.pixel-progress` y el negro a
  `--color-void`. Ver "Landing / juego — pixelart oscuro".
- **2026-07-25 — Vista "Universo" de Fuentes: construida y RETIRADA por decisión del usuario.**
  Se implementó el esquema de la base como grafo de fuerzas (219 nodos, jerarquía + FKs, filtros por tipo,
  iconos de lucide trazados en canvas) junto a la vista de tabla, con un conmutador segmentado. El usuario
  la evaluó y concluyó que **la idea no aportaba**: se eliminó el grafo, su API de relaciones y el
  conmutador; **Fuentes tiene una sola vista, la de tabla**. No re-proponerla. (Se conservan el rail en
  árbol y el ajuste de alto, que sí quedaron.)
- **2026-07-25 — Los dos modales de la landing seguían en pixelart (fuera del estándar serio).**
  `EntryChoiceModal` y `OnboardingSlidersModal` usaban Silkscreen + bordes 2px morados + emojis
  (✕ ▸ ⚠ ● ›) + hex crudos (`#0e1118`, `#151a26`, `rgba(123,95,191,…)`) en estilos inline por archivo,
  con un layout que dejaba huecos (grilla 3+1 en "Los 4 Pisos", modal de 860px con mucho aire).
  **Resuelto:** rediseñados al **tema del dashboard en modo oscuro** (`corp dark corp-overlay`), con
  iconos **lucide**, componentes compartidos (`Button`, `PixelInput`, `PixelTabs`, `PixelBadge`),
  tokens en lugar de hex, wizard con **rail de pasos** y contenido recompuesto (edificio de pisos,
  líneas de tiempo, grid de valores). Ver la sección "Modales de la landing…". Verificado `tsc` +
  `next build` + recorrido real de los 8 pasos en el navegador (capturas). **Nota:** el resto de los
  modales de la landing (`AccountRecoveryModal`, `MemberLoginModal`, `ClientLoginModal`,
  `ProposalPendingModal`, `CharacterGameplay`/`SignupForm`) **sigue en pixelart** → hoy el flujo mezcla
  los dos lenguajes; migrarlos a la misma isla `corp dark` queda **pendiente** (decisión del usuario).
- **2026-07-21 — Detalle de proyecto: se eliminaron las pestañas (mismo criterio que ticket).**
  `projects/[id]` usaba el rail de secciones con pestañas (Resumen / Requerimientos / DigiMundo /
  Imágenes) y `SectionRailItem` local. Se **combinó Resumen + Requerimientos en la columna
  principal** (descripción, requerimientos, equipo, propuestas, solicitudes, progreso y acciones,
  todo apilado sin pestañas) y se movieron **DigiMundo** e **Imágenes** al **panel lateral
  derecho**, en orden **Propiedades → DigiMundo → Imágenes** (rail derecho ensanchado a
  `lg:w-[360px]`). La grilla de imágenes se ajustó a `grid-cols-3 sm:grid-cols-4` para el ancho del
  rail. Se eliminaron `ptab`/`setPtab` y `SectionRailItem`. Verificado tsc + build. Refuerza el
  patrón "sin pestañas, un solo espacio" ya adoptado en `tickets/[id]`.
- **2026-07-21 — Detalle de ticket: se eliminaron las pestañas y se unificó en un solo panel.**
  `tickets/[id]` usaba un rail de secciones con pestañas (Resumen / Acciones / Propuestas) y
  `SectionRailItem` local. Por pedido del cliente se **fusionó Resumen + Acciones en un único
  panel** (una sola tarjeta con sub-secciones separadas por `border-b`: Descripción → Días de
  trabajo → Registro de trabajo/sesiones), sin componente de pestañas. Propuestas queda como
  tarjeta apilada debajo cuando el ticket está abierto. Se introdujo un encabezado de sección
  reutilizable **`SectionHead`** (icono accent + título display en mayúsculas + burbuja de conteo
  opcional + slot de acción a la derecha) como patrón para agrupar contenido dentro de una tarjeta
  sin pestañas. El **property rail** derecho (metadatos + "Acciones rápidas") se mantiene. Verificado
  tsc + build. Nota: `SectionHead` es hoy local a `tickets/[id]`; si se reusa en otra página,
  extraerlo a un componente compartido (principio de diseño vinculado).
- **2026-07-19 — El mapa de iconos de dimensión estaba duplicado en 3 archivos.** `DIM_ICON`
  (laboral/corporal/mental/social → lucide) se reescribía a mano en `mi-dia/page.tsx`,
  `HorarioDeVidaSystem.tsx` y `KnowledgeGraph.tsx` (como `ICON_COMP`, superset con ticket/proyecto).
  Los gráficos de Pensamientos habrían sido la **cuarta copia**. **Resuelto:** extraído a
  `components/centralized/dimensionIcons.ts` y los tres consumidores migrados (el de KnowledgeGraph
  compone `{...DIMENSION_ICON, ticket, project}`). Verificado tsc + build.
- **2026-07-19 — La paleta de dimensiones no es segura para daltonismo.** Comprobado con un
  validador: mental `#ec4899` ↔ corporal `#14b8a6` = **ΔE 3.7 en deuteranopia** (mínimo 8), y
  `#14b8a6`/`#eab308` por debajo de 3:1 de contraste sobre fondo claro. **Decisión:** NO tocar
  `DIMENSION_COLOR` (es canónica en Apoyo/Mi día/Horario; cambiarla repintaría medio dashboard) y
  compensar con **forma + icono + vista de tabla** en todo gráfico por dimensión (ver catálogo).
  Pendiente evaluar un re-escalonado de la paleta si algún día se rediseña Apoyo → PROPUESTAS.md.
- **2026-07-19 — El RAIL DE FILTRO estaba duplicado inline en ~13 sitios.** El control de la
  captura del usuario (tarjeta + título en mayúsculas + ítems icono/label/burbuja de conteo,
  activo con `bg-accent-light` + barra izquierda `border-accent`) NO era un componente: se
  reescribía a mano como `RailItem`/`SectionRailItem` local en `tickets`, `projects`,
  `tickets/[id]`, `projects/[id]`, `clients`, `subscriptions`, `invoices`, `support`,
  `centralized`, `admin`, `marketplace`, `flows` y `ReclutamientoSystem`. Contradice el
  principio de **diseño vinculado** (un cambio de estilo obligaría a tocar 13 archivos).
  **Resuelto parcialmente:** se creó la definición única
  **`components/ui/FilterRail.tsx`** (`<FilterRail title items value onChange hideZeroCounts />`,
  `items = {value,label,Icon,count}[]`), calcada del canónico
  `ReclutamientoSystem.tsx:53-76`, y la usan los dos consumidores nuevos (**Gestión Social** y
  **Experiencias**). **PENDIENTE:** migrar los ~13 rails antiguos a este componente (ver
  PROPUESTAS.md). Regla desde ahora: cualquier rail de filtro nuevo **importa `FilterRail`**;
  no se recompone a mano.
- **2026-07-09 — Correos con estilo "videojuego" (Courier, fondo oscuro, morado, bordes pixel).** El
  `emailShell` de `resend.ts` y sus plantillas usaban `'Courier New'`, `#0A0E17`, `#7B5FBF`, `border:2px` →
  inconsistente y poco serio. **Resuelto:** reescrito al tema `.corp` con helpers reusables (ver sección
  "Correos electrónicos"); las plantillas Arial de otras rutas se alinearon a los mismos tokens. `tsc`+`build` OK.
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

### Días de trabajo — horas opcionales (2026-07-22)
En el editor de días (`tickets/[id]`, `renderSlotEditor`) los `PixelInput type="time"` **Inicio/Fin** ahora se
muestran **siempre** (label "Inicio/Fin (opcional)" en días normales; "Inicio/Fin" en días Evento donde son
obligatorios). Debajo de cada día, nota `text-[10px] text-digi-muted` que explica el efecto (bloque ocupado en Mi
día + acción «Sesión» con costo `duración × $tarifa/h`). Reusa controles y tokens existentes; sin nuevos estilos.
