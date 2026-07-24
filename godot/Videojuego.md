# Videojuego GCC World — Documento de desarrollo (fuente de verdad viva)

> Este archivo es la **fuente de verdad del desarrollo del videojuego**. Lo mantiene la
> skill `/videojuegogcc`: al invocarla, se lee y analiza completo; cuando hay avances,
> correcciones o temas nuevos, se **actualiza** aquí (sin duplicar; corrigiendo lo viejo
> si algo cambió; fechas absolutas). Documentos hermanos: [HISTORIA.md](HISTORIA.md)
> (guion/lore + diseño del juego) y [GUION_VISUAL.md](GUION_VISUAL.md) (las 66 estampas
> del prólogo). Última actualización: **2026-07-23**.

---

## 1. Qué es el juego (visión)

- **Videojuego 2D pixel-art** en **Godot 4.7.1**, subcarpeta `godot/` del repo GCC WORLD.
  Objetivo: **exportar a web (HTML5)**, jugable en escritorio y móvil.
- Género: **aventura/RPG estilo Guardian Tales** con **temática filosófica** (fábula
  sobre el cuidado, la gratitud y el desarrollo humano).
- **Conectado a la plataforma GCC World** (plataforma de desarrollo humano: tickets,
  proyectos, facturación, marketplace, varios sistemas). Mecánicas planificadas:
  - **Zonas/caminos se desbloquean según la cuenta del usuario** en la plataforma
    (condiciones ligadas a su perfil real: talento, valores, dimensiones, red de apoyo).
  - **Moneda del juego** → a futuro canjeable en el **marketplace** por productos/
    servicios reales.
  - **Tareas del juego vinculadas a estadísticas del perfil** del usuario.
- Fernando es **principiante en Godot** y quiere **aprender guiado** además de que yo
  cree scripts/config/arte.

## 2. Historia y lore (resumen; detalle en HISTORIA.md y GUION_VISUAL.md)

- **El Hoyo:** lugar sagrado (un agujero natural en la tierra) donde los humanos daban
  las gracias, creyendo que abajo dormía un ser que los cuidaba. Al **abandonarlo** (por
  tecnología, dinero, poder), el mundo colapsó y del Hoyo brotó una **corrupción de
  raíces grises**.
- **Prólogo (estilo Undertale):** 66 estampas que cuentan la caída del mundo (devoción →
  olvido → decadencia social → colapso gris → un sobreviviente se lanza al Hoyo). El
  texto va **debajo, en Godot** (no en la imagen). Ver GUION_VISUAL.md + `Prologo.gd`.
- **Intro cinemática:** lluvia → descenso → zoom a la cueva (el Hoyo). Ver `Intro.tscn`.
- **Encuentro:** al fondo del Hoyo, el joven (el jugador) se acerca a una **niña
  demacrada amarrada a raíces**; diálogos ("¿Hay alguien ahí?", "Tengo miedo...",
  "¿QUIÉN ERES?" → registra el nombre); temblor, los hermanos son capturados; el joven
  despierta en otro lugar con una **voz** que lo reta a cambiar. Ver `Encuentro.gd`.
- **El personaje = el jugador:** debe ser **imposible de identificar** (silueta oscura,
  sin rostro/cuerpo/género), porque luego el jugador crea su propio personaje.

## 3. Arquitectura técnica (Godot)

**Flujo de escenas objetivo:** `Prologo.tscn` → `Intro.tscn` → `Main.tscn` (Encuentro) →
(creador de personaje) → lobby de nieve → caminos.

**Scripts y qué hace cada uno:**
- `Prologo.gd` / `Prologo.tscn` — reproductor de estampas del prólogo. **Auto-avance**
  con crossfade + **narración que se teclea** encima (Silkscreen). `GUION` = bloques de
  texto ↔ grupos de escenas (reorganización temática de las 66). Esc / botón "Saltar".
- `Intro.gd` / `Intro.tscn` — intro cinemática (lluvia CPUParticles2D, descenso de cámara
  por una imagen de fondo, zoom a la cueva, oscurece, `change_scene`). Ajustable por
  `@export`.
- `Encuentro.gd` — director de la escena del encuentro (en `Main.tscn`): jugador se
  mueve, diálogos por **proximidad** a `Nina`, temblor de cámara, fundidos. Usa distancias
  `@export` + `mostrar_distancia_debug` para calibrar.
- `CajaDialogo.gd` (`class_name CajaDialogo`) — **sistema de diálogos reusable**: caja
  abajo, efecto máquina de escribir (RichTextLabel `visible_characters`), avanza **solo
  con ESPACIO** (ignora `echo`/teclas mantenidas) o toque/clic. Silkscreen.
- `ControlesTactiles.gd` (`class_name ControlesTactiles`) — **joystick táctil** para
  móvil/web; aparece solo si `DisplayServer.is_touchscreen_available()` (o
  `siempre_visible` para probar en PC con mouse). Inyecta `Input.action_press/release`
  sobre `ui_left/right/up/down`, así el jugador no necesita cambios.
- `Violeta.gd` — movimiento 4 direcciones del personaje (teclado + joystick vía `ui_*`).
  Bandera `control_habilitado` para congelarlo (intro/diálogos). Animaciones por Inspector.
- `IntroDirector.gd` — versión antigua (intro dentro de Main); **en desuso**.

**Convenciones/gotchas Godot:**
- Godot 4.7 usa **TileMapLayer** (no el viejo TileMap) para mapas. Tile actual: `Tile 1.png`
  32×32 ("Mundo Interno").
- En 2D, el nodo más abajo en el árbol se dibuja encima (orden de capas).
- **Mover un personaje = mover el NODO padre**, no su sprite hijo (error típico:
  distancias/posición no cambian si mueves el sprite).
- Cámara hija del personaje → lo sigue centrado (offset local para paneos).
- Filtro de textura **nearest** (pixel-art nítido). Viewport 960×540 (16:9).
- Fuente **Silkscreen** (`assets/Fonts/`, misma que la landing de la plataforma).

## 4. Pipeline de ARTE con IA — `tools/generar_estampas.py`

**Herramienta:** Gemini **"Nano Banana"** (`MODELO = "gemini-2.5-flash-image"`; Pro =
`gemini-3-pro-image-preview`). API key de Fernando en **env `GEMINI_API_KEY`** — **NUNCA
commitear la key ni ponerla en archivos**. Deps: `pip install google-genai pillow`
(en venv). Salida: `assets/Prologo/anclas/` y `assets/Prologo/escenas/` (16:9, ~1344×768).

**Comandos:**
- `python tools/generar_estampas.py` → todas las escenas faltantes.
- `python tools/generar_estampas.py <n> [<n>...]` → regenera esas escenas.
- `python tools/generar_estampas.py --anchors [--force]` → anclas (todas / faltantes).

**Anclas (referencias maestras)** en `assets/Prologo/anclas/`:
- `estilo` = copia de **escena_53** (el estilo aprobado por Fernando: crudo, atmosférico,
  aventurero). Es la referencia de estilo.
- `hoyo` = **agujero natural en la tierra** (SIN muros de piedra, NO alcantarilla).
- `personaje` = **silueta negra sin identidad** (el jugador; ni rostro, ni cuerpo, ni
  género; NO encapuchado que se tapa, sino oscurecido por la luz de la imagen).
- `raices` = raíces grises/negras de corrupción.
- `isla` = isla con el Hoyo.
- `contexto` = **crudeza realista adulta** (armados con armas de fuego en ruinas) para
  fijar el nivel de realismo (no símbolos vacíos).

### ⭐ REGLAS APRENDIDAS de consistencia (críticas — respetarlas siempre)
1. **Estilo de dibujo:** para conservarlo, referenciar una **escena previa con POCOS
   personajes** (p. ej. `escena_01`). NO depender de escena_53 automática (desviaba el
   estilo) ni de una escena con multitud (copia la multitud).
2. **Escala:** mantener las figuras **pequeñas y distantes** (misma escala que las
   escenas base). Figuras grandes → caras detalladas → **el diseño se desvía**. La escala
   es la causa #1 de que "los humanos se vean diferentes".
3. **Centrar / composición:** usar el ancla `hoyo` para centrar el Hoyo; **describir
   posiciones explícitas** ("2 detrás, 2 delante, 1 a cada lado") para anillos alrededor.
4. **Continuidad:** **encadenar la escena anterior** como referencia conserva lugar/
   personajes/luz — PERO **también copia la composición/multitud**. Regla: encadenar =
   misma toma y misma gente; NO encadenar = libertad de composición (pero cuidar estilo/
   escala con las reglas 1–2).
5. **Añadir vs quitar:** para **AÑADIR** elementos, **EDITAR** (referenciar la propia
   imagen + "conserva todo, agrega X") funciona genial. Para **QUITAR** gente, la edición
   NO funciona (mantiene a todos) → mejor generar con referencia de pocos personajes.
6. **Cantidades:** acotar números explícitos ("solo 4–5", "2–3 raíces"). Evitar
   "cascada/lluvia/muchos" → produce cantidades infinitas o descontroladas.
7. **Acción clave:** para que algo pase DONDE debe (p. ej. frutos cayendo DENTRO del
   Hoyo), **reencuadrar cerca del objetivo** y ser explícito ("en el aire sobre la boca,
   cayendo dentro, NO sobre la hierba").
8. **Ser MUY detallista y explícito** (vista/ángulo, % del encuadre que ocupa cada cosa,
   número de elementos, qué NO hacer). **No tomar el camino fácil.** Los mejores
   resultados salieron con prompts largos y precisos.
9. **Contenido sensible:** menores en daño (arma, trata) → **símbolo/silueta**, nunca
   explícito (bloqueado por filtros + línea ética firme). Violencia **adulta** sí puede
   ser realista (armas, soborno, agresión).
10. **Errores:** `503` (alta demanda) → reintentos con backoff (ya implementado). Respuesta
    sin imagen = bloqueo de filtros → reformular en versión simbólica.
11. **Arco de dessaturación + hora del día:** color cálido (devoción) → gris (colapso);
    **variar la hora/luz por tramo** (día dorado, noche con luna, amanecer neblinoso…)
    para dar sentido temporal y separar escenas.
12. **Editar AÑADE pero NO reposiciona:** editar (referenciar la propia imagen) sirve para
    **añadir** elementos (un personaje al fondo, manchas, un bocadillo) conservando todo lo
    demás. Pero para **cambiar la POSE/posición** de un personaje NO sirve (lo deja igual):
    hay que **regenerar de cero** describiendo la postura al detalle ("de rodillas sobre
    ambas rodillas, torso y cara girados de FRENTE a X, manos juntas suplicando, NUNCA de
    perfil").
13. **Bocadillos y textos cortos SÍ salen legibles:** frases cortas en globos de diálogo o
    carteles se renderizan bien ("QUIERO MÁS DINERO", "GORDA/FEA/ASCO", "ALERTA URGENTE",
    "EMPLOYMENT OFFICE", reloj "2:15 AM"). Útil para mensajes clave. (Textos largos, no.)
14. **Evitar que la referencia contamine el ESCENARIO:** encadenar una escena copia también
    su lugar (p. ej. escena_23 metió su basural + mendigo en la 27). Si quieres OTRO lugar,
    referencia una escena de **estilo neutro** (p. ej. `escena_16`) SOLO para el estilo y
    **describe el escenario nuevo** en detalle.
15. **Menores — matiz del filtro:** el filtro bloquea CUALQUIER menor en contexto de DAÑO
    (armas, droga, mafia, ser arrastrado por un criminal — se probaron 3 encuadres, todos
    bloqueados; solo pasó la versión 100% simbólica con un osito/juguete). PERO un menor en
    contexto **NO dañino** (p. ej. el hijo detrás de la madre en una disputa de custodia)
    SÍ pasa. Otros temas sensibles adultos que SÍ pasan con contención: violencia de
    pandillas con víctima (sangre sobria), guerra, secta-suicidio (dagas en mano + caídos,
    sin mostrar el acto), extorsión, abuso de poder.
16. **Realismo social auténtico (lo que pide Fernando):** barrios pobres de TIERRA y casas
    de CAÑA; camaroneras como ejemplo de explotación; pandilleros SIN CAMISA/ropa callejera;
    body-shaming con insultos reales visibles; extorsión de exesposos en la PUERTA de la
    casa con triciclo/juguetes que muestran a los hijos; roles y GESTOS explícitos (jefe
    abusivo, dueño con fajos de dinero, padre suplicando de rodillas). Máximo contexto de
    entorno, **nunca el camino fácil**.
17. **503 (saturación):** en horas de alta demanda fallan muchas generaciones por 503; los
    fallos por 503 **no cuestan** (solo se cobra la imagen generada). Reintentar cuando baje
    la demanda; a veces pasa a la primera minutos después.

## 5. Diseño del juego (Fase 1 y progresión)

**Fase 1 (foco tras el prólogo/intro/encuentro):**
1. **Creador de personaje** (sexo, pelo, gafas, accesorios, ropa) antes del lobby.
2. **Lobby: mundo de nieve** grande (hub) con **varios caminos/rutas** (mini-mundos).
3. **Primer camino "perfil cero"** (sin condición): guía de uso de la **plataforma y el
   juego** (tareas que llevan a la plataforma dan beneficios mayores; también hay tareas
   internas para quien no quiera ir aún).
4. **Tutoriales** de controles: recoger/activar objetos, arma+atacar, armadura, escudo/
   cubrirse (sin parry), ver stats, mini-puzzles de botones.
5. **Caminos con condiciones** ligadas al perfil de plataforma + **economía** (monedas →
   marketplace).

**Progresión total ≈ 200 caminos** por tramos: 1–10 captar (historia/jugabilidad);
11–50 negocios plataforma↔juego (productividad, intercambio de recursos); 51–150 por
definir; 150+ competitivo.

## 6. Cómo trabajar con Fernando (preferencias / método)

- **Idioma: español** siempre.
- **Arte del prólogo: una escena por vez.** Genera → revisa → corrige con detalle →
  aprueba explícitamente → siguiente. No avanzar sin su "ok".
- Le importa **muchísimo**: (a) la **consistencia del estilo de dibujo** de personajes y
  del **Hoyo**; (b) la **escala** de las figuras; (c) la **continuidad** (que cada escena
  herede el lugar/estilo de la anterior); (d) que las imágenes muestren la **realidad
  cruda** sin sobre-simbolizar (salvo la línea de menores).
- Pide **ser muy detallista y no tomar atajos**: cuando algo no sale, la solución es
  describir con más precisión, no rendirse con una versión genérica.
- Valora que le **explique el "porqué"** y le deje **reglas** que aplico a lo siguiente.
- **Convención del repo:** commit+push a `main` tras avances verificados; el arte lo
  verifica **visualmente él** (no tests). No commitear la API key.

## 7. Recursos y herramientas

- **Godot 4.7.1** (instalado, `/opt/homebrew/bin/godot`).
- **Gemini API** (Nano Banana) para arte; venv en scratchpad con `google-genai` + `pillow`.
- Fuente **Silkscreen** (Regular+Bold, OFL) en `assets/Fonts/`.
- Assets: `Violeta` (spritesheet 384×96, 48×48), `Desconocido` (2º personaje), `Tile 1`
  32×32 (Mundo Interno). Prólogo: 5 anclas + 66 estampas en `assets/Prologo/`.
- Docs: `HISTORIA.md`, `GUION_VISUAL.md`, este `Videojuego.md`.

## 8. Estado actual (2026-07-23)

- ✅ Movimiento de Violeta, cámara, mapa TileMapLayer, joystick táctil.
- ✅ Intro cinemática, sistema de diálogos, escena del encuentro (esqueleto).
- ✅ Reproductor del prólogo (`Prologo.tscn`) con auto-avance + narración tecleada.
- ✅ **Pipeline de arte por IA** afinado con las reglas de §4.
- 🎨 **Estampas del prólogo:** anclas nuevas hechas. Escenas **regeneradas y aprobadas
  1→31**: Acto 1 devoción (1–6); Acto 2 corrupción del Hoyo (7–12: raíces, isla colosal,
  mar en remolino cayendo al Hoyo); Acto 3 decadencia social 13–31 (13 globo Tierra sin
  anillo; 14 mapa mundial plano con manchitas grises; 15 zoom a zona de Ecuador; 16 balacera
  de pandillas en barrio de tierra/caña; 17 guerra civil con dictador; 18 guerra entre dos
  países; 19 bomba nuclear con hongo enraizado + pareja abrazada; 20 pandemia con noticiero
  de virus; 21 discriminación religiosa; 22 mafia+menor SOLO simbólica (osito, sin niño);
  23 barrio pobre concurrido con basura + mendigo ignorado; 24 secta-suicidio con contención;
  25 abuso pastor 100% simbólico (sombra sotana + flor); 26 body-shaming a mujer obesa con
  insultos; 27 desempleo (señor con CV de perfil, colas naturales); 29 abuelita mendiga
  ignorada; 30 explotación en camaronera —joven/dueño con fajos/supervisor abusivo—;
  31 extorsión de exesposa en la puerta —padre de rodillas, hijos detrás, bocadillo "QUIERO
  MÁS DINERO"—). **Falta la 28** (violencia doméstica, simbólica) y **32–66** con §4.
- ⏳ Fase 1 del juego (creador, lobby de nieve, caminos, tutoriales) pendiente.

## 9. Pendientes / próximos pasos

- Continuar el prólogo desde la **escena 13** (el planeta Tierra) aplicando §4; el mundo
  se vuelve gris **gradual** (manchitas primero, no todo gris de golpe) y luego zoom a los
  eventos. Escenas violentas adultas realistas; menores por símbolo.
- Marcar `Prologo.tscn` como escena principal y probar el prólogo completo cuando haya más
  estampas.
- Revisar **saldo de la API de Gemini** (se han hecho muchas generaciones).
- Commit+push del avance de arte cuando Fernando lo apruebe.
- Fase 1 del juego (ver §5).

## 10. Registro de aprendizajes/decisiones

- **2026-07-23 (Acto 3, escenas 18–31):** confirmadas las reglas 12–17 de §4. Claves nuevas:
  editar AÑADE pero no reposiciona (la pose de rodillas solo salió regenerando de cero);
  bocadillos cortos salen legibles; el filtro bloquea menores en cualquier contexto de daño
  (mafia 22 → solo símbolo del osito) pero permite un menor en contexto no dañino (hijo en
  disputa de custodia, 31); Fernando pide realismo social muy detallado (camaronera, barrio
  de tierra/caña, extorsión de exesposos en la puerta) y "nunca el camino fácil". Aprobó el
  nivel de detalle alcanzado en la 31 como el estándar a seguir.
- **2026-07-23 (Acto 3, escenas 13–17):** aprendizajes: (a) **scene 13 = globo** de la Tierra
  desde el espacio (SIN anillos/aros); **scene 14 = mapa mundial PLANO** (cartográfico) — son
  representaciones distintas, no confundir. (b) Para **añadir manchas grises** al mapa, EDITAR
  (referenciar el propio mapa) funciona; la primera versión salió casi invisible → hubo que
  pedirlas "pequeñas pero CLARAMENTE VISIBLES". (c) La **precisión geográfica** de países
  pequeños (Ecuador) es floja: hay que describir la posición explícita ("extremo noroeste,
  costa del Pacífico, línea ecuatorial") y aun así queda aproximada. (d) **Escenas de acción/
  urbanas:** referenciar una escena de acción ya aprobada (p. ej. `escena_16`) mantiene el
  estilo de personajes entre escenas crudas; las figuras de acción pueden ser un pelín más
  detalladas que las diminutas rurales, y a Fernando le pareció bien. (e) **Realismo social
  crudo** (violencia de pandillas con armas de fuego, víctima caída con sangre SOBRIA, guerra
  civil, dictador protegido) SÍ pasa los filtros si la sangre es sobria (sin gore extremo).
  (f) Fernando pide **autenticidad social**: barrios pobres de TIERRA, casas de CAÑA,
  pandilleros SIN CAMISA/ropa callejera, y que una balacera tenga víctimas reales.
- **2026-07-21/23:** definido lore, prólogo (66 estampas), arquitectura de escenas,
  pipeline de arte por IA. Corrección clave: el estilo salía tipo **Minecraft/voxel** →
  se forzó **pixel-art 2D dibujado a mano** (referencias Undertale/Sea of Stars); luego se
  adoptó **escena_53** como estilo maestro. Se derivaron las **reglas de consistencia**
  (§4). El Hoyo debe ser **agujero natural** (no alcantarilla) y el personaje una
  **silueta sin identidad** (es el jugador).
