# Videojuego GCC World — Documento de desarrollo (fuente de verdad viva)

> Este archivo es la **fuente de verdad del desarrollo del videojuego**. Lo mantiene la
> skill `/videojuegogcc`: al invocarla, se lee y analiza completo; cuando hay avances,
> correcciones o temas nuevos, se **actualiza** aquí (sin duplicar; corrigiendo lo viejo
> si algo cambió; fechas absolutas). Documentos hermanos: [HISTORIA.md](HISTORIA.md)
> (guion/lore + diseño del juego) y [GUION_VISUAL.md](GUION_VISUAL.md) (las 66 estampas
> del prólogo). Última actualización: **2026-07-26**.
>
> **★ HITO (2026-07-26): el PRÓLOGO ESTÁ COMPLETO — las 66 estampas generadas, afinadas y
> aprobadas por Fernando** (incluidas las correcciones finales de estilo/contenido de las
> escenas 20, 25, 26, 28, 53, 54, 55, 56 y la 66). Este documento + la skill `/videojuegogcc`
> contienen TODO el detalle (historia completa en §2, arquitectura §3, pipeline y reglas de
> arte §4, diseño/roadmap §5, cómo trabajar con Fernando §6, estado §8, aprendizajes §10);
> no hace falta otra skill para poner al día a un agente nuevo.

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

## 2. Historia y lore COMPLETOS (fuente de verdad narrativa; detalle también en HISTORIA.md / GUION_VISUAL.md)

**El Hoyo (lore central).** Hace mucho, los humanos antiguos adoraban un lugar llamado
**el Hoyo**: un **agujero natural en la tierra** (no un pozo ni alcantarilla). Cada cierto
tiempo lo visitaban y agradecían, creyendo que abajo **existía un ser que los protegía** en
los peores momentos. En esa época vivían en tranquilidad, había lo suficiente para todos.
Se volvió catastrófico cuando, tras años, **dejaron de interesarse por el Hoyo** y pasaron
a adorar **la tecnología, el dinero y el poder**. El mundo sufrió catástrofes en cadena:
un **gran terremoto**, luego **enfermedades/pandemias**, luego **guerras por los recursos**.
Mientras tanto el Hoyo se **deterioraba**, rodeado de una **sombra/raíces grises** de
corrupción; la gente pasaba sin entender que **cuanto más se alejaban del Hoyo y de sus
orígenes, peor iba el mundo**. Al final quedaban muy pocos humanos, sobreviviendo como podían.

**El prólogo = las 66 estampas** (estilo Undertale: imágenes + texto DEBAJO en Godot, no en
la imagen). Arco narrativo:
- **Acto 1 · Devoción (1–6):** una mujer lleva frutos de ofrenda al Hoyo y los lanza dentro;
  la comunidad reza arrodillada; los niños repiten el rito; cada vez menos personas rezan;
  al final solo una viejita hace el último gesto.
- **Acto 2 · Abandono y corrupción del Hoyo (7–12):** ya nadie reza; del Hoyo **brotan raíces
  grises** que lo rodean y ennegrecen; se ve la isla; el Hoyo queda muy rodeado de raíces y la
  naturaleza se pudre; el **mar inunda la isla** y el agua **drena hacia dentro del Hoyo**
  (remolino).
- **Acto 3 · Decadencia social — el mundo se vuelve gris (13–46):** 13 el **globo terráqueo**;
  14 el **mapa mundial plano** donde aparecen **zonas grises**; zoom a los eventos humanos:
  balacera entre bandas, guerra civil (militares vs civiles, dictador protegido), guerra entre
  países, **bomba nuclear**, **pandemia** (20: calle con cuerpos y personal hazmat
  **recogiendo cadáveres, SIN armas**; cartel "ALERTA URGENTE"), religión que se cree superior,
  narcos enseñando a un niño a coger un arma (símbolo), tirar basura ignorando a un mendigo,
  **líder de secta** incitando al suicidio, **25 el "padre"/cura** con intención predatoria
  (simbólico: flores marchitas + su sombra + una **niña asustada solo insinuada por su sombra**
  en un rincón), **26 body-shaming/ciberbullying** (mujer llorando con el móvil rodeada de
  comentarios "GORDA/FEA/ASCO"), señor mayor buscando trabajo entre colas de desempleados,
  **28 violencia doméstica** (padre a punto de golpear a la esposa acorralada; los **dos hijos
  como sombras juntas escondidas en una esquina**; silla volcada, plato roto), viejita pidiendo
  dinero, joven que acepta monedas por 16 h de fábrica, extorsión, **32** drogas en el colegio,
  **33** sicariato de un profesor (arma de fuego + huida en MOTO), **34** xenofobia en el
  estadio, **35** millonarios + niños secuestrados (símbolo), **36** cúpula secreta con mapamundi
  de alfileres, **37** adicto a videojuegos vs niños jugando afuera, **38** padre increpa al
  profesor, **39** coima bajo la ventanilla, **40** el barrio protege a un delincuente de la
  policía ("¡NO SE LO LLEVEN!"), **41** deforestación→desierto, **42** industrias contaminando,
  **43** IA bebiéndose el agua del mundo, **44** niño pidiendo agua ($30 el bidón), **45** calles
  de miseria, **46** desigualdad partida por un muro (zona rica vs favela).
- **Guerra y colapso gris (47–52):** 47 **guerra nuclear entre países** (misiles pequeños,
  estelas suaves); 48 el mundo impactado por explosiones nucleares; 49 **terremoto a nivel de
  calle** (edificios cayéndose, grieta pequeña, gente huyendo SIN armas); **50** el gris se
  expande intenso en el **mapa mundial** (~90% de tierra gris + grietas leves + MENOS agua, pero
  aún con agua azul oscura); **51** la **vista aérea del Hoyo**: la zona antes inundada ahora es
  **desierto árido** con las **raíces grises muy extendidas**, SIN agua (Fernando la **redefinió**
  aquí — ya NO es "gris casi total"); **52** el mundo **completamente cubierto de gris**
  (monocromo, tierra y océanos grises = la muerte del mundo).
- **Acto 4 · El sobreviviente y la caída (53–66):** una **FAMILIA de 5** —papá, mamá, el
  **hermano mayor (= el personaje del jugador, adolescente, silueta neutra sin sexo
  distinguible)**, y **dos hermanitos pequeños: una niña (con vestido) y un niño**— huye por
  calles en ruinas de una **horda de perseguidores** (adultos musculosos, feroces, algunos con
  **armas blancas de color blanco**; 53 = los 5 huyendo a la izquierda, perseguidores a la
  derecha; 54 = solo la horda persiguiendo). 55 la familia huye desesperada por el **desierto**
  hacia una loma; 56 **POV/over-the-shoulder** del hermano mayor (silueta negra sólida,
  andrógina) corriendo y mirando el Hoyo lejano. 57 llegan solos a una **casa en ruinas** a
  esconderse; 58 (interior) los **padres bloquean la puerta** contra los asesinos de afuera
  mientras los **niños se esconden en una caja** dentro sin que los malos se percaten; 59
  primer plano de una **mano abriendo la tapa de la caja** desde dentro; 60 los **3 hermanos
  ven a sus 2 padres muertos** afuera (implícito, sin gore); 61 los **3 corriendo cogidos de la
  mano** con visión borrosa por el llanto; 62 corren hacia la loma; 63 la **loma es un gran
  cráter** y dentro está el **Hoyo real** (agujero negro + red radial de raíces grises), los
  niños descienden y los perseguidores llegan lejos por el mismo lado; 64 **POV mirando sus
  pies y los de sus hermanos al borde** del Hoyo; 65 **se lanzan** (los 3 cayendo, vistos desde
  dentro del pozo contra la boca de luz); 66 (cierre) **los 3 hermanos cayendo dentro del Hoyo**
  en el interior oscuro de **tierra árida gris**, siluetas negras cogidas de la mano.

**Intro cinemática** (`Intro.tscn`): lluvia → descenso de cámara → zoom a la cueva (el Hoyo).
Puente entre el prólogo y el encuentro.

**Primera escena jugable — el Encuentro** (`Encuentro.gd`, en `Main.tscn`): tras caer sin
daño al fondo del Hoyo, el joven (con control ya, avanza por proximidad) se acerca a una
**niña demacrada, casi esquelética, amarrada a raíces** como si la tierra la consumiera.
Diálogos: *"¿Hay alguien ahí? ¿Hola?"* → *"Tengo miedo"* → *"¿QUIÉN ERES?"* (su grito hace
temblar el lugar; **aquí se registra el NOMBRE del personaje**). Ella dice que nadie debería
estar ahí, que *"esto es culpa de todos ustedes"*. Tiembla todo: una **piedra cae y se vuelve
una celda** que atrapa a un hermanito; **raíces** absorben a la otra hermanita. La niña
demacrada: *"Necesito vivir, y estos niños me ayudarán"*; se los lleva y rechaza al mayor
(*"Yo no necesito a gente como tú"*). Todo se apaga; el personaje **despierta en otro lugar**
y una **voz** dice: *"Valoro tu valentía de haberte lanzado hasta aquí. Pero mientras sigas
siendo igual que los demás, no voy a poder hacer nada para ayudarte."* → **aquí empieza la
Fase 1** del juego (creador de personaje → lobby de nieve → caminos).

**Regla de oro del protagonista:** el personaje del jugador (el hermano mayor) es SIEMPRE una
**silueta oscura imposible de identificar** — sin rostro, sin cuerpo definido, **sin sexo
distinguible** (andrógina), **sin capucha** (no encapuchado, solo oscurecido) — porque el
jugador diseña su propia apariencia al iniciar el juego (creador de personaje).

## 3. Arquitectura técnica (Godot)

**Flujo de escenas objetivo:** `Prologo.tscn` → `Intro.tscn` → `Main.tscn` (Encuentro) →
(creador de personaje) → lobby de nieve → caminos.

**Escena principal del proyecto:** `res://Prologo.tscn` (fijada el 2026-07-26; antes
`run/main_scene` apuntaba a `uid://b2sc1r1ep0bus`, un UID **fantasma** que ya no existía en
el proyecto, así que F5 no arrancaba).

**⭐ Estirado de pantalla (LAYOUT DE TAMAÑOS FIJOS) — decisión de Fernando (2026-07-26):**
`project.godot` usa **`window/stretch/mode="canvas_items"` + `aspect="keep"`** sobre el
lienzo base **960×540**. El motor escala el lienzo COMPLETO a la ventana (con barras negras
si no es 16:9), así que **imagen y letras conservan siempre el mismo tamaño y proporción**
en cualquier pantalla, ventana o navegador. Antes estaba en `mode` sin definir (=`disabled`)
+ `aspect="expand"`: el viewport crecía con la ventana y la fuente seguía midiendo 20 px
**físicos** → en pantallas grandes el texto se veía diminuto (la queja de Fernando).
Consecuencia para TODAS las escenas: la cámara de `Main.tscn`/`Intro.tscn` ve siempre
960×540 unidades de mundo (ya no "más mundo" en monitores anchos). **Regla: cualquier UI
nueva se mide en el lienzo de 960×540, nunca en píxeles de ventana.**

**Scripts y qué hace cada uno:**
- `Prologo.gd` / `Prologo.tscn` — reproductor de estampas del prólogo, **estilo Undertale**:
  la estampa va **centrada en una caja de TAMAÑO FIJO** (por defecto `caja_imagen` =
  672×384, la mitad exacta de los 1344×768 del arte) y la **narración se teclea DEBAJO**
  sobre negro, con **letra de tamaño fijo** (`tamano_letra` = 24, `Label` centrado, sin
  outline). **Auto-avance** con crossfade. `GUION` = 20 bloques de texto ↔ grupos de
  escenas: cubre **las 66 estampas exactamente una vez** (verificado; 0 duplicadas, 0
  faltantes) → ≈ **4 min 24 s** a 4 s/escena. Esc / botón "Saltar" van a `Intro.tscn`.
  Todo ajustable por Inspector (`@export`: tiempos + tamaños fijos).
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
- Filtro de textura **nearest** por defecto (pixel-art nítido). Viewport 960×540 (16:9).
  **Excepción:** las estampas del prólogo (ilustraciones de 1344×768 que se **reducen** a la
  caja de 672×384) usan `texture_filter = TEXTURE_FILTER_LINEAR` **por nodo** — con nearest
  la reducción sale con aliasing. El nearest global es para los **sprites** de pixel-art.
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
    la demanda; a veces pasa a la primera minutos después. **429 RESOURCE_EXHAUSTED** = se
    **acabaron los créditos de prepago** de Gemini → recargar en https://ai.studio/projects.
18. **⭐ Consistencia del DISEÑO de personajes (crítico para Fernando):** el estilo de dibujo
    de personas está fijado por la **escena_40** (pixel-art estilizado de videojuego:
    proporciones algo robustas, caras expresivas, sombreado plano). Cuando una escena sale
    con personajes **realistas/detallados/fotográficos**, hay que **regenerarla referenciando
    `escena_40`** y repetir "usa EXACTAMENTE el diseño de personajes de la escena_40, NO estilo
    realista". Así se corrigieron 26 y 28. NO cambiar el estilo de arte entre escenas.
19. **NO usar `escena_16` como referencia de estilo:** es un TIROTEO y **contamina metiendo
    ARMAS** en manos que no deben llevarlas (metió rifles a los hazmat de la 20 y armó a la 49).
    Para estilo neutro usar `escena_40` o una escena sin armas, y prohibir armas explícitamente.
20. **Violencia doméstica + menor = BLOQUEO seguro del filtro.** La 28 se bloqueó 5/5 tanto con
    figuras directas como con "sombra humana de un hombre golpeando a una mujer" si había un
    niño presente. **Lo que SÍ pasó:** violencia **adulto-a-adulto** (padre maltratando a la
    esposa, sobria, sin mostrar el golpe conectando) + el/los **menor(es) solo insinuados como
    SOMBRA** (encogidos, escondidos). Regla general reconfirmada: **menores en contexto de daño
    → solo símbolo/sombra, nunca renderizados**; el tema pasa si el daño explícito es entre
    adultos y el menor únicamente se sugiere.
21. **Cachear = un fallo de filtro NO reescribe el archivo:** si una regeneración se bloquea
    (429/filtro en los 5 reintentos), el `.png` queda con la **última versión que sí pasó**;
    parece que "no cambió". Verificar el log (`⚠️ falló`) o el md5 del archivo antes de asumir
    que el nuevo prompt salió.
22. **Órbita de correcciones típicas de Fernando (Acto 4):** cuenta y alturas exactas
    (papá≈mamá≈hermano mayor altos; niña y niño MUCHO más pequeños; el mayor **andrógino**);
    dirección de carrera consistente entre escenas seguidas; silueta del jugador **negra
    sólida y plana** (sin sombreado que revele forma); el Hoyo **NO frontal** (hueco en el
    suelo/loma), salvo la vista aérea de raíces (escena_51). Evitar mencionar **edades
    explícitas** de menores en el prompt (dispara el filtro): decir "muy pequeños/bajitos".

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

## 8. Estado actual (2026-07-26)

- ✅ Movimiento de Violeta, cámara, mapa TileMapLayer, joystick táctil.
- ✅ Intro cinemática, sistema de diálogos, escena del encuentro (esqueleto).
- ✅ Reproductor del prólogo (`Prologo.tscn`) con auto-avance + narración tecleada.
- ✅✅ **PRÓLOGO MONTADO EN GODOT (2026-07-26):** las 66 estampas ya se reproducen dentro del
  juego con el **layout estilo Undertale de tamaños fijos** que pidió Fernando (imagen
  centrada en caja fija + texto grande debajo, independientes del tamaño de ventana).
  `run/main_scene` = `res://Prologo.tscn`. Verificado ejecutando el juego a 1280×720 y
  capturando pantalla desde dentro de Godot.
- ✅ **Pipeline de arte por IA** afinado con las reglas de §4.
- ✅✅ **PRÓLOGO COMPLETO (2026-07-26): las 66 estampas generadas, afinadas y APROBADAS.**
  Se regeneró la **66** (tras recargar créditos de la API) y se hicieron las **correcciones
  finales** de estilo/contenido: **20** (hazmat SIN armas, recogiendo cadáveres), **25**
  (añadida la niña asustada como sombra junto al cura), **26** (body-shaming al diseño de
  personajes de la 40), **28** (violencia doméstica realista: padre→esposa + niños como sombra
  en una esquina, estilo 40), **53–56** (familia de 5 con alturas correctas, hermano mayor
  andrógino, perseguidores adultos musculosos con armas blancas blancas, POV del hermano mayor
  corriendo). **Pendientes menores de arte:** revisar la **42** (industrias contaminando —
  puede seguir la versión vieja Minecraft) por si se quiere rehacer.
- 🎨 **Historial del arte del prólogo (referencia):** anclas nuevas hechas. Escenas
  **regeneradas y aprobadas 1→66** (Acto 1 devoción 1–6; Acto 2 corrupción del Hoyo 7–12; Acto 3 decadencia social
  13–46; guerra/colapso 47–52; Acto 4 sobreviviente 53–65). **Falta SOLO la 66** (última del
  prólogo) — quedó pendiente porque el **2026-07-26 se AGOTARON los créditos de prepago de la
  API de Gemini** (error 429 RESOURCE_EXHAUSTED; recargar en https://ai.studio/projects y
  regenerar la 66; su prompt ya está listo en el script). Hitos 32–46 (ver registro §10 del
  2026-07-24).
  **Bloque 47–58 (2026-07-25):** 47 guerra nuclear entre países (misiles pequeños, estelas
  suaves); 48 mundo impactado por explosiones nucleares; 49 TERREMOTO a nivel de calle
  (edificios cayéndose, grieta pequeña, gente huyendo SIN armas); **arco del gris 50–52 =
  MAPA MUNDIAL**: 50 el gris se expande intenso (~90% tierra gris + grietas leves en 1-2
  continentes + MENOS agua/lechos secos pero AÚN con agua azul); **51 = REDEFINIDA** por
  Fernando: ya NO es "gris casi total", sino **vista aérea del Hoyo** (como escena_10) con la
  zona antes inundada ahora **desértica/árida** y las **raíces grises más extendidas**, SIN
  agua; 52 el mundo **completamente gris/monocromo** (tierra y océanos grises). 53 (=ancla
  estilo, ya aprobada) siluetas huyendo de perseguidores en calles en ruinas; 54 los
  perseguidores = **caníbales DESNUDOS con armas blancas** (siluetas granate); 55 la familia
  (5 siluetas: 2 padres altos + 2 hermanitos + hermano mayor) huye por el desierto, el mayor
  mira la loma/Hoyo al fondo; 56 **zoom/plano cerrado del hermano mayor corriendo** y mirando
  el Hoyo lejano con raíces rastreras (poco); 57 la familia llega SOLA a una **casa en
  ruinas** a esconderse; 58 (vista INTERIOR) los **padres bloquean la puerta** encarando a los
  asesinos (afuera, idénticos a la 54) mientras los **niños se esconden en una caja DENTRO** de
  la casa sin que los malos se percaten; 59 primer plano de una **mano abriendo la tapa de la
  caja** desde dentro; 60 (misma zona que 58, después) los **3 hermanos ven a sus 2 padres
  muertos** afuera (implícito, sin gore; los 2 hermanitos detrás del mayor, caja vacía,
  asesinos idos); 61 los **3 hermanos corriendo cogidos de la mano** (de espaldas, mayor
  ADOLESCENTE + 2 pequeños) con desenfoque de llanto; 62 corren hacia la loma (Hoyo como hueco
  en lo alto, NO portal frontal); 63 la **loma es un gran CRÁTER** y dentro está el Hoyo real
  (raíces radiales estilo escena_51, gris), niños descendiendo, perseguidores lejos por el
  mismo lado; 64 **POV de los pies+piernas al borde** (personaje al centro, hermana con vestido
  y hermano niño a los lados) — terminó como plano por detrás DE PIE al borde; 65 los 3 caen al
  Hoyo vistos **desde dentro mirando arriba**, en silueta contra la boca iluminada; **66** los
  3 hermanos cayendo dentro del Hoyo en el **interior oscuro de tierra árida gris**, siluetas
  negras cogidas de la mano. **Correcciones 2026-07-26:** 53 pasó a familia de 5 con alturas
  correctas + perseguidores adultos musculosos; 54 pasó a "solo la horda persiguiendo, a la
  izquierda, algunos con armas blancas blancas"; 55/56 alturas + Hoyo como montículo (no
  frontal) + POV over-the-shoulder del hermano mayor **andrógino** (silueta negra sólida)
  corriendo; y las correcciones de estilo de 20/25/26/28.
- 📖 **Narración original localizada (2026-07-25):** la historia completa que dictó Fernando
  (lore + lista de las 66 escenas) está en el transcript de la sesión origen del juego
  (`~/.claude/projects/…-GCC-WORLD-godot/0d2c50a7-….jsonl`, mensajes largos del usuario) y
  resumida en `HISTORIA.md` + `GUION_VISUAL.md`. La escena **52 = "el mundo completamente
  cubierto de gris"** (no hay detalle extra oculto; la coletilla "solo el Hoyo/una lágrima
  conservan tinte" era nota interpretativa del guion, no dictado de Fernando).
- ⏳ Fase 1 del juego (creador, lobby de nieve, caminos, tutoriales) pendiente.

## 9. Pendientes / próximos pasos

- **Prólogo COMPLETO** ✅ (66/66). Opcional: revisar la **42** (industrias contaminando) por si
  se quiere rehacer al estilo actual.
- **Integrar el prólogo en Godot** ✅ (2026-07-26): 66 estampas reproduciéndose, layout de
  tamaños fijos, `Prologo.tscn` como escena principal. **Falta afinar con Fernando:**
  (a) el **texto de los 20 bloques** del `GUION` (¿le gusta como está?);
  (b) el **ritmo** (4 s/escena → ≈4 min 24 s en total);
  (c) si quiere poder **avanzar a mano** (Espacio/toque) además del automático;
  (d) **música/ambiente** (hoy el prólogo es MUDO — falta el archivo de audio);
  (e) probar el flujo completo `Prologo → Intro → Encuentro` (la `Intro.tscn` necesita que
  Fernando arrastre su imagen de fondo al nodo `Fondo`, hoy está vacío).
- **Fase 1 del juego** (ver §5): creador de personaje → lobby de nieve → primer camino
  "perfil cero" (guía plataforma+juego) → tutoriales de controles → caminos con condiciones +
  economía. Fernando aprende Godot guiado en paralelo.

## 10. Registro de aprendizajes/decisiones

- **2026-07-26 (montaje del prólogo en Godot — TAMAÑOS FIJOS):** Fernando pidió el prólogo
  **como el de Undertale**: imagen **centrada en un tamaño fijo** y letras **grandes y de
  tamaño fijo debajo**, porque "actualmente el tamaño de las letras depende del tamaño de la
  pantalla y eso no se ve bien". Aprendizajes:
  (a) **La causa NO era el layout, era el `stretch mode` del proyecto.** Con `mode=disabled`
  + `aspect="expand"` el viewport crece con la ventana: la imagen se estiraba a pantalla
  completa pero la fuente seguía midiendo 20 px **físicos** → texto diminuto en pantallas
  grandes. **Solución: `mode="canvas_items"` + `aspect="keep"`** → el lienzo 960×540 se
  escala completo. **Regla nueva: toda UI se mide sobre el lienzo de 960×540.**
  (b) **`Label` > `RichTextLabel`** para narración centrada: `Label` también tiene
  `visible_characters` / `get_total_character_count()` (o sea, el efecto máquina de escribir
  funciona igual) y **sí tiene `horizontal_alignment`** — con `RichTextLabel` habría que
  meter bbcode `[center]`. Menos código y centrado real.
  (c) **Filtro de textura por nodo:** las estampas se **reducen** de 1344×768 a 672×384; con
  el `nearest` global del proyecto la reducción hace aliasing → `TEXTURE_FILTER_LINEAR` en
  los `TextureRect` del prólogo (el nearest se queda para los sprites).
  (d) Al no estar el texto ya encima de la imagen, se **quitó el degradado inferior y el
  outline** de la fuente (sobre negro no aportan nada).
  (e) **`run/main_scene` apuntaba a un UID fantasma** (`uid://b2sc1r1ep0bus`, de un `Main.tscn`
  viejo) → el proyecto no arrancaba con F5. Ahora es `res://Prologo.tscn`.
  (f) **Cómo verifico el arte/UI del juego sin depender de Fernando:** `screencapture` de
  macOS está **bloqueado por permisos** (“could not create image from display”), pero sí
  funciona montar un nodo temporal que corra la escena y guarde
  `get_viewport().get_texture().get_image().save_png(...)` tras `await
  RenderingServer.frame_post_draw` (con ventana, NO `--headless`). Truco reutilizable.
- **2026-07-26 (cierre del prólogo + correcciones de estilo/contenido):** (a) **66 completada**
  tras recargar créditos (era un 429, no un problema de prompt). (b) **Consistencia de DISEÑO de
  personajes** = la queja más fuerte de Fernando: la 26 y la 28 salían **realistas** y hubo que
  regenerarlas referenciando **escena_40** ("usa EXACTAMENTE el diseño de personajes de la 40,
  NO realista"). Regla §4.18. (c) **escena_16 contamina con ARMAS** (metió rifles a los hazmat de
  la 20) → no usarla de estilo; usar escena_40 y prohibir armas. Regla §4.19. (d) **Violencia
  doméstica + menor = bloqueo total del filtro** (5/5, incluso con sombra humana); solución:
  violencia **adulto-a-adulto** sobria + menor **solo como sombra**. Regla §4.20. (e) Un fallo de
  filtro **no reescribe el .png** (queda la última que pasó) → verificar log/md5. Regla §4.21.
  (f) Correcciones repetidas del Acto 4: alturas exactas (papá≈mamá≈mayor altos; niña/niño mucho
  más pequeños), hermano mayor **andrógino** y **silueta negra sólida y plana**, dirección de
  carrera consistente, Hoyo **no frontal** (montículo con hueco arriba + raíces radiales, estilo
  escena_51/56), y **no mencionar edades** de menores en el prompt (dispara el filtro). Reglas
  §4.22.
- **2026-07-26 (bloque 59–65, la caída al Hoyo):** aprendizajes: (a) **POV difícil:** las
  tomas en primera persona (pies/piernas al borde, manos en primer plano) tienden a salir mal
  (manos gigantes tipo garra, pies planos cortados, o el modelo revierte a plano de espaldas);
  ayuda pedir "piernas+pies en ESCORZO", "cuerpos fuera de cuadro" y aclarar "DE PIE (piernas
  verticales muy escorzadas), NO acostados (piernas estiradas)". (b) **El SALTO/CAÍDA al vacío
  es de lo más difícil:** al referenciar una escena con ellos de pie, el modelo los deja
  PARADOS una y otra vez; la solución que SÍ funcionó fue cambiar de encuadre a **"desde DENTRO
  del pozo mirando hacia ARRIBA"**, con los 3 en SILUETA cayendo contra la boca iluminada — sin
  suelo donde pararse. (c) Para diferenciar **niña vs niño** basta pedir **vestidito/falda +
  zapatitos** en una y pantalón/tenis en el otro. (d) El **hermano mayor = personaje principal**
  es ADOLESCENTE (no adulto), y los otros dos son **1 hermana + 1 hermano** pequeños. (e)
  Reforzada la geometría del Hoyo: la loma-cráter contiene dentro el Hoyo de raíces (escena_51);
  el Hoyo "normal" es un hueco en el suelo (no un portal de frente).
- **2026-07-25 (bloque 47–58, guerra/colapso + Acto 4):** aprendizajes clave:
  (a) **Arco del gris en MAPA (50–52):** el modo EDITAR "conserva colores" y PELEA contra
  agrisar (revierte al verde); para llevar un mapa a gris hay que **regenerar desde el mapa
  limpio (escena_14)** con instrucción fuerte ("90% gris, repinta el verde/tostado"), y luego
  EDITAR solo para AÑADIR (grietas, oscurecer océanos). "Menos agua pero AÚN con agua": pedir
  lechos secos expuestos PERO agua restante en AZUL OSCURO reconocible (si no, se vuelve todo
  gris turbio ilegible). (b) **Contaminación de referencias:** referenciar una escena arrastra
  su contenido — escena_16 (tiroteo) metió ARMAS/gente armada en la 49; escena_54 metió
  figuras ROJAS (perseguidores) en la 57. Solución: referenciar una escena SIN ese elemento y
  prohibirlo explícito ("NADA de figuras rojas / sin armas"). (c) **Consistencia de villanos:**
  lo más difícil; en planos cerrados salen GRANDES/musculosos/detallados y dejan de parecer los
  de antes → forzar "siluetas planas, PEQUEÑAS y simples, IDÉNTICAS a escena_54, mismo color
  granate". (d) **Capucha fantasma:** una silueta de espaldas tiende a salir ENCAPUCHADA →
  repetir "SIN capucha, SIN capa, cabeza descubierta, persona normal oscurecida". (e) **Raíces:**
  deben ir **RASTRERAS, pegadas al suelo** como venas; si dices solo "raíces" salen ramas/árbol
  seco VOLANDO en el aire → especificar "pegadas al suelo, NO ramas, NO árbol". (f) **El
  personaje = el jugador:** va en la MISMA escala de siluetas que la familia (2 padres altos +
  2 hermanitos + hermano mayor un poco más grande), NO gigante en primer plano (salvo un ZOOM
  explícito). (g) **La IA resiste "correr y mirar atrás":** pose cuerpo-hacia-un-lado +
  cabeza-al-otro es difícil, a veces no la logra. (h) Fernando aporta ideas y también las
  DESCARTA (recuadro/viñeta, halo) — dio libertad creativa pero pide **mucho detalle y no
  atajos**; y cuida la **continuidad de dirección** (huir siempre hacia el mismo lado entre
  escenas seguidas). (i) **Escena 51 redefinida** por él sobre la marcha (Hoyo aéreo desértico
  en vez de "gris casi total"): el guion se ajusta a lo que pide en el momento.
- **2026-07-24 (Acto 3, escenas 32–46):** aprendizajes: (a) **BOCADILLOS de diálogo** funcionan
  muy bien para conflictos ("¡NO LE GRITE A MI HIJO!", "¡NO SE LO LLEVEN!") — a veces hay typos
  pero legibles. (b) Para intercambios OCULTOS ("por debajo de la mesa") hay que **acercar el
  plano** para que se vean las manos/objetos. (c) **REALISMO exige exactitud del hecho**: el
  sicariato es arma de FUEGO + huida en MOTO (no machete); los eventos van en su lugar REAL
  (la xenofobia fue en el PASILLO de acceso del estadio, no en las gradas); las multitudes
  deben ser DENSAS y NATURALES (cada quien a su bola), no una cuadrícula vacía; las EXPRESIONES
  importan (vecinos asustados, tirador serio, conductor sonriendo). (d) Referenciar una escena
  de estilo NEUTRO (escena_16) y DESCRIBIR el escenario nuevo evita que se copie el lugar de la
  referencia. (e) Composiciones de CONTRASTE/split funcionan genial (muro rico vs favela,
  bosque→desierto, cuarto oscuro del gamer vs ventana soleada). (f) Menores en contexto NO
  dañino pasan (niños jugando afuera, hijo tras el padre, niño víctima al fondo); en contexto
  de daño, bloqueados (mafia 22 y secuestro 35 → solo símbolo). (g) Fernando corrige con
  exigencia y aprecia máximo detalle realista — el estándar es alto.
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
