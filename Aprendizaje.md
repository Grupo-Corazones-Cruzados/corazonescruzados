# Aprendizaje — Sistema "Gestión de Datos" (Centralizado · pilar · fundamentación)

> Documento vivo de la skill `/aprendizaje`. Acumula todas las preguntas técnicas y sus
> respuestas hasta dominar el problema y resolverlo sin fallos.
>
> **Estados de pregunta:** ❓ Abierta · 🔎 Investigando · ✅ Resuelta · ⏸ Bloqueada (espera al usuario)

## Objetivo ACTUAL (declarado 2026-07-19, 3ª parte) — JUEGO GCC WORLD: motor, librerías y arquitectura

**Rol asumido:** *arquitecto de motor de videojuego web + diseñador de sistemas/economía de juego.*
Elegido porque la decisión crítica no es artística sino de arquitectura: qué capa de render se
reemplaza, qué se conserva, y cómo se hace **autoritativa en servidor** una economía cuyas fichas
se canjean por productos y servicios REALES.

### Necesidad (verbatim del usuario, 2026-07-19)
Juego con finalidad de **enseñanza** y **retos**, con **economía de fichas internas** que luego se
aprovecha para ofrecer productos y servicios **gratuitos** a quien cumpla retos y gane fichas.
Aventura con **secretos y retos que involucran la vida real**, con datos que solo se encuentran
**investigando entre el mundo del juego y el `/dashboard` del usuario**. A ciertas etapas **solo se
avanza según los resultados REALES registrados en la app** o condiciones particulares. Jugabilidad
tipo **RPG que consume recursos de la cuenta del usuario**; ante el **fracaso**, el usuario debe
ganar recursos que **a veces no vienen del juego sino de tareas de los módulos del `/dashboard`**.
El usuario irá indicando dinámicas, misiones, etapas e historias. Encargo a Claude: **investigar
proyectos/librerías** para diseñar el juego, crear **secuencias/escenas programadas** y los ajustes
que requiere un videojuego. Es pixel art, pero **abierto a reformulaciones completas** para lograr
mejor imagen, sombras, rendimiento y edición de mundos.

### Hallazgo que reencuadra el encargo (auditoría del código, 2026-07-19)
El encargo asumía "hay que montar el juego". La realidad: **ya existen ~16.100 líneas de juego**, y
lo valioso NO es el código de dibujado (que es justo lo que un motor regala) sino **los editores
integrados en la app con auth y BD**, que ninguna herramienta estándar da:

| Archivo | Líneas | Qué es |
|---|---|---|
| `components/landing/world/MapEditor.tsx` | **6.341** | Editor de mapas completo en navegador |
| `components/landing/CharacterGameplay.tsx` | **2.590** | Runtime del juego A |
| `app/(main)/world/page.tsx` | 1.496 | Runtime del juego B (legacy, digimon) |
| `NpcEditor` / `CinematicEditor` / `SceneManagerEditor` / `items.ts` | ~3.650 | Editores + catálogo |

**Hay DOS juegos sin una línea compartida:** (A) "El Mundo" — LPC 64×64, tilemaps, NPCs, luces,
cinemáticas, en la landing; (B) "Digimundo" (`/world`) — canvas único, sprites generados con
fal.ai/OpenAI, afinidad 0-100. Dos sistemas de sprites, dos formatos de mundo, dos persistencias.

### Estado técnico real del juego A (verificado, con rutas)
- **Sin motor, sin WebGL.** Canvas 2D + **DOM/CSS**: los tiles son un `<canvas>` del **mundo entero**
  pintado 1 vez (`WorldMap.tsx:40`), pero el jugador y los NPCs son **~12 `<div>` apilados** por
  personaje con `background-position` (`CharacterCreator.tsx:848-1010`). Cámara = `translate` CSS.
- **No hay un game loop:** hay **4 RAF independientes + 2 `setInterval`**, todos disparando
  `setState` de React ⇒ **React ES el render loop**. El `fps` declarado por animación no se usa:
  todo avanza con un `setInterval(130ms)` global (`CharacterGameplay.tsx:611`).
- **Mapas:** tilemap **disperso** (array de tiles con coords absolutas), tile 32px ×2 en pantalla.
  El campo `s` es un **índice posicional** en `SHEETS` — reordenar el array **corrompe todos los
  mapas guardados** (advertido en `sheets.ts:1-2`).
- **Colisión de UN SOLO PUNTO** en los pies, sin AABB ni sweep; con `factor` capado a 5 hay
  desplazamientos de hasta 9,5px por paso ⇒ **tunneling**. Movimiento en 4 direcciones puras.
- **Iluminación:** gradientes radiales sin oclusión (la luz atraviesa muros), sin normal maps, sin
  sombras proyectadas (`GroundShadow` es un `div` con `radial-gradient`).
- **Cinemáticas = diapositivas**, no timeline: `{backdrop, characters[], dialog, duration}`, `<img>`
  estáticos en un stage 1280×720. Sin tweening ni animación de sprite.
- **Diálogos = `string[]` plano.** Sin ramas, sin condiciones, sin variables. **No hay quests.**

### ⚠️ Riesgos CRÍTICOS detectados (bloquean el objetivo del usuario)
1. **Economía inexistente Y falsificable.** Cero coincidencias de coin/ficha/reward/xp/score en todo
   el juego. Peor: `POST /api/world/inventory` acepta cualquier `{placementId, itemId}`
   **sin validar que ese placement exista ni que el jugador esté cerca** (`inventory/route.ts:29-45`).
   Como las fichas darán productos reales, esto es explotable con un `fetch` desde la consola.
2. **Canvas del mundo completo = bomba de memoria.** `WorldMap` crea un canvas de `width*32 ×
   height*32`. Con el máximo permitido (500×500 tiles) son **16000×16000px ≈ 1 GB de VRAM**, y se
   instancian **tres a la vez** (`below`, `above`, y `LightOverlay` a 64px ⇒ 32000×32000). Un mapa
   de 200×200 **ya revienta el límite de canvas de Safari/iOS**. Sin culling ni chunking.
3. **Progreso casi todo en `localStorage` o en memoria.** Cinemáticas vistas → `localStorage`
   (*"clearing browser data replays them"*, `events.ts:20-33`); triggers de props → `Set` en memoria.
   **No se guarda posición ni escena actual.** Incompatible con "avanzar según resultados reales".
4. **Esquema del juego NO versionado.** `sql/migrations/` **ya no existe** (verificado: `find` da 0
   archivos `.sql`) y el juego no está en Prisma. Las 4 tablas (`scenes`, `world_maps`, `npcs`,
   `lights`) solo existen en la BD de producción. Además hay **DDL en el hot path**: un
   `ALTER TABLE ADD COLUMN IF NOT EXISTS` **en cada GET y cada PUT** de `/api/world/map`.
   ⚠️ Esto **contradice `MEMORIA.md`**, que dice que las migraciones viven en `sql/migrations/`.
5. **Autorización de edición por email hardcodeado**: `ADMIN_EMAIL = 'lfgonzalezm0@outlook.com'`
   (`lib/world/auth.ts:5`).
6. **Sin soporte móvil/táctil**: el control es exclusivamente teclado.

### Decisión de arquitectura propuesta (investigación web, 2026-07-19)
**Reemplazo quirúrgico, NO migración total:** cambiar solo la capa de dibujado (~1.500 líneas) a
**Phaser 4**, y **conservar los ~14.500 de editores + las rutas API**, que siguen siendo React+Postgres.

- **Motor: Phaser 4.2.1** (MIT). Razón decisiva para este caso: **`sprite.setLighting(true)` con
  normal maps y self-shadows nativos** — exactamente el "mejores sombras" que pide el usuario, hoy
  imposible con gradientes radiales. Existe plantilla oficial Next 15 + Phaser 4 + React 19.
  ⚠️ *Aviso oficial:* activar lighting **rompe el batching** ⇒ aplicar selectivamente.
- **Descartados y por qué:** Godot/Unity/Cocos/Defold/GDevelop → producen un **iframe**, lo que
  **pierde el contexto de auth de la app** (inaceptable si las fichas dan productos reales) y pesa
  MB en vez de KB. `@pixi/react` → bugs abiertos con **React 19.2 + StrictMode + Next dev**
  (issues #630/#602/#648), sin push desde 2026-01. Kaplay → v4000 lleva 2 trimestres de retraso.
- **NO adoptar Tiled ni LDtk** (aunque sean "el estándar"): obligarían a instalar una app de
  escritorio y subir ficheros, **perdiendo el editor en navegador con auth y BD**, que es una
  ventaja de producto. (Dato: LDtk no tiene release estable desde enero de 2024.)
- **NO montar servidor de juego** (Colyseus/Nakama): un RPG single-player no tiene simulación
  adversarial en tiempo real; añadiría una **segunda fuente de verdad** para la economía sin quitar
  confianza al cliente. Bastan Route Handlers + Postgres.
- **NO ECS** (bitECS/Miniplex): decenas de entidades, no miles. Además el estado autoritativo debe
  ser **diffable y expresable como filas**; los TypedArrays SoA de bitECS pelean contra Postgres.
- **NO Howler**: congelado (v2.2.4 es de sept-2023; en nov-2025 el único commit **añadió publicidad
  de un patrocinador**; nadie respondió a la propuesta de fork de feb-2026). Usar el audio de Phaser,
  que es el único que maneja el estado **no estándar `'interrupted'`** de iOS y el backgrounding.

### Reencuadre clave para la economía (lo más importante del análisis)
**Las fichas no son una variable de juego: son un sistema de pagos.** Deben modelarse como
**libro contable append-only** (tabla `ficha_transaction` con clave de idempotencia + UNIQUE, saldo
**derivado**), no como una columna entera mutable. Eso da auditoría cuando se dispute un canje y
hace la duplicación **detectable a posteriori** en vez de invisible. Corolarios:
- El cliente manda **acciones** ("interactué con NPC 7 en el paso 3"), **nunca resultados**
  ("misión completa, págame"). Máquina de estados de misiones **en el servidor**.
- **Loguear el stream de acciones desde el día uno** — es el insumo para detectar anomalías y no se
  puede reconstruir retroactivamente.
- **Fricción en el canje, no durante el juego.** Topes diarios y rendimientos decrecientes: la
  amenaza real no es "tengo 10.000 fichas" (eso lo mata la autoridad del servidor) sino
  **"un script repite la misma misión legítima 400 veces de noche"** — eso es un ataque económico y
  se defiende con **diseño**, no con código cliente.
- La defensa en cliente es inútil, con evidencia: el speedhack es **una extensión de navegador** en
  la Chrome Web Store que sobreescribe `Date.now`/`performance.now`/`requestAnimationFrame`, y
  **falsea `Function.prototype.toString`** para seguir reportando `[native code]`. WASM tampoco
  salva (existe Cetus, un Cheat Engine para WASM).

### Paquetes a instalar (versiones VERIFICADAS contra el registro npm el 2026-07-19)
```bash
npm i phaser@4.2.1        # MIT — motor + lighting con normal maps + audio iOS-safe
npm i inkjs@2.4.0         # MIT, 0 deps — diálogos ramificados; ToJson()/LoadJson() serializa
                          #   TODO el estado narrativo ⇒ se persiste y revalida en Postgres
npm i pure-rand@8.4.2     # MIT — RNG con semilla y estado serializable (loot auditable)
npm i -D free-tex-packer-core@0.3.8   # MIT — exportador Phaser nativo
npm i -D @kayahr/aseprite@2.1.0       # MIT — tipos TS del JSON de Aseprite
# zustand@^5.0.0 YA está instalado → usar zustand/vanilla como puente Phaser↔React
```
Fuera de npm: **Aseprite** ($19.99) — Phaser tiene loader nativo (`this.load.aseprite`) y convierte
**los tags en animaciones automáticamente**; Pixi NO (declara `frameTags` pero nunca los lee).
Alternativa libre: Pixelorama 1.1.10.
**NO instalar:** `howler`, `use-sound`, `@pixi/react`, `bondage`/`yarn-bound` (lenguaje de 2020),
`react-game-engine` (archivado), ningún ECS, ningún framework de servidor de juego.

### Reglas de integración no negociables (Next 15 + React 19)
- `ssr:false` **no está permitido en Server Components** en Next 15 ⇒ hace falta un wrapper
  `'use client'` fino con `dynamic(..., { ssr:false })`.
- **React 19 StrictMode monta dos veces** y el `import()` es asíncrono ⇒ montaje idempotente con
  bandera `disposed`, o se filtra un juego huérfano sin cleanup (phaser#4305).
  **NO desactivar `reactStrictMode`** (dev-only; ocultaría bugs en TODA la app, no solo en `/world`).
- **Lo que cambia cada frame NO toca React jamás.** Posiciones/velocidades solo en Phaser; React
  solo pinta HUD, inventario y diálogo, leyendo de `zustand/vanilla`.
- **Riesgo de despliegue (alta probabilidad):** Railway con `output:'standalone'` **no copia
  `public/`** ⇒ todos los sprites y audios dan 404 en producción funcionando perfecto en local.
- **Phaser NO tree-shakea** (no hay campo `sideEffects` ni subpath exports; varios blogs afirman lo
  contrario y se equivocan) ⇒ ~347KB gz. Mitigación: split por ruta, solo carga en el juego.

### ADENDA (2026-07-19, tarde) — el usuario levanta la restricción del editor de escritorio
**Dijo:** que descargar algo a su PC y subirlo a la app "no lo veo tan mal", incluso "así sea Godot",
porque necesita "un buen motor para trabajar y poder diseñar lo que quiera sin tantas limitaciones
como quizás tengo actualmente con mi motor de edición muy inmaduro". Su única preocupación:
"asegurar que existan las validaciones de usuario y reglas de usuario".

**Corrección a mi análisis previo:** descarté Tiled/LDtk infiriendo que el editor en navegador era
intocable. **Esa inferencia era mía y era incorrecta.** Tiled pasa de descartado a **recomendado**.
La distinción que lo resuelve: **el editor de autoría y el runtime son capas separables**. La
objeción del `<iframe>`/auth aplica SOLO al runtime; jamás aplicó a la herramienta de autoría.

**Verificado por mí leyendo el tarball de `phaser@4.2.1`** (no búsqueda web):
- **25 archivos de parser de Tiled, cada uno con su test unitario.** Soporta mapas **infinitos por
  chunks** (`ParseTileLayers.js:46,101-135`) ⇒ **es la cura del canvas de 1 GB y del crash en iOS**;
  **tiles animados** con duración (`ParseTilesets.js:90-119`) ⇒ el agua congelada se animaría;
  **Wang sets** (`ParseWangsets.js`), object layers completos, group layers, image layers,
  Collection of Images, y las 4 orientaciones. Shaders de luz reales (`ApplyLighting.glsl`).
- ⚠️ **Corrijo un error de mi 1er informe:** dije que Phaser no soporta "Collection of Images". Eso
  era cierto en Phaser 3, **NO en Phaser 4**.
- ⚠️ **GOTCHA CRÍTICO — tilesets externos `.tsx` NO soportados** (`ParseTilesets.js:38`): el fallo es
  un `console.warn`, **no una excepción**. Un mapa exportado sin "Embed Tilesets" **carga sin sus
  tilesets, en silencio**. Debe ser regla del pipeline Y rechazo duro del validador.
- **Auto-tiling:** es ayuda de AUTORÍA. Tiled resuelve los tiles al pintar y exporta índices ya
  resueltos; el runtime no necesita entender nada. Phaser parsea los wangsets solo como extra.

**Godot 4.7.1 — números MEDIDOS (se descargó el `.tpz` oficial y se comprimió localmente):**
- `godot.wasm` sin hilos: **37,68 MiB crudo / 6,58 MiB brotli**. La cifra oficial que circula
  ("~5 MB en 4.3") está **desactualizada en un 31%**. Payload realista total: **9-19 MB**.
  Ratio contra Phaser: **24,4×**. **Suelo inamovible de ~7 MB.** Threads NO cuesta tamaño.
- ✅ **A favor, y corrige mi objeción del puente frágil:** `library_godot_fetch.js` (4.7-stable)
  construye `fetch(url,{method,headers,body})` **sin campo `credentials`** ⇒ por spec el default es
  `same-origin` ⇒ **servido desde `public/game/`, las cookies httpOnly de sesión viajan solas**.
  Es la integración más segura posible. Pero **obliga a same-origin para siempre** (un CDN de otro
  dominio rompe la auth de forma permanente). Se monta sin iframe con `new Engine({canvas,...})`.
- ❌ **`godot#76266` ABIERTO y SIN ASIGNAR:** la iluminación 2D se calcula **por píxel del viewport
  destino, no a resolución del arte** ⇒ en pixel art escalado los degradados rompen la estética de
  píxel. Calinou: *"nadie está trabajando en implementarlo"*. El workaround (buffer de baja
  resolución) **imposibilita zoom, paneo y movimiento suave**. Su ventaja de luz viene con asterisco
  justo en nuestro estilo.
- ❌ `godot#70621` (OOM en iOS por límite de 2 GB de wasm) **abierto, actualizado 2026-06-01**.

**Única ventaja visual REAL de Godot: sombras por oclusión** (`LightOccluder2D`+`OccluderPolygon2D`)
— que una columna proyecte sombra sobre el suelo. **Phaser 4 NO la trae**: hace `setSelfShadow()`
(relieve DENTRO de un sprite) pero no proyecta entre objetos. Es la **desventaja honesta** de la
opción A; implementable a mano (shadow casting 2D) pero es trabajo propio.

**Normal maps — la respuesta que faltaba, y reencuadra el objetivo del usuario:**
- **Laigter VIVO y gratis** (v1.13.1 2025-12-16, GPL-3, solo 4 issues abiertos). Verificado en su
  `main.cpp`: **CLI headless real** (`--no-gui --normal --specular --occlusion --parallax --preset`,
  recursivo por defecto) ⇒ **sí se automatiza un tileset entero en CI**.
- **PERO el coste es de ARTE, no de motor:** Cardboard Sword invirtió **~3 meses-persona** en normal
  maps a mano solo para los tilesets de *The Siege and the Sandfox*. La comunidad estima **2-4× el
  tiempo de arte base**. Las herramientas son **más flojas justo en animación**.
- ⇒ **"Las mejores sombras" es una partida de presupuesto de arte, no una elección de motor.**
  Elegir Godot por las sombras NO ahorra esos meses. **Plan: probar Laigter automático +
  `setSelfShadow()` sobre 2-3 assets reales ANTES de comprometer meses de arte o cambiar de motor.**

**Descartados con motivo nuevo:**
- **LDtk — por mantenimiento, no por diseño:** sin release estable desde **v1.5.3 (2024-01-15)**; los
  commits de 2026 son solo CI. Su UX (auto-layer rules, IntGrid) sigue siendo superior, pero el
  paquete de tipos de referencia está en un repo **archivado** apuntando al formato 0.8.
- **Híbrido "autoría en Godot → runtime Phaser" = TRAMPA.** No existe conversor (búsqueda: 9 repos,
  ninguno lo es). Motivo técnico: el `.tscn` es parseable pero **la carga útil del tilemap es un blob
  binario opaco y dependiente de versión** (G3 `PackedInt32Array` → G4 `PackedByteArray`); existe un
  conversor cuyo propósito literal es arreglar la **"pérdida silenciosa de datos de tiles"**. Sería
  montar el pipeline sobre la parte menos estable y no documentada del formato.

**Validación de mapas subidos (la preocupación explícita del usuario):**
- **Concepto clave:** un TMJ subido es **contenido de ADMIN**, no estado de jugador. Son dos niveles
  de confianza que no se mezclan. **Regla de oro: el mapa es geometría y decoración; JAMÁS premios
  ni saldos.** El mapa dice *dónde hay un cofre*, nunca *que este usuario tenga su contenido*.
  Con las recompensas acuñadas en servidor, un mapa malicioso rompe el render, no crea fichas.
- Capas, en orden: (1) límite de tamaño **antes** de parsear (un TMJ de 200 MB es DoS trivial contra
  el Node de Railway); (2) ruta con sesión de admin (`getAuthedClient()`); (3) Zod `.strict()` para
  forma y límites — **NO** validar el payload de tiles con `z.array(z.number())` sobre millones de
  gids (lentísimo); usar bucle plano para longitud y rango; (4) **rechazo duro de tilesets con
  propiedad `source`**; (5) allowlist de rutas de imagen (anti path-traversal/SSRF); (6) integridad
  referencial — **extender el patrón que YA existe en `lib/validation.ts` (`validateWorldConfig`)**;
  (7) guardar TMJ original + normalizado y versionar; (8) devolver errores agregados, no el primero.

⚠️ **Caveat de fuentes:** el sub-agente que investigó iluminación reportó que **Reddit estaba
bloqueado y agotó su presupuesto de búsqueda** ⇒ esa parte **no incluye a ningún desarrollador de
juego publicado hablando en primera persona**. Ausencia de evidencia con fuentes bloqueadas, no
evidencia de ausencia.

**Entregable:** propuesta en HTML para el usuario (artifact privado)
`https://claude.ai/code/artifact/921a0c67-b2da-4b6c-9b51-b523270c4e84`, fuente en scratchpad
`propuesta-motor-juego.html`. **El usuario aún NO ha decidido** — no hay aprobación de nada.

### Preguntas abiertas para el usuario
### PJ1 — ¿Se unifican los dos juegos (A "El Mundo" y B "Digimundo") o B se retira? · ❓ Abierta
- **Por qué importa:** mantener dos motores, dos formatos de mundo y dos persistencias duplica todo
  el trabajo y ninguno de los dos hereda las mejoras del otro. Afecta al alcance de la migración.

### PJ2 — ¿Qué "resultados reales del `/dashboard`" desbloquean etapas, exactamente? · ❓ Abierta
- **Por qué importa:** es el corazón del diseño. Los módulos disponibles hoy son tickets, proyectos,
  calendario, finanzas, suscripciones, pensamientos, centralizado. Necesito saber qué eventos
  concretos (¿cerrar un ticket? ¿asistir a una reunión? ¿registrar pensamientos N días seguidos?)
  emiten señal al juego, para diseñar el bus de eventos y la máquina de estados server-side.

### PJ3 — ¿Qué son "los recursos de la cuenta" que consume el RPG? · ❓ Abierta
- **Por qué importa:** el usuario dice que la jugabilidad **consume recursos que el usuario tiene en
  su cuenta**. ¿Son las mismas fichas, o un recurso distinto (energía/tiempo)? De esto depende si el
  libro contable es uno o varios, y si el fracaso puede dejar a alguien bloqueado sin salida.

### PJ4 — ¿Las fichas se pueden transferir entre usuarios? · ❓ Abierta
- **Por qué importa:** si son transferibles, el riesgo pasa de "farming" a "mercado secundario" y
  cambia por completo el modelo antifraude (y posiblemente sus implicaciones legales/fiscales).

### PJ5 — ¿Se rehace el arte o se conserva LPC? · ❓ Abierta
- **Por qué importa:** las sombras con normal maps de Phaser 4 **exigen normal maps por asset**. El
  set LPC actual (19MB en `public/character/`) no los tiene. Generarlos o rehacer el arte es un coste
  real que hay que decidir antes de prometer "las mejores sombras".

### PJ6 — ¿Móvil es requisito? · ❓ Abierta
- **Por qué importa:** hoy el control es 100% teclado y el canvas de mundo completo **ya revienta en
  iOS**. Si móvil es requisito, el chunking del render deja de ser optimización y pasa a bloqueante.

## Objetivo ANTERIOR (declarado 2026-07-19, 2ª parte) — Módulo "Pensamientos" + etiquetado IA nocturno

**Rol asumido:** arquitecto full-stack + diseño de visualización de datos.

### Necesidad (base verbatim del usuario)
Módulo donde candidatos y miembros capturan pensamientos rápidamente (texto corto o lectura
amplia). Panel izquierdo con las fechas en que se escribió; al elegir una, sus pensamientos.
Modal con gráfico de puntos unidos = cantidad por fecha, más un indicador de **intensidad** basado
en la cantidad de texto. Otro gráfico con la **categoría** que una IA asigna **cada noche a la
01:00** a los pensamientos sin etiquetar: mental (filosófico/salud mental/reflexión de vida),
social (personas, realidad social), laboral (relaciones laborales, metas laborales o proyectos
personales), corporal (salud física, autocuidado, alimentación, medicación). Ese gráfico muestra
cantidad por tipo en el mes e intensidad mensual por caracteres.

### Hallazgos clave (verificados en el código)
- **Las 4 categorías YA EXISTEN**: son las `DIMENSIONS` de `lib/centralized/apoyo.ts:24-31`
  (laboral·corporal·mental·social, con color). Se reutilizan como fuente única en vez de inventar
  una lista nueva.
- **OpenAI**: el repo llama por `fetch` directo a `/v1/chat/completions` con
  `response_format: json_object` y valida a mano tras el `JSON.parse` (`lib/openai.ts`,
  `apa-extract/route.ts`). La dependencia `openai` solo se usa para audio.
- **NO hay ninguna infraestructura de tareas programadas**: sin `node-cron`, sin cola, sin
  `railway.json`/`Procfile`/`Dockerfile`. Producción arranca con `next start -p $PORT`.
  El patrón que sí existe es **endpoint protegido por secreto compartido** llamado desde fuera
  (`lib/centralized/percepcion-worker.ts`, cabecera `x-worker-token`, fail-closed).
- **No hay librería de gráficos** (solo `react-force-graph-2d` para el grafo). El repo dibuja a
  mano (`CriteriaSections.tsx`, `KnowledgeGraph.tsx`).
- **`DIM_ICON` estaba duplicado en 3 archivos** — habría sido la 4ª copia.

### Decisiones del usuario (2026-07-19) — ✅ resueltas
- **Cron:** servicio de tipo **Cron en Railway**. (Sí hace falta algo externo.)
- **Privacidad:** los pensamientos son **solo del autor**. *Matiz del usuario:* más adelante un
  sistema del Centralizado accederá a los de todos **por políticas internas de la organización**.
- **Alcance:** módulo **aislado** por ahora. *Matiz del usuario:* después, desde **Gestión Social →
  Recursos**, se usarán para dar una **valoración global** de talentos y valores (spec completa
  registrada en `MEMORIA.md` → "PENDIENTE acordado"). Ojo: esa puntuación es **fija, no
  acumulativa** (semántica distinta del ±1 de tareas).

### Construido y verificado (2026-07-19)
- `lib/centralized/pensamientos.ts` (puro: categorías, TZ, bandas de intensidad) ·
  `pensamientos-db.ts` (DDL + consultas + stats) · `pensamientos-ai.ts` (clasificador) ·
  `pensamientos-runner.ts` (trabajo nocturno) · `lib/cron-auth.ts` (`CRON_TOKEN`).
- Rutas `api/pensamientos/{,[id],stats,cron/etiquetar}` · página · `ThoughtCharts.tsx` ·
  `scripts/pensamientos-cron.mjs` · sidebar + `MODULE_ACCESS` + módulo bloqueable.
- `components/centralized/dimensionIcons.ts` (`DIMENSION_ICON` + `DIMENSION_SHAPE`) y **migradas
  las 3 copias duplicadas**.
- **Verificación:** `tsc` + `next build` OK · **IA contra OpenAI real 6/6** (incluye casos cortos y
  ambiguos) · **BD real 13/13 con ROLLBACK** (agrupación por día local, filtro por fecha, privacidad
  por fila, series mensuales, cola del nocturno, idempotencia de `setCategory`, limpieza de
  categoría al editar, bitácora). Tablas `pn_thoughts`/`pn_tagging_runs` **creadas en producción**
  (vacías, confirmado).

### Lección técnica — separar constantes puras de la capa de datos
`intensityOf` vivía en `pensamientos-db.ts`, que importa `pool`. Importarlo desde un componente
`'use client'` habría arrastrado Postgres al bundle del navegador. Se partió en `pensamientos.ts`
(puro) + `pensamientos-db.ts`, el mismo corte que ya existía en `apoyo.ts` / `apoyo-db.ts`.
**Regla:** toda constante que consuma el cliente vive en un módulo sin `pool`.

### Lección de visualización — el color se valida, no se opina
Al validar `DIMENSION_COLOR` con un comprobador de daltonismo: **mental ↔ corporal ΔE 3.7 en
deuteranopia** (mínimo 8) y dos colores por debajo de 3:1 de contraste en claro. No se cambió la
paleta (es canónica en media app); se compensó con **forma de marcador + icono + vista de tabla**.
También se evitó el error clásico de poner intensidad como **segundo eje Y**: va como tamaño de
punto o en un gráfico aparte.

### Infraestructura desplegada (2026-07-19) — Railway, hecho por mí a pedido del usuario
- Proyecto **Servidor-GCC**: creado el servicio **`pensamientos-cron`** (mismo repo) con
  `0 6 * * *` (UTC = 01:00 Ecuador), `node scripts/pensamientos-cron.mjs`, `restartPolicyType=NEVER`,
  **build anulado** (el disparador no usa dependencias) y `watchPatterns` acotado al script.
  `CRON_TOKEN` (43 car. aleatorios) en el servicio web y en el de cron; `APP_URL` en el de cron.
- El **CLI de Railway no expone `cronSchedule`/`startCommand`** → se usó su **API GraphQL**
  (`serviceInstanceUpdate`) con el token del propio CLI.
- **⚠️ Lección cara: cambiar el cron NO surte efecto sin REDESPLEGAR.** El despliegue vigente
  conserva el snapshot de configuración anterior. Dos disparos programados pasaron de largo con el
  horario ya cambiado; solo tras `serviceInstanceDeployV2` se ejecutó. Lo descubrí porque probé el
  disparo real en vez de darlo por bueno al ver la config correcta en la API.
- Docs de Railway: intervalo mínimo **5 minutos**, todo en **UTC**, y el servicio **debe terminar**
  (si sigue vivo, se salta la siguiente ejecución).
- **Verificado en producción:** 401 sin token · 401 con token inválido · 200 con el correcto ·
  4 pensamientos reales → **4/4 etiquetados por la IA** · disparo real del cron visto en sus logs ·
  datos de prueba borrados (`pn_thoughts` y `pn_tagging_runs` en 0).

### Progreso
- **% de información para el objetivo:** 100% — construido, desplegado y verificado de extremo a
  extremo en producción. Sin pendientes del usuario.

## Objetivo ACTUAL (declarado 2026-07-19) — Sistema "Gestión Social" (Centralizado · CONTROLADOR · gestión) + módulo "Experiencias"

**Rol asumido:** arquitecto full-stack de la plataforma GCC World (modelo de datos Postgres +
Next.js App Router + integración con el motor de puntuación de talentos/valores).

### Necesidad (base verbatim del usuario, 2026-07-19)
Dos piezas acopladas:
1. **Sistema "Gestión Social"** — nuevo sistema del Centralizado, piso **controlador**, paso
   **gestión** (celda **"Soluciones"**). Tres pestañas: **Eventos** (única funcional ahora),
   **Recursos** y **Discusión** (vacías, para futuro).
   - En Eventos se **generan eventos**; cada evento contiene un **conjunto de tareas**.
   - Cada tarea lleva **etiquetas de valores y talentos** (igual que el Horario de Vida) y una
     propiedad **plazas** = cuántas personas pueden tomarla.
   - El usuario del sistema marca **INICIO** del evento manualmente (aunque tenga fecha/hora
     asignada) y después marca **FIN**.
   - Al finalizar: se conservan las tareas marcadas **completadas**; las tomadas y **no**
     completadas pasan automáticamente a **no completado** (`failed`).
   - **Filtro de estado de eventos** con el patrón de rail de la app (icono + label + conteo).
2. **Módulo "Experiencias"** (dashboard, nuevo) — el miembro ve los eventos publicados, entra a
   uno, revisa sus tareas, **toma una tarea si quedan plazas** y confirma asistencia. Esa tarea
   se **auto-asigna en su "Mi día"**, con **etiqueta distintiva** de que viene de Gestión Social,
   y queda **bloqueada** (no puede marcar completada/fallida) mientras el evento no esté iniciado.

### Hallazgos de investigación en el repo (2026-07-19) — verificado leyendo el código

**A. Cómo se registra un sistema del Centralizado** (NO hay array de registro único; son 2 sitios):
- Ruta 100% dinámica: solo existen `app/(dashboard)/dashboard/centralized/page.tsx` y
  `app/(dashboard)/dashboard/centralized/[piso]/[paso]/[slug]/page.tsx`. Los pisos/pasos son
  constantes en `lib/centralized/systems.ts:9-21`; la celda sale de `CELL_MAP` (`systems.ts:49-54`).
  **`controlador` × `gestion` = celda "Soluciones"** ✅.
- **(1) Fila sembrada en Postgres**: `INSERT … WHERE NOT EXISTS` por slug dentro de `ensureTable()`
  en `app/api/centralized/systems/route.ts:30-132` (el de `percepcion-social` está en :111-117).
  Tabla `gcc_world.centralized_systems (id,name,description,piso,paso,cell_name,is_active,slug)`.
  **No hay columna `icon`.**
- **(2) Rama en el ternario** de `[piso]/[paso]/[slug]/page.tsx:110-141` que mapea slug → componente.
  Sin esa rama, un sistema creado en BD cae al fallback "La interfaz estará disponible pronto".
- Añadir un sistema = seed SQL + import/rama en el ternario + componente en
  `components/centralized/systems/` + `lib/centralized/<x>-db.ts` + rutas `app/api/centralized/<x>/`.
- **Control de acceso**: en `app/api/centralized/systems/route.ts:164-184` — un miembro ve los
  sistemas de **su piso y los pisos por debajo**, pero **solo en su paso exacto**
  (`pisosAtOrBelow`, `systems.ts:32-43`); admin lo salta todo; escape hatch =
  `centralized_member_access` (ShareAccessModal). ⚠️ Ese filtro vive SOLO en `systems/route.ts`;
  las rutas de datos de cada sistema solo comprueban `['admin','member']`.

**B. Cómo las tareas puntúan talentos y valores** (el corazón del acople):
- Listas canónicas (fuente única, hardcoded, NO son tablas):
  `lib/centralized/valores.ts` → `VALORES` = 9 `{key,label}`; `lib/centralized/talentos.ts` →
  `TALENTOS` ≈600 strings planos. Se eligen con **`components/ui/MultiSelectSearch.tsx`**
  (multi-select con buscador, chips debajo, tope `maxVisible=60`).
  ⚠️ **Los valores se guardan por `key`; los talentos por su string literal.**
- Motor único: **`getSubjectsProfileScores()` en `lib/centralized/horario-db.ts:304-353`**.
  - Une **dos fuentes con el MISMO formato** `(subject_id, status, value_tags, talent_tags)`,
    ambas filtradas a `status IN ('completed','failed')`:
    (1) `hv_schedule` JOIN `hv_task_labels`; (2) `cv_generated_tasks`.
  - Regla: `completed` = **+1** a **cada** etiqueta de la tarea; `failed` = **−1**;
    `pending` **no puntúa** (lo excluye el WHERE). **Sin pesos.**
  - Talentos: `net = c − f`, se descartan `net<=0`, top 10, y cada uno recibe
    `round(net/sum*100)` → **porcentaje RELATIVO al propio sujeto** (no comparable entre personas).
  - Valores: `valuesBalance[v] = {completed, failed}` en crudo (barra divergente).
- Consumo: `getSubjectsCriteria` (`lib/centralized/criteria.ts:11-26`) → `/api/admin/candidates`
  y `/api/admin/team` → `components/centralized/reclutamiento/CriteriaSections.tsx`.
  También ordena candidatos en `app/api/tickets/assignees/route.ts:44-70`.
- 🔑 **Punto de integración**: para que las tareas de Gestión Social puntúen basta con **añadir
  una TERCERA query** con ese mismo shape a `getSubjectsProfileScores`. Sin tocar la fórmula.

**C. Cómo se pintan las tareas FIJAS en "Mi día"** (plantilla exacta a calcar):
- Página: `app/(dashboard)/dashboard/mi-dia/page.tsx` (465 líneas, todo inline; **no hay
  componente TaskCard**). Rail de tareas en :393-424.
- Precedente perfecto = **Comandos Violeta**: tabla `cv_generated_tasks`
  (`lib/centralized/comandos-db.ts:53-76`) con `subject_kind/subject_id/title/detail/
  value_tags/talent_tags/all_day/start_time/end_time/day/status`. Sus filas aterrizan en Mi día
  como entradas **fijas** (el usuario solo cambia estado/etiquetas).
- Distintivo de origen en Mi día: **no hay columna `origin`** — se infiere por tabla/booleanos
  del view-model (`auto`, `gen`, `source`, `policyName`). Iconos: `ShieldCheck` violeta (política),
  `Lock` sky (ticket/proyecto). Color de borde por estado (:396).
- Estado: **`components/centralized/TaskStatusButtons.tsx`** (Completada/Fallida/Pendiente).
  ⚠️ **Hoy NO acepta `disabled`** — habrá que añadírselo (default `false`) para el bloqueo.
- Escritura de estado: 3 endpoints según origen (`/horario/schedule`, `/horario/auto-status`,
  `/horario/generated`), todos optimistas con rollback vía `loadHorario()`.
- ⚠️ Los endpoints de escritura exigen `['admin','member']` → **un candidato puede leer pero no
  marcar estado** (hueco latente ya existente).

**D. El filtro de estado que pidió el usuario (la captura)**
- Es el **"rail" del patrón "Explorador Azure"** (`Diseño.md:104-119`): tarjeta
  `bg-digi-card border border-digi-border rounded-lg p-2` + título
  `text-[10px] font-semibold text-digi-muted uppercase tracking-wide` + ítems
  `w-full flex items-center gap-2.5 px-3 py-2 rounded-md border-l-2`; activo =
  `bg-accent-light border-accent text-accent`; badge de conteo
  `text-[10px] px-1.5 py-0.5 rounded-full tabular-nums`.
- ⚠️ **NO es un componente compartido**: está duplicado inline en ~13 sitios (`RailItem` local en
  clients/tickets/projects/centralized/flows…). El canónico visualmente idéntico a la captura es
  `components/centralized/systems/ReclutamientoSystem.tsx:53-76`.
  → Contradice el principio de "diseño vinculado" de `Diseño.md`; ver Propuestas.

**E. "Experiencias" NO existe** (verificado: ni ruta, ni sidebar, ni componente). Alta de módulo =
  carpeta en `app/(dashboard)/dashboard/experiencias/` + `NavItem` en `NAV_GROUPS`
  (`components/dashboard/DashboardSidebar.tsx:16-58`) + entrada en `MODULE_ACCESS`
  (`lib/dashboard/access.ts:28-49`, roles `'candidate'|'client'|'member'|'admin'`).

### Arquitectura propuesta (borrador — a confirmar con las preguntas abiertas)
Prefijo de tablas **`gs_`**, en `lib/centralized/gestion-social-db.ts` con `ensure` de
**promise-singleton** (patrón de `percepcion-db.ts:20-30`, obligatorio: varios fetch en paralelo).

- **`gs_events`**: `id, name, description, event_date DATE, start_time, end_time, location,
  status ('draft'|'published'|'active'|'finished'|'cancelled'), started_at, ended_at,
  created_by, created_at`.
- **`gs_event_tasks`**: `id, event_id FK ON DELETE CASCADE, title, detail,
  value_tags TEXT[], talent_tags TEXT[], plazas INT, all_day, start_time, end_time, position`.
- **`gs_task_signups`**: `id, task_id FK CASCADE, event_id, subject_kind, subject_id,
  status ('pending'|'completed'|'failed'), signed_up_at,
  UNIQUE(task_id, subject_kind, subject_id)`.
  Plazas disponibles = `plazas − COUNT(signups)`; la toma debe ser **atómica** (ver Riesgos).

Ciclo de vida: `draft → published → (INICIO manual) active → (FIN manual) finished`.
Al pasar a `finished`: `UPDATE gs_task_signups SET status='failed' WHERE status='pending'`.
Bloqueo en Mi día: `TaskStatusButtons` deshabilitado mientras `gs_events.status <> 'active'`.

### Decisiones del usuario (2026-07-19) — todas ✅ resueltas
- **P1 · Una sola tarea por evento y persona.** Un miembro toma **máximo 1 tarea por evento**
  (reparte plazas, evita solapes en Mi día). → `UNIQUE (event_id, subject_kind, subject_id)`
  **además** del unique por tarea. *Por eso `gs_task_signups` lleva `event_id` denormalizado.*
- **P2 · Se puede soltar solo ANTES del inicio.** Con el evento en `published` el miembro puede
  liberar la plaza; con el evento `active` o posterior, ya no (queda comprometido).
- **P3 · Horario del evento, con override por tarea.** La tarea hereda `event_date` +
  `start_time`/`end_time` del evento; si la tarea define horario propio, ese manda
  (`COALESCE(t.start_time, e.start_time)`).
- **P4 · Miembros y candidatos.** Ambos ven Experiencias y pueden tomar tareas (para el candidato,
  demostrar valores es su meta de afiliación). ⚠️ Implica **habilitar la escritura de estado para
  candidatos** en el endpoint de estado de las tareas de Gestión Social (los endpoints de horario
  existentes exigen `['admin','member']`; el nuevo debe resolver el sujeto del logueado y permitir
  candidato **solo sobre sus propias filas**).

### Construido y verificado (2026-07-19)
**Backend**
- `lib/centralized/gestion-social-db.ts` — DDL (promise-singleton) de `gs_events`,
  `gs_event_tasks`, `gs_task_signups` + toda la lógica: listar/crear/editar/borrar eventos y
  tareas, `startEvent`/`finishEvent`, `takeTask`/`releaseTask`, `listEventsForSubject`,
  `getSubjectSocialTasks`, `setSocialTaskStatus`, `sanitizeTags`.
- `lib/centralized/subject.ts` — `resolveSubject()` **extraído** de la ruta de horario
  (definición única; ahora la usan Mi día y Experiencias).
- `lib/centralized/horario-db.ts` — **3ª fuente de scoring** añadida a
  `getSubjectsProfileScores` + `social[]` en `getSubjectHorario`.
- Rutas: `api/centralized/gestion-social/{eventos,eventos/[id],eventos/[id]/estado,
  eventos/[id]/tareas,tareas/[id]}`, `api/experiencias/{,[id],tareas/[id]}`,
  `api/centralized/horario/social`.
- Seed del sistema en `app/api/centralized/systems/route.ts` (slug `gestion-social`).

**Frontend**
- `components/centralized/systems/GestionSocialSystem.tsx` — pestañas Eventos/Recursos/
  Discusión; rail de filtro por estado; lista + panel de detalle; formularios de evento y de
  tarea (con `MultiSelectSearch` de valores/talentos y campo Plazas).
- `components/ui/FilterRail.tsx` — **NUEVO componente compartido** del rail de filtro.
- `app/(dashboard)/dashboard/experiencias/page.tsx` + sidebar + `MODULE_ACCESS` + módulo
  bloqueable en `comandos.ts`.
- `components/centralized/TaskStatusButtons.tsx` — prop `disabled` (para el bloqueo).
- Mi día: tarjeta ámbar punteada con `PartyPopper`, chip **"Gestión Social"**, nombre del
  evento, aviso "Bloqueada hasta que inicie el evento" y botones deshabilitados.

**Verificación**
- `tsc --noEmit` OK · `next build` OK (todas las rutas nuevas registradas).
- **Prueba E2E contra Postgres REAL con ROLLBACK: 23/23 ✅** — DDL idempotente, agregados de
  plazas, bloqueo en draft, una-tarea-por-evento (UNIQUE 23505), plazas agotadas, soltar solo
  en published, inicio/fin manuales, autorización por fila, auto-`failed` al finalizar, las
  3 fuentes de scoring, herencia de horario evento↔tarea, y CASCADE al borrar.
  Confirmado que el rollback no dejó ninguna tabla `gs_*`.

### Ampliación de la misma sesión (2026-07-19), a pedido del usuario
- **Bloques en el calendario:** las tomas se pintan en la grilla de Mi día como `EventInstance`
  sintéticos punteados (ámbar/verde/rojo), fuera del cómputo de horas, con popover de estado que
  respeta el bloqueo; y en el panel "Eventos" con `PartyPopper` + "· evento".
  `EventInstance` ganó **`taskKind: 'policy' | 'social'`** y `socialLocked` — `generated` pasó a
  significar "bloque sintético" y `taskKind` identifica el sistema de origen.
- **Tablas creadas en la BD real** (`gs_events`, `gs_event_tasks`, `gs_task_signups` + índices +
  los 2 unique) y **sistema sembrado** en `centralized_systems` (id 12). El DDL se aplicó
  **extrayendo el SQL del propio `gestion-social-db.ts`** (parseando sus template literals) para
  garantizar cero deriva entre el script y la librería.
- **Verificación extra:** 9/9 con datos reales insertados y luego borrados (ventana [from,to) del
  calendario, horario propio vs heredado, color por estado, `locked`, y que una tarea sin tomar no
  genera bloque en el calendario de nadie).

### Pendientes / notas
- `FilterRail` es nuevo; los ~13 rails duplicados inline siguen sin migrar (ver PROPUESTAS.md).

### Progreso
- **% de información para el objetivo:** 100% — construido y verificado contra BD real.

## Objetivo ANTERIOR (declarado 2026-07-17) — Sistema "Percepción Social" (Centralizado · piso COLABORADOR)

**Rol asumido:** arquitecto full-stack + integrador de IA de visión (Claude CLI local) para GCC World.

### Necesidad (base verbatim del usuario, 2026-07-17)
Primer sistema del **piso Colaborador** del Centralizado. El piso Colaborador permite que los colaboradores
**ejecuten tareas de sistemas delegados** o **generen registros que alimentarán sistemas futuros**.

**Sistema "Percepción Social" = capturar eventos del entorno del sujeto que usa la app:**
1. El usuario envía a la app su **ubicación actual** (GPS).
2. Con la **cámara del dispositivo** toma un **conjunto de fotos** del entorno.
3. Las fotos + un **prompt** se envían a una **IA** que analiza cada imagen y **distingue los elementos**
   presentes: **objetos, animales o personas**.
4. La IA entrega, por cada elemento, **todas las propiedades** que reconozca (color del árbol, raza del
   animal, tipo de cabello de la persona, etc.) — análisis libre, la IA decide qué propiedades reporta.
5. El resultado se **registra en la app**; luego, dentro del mismo sistema, se puede **acceder y revisar**
   lo interpretado por la IA.

**Backend IA:** un **servidor local conectado con el Claude CLI** recibe el conjunto de imágenes + prompt,
analiza y devuelve el resultado (MISMO patrón que el agente de Gestión de Datos — local-only).

**Propósito / futuro:** estos registros alimentarán a futuro un sistema que dibuja un **mapa real** y
**simula el mundo real** (objetos/animales/personas en los terrenos). Ese mundo virtual será una **pieza
clave del futuro Sistema de Control Psicosocial** (piso global · paso creación, celda "Control Psicosocial").

**Interfaz:** el usuario pide **creatividad** para navegar y acceder al contenido del sistema.

### Hallazgos de investigación en el repo (2026-07-17) — todo verificado por exploración del código
- **Cómo se agrega un sistema al Centralizado** (dirigido por datos, no páginas hardcodeadas):
  1. `lib/centralized/<sys>-db.ts` con `ensure<Sys>Tables()` (patrón `CREATE/ALTER/INDEX IF NOT EXISTS`,
     prefijo de tabla propio; **guard promise-singleton** anti-DDL-concurrente como `gestion-datos-db.ts:24-34`).
  2. `app/api/centralized/<sys>/.../route.ts` (llaman a `ensure<Sys>Tables()`; auth `getCurrentUser` + roles).
  3. `components/centralized/systems/<Sys>System.tsx` (recibe `{ system, isAdmin }`).
  4. Registrar el componente en el switch de `app/(dashboard)/dashboard/centralized/[piso]/[paso]/[slug]/page.tsx`.
  5. Sembrar el sistema con `INSERT ... WHERE NOT EXISTS` en `ensureTable()` de
     `app/api/centralized/systems/route.ts` (piso/paso/cell_name/slug exactos). `CELL_MAP` está **duplicado**
     en `lib/centralized/systems.ts` y en esa route → mantener en sync.
  - **Modelo 4P:** pisos = global/pilar/controlador/colaborador; pasos = fundamentacion/creacion/implementacion/
    gestion. `colaborador·fundamentacion = "Investigador"` (ya lo ocupa Dinámica Condiciológica; pueden coexistir
    varios sistemas por celda).
- **Patrón Claude CLI local** (a calcar de `lib/centralized/pesos-agent.ts`):
  - `execFile(claudeBin(), ['-p', input, '--output-format','json','--permission-mode','bypassPermissions', ...])`,
    `cwd` neutral, `maxBuffer` grande, `timeout`. `claudeBin()` = `CLAUDE_CLI_PATH` → `$HOME/.local/bin/claude` → `claude`.
  - Parseo de dos capas: `JSON.parse(stdout)` → `parsed.result` + `parsed.session_id`; luego `parseAction` extrae el
    JSON que el modelo escribió dentro de `result` (tolerante a fences/prosa).
  - Sesión: `claude_session_id` viaja al cliente y se reinyecta con `--resume`; `--system-prompt` (REEMPLAZA) solo
    en el 1er turno. Reencuadre "tarea de transformación de texto, tu salida es UN JSON" para quitar identidad de coder.
  - **Local-only:** el binario `claude` corre como `child_process` DENTRO del server Next.js local; **no funciona en
    Railway** (igual que el agente de pesos). Feature interna.
  - **CLAVE para imágenes:** hoy NINGUNA invocación pasa imágenes (todo texto). El Read tool de Claude Code **lee
    imágenes visualmente** → estrategia: **escribir las fotos a disco (rutas absolutas) y pasarlas en el prompt
    PERMITIENDO la tool `Read`** (el agente de pesos la deshabilita; aquí NO), con `cwd` = carpeta de esas fotos.
- **Imágenes/subida (reutilizable):** `lib/cloudinary.ts` (`uploadImage`/`uploadImages` → `secure_url`, fallback
  base64); patrón multipart `app/api/users/avatar/route.ts` (recibe `File`→arrayBuffer→base64→Cloudinary); multi-archivo
  por registro en `incidents/[id]/images` y `projects/[id]/images` (columna `TEXT[]`, POST append / GET / DELETE por índice,
  **array Postgres es 1-based**). Servido optimizado con `sharp`.
- **Cámara:** NO existe captura (`getUserMedia`/`capture=`) en el repo → se construye desde cero. HTTPS disponible
  (`server.cjs`, `npm run dev:https`) — requisito para cámara+GPS fuera de localhost.
- **Geolocalización:** NO existe (`navigator.geolocation` a cero) → desde cero. Sin columnas GPS en BD.
- **Mapas:** solo el mundo gamificado por tiles (grid discreto, no geográfico). **No hay librería de mapa geográfico**
  instalada (ni leaflet/maplibre/mapbox). Grafo canvas reutilizable: `react-force-graph-2d` (`GdGraph`/`KnowledgeGraph`/
  `PolicyGraph`) + `FloatingWindow` (arrastrable/redimensionable).
- **UI estándar:** patrón "Explorador Azure" (rail Pisos + lista + panel) y grafo canvas oscuro + panel glass (Diseño.md).

### Arquitectura propuesta (borrador, a confirmar con las preguntas abiertas)
- **Slug:** `percepcion-social`. **Piso:** colaborador. **Paso:** por confirmar (propuesta: `fundamentacion`, celda "Investigador").
- **Modelo de datos (prefijo `ps_`):**
  - `ps_capturas` (id, user_id, session_id, lat, lng, accuracy, direccion?, capturado_en, estado
    [pendiente|analizando|analizado|error], claude_session_id?, resumen?, notas?).
  - `ps_fotos` (id, captura_id FK, url [Cloudinary], orden, width?, height?).
  - `ps_elementos` (id, captura_id FK, categoria [objeto|animal|persona], nombre, confianza?, resumen?,
    propiedades JSONB [libres, lo que la IA reconozca], foto_indices? [en qué fotos aparece]).
- **Flujo:** cámara (getUserMedia) toma N fotos + GPS → POST multipart → server sube a Cloudinary (persistencia/UI)
  y **escribe copias a disco temporal** → invoca Claude CLI con prompt + rutas absolutas (tool Read habilitada) →
  la IA devuelve JSON `{ resumen, elementos:[{categoria,nombre,propiedades,foto_indices,confianza}] }` → server
  persiste elementos → estado `analizado`. Alcance forzado en server (solo las fotos de ESA captura).
- **UI (creativa):** (1) **Modo Captura** — botón grande "Nueva captura del entorno" → cámara + preview de fotos +
  GPS auto → enviar. (2) **Explorador** — rail (estado/fecha) + lista/galería de capturas georreferenciadas + panel de
  detalle. (3) **Detalle** — galería de fotos + elementos agrupados por categoría (objetos/animales/personas) con sus
  propiedades; opción de **grafo** captura→elementos→propiedades (motor reusable). (4) A futuro: pins en mapa real.

### Decisiones del usuario (2026-07-17) — todas resueltas
- **P1 — Paso:** ✅ **Gestión** → `colaborador/gestion`, celda **"Líder"**. URL `/dashboard/centralized/colaborador/gestion/percepcion-social`.
- **P2 — Captura de cámara:** ✅ **in-app con `getUserMedia`** (video en vivo + tomar varias fotos con preview/borrar). Requiere HTTPS fuera de localhost (`npm run dev:https`).
- **P3 — Mapa:** ✅ **solo coordenadas + link a Google Maps** por ahora (el mapa real se deja para el sistema futuro dedicado). NO se instala librería de mapas.
- **P4 — Visibilidad:** ✅ **privadas por colaborador** (cada quien ve las suyas; el admin ve todas). Alcance forzado en la capa DB (`ownerClause`) y en las rutas (`getCurrentUser` + rol).
- **P5 — Análisis por conjunto:** ✅ la IA analiza el **conjunto** de fotos y devuelve **UNA lista consolidada** de elementos con `foto_indices`.

### Construido y verificado (2026-07-17)
- **Backend:** `lib/centralized/percepcion-db.ts` (tablas `ps_capturas`/`ps_fotos`/`ps_elementos`, promise-singleton, CRUD con propiedad forzada) · `lib/centralized/percepcion-agent.ts` (Claude CLI local: escribe fotos a `mkdtemp`, `claude -p ... --allowedTools Read --system-prompt`, cwd=dir temporal, parseo 2 capas + normalizadores) · rutas `app/api/centralized/percepcion/capturas/{route,[id]/route,[id]/analyze/route}` (multipart→Cloudinary; analyze `maxDuration=300`).
- **Registro:** semilla en `systems/route.ts` `ensureTable` (colaborador·gestion·Líder·percepcion-social) + rama en el switch de `[piso]/[paso]/[slug]/page.tsx`.
- **Frontend:** `components/centralized/systems/PercepcionSocialSystem.tsx` — rail (Nueva captura + filtros con conteos) + galería de capturas + panel de detalle (fotos con `ImageGallery`, elementos agrupados por objeto/animal/persona con chips de propiedades, link Maps) + **overlay de cámara** (getUserMedia `facingMode:environment`, canvas→blob, GPS auto, tira de fotos). Auto-analiza tras guardar.
- **Verificación:** `tsc --noEmit` limpio · `next build` OK (3 rutas API registradas) · **PRUEBA EN VIVO DEL CLAUDE CLI VISION:** replicando los args del agente sobre `public/PaisajeVioleta1.png`, `claude` **leyó la imagen con Read** (2 turnos) y devolvió el JSON exacto esperado (`resumen` + 13 `elementos` con categoria/nombre/confianza/propiedades/foto_indices), `is_error:false`, ~36s. **El mecanismo de visión headless FUNCIONA.**
- **Lección técnica clave (visión con Claude CLI):** para que el modelo VEA imágenes en modo headless, hay que (1) escribirlas a disco, (2) pasar sus **rutas absolutas** en el `-p`, (3) **`--allowedTools Read`** (Claude Code lee imágenes visualmente), (4) `--system-prompt` que lo reencuadre como analista visual "tu única salida es UN JSON" (NO coder), (5) `cwd` = dir temporal de las fotos. Devuelve el JSON dentro de `parsed.result` → parseo de 2 capas.
- **Local-only (modelo inicial, DESCARTADO):** al principio el server ejecutaba `claude` in-process → solo funcionaba con Next local, no en Railway.

### REFACTOR a "worker local + app web" (decisión usuario 2026-07-18)
El usuario aclaró que quiere **capturar desde la web publicada** dejando un procesador local encendido. Se refactorizó al
modelo desacoplado que él había descrito al inicio ("servidor local conectado con claude cli"):
- La app (local/Railway) **solo guarda** capturas como `pendiente`. El **worker local** (`scripts/percepcion-worker.mjs`)
  sondea, reclama, analiza con `claude` y devuelve el resultado. Auth por **token compartido** `PERCEPCION_WORKER_TOKEN`.
- Cambios: se eliminó `percepcion-agent.ts` (server ya no ejecuta claude); `[id]/analyze` ahora **re-encola** (no spawnea);
  nuevos `worker/pending` (claim atómico `FOR UPDATE SKIP LOCKED` + re-reclamo de colgadas >10min con `claimed_at`) y
  `worker/result` (persiste); `percepcion-db.ts` ganó `claimForWorker`/`requeueCaptura`/columna `claimed_at`; el
  componente ahora **encola + hace polling** (pendiente="en cola", analizando=spinner, error=reintentar) en vez de
  análisis in-process. La lógica de visión vive ahora SOLO en el worker `.mjs` (autónomo, `--once` para cron).
- **HTTPS (aclaración al usuario):** la cámara/GPS exigen contexto seguro; la web (Railway) ya es HTTPS → funcionan. `dev:https`
  solo hace falta para pruebas locales desde otro dispositivo (no localhost). El HTTPS NO es la limitación; la limitación
  era el Claude CLI, ahora resuelta con el worker.
- **Config despliegue:** server (local+Railway) `PERCEPCION_WORKER_TOKEN`; worker `PERCEPCION_WORKER_TOKEN`+`PERCEPCION_APP_URL`
  (+opc `CLAUDE_CLI_PATH`/`PERCEPCION_POLL_MS`/`PERCEPCION_BATCH`) → `node scripts/percepcion-worker.mjs`.

### Progreso
- **% de información para el objetivo: 97%** — sistema construido y **verificado end-to-end**: `tsc`+`next build` OK (5 rutas
  API) + prueba REAL del worker (dev server con token → captura pendiente en BD → `worker --once` reclamó, llamó a `claude`,
  reconoció 18 elementos con propiedades y devolvió el resultado → captura `analizado`; datos de prueba borrados). Falta solo
  la **validación visual in-app** en el navegador (login + cámara + GPS), no realizable sin sesión/dispositivo.

---

## Objetivo ACTUAL (declarado 2026-07-12) — Agente IA (Claude CLI) que genera PESOS de una premisa desde Scopus

**Necesidad:** desde una **fuente premisa** seleccionada, lanzar un **agente conversacional** que:
- Lee el **contenido de la premisa** para entender QUÉ buscar.
- Busca en **Scopus** datos de los **últimos 5 años** (el agente decide cómo buscar/filtrar).
- Genera **pesos** (cantidad/cualidad) que refuerzan la premisa, **aprendiendo la redacción** de los pesos ya existentes.
- **Cada peso lleva su referencia bibliográfica** (Scopus/Crossref → gd_referencias).
- Sesión **conversacional que queda abierta**: pedirle más búsquedas/más pesos y **modificar** los pesos ya agregados EN ESTA sesión.
- **Alcance estricto:** la sesión solo trabaja sobre **los pesos que ella misma añade** a la premisa elegida; NO sobre pesos previos, ni otras premisas, ni pesos de otras premisas.
- **Backend IA:** NO usa la API key de OpenAI. Usa el **Claude CLI del servidor local** (headless).
- **UI:** botón en la premisa → **modal de chat arrastrable/redimensionable** (reusar `FloatingWindow`).

### Viabilidad verificada (2026-07-12)
- **Claude CLI** instalado (`~/.local/bin/claude`, v2.1.207) y **autenticado**. `claude -p "…" --output-format json --max-turns 1` → `{"result":"OK","session_id":…,"total_cost_usd":~0.10}`. Soporta `--resume <session_id>` (continuar sesión), `--mcp-config`, `--allowedTools`, `--append-system-prompt`, `--permission-mode bypassPermissions`, `--input/output-format stream-json`.
- **`FloatingWindow`** ya es **arrastrable + redimensionable** (barra move + 8 tiradores). Se reusa.
- **Scopus + Crossref**: ya integrados (`lib/centralized/scopus.ts`).
- Precedente de spawn de procesos: `lib/dev-servers.ts` (child_process).

### Arquitectura propuesta (decisión de diseño)
**Bucle de agente orquestado por NUESTRO servidor** (no MCP), para máximo control del alcance:
- Un turno = `claude -p --resume <sid> --output-format json` con un **system prompt** que le da el contexto (contenido de la premisa, ejemplos de estilo, pesos de la sesión) y le indica que responda con **acciones JSON**: `scopus_search`, `add_weight`, `update_weight`, `delete_weight`, `message`.
- NUESTRO servidor **ejecuta** cada acción (Scopus/Crossref/DB) — así el alcance ("solo pesos de esta sesión") se **fuerza en el servidor**, no confiamos en el modelo — y reanuda la sesión con el resultado hasta que el agente emita `message` final.
- **Scoping:** columna nueva `gd_fuentes.agent_session_id`; las acciones update/delete solo tocan pesos con ese `session_id` + esa premisa. Los pesos son reales (aplicados a la premisa vía `gd_fuente_pesos`), quedan tras la sesión.
- **Solo local:** el `claude` CLI vive en el equipo local; en Railway no está autenticado → feature **local-only** (herramienta interna). Coste ~$0.10/turno de la cuenta Claude del usuario.

### Decisiones del usuario (2026-07-12)
- **P-A1 Guardado:** se guardan **al momento** (pesos reales aplicados a la premisa, modificables en la sesión).
- **P-A2 Estilo:** aprende de **todos** los pesos existentes (muestra de 15, solo lectura).
- **P-A3 Credibilidad:** la **estima el agente** (recencia/revista/citas).

### Lección técnica clave — encuadre del Claude CLI como agente de protocolo JSON
- `claude -p` trae la **identidad de "agente de programación"** de Claude Code; con `--append-system-prompt` el
  modelo se confundía ("no tengo acceso al repo", inventaba acciones, decía "me faltan herramientas").
- **Fixes que lo resolvieron:** (1) **`--system-prompt`** (REEMPLAZA el prompt, no append) — quita la identidad
  de coder. (2) **NO** usar `--exclude-dynamic-system-prompt-sections` (causaba respuestas VACÍAS). (3) **cwd
  neutral** (`os.tmpdir()`) para no cargar el CLAUDE.md del repo. (4) **Reencuadre del prompt**: "TAREA DE
  TRANSFORMACIÓN DE TEXTO; no dispones de herramientas ni las necesitas; tu única salida es UN JSON en texto
  plano que un programa externo ejecuta; así 'buscas' y 'guardas'". (5) `--disallowedTools` de las tools del CLI.
  (6) recordatorio de acciones válidas en cada RESULTADO. Con esto el loop completa: reformula si no hay DOI,
  agrega pesos con DOI y termina con message. Verificado con Scopus real.
- **Solo local:** el `claude` CLI vive en el equipo local (no en Railway). Coste ~$0.10+/turno de la cuenta Claude.

### Progreso
- **% de información para el objetivo: 100%** — implementado y verificado (tsc+build; loop real claude+Scopus;
  alcance de sesión en BD con ROLLBACK). Falta solo la **validación visual en vivo** (login) del chat.

---

## Objetivo previo (declarado 2026-07-11) — Sistema "Gestión de Datos" en Centralizado

**Necesidad:** nuevo sistema en `/dashboard/centralized`, piso **pilar**, paso **fundamentación**
(slug propuesto `gestion-de-datos`). Gestiona y ordena los **datos recolectados** aplicando la
**condiciología** como método de clasificación de datos (para objetos/materias de conocimiento, no para
comportamientos). Interfaz **calcada de Comandos Violeta**: panel lateral izquierdo (aquí = lista de
**Problemáticas**) + panel derecho "universo de gráficos" (grafo) para operar toda la tubería de
clasificación. **UI genérica todavía por afinar; foco primero en el modelo de datos + motor de
nomenclatura correctos.**

### Rol asumido
**Arquitecto de datos + ingeniero full-stack (Next.js 15 App Router + Postgres crudo `pg`, schema
`gcc_world`)**, con foco en un **motor de nomenclatura/clasificación** determinista y en replicar el
patrón grafo+paneles de Comandos Violeta.

### La tubería de clasificación (9 niveles) — base verbatim del usuario (2026-07-11)
> La **condiciología** = estudio de las condiciones a través de instancias (evalúa comportamientos por
> factores generales, cada factor con causas específicas). Para **objetos/materias de conocimiento** la
> evaluación NO usa condiciones sino el **método de este sistema** (abajo).

**0. Problemática (carpeta raíz).** Se crea PRIMERO. Al crearla se le asigna una **referencia de máx. 4
letras** (p.ej. `NROF`) que heredarán sus fuentes de tipo premisa. Al seleccionarla se ve TODO el proceso
de gestión de datos de esa problemática. Dentro de una problemática seleccionada se puede: **agregar
fuentes**, **agregar problemas**, crear códigos, categorías, ver piezas, generar rompecabezas, subtemas,
temas.

**1. Fuente (entrada de datos).** Es la ENTRADA; hoy **manual**, a futuro robots/conexiones que buscan y
recolectan datos del tema. Cada fuente tiene **3 propiedades**:
  - **Nivel de confianza / credibilidad** (numérico).
  - **Tipo de dato:** `cantidad` (p.ej. "30 de cada 100 niños entran a escuela particular") | `cualidad`
    (p.ej. "se observó cómo los jóvenes se molestaban con el que alertaba a la profesora").
  - **Tipo de lógica:** `premisa` (aplica a una premisa lógica) | `peso` (aporta peso/credibilidad a otra
    fuente).
  - **Nomenclatura de fuente:**
    - premisa → `<REF>-<seq>`, con **seq por problemática** (p.ej. `NROF-1`, `NROF-23`).
    - peso → `Ref-<seq>`, con **seq GLOBAL** (independiente de la problemática; p.ej. si en la 1ª
      problemática llegué a `Ref-5`, la 1ª peso de la 2ª problemática es `Ref-6`).

**2. Código (premisa/verdad consecuente).** Resultado de **juntar premisas** (fuentes premisa) que por
lógica dan una **verdad consecuente** (= premisa lógica). Puede juntar **varias** premisas (no solo 2).
  - **Nomenclatura:** `COD-<REF>-<u1>/<u2>/…/<uN>`, donde cada `u` es una unidad-premisa de esa
    problemática. Ej.: `COD-NROF-1/23`, `COD-NROF-1.45/12`.
  - **Fuentes de tipo peso** sobre una fuente premisa: **no cambian** la nomenclatura de la premisa; ajustan
    su credibilidad (**promedio** entre ambas). Una fuente peso puede **sumar** o **contradecir**. Repetir la
    misma verdad ⇒ más creíble (a más repetición, mayor credibilidad).
  - **Enfrentamiento de dos premisas** (una premisa puede contradecir a otra SIN ser peso): se enfrentan dos
    fuentes premisa y por **credibilidad** una queda por encima; se **fusionan en UNA sola premisa** que junta
    la verdad de ambas (texto de la premisa combinada lo escribe **manualmente** el usuario). Nomenclatura de la
    premisa enfrentada: `<REF>-<ganadora>.<perdedora>` (p.ej. `NROF-1.45` → ganó 1, perdió 45). Usada en un
    código: `COD-NROF-1.45/12`.
  - **Verificación:** un código nace **NO verificado**. Se verifica con **pruebas empíricas** reales
    (estudios propios / demostración en vivo). Cada código tiene una **lista de eventos** (título + **url**:
    video grabado o streaming en vivo) que evidencian la demostración. Solo un código **verificado** puede
    pasar a **categorías**.

**3. Categoría.** Agrupa **códigos verificados** (para reutilizarse a futuro en el sistema "encuadre
condiciológico"). Tiene número secuencial (cat-1, 2, 3…). **Nomenclatura:** `CAT-<seq>-<nomenclatura del/los
código(s)>` (ej. `CAT-1-COD-NROF-1.45/12`).

**4. Pieza.** **NO se crea desde este sistema** (viene del futuro sistema "metodología condiciológica"),
pero **sí se visualiza** aquí. Un experto en condiciología **revisa o corrige** los códigos que llegan y
devuelve una pieza que puede juntar **varios códigos** o usar **solo uno**. Dos tipos:
  - `revisión` = **añade variables** a un código con datos fijos. Nomenclatura `PIE.REV-<nomencl. categoría>`
    (ej. `PIE.REV-CAT-1-COD-NROF-1.24/12`).
  - `corrección` = **convierte el código completo** en variables distintas. Nomenclatura `PIE.COR-…`
    (ej. `PIE.COR-CAT-1-COD-NROF-1.24/12`).
  - Las variables dependen de **3 factores globales**: `mental`, `corporal`, `ambiental`. Hay **variables
    fijas** y **variables que cambian**. Cada variable puede traer **restricciones** (definidas desde el
    sistema de metodología condiciológica): p.ej. "aplica más de uno", listado de variables NO aceptadas, o
    "solo se une con variables de ciertas categorías". Estas restricciones gobiernan el nivel siguiente.

**5. Rompecabezas.** Une **piezas** para responder a una **situación**; la **lógica valida** si las piezas
pueden unirse según las **restricciones** de sus variables. Es como una **fórmula/expresión** cuyos
parámetros son las variables de las piezas usadas; distintas uniones ⇒ distintas expresiones/realidades.
  - **Nomenclatura: NINGUNA codificada** → se le asigna un **nombre manual** (p.ej. "Evento laboral de
    Desesperación"), legible, para usarse a futuro en "dinámica condiciológica".
  - Al crear se elige: **situación** (categoría de una lista de "situaciones" que se compartirá luego) +
    **unión de piezas** + **nombre**.

**6. Subtema.** **Título** que agrupa rompecabezas en un **orden manual** para transmitir una idea = una o
más **hipótesis** (producto final del subtema). Al crear: **título** + **lista de hipótesis**. **Sin
nomenclatura.**

**7. Tema.** Agrupa **subtemas**; **describe toda la realidad en prosa** conectando el contenido de todos los
subtemas **sin inventar** lógicas nuevas — **excepto las hipótesis** de los subtemas, que deben quedar
**distinguidas** dentro del documento del tema. Tiene **título**. **Sin nomenclatura.** Se asocia a
**materias** y a **problemas**.

**8. Materia.** Área de conocimiento (física, psicología, química, software…). **Lista global** (como
"situaciones"). Un tema se asocia a las materias que usó como conocimiento.

**Problema.** Existe **dentro de la problemática** (se agrega en la interfaz junto a las fuentes). Un **tema**
se asocia a **problemas**; los problemas están conectados por origen a la problemática.

### Elementos GLOBALES (no por-problemática)
- **Secuencia de fuentes tipo peso** (`Ref-N`) — global.
- **Materias** — lista global.
- **Situaciones** (categorías de rompecabezas) — lista global (definición fina la comparte el usuario luego).

### Motor de nomenclatura (resumen determinista)
| Nivel | Nomenclatura | Secuencia |
|---|---|---|
| Problemática | `REF` (≤4 letras, manual) | — |
| Fuente premisa | `REF-<n>` | por problemática |
| Fuente peso | `Ref-<n>` | **global** |
| Premisa enfrentada | `REF-<ganó>.<perdió>` | usa seq de fuentes premisa |
| Código | `COD-REF-<u1>/<u2>/…` (u = `<n>` o `<g>.<p>`) | por problemática |
| Categoría | `CAT-<n>-<cod…>` | (¿global/por-problemática? → confirmar) |
| Pieza revisión | `PIE.REV-<cat…>` | — (viene de otro sistema) |
| Pieza corrección | `PIE.COR-<cat…>` | — |
| Rompecabezas | **nombre manual** | — |
| Subtema / Tema | **título** (sin nomenclatura) | — |

### Patrón técnico confirmado (Comandos Violeta, 2026-07-11) — a calcar
- **DB:** `lib/centralized/<sistema>-db.ts` importa `pool` de `@/lib/db` (pool `pg` global, `search_path=gcc_world,public`);
  `let ready=false` + `ensure<Sistema>Tables()` con `CREATE TABLE IF NOT EXISTS gcc_world.<prefijo>_*`; cada CRUD hace
  `await ensure...()` primero. SQL siempre calificado `gcc_world.`; params `$1`; jsonb `$n::jsonb`+`JSON.stringify`; `RETURNING`.
- **Dominio:** `lib/centralized/<sistema>.ts` tipos/constantes puras (meta de nodos color/forma, helpers de nomenclatura, keys de nodo).
- **API:** `app/api/centralized/<sistema>/**` con guard `getCurrentUser()` + `['admin','member']`, try/catch → `{error}`/500,
  éxito `{data}` (lecturas/creación) o `{ok:true}` (PATCH/DELETE).
- **Registro:** INSERT idempotente `… WHERE NOT EXISTS (slug)` en `ensureTable()` de `app/api/centralized/systems/route.ts`
  (name='Gestión de Datos', piso='pilar', paso='fundamentacion', cell_name='Academia', slug='gestion-de-datos'); dispatch
  ternario por slug en `app/(dashboard)/dashboard/centralized/[piso]/[paso]/[slug]/page.tsx` → `<GestionDeDatosSystem system isAdmin/>`.
- **UI:** `'use client'` en `components/centralized/systems/`, layout 3 zonas (aside izq + grafo + panel flotante absolute),
  constantes `mf/df`, `GLASS`/`GLASS_BTN`/`GLASS_INPUT`, fetch nativo + `sonner`, mutaciones optimistas, `PixelConfirm` para borrar,
  `FloatingWindow` para modales. Grafo `react-force-graph-2d` (import dinámico cliente, cache de nodos por key, `traceShape`/
  `shapeOf`/`colorOf`, leyenda hover-previsualiza+clic-fija). Panel izq usa clases `digi-*`; panel sobre grafo negro usa `GLASS`/blanco.
- **Ruta final:** `/dashboard/centralized/pilar/fundamentacion/gestion-de-datos`. Acceso: miembros piso global/pilar con paso
  fundamentación (`pisosAtOrBelow('pilar')=[pilar,controlador,colaborador]` incluye pilar; se exige paso exacto) + admin + shares.

### Decisiones de negocio (RESUELTAS 2026-07-11, por el usuario)
#### P1 — Secuencia de **categorías** · ✅ Resuelta → **por problemática** (CAT-n reinicia en cada problemática; agrupa códigos verificados de esa problemática).
#### P2 — **Piezas** · ✅ Resuelta → **solo visualización** (se modela la tabla + variables/restricciones, pero NO se crean desde este sistema; llegan del futuro sistema "metodología condiciológica". Los **rompecabezas quedan a la espera** de que existan piezas).
#### P3 — **Escala de credibilidad** · ✅ Resuelta → **0–100 %** (numérico). El promedio peso↔premisa y los enfrentamientos operan en esta escala.
#### P4 — **Alcance / orden** · ✅ Resuelta → **por fases verificables**:
  - **Fase A (núcleo lógico):** Problemática(+REF), Problemas, Fuentes (premisa/peso, credibilidad, seq premisa por-problemática / peso global),
    Pesos (promedio de credibilidad), Enfrentamientos (ganó.perdió + texto manual), Códigos (+ premisas juntadas + eventos de verificación
    título/url + estado verificado), Categorías (por problemática). + registro del sistema + shell UI/grafo.
  - **Fase B (síntesis):** Piezas (solo visualización + modelo variables mental/corporal/ambiental + restricciones), Situaciones (lista global),
    Rompecabezas (nombre manual + situación + unión de piezas validada por restricciones), Subtemas (+ hipótesis).
  - **Fase C (descriptivo):** Temas (prosa + asociación a materias y problemas), Materias (lista global).

### Preguntas ABIERTAS (surgidas al diseñar)
#### P5 — ¿La fuente peso puede **contradecir**? · ✅ RESUELTA (usuario, 2026-07-11) → **NO**.
- **Respuesta:** una fuente de tipo peso **SIEMPRE aumenta** la credibilidad de una premisa (promedio `(actual+peso)/2`). **No
  existe modo "contradice" en pesos.** La contradicción se aplica **solo enfrentando dos premisas** (gana la de mayor
  credibilidad efectiva). Se **eliminó** el `modo` de `gd_fuente_pesos`, de `aplicarPeso()`, de la ruta `/pesos` y del UI.
#### P6 — Nomenclatura de **categoría** con **varios** códigos: ¿`CAT-n-<cod1>_<cod2>…` o solo `CAT-n` + lista? · ⏸ (provisional: `CAT-n` como ref primaria + lista de códigos; el display concatena el 1º código como en el ejemplo).

### Progreso
- **% de información para el objetivo:** ~99% — **SISTEMA COMPLETO (Fases A+B+C) CONSTRUIDO Y VERIFICADO (2026-07-11)**:
  dominio+nomenclatura, capa DB (tablas `gd_`), **15 rutas API**, grafo `GdGraph.tsx` (**10 tipos de nodo**) y componente
  `GestionDeDatosSystem.tsx`. `tsc --noEmit` + `next build` OK. P5 resuelto (peso solo aumenta; contradicción = enfrentamiento).
  **Prueba END-TO-END contra la BD real de Railway (10/10, transacción con ROLLBACK):** 24 tablas DDL + flujo completo
  Problemática→…→Tema + secuencias + REF única. Solo falta **validación visual/UX en vivo** (requiere login).
  - **Fase A:** Problemática/Problemas/Fuentes/Enfrentamientos/Códigos(+eventos)/Categorías.
  - **Fase B:** Piezas (solo visualización), Situaciones/Materias (listas globales), Rompecabezas, Subtemas (+hipótesis).
  - **Fase C:** Temas (prosa + agrupa subtemas + asocia materias y problemas).
- **Pendiente:** **validación visual en vivo** (requiere login); probar contra Railway; alimentar piezas desde el futuro
  sistema de "metodología condiciológica" (hoy solo-visualización → rompecabezas a la espera de piezas reales).
- **Solución construida (A+B+C):** ver detalle en `MEMORIA.md` → "Decisiones recientes (feature) · Gestión de Datos".

### Cambio (2026-07-11): botón "Listas" ELIMINADO de Gestión de Datos
Las listas globales (situaciones, materias, **talentos, valores** y futuras) deben editarse desde un **espacio ÚNICO**:
el futuro sistema **Metodología Condiciológica**. Se quitó el botón "Listas" + `ListasModal`/`EditableList` de
`GestionDeDatosSystem.tsx`. Las tablas `gd_situaciones`/`gd_materias` y sus rutas API se **conservan** (los selectores de
rompecabezas/temas las leen); solo se quitó la edición desde aquí. Verificado tsc OK.

---

## ROADMAP — sistemas condiciológicos siguientes (capturado 2026-07-11, base verbatim del usuario)
> Visión detallada de los sistemas que siguen. **NO construido aún** — capturado para dominarlo antes de desarrollar.
> Nomenclatura de factores: el usuario ahora dice **cognitivo/corporal/ambiental** (antes "mental/corporal/ambiental" en
> las variables de pieza) — **reconciliar** al construir (probablemente mental≡cognitivo). Ver P7 abajo.

### Flujo global (cómo encajan los sistemas)
1. **Gestión de Datos** = motor que recolecta y analiza datos hasta crear **Categorías** (códigos verificados).
2. **Metodología Condiciológica** (sistema, "el lector") = aplica la metodología de **6 pasos** (Reconocer→Controlar→
   Predecir→Experimentar→Convertir→Cambiar) para obtener **condiciones** reconocibles y cambiables. Lee contenido de
   investigación de varios sistemas y **genera TAREAS** dentro de un **proyecto de investigación** para avanzar. Decide
   qué **códigos** convertir en **piezas** y lo solicita generando tareas → van a **Gestión de Condiciones**.
   **Es el ESPACIO ÚNICO donde se editan las listas globales** (situaciones, materias, talentos, valores, futuras).
3. **Gestión de Condiciones** (sistema NUEVO, para **miembros paso fundamentación · piso controlador**) = donde se
   **reconoce/controla/predice** un código para convertirlo en **pieza**, descubriendo **condiciones**. Devuelve la pieza
   (revisión/corrección + variables) a Metodología Condiciológica, que la adopta a su proyecto; luego la pieza se reutiliza
   en **Gestión de Datos** para justificar una problemática (rompecabezas).
4. **Dinámica Condiciológica** (sistema, referenciado) = investiga EXCLUSIVAMENTE los factores **cognitivo/corporal/
   ambiental**; cada factor tiene **causas**, cada causa tiene **variables**. Define (por análisis experto, según se estudia)
   qué variables existen y los métodos de recolección según las causas a monitorear. **Provee el listado factor→causa→
   variable** que usa Gestión de Condiciones.
5. **Laboratorio Condiciológico** (herramienta) = lugar donde los miembros lanzan las subtareas y hacen el **proceso de
   investigación de condiciones**: sobre un código, ejercicio en un espacio ambientado, luego analizan factores/causas/
   variables para determinar cuáles impactan el código. Las investigaciones se guardan como **registros de condiciones**.
6. **Alertas** (módulo FUTURO, debajo de "Mi día") = bandeja de notificaciones (invitaciones, eliminaciones, novedades)
   para **aprobar/rechazar** invitaciones/solicitudes.

### Sistema "Metodología Condiciológica" — interfaz
- **Panel izquierdo** (como el de Problemáticas de Gestión de Datos): crear **Proyectos de investigación**. Un proyecto de
  investigación **siempre tiene finalidad productiva** (su salida es un resultado usable, p.ej. construir un edificio,
  cambiar la infraestructura tecnológica de un barrio). Esa salida luego alimenta un **proyecto de creación** (paso
  creación) — la vinculación se explicará a futuro.
- **Panel derecho = 6 pestañas** (los 6 pasos): **Reconocer · Controlar · Predecir · Experimentar · Convertir · Cambiar**.
  Cada pestaña trae **fuentes de distintos sistemas**.
  - **Reconocer (definir ahora):** panel derecho con **todos los códigos VERIFICADOS** (de Gestión de Datos) por su
    referencia; seleccionar un código → otro panel a la derecha con su **detalle**: premisas asociadas, **fuentes de peso**
    de esas premisas (mostrar SOLO su nomenclatura + **burbuja al hover** con el detalle del peso) y premisas de
    **enfrentamiento**. Se pueden **seleccionar varios códigos** y revisarlos (¡pide creatividad!). Con un conjunto de
    códigos → **Generar tarea**: **título** + asociar al **proyecto de investigación** + campo **notas/observaciones**.
    La tarea va **directo a Gestión de Condiciones**.

### Sistema "Gestión de Condiciones" (NUEVO · piso controlador · paso fundamentación) — interfaz
- **Panel derecho:** todas las **tareas generadas**, seleccionables en **orden ascendente** (más antigua→reciente).
  Seleccionar tarea → panel a la derecha con su detalle. **Pestañas** en ese panel:
  - **Datos:** todos los **códigos asociados** + detalle de cada uno (pesos, enfrentamientos, etc.).
  - **Subtareas (requerimientos):** generar subtareas; cada subtarea puede incluir un conjunto de **tickets o proyectos**
    (sin límite de subtareas ni de tickets/proyectos por requerimiento). Al crearlos, el usuario es el **cliente**; luego
    puede: asignar un **miembro paso fundamentación** para que tome el ticket, o dejarlo **sin miembro y público**
    (candidatos/miembros lo ven, pero **solo miembros paso fundamentación lo pueden tomar**; el primero que lo toma lo
    ejecuta). Igual para **proyectos** (agregar miembros paso fundamentación como participantes, o público; solo miembro
    paso fundamentación entra como participante). **Diferencia clave vs tickets/proyectos normales:** la **autorización
    para entrar se SALTA** (se presume competencia). (A futuro, algo similar para los normales bajo ciertas condiciones.)
  - **Pieza (espacio de trabajo):** construir la pieza. Puede usar todos o algunos de los códigos verificados de la tarea
    (criterio del miembro). Usa el **MISMO universo de gráficos** de Gestión de Datos (mismos íconos de código/categoría/
    pieza): visualiza códigos y categorías ya definidos (con acceso a sus datos) y una **pieza precreada VACÍA**.
    - **La pieza se crea al crear la tarea** (en Metodología Condiciológica), nace **vacía**; mientras esté vacía, en
      Gestión de Datos se ve **INCOMPLETA** y su avance/detalle se refleja conforme avanza en Gestión de Condiciones.
      ⇒ **implica agregar `estado` a `gd_piezas`** (incompleta|completa/verificada) al construir esto.
    - Para **agregar una condición** al universo: seleccionar → panel derecho **"Condiciones"** con todas las condiciones
      creadas + botón **agregar condición**. Las condiciones se agregan por la gestión vía subtareas + el proceso de
      investigación registrado (hecho en el **Laboratorio Condiciológico**).
    - **Crear condición** → modal para agregar **variables fijas** y **variables del listado** de factores de **Dinámica
      Condiciológica** (factor→causa→variable). Panel derecho con todas las variables **agrupadas por causa y factor**;
      **universo de variables** donde se **arrastran** variables del panel izquierdo → significan que la condición está
      afectada por ellas (**NO verificadas**); + botón para **variables fijas**.
    - **Verificación de condición:** las variables (fijas o de factor) deben **verificarse demostrando que se expresan en
      la condición** → la condición tiene una **lista de eventos** (demostración de que existe). Verificada ⇒ se muestra
      **distinta** en el universo de la pieza (verificada vs no verificada).
    - Al agregar condiciones, la **pieza trae automáticamente las variables** de esas condiciones al universo (cada
      variable de cada condición visualizable). Variables **repetidas** entre condiciones ⇒ permiten reconocer **reglas**.
    - **Restricciones (3 funciones por ahora, se ampliarán):** (1) qué variables **no se pueden usar junto a** otra
      variable; + las ya comentadas (`aplicaMasDeUno`, `soloCategorias`). Se **añaden a nivel del universo de gráficos**
      sobre las condiciones existentes. Limitan el comportamiento de la pieza al unirse en **rompecabezas** (Gestión de Datos).
    - Al terminar → **marcar la tarea como completada** ⇒ la pieza queda **completa/verificada** y usable en Gestión de Datos.

### Preguntas abiertas del roadmap
#### P7 — Factores · ✅ RESUELTA (usuario 2026-07-11): los 3 factores son **mental, corporal, ambiental** (mi modelo era correcto). Tienen **causas**: mental→[cognitivo, social], corporal→[estructural, funcional], ambiental→[positivo, universo]. Cada causa tendrá **variables** (las define Dinámica Condiciológica). Registrado en `lib/centralized/condiciologia.ts` (`FACTORES`).
#### P8 — Piso/paso · ✅ PARCIAL (usuario 2026-07-11): **Metodología Condiciológica = global · fundamentación** (celda "Condiciología"). Gestión de Condiciones = **controlador · fundamentación**. **Dinámica Condiciológica** = por confirmar.

### Estado de construcción del roadmap (2026-07-11)
- **Dinámica Condiciológica — HECHA (2026-07-11):** colaborador·fundamentación (celda "Investigador", a confirmar piso/paso).
  Panel de 3 factores → variables agrupadas por causa → editar **nombre** + **herramienta de monitoreo**. Dueño de
  `dc_variables` (campo nuevo `herramienta_monitoreo`); en Gestión de Condiciones el catálogo quedó **solo lectura**. Ruta
  `dinamica/variables` (GET/POST/PATCH/DELETE). tsc+build OK + BD real 2/2. **Futuro:** campos que conectarán con Gestión de Datos.
  **Pendiente:** Laboratorio Condiciológico, módulo Alertas; pulidos finos de Gestión de Condiciones Fase 2.
- **Gestión de Condiciones — FASE 1 HECHA (2026-07-11):** controlador·fundamentación (celda "Conocimiento"). Bandeja de
  tareas + pestañas **Datos** (códigos con detalle) / Subtareas (placeholder) / **Pieza (workspace)**: condiciones con
  **variables** (fija factor/causa o del catálogo `dc_variables`), **eventos** de verificación, **restricciones** (3 tipos)
  y **"Completar tarea"** → `completeTask` **materializa `gd_pieza_variables`** (fija→fija, catálogo→cambia; restricciones
  volcadas) + pieza `completa` + tarea `completada` (reabrible). DB `condiciones-db.ts` (dc_/gc_) + 8 rutas API. Dominio
  `condiciologia.ts` (`RESTRICCION_TIPOS`). tsc + build OK + **BD real 8/8 (ROLLBACK)**.
  **FASE 2 HECHA (2026-07-11):** (a) **Subtareas** con integración REAL — requerimientos crean tickets/proyectos reales
  (usuario=cliente, marcados `source_system='condiciones'`/`source_paso='fundamentacion'`), asignar miembro paso-fundamentación
  o público, **tomar** con enforcement de paso, y **bypass** del gate de proyecto privado; (b) **universo de gráficos** en el
  workspace (toggle Panel/Universo, `GdGraph` con nodos código/pieza/condición/variable). tsc+build OK + **BD real 5/5** (INSERT
  ticket service_id NULL + proyecto público con columnas reales). Detalle en `MEMORIA.md`.
  **Pendiente:** botón "Tomar" en la UI de los módulos Tickets/Proyectos; drag-drop de variables al crear condición; sistemas
  **Dinámica Condiciológica** (catálogo real de variables) y **Laboratorio Condiciológico**, módulo **Alertas**.
- **Metodología Condiciológica — FASE 1 HECHA:** proyectos de investigación + 6 pestañas (solo **Reconocer** desarrollado:
  códigos verificados multi-selección + detalle premisas/pesos[hover]/enfrentadas + generar tarea) + gestión de listas
  globales (situaciones/materias) + `createTask` pre-crea **pieza vacía incompleta**. tsc + build OK + BD real 6/6 (ROLLBACK).
  Gestión de Datos refleja `gd_piezas.estado` (piezas incompletas atenuadas). Botón "Listas" quitado de Gestión de Datos.
  **Pendiente:** 5 pasos restantes; sistemas Gestión de Condiciones, Dinámica Condiciológica, Laboratorio; módulo Alertas;
  migrar talentos/valores a listas editables. **P9/P10** siguen abiertas (variables/condiciones; vinculación tarea↔pieza ya
  parcialmente resuelta con `mc_task_pieza` + estado incompleta).
#### P9 — Modelo de **variables** (Dinámica Condiciológica: factor→causa→variable) y de **condiciones** (registros con variables + eventos de verificación + restricciones): tablas nuevas + de dónde salen. · ⏸
#### P10 — Vinculación **tarea (Metodología)→pieza precreada vacía** y estados de pieza (`incompleta`) reflejados en Gestión de Datos. · ⏸

---

## Objetivo PREVIO (declarado 2026-07-08, ✅ CERRADO 100%) — Comandos Violeta: generación REAL de tareas al activar una política
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
- **RESUELTO (2026-07-09) — sesión de dashboard para candidatos (evita doble login):** decisión del usuario =
  darle la sesión de dashboard en el MISMO login (rol según el usuario; módulos gateados por rol). Helper
  **`lib/auth/candidateSession.ts` → `grantCandidateDashboardSession(email)`**: busca/crea la fila `gcc_world.users`
  (rol 'client' si es nueva; preserva el rol si ya existe), sincroniza la contraseña, **vincula
  `clients.user_id`** y emite el **JWT `auth_token`** (`createToken`+`setAuthCookie`). Se llama en
  **`complete-profile`** (al crear la cuenta) y en **`recover/verify`** (al iniciar sesión como candidato). Así,
  al ir a `/dashboard` ya hay JWT → NO rebota a `/auth` (un solo login). Es coherente con `passkey/login/finish`,
  que ya emitía el JWT del `users` enlazado por `clients.user_id`. Verificado tsc+build + SQL en Postgres (rollback).
- **Botón del ofrecimiento de passkey** (AccountRecoveryModal) ahora dice "…comenzar a colaborar" (destino
  dashboard) o "…entrar al juego" (destino juego) según `destination`.

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

---

## Objetivo (2026-07-16/17) — Integración Google Workspace (Meet + correo + cuentas) + Responsividad total · ✅ RESUELTO

> Objetivo previo (agente de pesos, 2026-07-12) quedó resuelto. Esta sección acumula los aprendizajes de la
> sesión del 2026-07-16/17. El detalle de implementación vive en `MEMORIA.md`; aquí van las **preguntas técnicas
> y sus respuestas/descubrimientos** (lo que costó averiguar).

### Rol asumido
Integrador de sistemas / arquitecto cloud (Google Workspace Admin SDK, Calendar/Meet/Gmail API) + front responsive.

### Preguntas y respuestas (aprendizajes clave)

#### P1 — ¿Se puede grabar/transcribir un Google Meet automáticamente por API? · ✅ Resuelta
- **Respuesta:** Sí, con la **Meet REST API v2** (`meet.spaces.create`) y `config.artifactConfig`:
  `recordingConfig.autoRecordingGeneration=ON`, `transcriptionConfig.autoTranscriptionGeneration=ON`,
  `smartNotesConfig.autoSmartNotesGeneration=ON` (notas Gemini). Se **adjunta** el space al evento de Calendar
  con `conferenceData` importada (conferenceId + entryPoints) → el evento queda con el Meet nativo que auto-graba.
  Requiere scope `meetings.space.created`. Verificado en vivo: el plan de GCC soporta las tres. (fuente: pruebas
  con la cuenta real)

#### P2 — ¿Un miembro puede tener Gmail `@dominio` gratis? · ✅ Resuelta (NO)
- **Respuesta:** **No.** Gmail/Calendar propios de un dominio **exigen licencia PAGADA** (Business Standard+ para
  grabar). **Cloud Identity es GRATIS** pero solo da **identidad + perfil (nombre/foto/teléfono)** — sin Gmail,
  sin Calendar, sin grabación. Unirse a un Meet sí es gratis. → Decisión: cuentas de miembros = Cloud Identity
  gratis (identidad+perfil); las reuniones las organiza y **graba la cuenta del líder** (una sola licencia).

#### P3 — ¿Se puede evitar por código la licencia pagada auto-asignada? · ✅ Resuelta (NO)
- **Respuesta:** **No.** La org tenía **auto-asignación de licencias ON** → cada usuario nuevo recibe Business
  Standard; `licenseAssignments.delete` no la quita (y la auto-asignación la re-pone). La ÚNICA vía limpia es
  **desactivar la auto-asignación** (Admin → Facturación), idealmente **por unidad organizativa** (se creó `/Candidatos`).
  Durante el **trial** no se puede desactivar hasta pasar a pago. (fuente: pruebas creando/borrando usuarios de test)

#### P4 — Crear la clave JSON de la service account estaba bloqueado · ✅ Resuelta
- **Respuesta:** Política "segura por defecto" `iam.disableServiceAccountKeyCreation`. Se sobrescribe con
  `gcloud org-policies set-policy` (enforce=false a nivel proyecto), teniendo `roles/orgpolicy.policyAdmin`.

#### P5 — Bug de zona horaria en el formulario del calendario público · ✅ Resuelta
- **Respuesta:** `zonedWallclockToUTC` usaba `new Date(string)` → **dependía de la zona del navegador** y daba
  horas erróneas. Se reescribió con `Intl.formatToParts` (independiente de la zona local; verificado en
  UTC/Ecuador/Madrid/Tokyo). Decisión de UX: el calendario público SIEMPRE en horario del miembro (Ecuador).

#### P6 — Patrón de responsividad reutilizable para toda la app · ✅ Resuelta
- **Respuesta:** 3 piezas: (1) `hideOnMobile` por columna en `PixelDataTable` (`hidden sm:table-cell`);
  (2) `DetailHeader` con acciones que **envuelven** (`flex-wrap`); (3) apilar-con-altura-condicional:
  `flex-col lg:flex-row` + `w-full lg:w-[Npx]` + `max-h-[..]/min-h-[..] lg:…-none/0`, y en calendarios,
  forzar **vista de Día** en `<768px`. Aplicado a TODO el dashboard. Excepción: editores de canvas del mundo.

### Estado
- **% de información para el objetivo: 100%** — todo implementado y verificado en vivo (Gmail/Meet reales,
  cuentas de prueba, BD ROLLBACK, tsc+build). **Pendiente NO técnico:** env `GOOGLE_SA_KEY`/`GOOGLE_WORKSPACE_ORGANIZER`
  en Railway (prod) y, al pasar el trial, excluir `/Candidatos` de la auto-asignación de licencias.
