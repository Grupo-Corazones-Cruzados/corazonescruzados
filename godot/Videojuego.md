# Videojuego GCC World — Documento de desarrollo (fuente de verdad viva)

> Este archivo es la **fuente de verdad del desarrollo del videojuego**. Lo mantiene la
> skill `/videojuegogcc`: al invocarla, se lee y analiza completo; cuando hay avances,
> correcciones o temas nuevos, se **actualiza** aquí (sin duplicar; corrigiendo lo viejo
> si algo cambió; fechas absolutas). Documentos hermanos: [HISTORIA.md](HISTORIA.md)
> (guion/lore + diseño del juego) y [GUION_VISUAL.md](GUION_VISUAL.md) (las 66 estampas
> del prólogo). Última actualización: **2026-07-28**.
>
> **★ HITO (2026-07-26): el PRÓLOGO ESTÁ COMPLETO — las 66 estampas generadas, afinadas y
> aprobadas por Fernando** (incluidas las correcciones finales de estilo/contenido de las
> escenas 20, 25, 26, 28, 53, 54, 55, 56 y la 66). Este documento + la skill `/videojuegogcc`
> contienen TODO el detalle (historia completa en §2, arquitectura §3, pipeline y reglas de
> arte §4, diseño/roadmap §5, cómo trabajar con Fernando §6, estado §8, aprendizajes §10);
> no hace falta otra skill para poner al día a un agente nuevo.
>
> **★ HITO (2026-07-28): PUBLICADO EN PRODUCCIÓN el prólogo de 83 estampas + el personaje
> articulado.** Desde el 26-jul el juego creció en tres frentes: 17 estampas nuevas (67–83) con
> el **Acto 4 reescrito**, el **creador de personaje propio** (piezas generadas con IA en el
> estilo del prólogo, sustituye a LPC) y el **personaje articulado tipo marioneta** en Godot
> (camino Guardian Tales: esqueleto + anclajes). Ver §8 y §10.

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
  672×384, la mitad exacta de los 1344×768 del arte) y el **texto se teclea DEBAJO** sobre
  negro, con **letra de tamaño fijo** (`tamano_letra` = 24, `Label` centrado, sin outline).
  **★ LA CANCIÓN MANDA EL TIEMPO (decisión de Fernando, 2026-07-26):** el texto que se
  muestra ES **la letra de la canción** y aparece verso a verso en el segundo exacto en que
  se canta. Nada va por temporizador: todo se compara contra la **posición de reproducción**
  de la música (los temporizadores se desfasan; la posición de la canción no).
  - `LETRAS` = 16 versos, cada uno con su `"t"` (segundo en que se canta). Un verso con
    texto `""` limpia la pantalla (para tramos instrumentales).
  - `TRAMOS` = las estampas, con **su propio ritmo por acto** (`"seg"` = segundos por
    estampa). Reloj independiente del de la letra, porque hay 66 imágenes y la letra no las
    reparte parejo. **Fernando dictará el orden y el reparto definitivos.**
  - **Música:** `Pixel Heart Quest - AI Music (8).mp3` (2:15, **sin bucle**: el prólogo dura
    lo que dura la canción), entra con fundido de 3 s a −6 dB.
  - Al terminar (o al pulsar Esc / "Saltar"), **funde a negro y baja la música a la vez**
    antes de cambiar a `Intro.tscn`.
  - **`calibrar_letras` (modo calibración):** suena la canción, sale el verso que toca y
    Fernando pulsa **ESPACIO** cuando empieza a cantarse; BORRAR deshace, ESC termina antes.
    Al acabar imprime el bloque `LETRAS` listo para pegar y lo guarda en
    `user://letras_calibradas.txt`. **Es la única forma fiable de clavar los tiempos**
    (yo no puedo oír la canción).
  - Todo ajustable por Inspector (`@export`: ritmo, música, tamaños fijos).
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
- `PersonajeArticulado.gd` / `PruebaPersonaje.tscn` (2026-07-28) — **el personaje del jugador
  montado como marioneta**: lee `assets/piezas-mujer.json` + `piezas-mujer.png` (piezas sueltas
  con su pivote) y arma el muñeco solo — **el torso es la raíz y todo lo demás cuelga de él**.
  `PruebaPersonaje.tscn` es el **banco de pruebas**: se abre y con **F6** el personaje camina y
  gira entre vistas, sin levantar la web. **Regla de los pivotes:** lo que **cuelga** (brazos,
  piernas, faldón) gira por su borde **superior**; lo que se **apoya** (cabeza sobre el cuello,
  torso sobre la cadera) por el **inferior**. **Límite medido: rotar pixel-art aguanta ~16°**;
  más allá se ve el escalonado del borde.
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
22. **⭐ ESTAMPAS NUEVAS = numerar a partir de 67, NUNCA renumerar:** las 66 originales están
    aprobadas y con su `.import` e historial de git; insertar una escena renumerando rompería
    todo. Regla: la estampa nueva se guarda como `escena_67`, `escena_68`… y el **ORDEN REAL
    en que se ve lo manda `TRAMOS` en `Prologo.gd`**, no el número de archivo. En el generador,
    el diccionario **`INSERTADAS = {67: 3, 68: 3}`** anota detrás de qué escena va cada nueva
    para que **herede el TONO de color de ese punto del arco** (sin eso, la 67 habría salido
    gris de Acto 4 en vez de cálida de Acto 1).
23. **`--force` NO debe tocar las anclas** (bug corregido el 2026-07-26): `generar_estampas.py`
    pasaba el flag a `asegurar_anclas()`, así que `python … 68 --force` **regeneró las 5 anclas
    aprobadas**. Se restauraron con `git checkout` (por eso conviene que el arte esté siempre
    commiteado antes de regenerar). Ahora las anclas solo se rehacen con `--anchors --force`.
24. **"Gente que se va" no sale sola:** pedir "caminando alejándose" produjo figuras **de pie,
    de frente y quietas**. Lo que SÍ funciona es describir la MECÁNICA del paso y prohibir lo
    contrario: "una pierna adelantada y otra atrasada en zancada, vistos de espaldas/tres
    cuartos, PROHIBIDO figuras quietas, de frente, corrillos, sentadas". Y para la dirección,
    decir el LADO del encuadre ("salen por la IZQUIERDA, la mitad derecha queda vacía"), no
    "hacia el fondo".
25. **⭐ GUARDAR LAS VERSIONES DESCARTADAS: sirven de referencia visual.** Fernando pidió que
    las casas de la 69 se vieran "como en aquella escena en la que las pusiste y no tocaba" —
    es decir, como en una versión de la 68 que él mismo había rechazado. Como esa versión se
    había guardado antes de sobrescribirla, se **recortó la franja del horizonte** y se guardó
    en **`assets/Prologo/referencias/`** para pasarla como imagen de referencia al generador.
    Resultado inmediato y exacto. Regla doble: (a) antes de regenerar una escena, **copiar la
    versión actual** a un lado; (b) **una imagen de referencia gana a cualquier descripción**
    — para clavar un look concreto, recortar el trozo que lo tiene y adjuntarlo, en vez de
    describirlo con palabras.
    **Y también sirve para las POSES:** la 68 no acababa de leerse como "se están yendo"
    (figuras quietas, alguna mirando atrás) por muchas vueltas que se le diera al texto; se
    resolvió recortando de la **69** la zona donde la gente SÍ camina bien y pasándola como
    segunda referencia ("copia EXACTAMENTE estas posturas"). Al hacerlo hay que añadir la
    contrapartida: **"de esta referencia copia SOLO las posturas, NO su escenario"** y
    prohibir lo que arrastraría (allí: el camino de tierra, las casas y la arboleda).
    Recortes guardados en `assets/Prologo/referencias/`: `casas_horizonte.png` (poblado lejano
    en silueta) y `caminando_izquierda.png` (posturas de caminar de noche).
27. **⭐ EL TEXTO DENTRO DE UNA ESTAMPA NO SE PUEDE ARREGLAR DESPUÉS.** En la 78 el cartel
    salió como "PUEBLO VIGLEETA" en vez de "PUEBLO VIOLETA", y NADA lo corrigió: (a) pedir la
    corrección editando la imagen completa **se llevó también el humo y el cartel entero**
    (confirma la regla 5: editar para QUITAR arrastra lo que no debe); (b) mandar solo un
    **recorte ampliado del cartel** con el cambio pedido devolvió la imagen **idéntica**: el
    modelo no reescribe texto pequeño; (c) repintarlo por código con la fuente Silkscreen sale
    legible, pero **no hay madera limpia de donde clonar** (las letras ocupan toda la tabla),
    así que la reparación deja parches planos o restos de las letras viejas.
    **Regla: el texto hay que acertarlo EN LA GENERACIÓN.** Si hace falta que salga bien,
    pedirlo en **letras GRANDES** (cartel grande, o el texto en DOS LÍNEAS) y regenerar hasta
    que salga; los textos cortos y grandes sí salen (regla 13). Y avisar a Fernando de que
    cambiar el texto después implica regenerar la escena entera.
28. **Borrar un objeto pequeño sobre un cielo degradado SÍ se puede por código:** para quitar
    la chimenea del horizonte, promediar los lados deja una **banda visible** (el cielo tiene
    tramado). Lo que funciona es **copiar la textura real** de un tramo de cielo desplazado un
    **múltiplo del periodo del tramado (2 px)**, eligiendo para cada fila el lado (izquierda o
    derecha) cuya media se parece más a la de los píxeles vecinos. Queda invisible.
29. **Truco de guion para que algo NO se vea:** si el modelo insiste en dibujar un elemento
    prohibido (la fábrica en el horizonte), no basta prohibirlo — hay que hacerlo
    **geométricamente imposible**: "el humo NACE DETRÁS de una colina, su origen queda oculto
    tras el relieve".
26. **El escenario NO admite elementos nuevos sin permiso:** al decir "se van a sus casas", el
    modelo **inventó casas en el horizonte**; Fernando lo rechazó ("en la zona del Hoyo no hay
    casas ni nada nuevo"). Regla: prohibir explícitamente **construcciones, luces, caminos,
    vallas y carteles**, "ni siquiera pequeños o lejanos", y repetir que el horizonte queda
    LIMPIO igual que en la referencia.
31. **⭐⭐ LA REGLA MADRE DEL PIPELINE: la REFERENCIA VISUAL manda sobre cualquier descripción.**
    Todo lo que el modelo NO obedece por texto se consigue **encadenando una imagen que ya lo
    tenga bien** y diciéndole que lo conserve. Casos de la sesión del 2026-07-27: la posición y
    el tamaño del Hoyo en la 6 (imposible con "centrado", "en el eje vertical", "un tercio del
    ancho"; resuelto al encadenar la 5); las casas del horizonte de la 69 (recorte de una
    versión descartada); las posturas de caminar de la 68 (recorte de la 69). **Antes de pelear
    con palabras, buscar qué imagen ya resuelve eso y encadenarla.** Al hacerlo hay que decir
    siempre **qué copiar y qué NO** ("copia solo las posturas, NO su escenario"), porque la
    referencia arrastra todo lo demás.
32. **El modelo NO CUENTA figuras.** Pedir "exactamente 6 personas", "solo 5 ancianos" o "dos
    padres" falla aunque se enumeren una a una con su posición ("(1) detrás izquierda, (2)
    detrás derecha…"). Salieron 14 en vez de 6 (escena 4), 8-9 en vez de 5 (escena 5) y 1 en
    vez de 2 (escena 58). Lo que SÍ funciona es acotar por **composición** ("muy separadas, con
    huecos grandes de hierba entre una y otra", "un anillo amplio y ralo"). Si la cantidad
    exacta importa, **elegir entre generaciones** en vez de insistir.
33. **Las PROPORCIONES se piden COMPARANDO, nunca con edades ni medidas.** "Niña de 6 años" no
    sirve y además dispara el filtro (regla §4.22). Lo que acierta a la primera: "casi de la
    misma estatura que su hermano", "le llegan al mayor POR EL PECHO, dos tercios de su
    altura", "cabeza pequeña respecto al cuerpo, más o menos una sexta parte de su altura",
    "PROHIBIDO que parezca un bebé, con cabeza enorme y cuerpo rechoncho". Igual para objetos:
    "una casa mide tres o cuatro veces la altura de una persona" arregló la 69, y "la niña
    sentada ocupa casi todo el alto del hueco" arregló la ventana de la 81.
33-bis. **Si la comparación no basta, dar una PRUEBA VISUAL VERIFICABLE.** En la 53 el hermano
    mayor salía casi tan alto como los padres; ni "adolescente" ni "cuatro quintos de su altura"
    lo corrigieron. Lo que funcionó: *"si trazas una línea horizontal por encima de la cabeza de
    un padre, la cabeza del hermano queda por debajo, con un hueco visible del grosor de media
    cabeza; si quedan a la misma altura, está MAL"*. Convertir la proporción en algo que el
    modelo pueda **comprobar en la imagen** es el escalón siguiente a la regla 33.
33-ter. **⚠ "EDITA esta imagen CONSERVANDO todo" BLOQUEA cualquier cambio de las figuras.**
    La 53 llevaba tres intentos sin que cambiaran las alturas: medido, las tres cabezas seguían
    en y=349/349/353. La causa no era la instrucción, era que **el prompt usaba la propia
    escena_53 como referencia con la orden de conservarlo todo**. Para cambiar anatomía,
    proporciones o poses hay que **generar de cero, sin usar la escena como referencia de sí
    misma**, asumiendo que se rehace la composición (costó 4 tiradas recuperar perseguidores,
    tallas, dirección y armas). Y las tallas se acertaron dándolas como **porcentajes con
    recuento**: "adulto 100 % (dos figuras), adolescente 80 % (una), niños 50 % (dos);
    comprueba que haya dos grandes, una intermedia y dos pequeñas".
34. **Cada tirada arregla lo pedido y SUELTA lo que ya estaba bien.** Es el comportamiento más
    costoso del pipeline: la 81 llevó **9 generaciones** porque al pedir el gesto se perdía la
    silueta, al pedir la silueta se perdían las poses, y así. Dos consecuencias prácticas:
    (a) **una corrección por tirada** y **repetir en cada prompt las reglas ya conseguidas**
    (sobre todo la de la silueta, que se perdía siempre); (b) **guardar SIEMPRE la versión
    anterior** antes de regenerar (ver regla 25), porque a veces hay que volver.
34-bis. **⭐ NO REESCRIBIR EL PROMPT: AÑADIR SOBRE EL QUE YA FUNCIONA.** Aviso de Fernando
    (2026-07-27): *"estás quitando y sacando detalles que ya funcionan"*. Al corregir la 53 se
    reescribían bloques enteros y cada tirada perdía algo ya conseguido (la dirección de la
    huida, el caos, la variedad de las figuras). Lo que lo resolvió: **recuperar con `git show`
    el prompt exacto de la versión buena** y añadirle SOLO un párrafo con lo que faltaba, sin
    tocar una línea más. Regla operativa: versionar los prompts que funcionan (van en git con
    su imagen) y corregir por ADICIÓN, nunca por reescritura.
35. **Quitar un elemento por prompt casi nunca funciona.** Pedir "cierra la caja" borró la caja
    entera (escena 80, 3 intentos, incluso planteándolo como añadido y con la caja de
    referencia); pedir "sin niños" los dejó igual (58); pedir "quita la chimenea" no la quitó
    (78). Si el elemento estorba, **regenerar desde una imagen que no lo tenga**; si falta,
    **encadenar la que sí lo tiene**.
36. **⭐ EL FILTRO Y LOS MENORES — cómo desbloquearlo:** la 58 se bloqueó **5/5 dos veces
    seguidas** al juntar en un mismo cuadro a los niños escapando y a los perseguidores
    armados; suavizar la acción NO bastó. **La solución fue PARTIR LA ESCENA EN DOS estampas:**
    una con los padres y la amenaza (sin niños) y otra con los niños (sin amenaza). Ambas
    pasaron a la primera. Además: el **contacto físico** con un menor ("agarrarlo por debajo de
    los brazos", "izarlo") dispara el filtro, pero **darle la mano** pasa sin problema.
36-bis. **⭐ SI EL FILTRO BLOQUEA, REESCRIBIR EN CLAVE DE FORMAS Y MOVIMIENTO.** Idea de
    Fernando (2026-07-27) y funciona: se obtiene la MISMA imagen describiéndola como geometría
    en vez de como amenaza. En la 53, detallar tres armas distintas la bloqueó 5/5; al cambiar
    "machete en alto / cuchillo apuntando / hoja curva" por **"una pieza BLANCA recta levantada
    sobre el hombro / una pieza blanca corta al frente / una pieza blanca curva a la cintura"**,
    y "perseguidores feroces que quieren matarlos" por **"tres figuras granate que corren en la
    misma dirección, por detrás y a distancia"**, pasó sin un solo reintento. Regla: describir
    **qué se ve** (color, forma, postura, dirección), nunca **qué significa**.
36-ter. **⭐ COMBINAR DOS ESTAMPAS APROBADAS: hacerlo por CÓDIGO, no por IA.** La 82 (padres
    en la puerta + hijos saliendo por la ventana) se intentó SIETE veces por generación y en
    todas el adolescente salía tan alto como los adultos: están en extremos opuestos del cuarto
    y el modelo no tiene con qué compararlos. Solución, a propuesta de Fernando: **trasplantar
    por código** la zona de la ventana de la 81 sobre la habitación de la 58. Como las dos
    estampas comparten cuarto, luz y encuadre (sus ventanas caían en x≈1060-1160 en ambas), un
    pegado rectangular con la máscara difuminada ~22 px deja la costura invisible. **Regla: si
    dos mitades ya están aprobadas por separado, componerlas es más fiable que pedirle a la IA
    que las rehaga**, porque regenerar siempre reabre lo que ya estaba bien.
37. **El plano subjetivo (POV) achica todo lo demás y conviene evitarlo.** En la 81, los
    antebrazos en primer plano hacían que los niños parecieran duendes, y hubo que describir la
    anatomía del escorzo ("antebrazos ANCHOS y CORTOS entrando por las esquinas inferiores, no
    palos finos cruzando la pantalla"). **Fernando propuso quitar el POV y fue lo que resolvió
    las proporciones de golpe.** Regla: si un POV da problemas de escala, pasar a plano normal.
38. **Fernando quiere REGENERAR, no editar por código.** Lo dijo expresamente el 2026-07-27:
    *"yo no quiero que edites; cuando quiera que edites te lo pido"*. Los retoques por código
    (mover el Hoyo, repintar el cartel) los rechaza aunque sean más exactos. **Regenerar por
    defecto; editar solo si él lo pide.** (Sí aceptó ediciones puntuales de color/limpieza,
    como borrar la chimenea del cielo o quitar el violeta de la 75.)
39. **⚠ Distinguir un FALLO de generación de un resultado malo:** si los reintentos se agotan
    (503 de saturación o bloqueo del filtro), el `.png` **conserva la versión anterior** y
    parece que "no cambió nada". Pasó con la 4, cuya corrección nunca llegó a probarse.
    **Comprobar SIEMPRE el md5 antes de juzgar el resultado** (regla §4.21).
30. **Órbita de correcciones típicas de Fernando (Acto 4):** cuenta y alturas exactas
    (papá≈mamá≈hermano mayor altos; niña y niño MUCHO más pequeños; el mayor **andrógino**);
    dirección de carrera consistente entre escenas seguidas; silueta del jugador **negra
    sólida y plana** (sin sombreado que revele forma); el Hoyo **NO frontal** (hueco en el
    suelo/loma), salvo la vista aérea de raíces (escena_51). Evitar mencionar **edades
    explícitas** de menores en el prompt (dispara el filtro): decir "muy pequeños/bajitos".

## 4-bis. PUBLICAR EL JUEGO A PRODUCCIÓN (un solo comando)

```bash
npm run juego:publicar                 # mensaje de commit automático
npm run juego:publicar "mi mensaje"    # mensaje propio
```

`scripts/publicar-juego.sh` hace, en orden: **reimporta** Godot → **exporta a web**
(`public/game/`) → `git add -A` + commit + `pull --rebase` + **push a `main`**. Railway
auto-despliega en cada push. Si no hay cambios, sale limpio sin crear un commit vacío.

**⚠ ANTES de publicar, comprobar SIEMPRE dos cosas** (aprendido el 2026-07-28):

1. **Las estampas nuevas nacen SIN comprimir** (`compress/mode=0` en su `.png.import`) y son
   PNG de ~1,7 MB cada una → el `.pck` se dispara. Hay que ponerlas en **WebP con pérdida**:
   ```bash
   sed -i '' 's|^compress/mode=0$|compress/mode=1|; s|^compress/lossy_quality=0.7$|compress/lossy_quality=0.85|' \
     godot/assets/Prologo/escenas/escena_*.png.import
   ```
   Medido el 2026-07-28: 15 estampas nuevas pesaban **26 MB** en crudo y el `.pck` quedó en
   **14,9 MB** al comprimirlas (sin comprimir habría rondado los 40 MB). **No se tocan los PNG
   originales**, solo su importación; se revierte con `mode=0`.
   **NO comprimir con pérdida los sprites del personaje** (`piezas-*.png`): son pixel-art que se
   dibuja al píxel exacto con `nearest` y la pérdida ensucia bordes y alfa. Las estampas sí,
   porque el prólogo las reescala con `TEXTURE_FILTER_LINEAR`.
2. **Lo que el juego no abre, fuera del export.** `export_presets.cfg` → `exclude_filter` ya
   excluye `assets/Prologo/anclas/*` (referencias del generador, −12 MB),
   `assets/Prologo/referencias/*` (recortes de la regla §4.25) y
   `assets/Prologo/escenas/Copia*` (los respaldos de la regla §4.34). El prólogo carga por
   patrón `escena_%02d.png`, así que **cualquier archivo con otro nombre en `escenas/` es peso
   muerto** que viajaría al navegador.

### ⭐ EL AUDIO EN WEB EXIGE UN GESTO DEL JUGADOR (2026-07-28)

**Síntoma:** en el móvil el prólogo **se ve pero no suena**. En el escritorio de Fernando sí
sonaba, lo que despista.

**Causa (medida, no supuesta):** el navegador bloquea el audio hasta que el usuario hace un
gesto **en esa página**, y `/juego` es una **navegación aparte** — el login de la portada NO
cuenta. Godot solo despierta su `AudioContext` cuando recibe input **en su canvas**, y el
prólogo es una cinemática que nadie toca. En escritorio Chrome suele saltarse la política por el
*Media Engagement Index* (visitas mucho tu propio dominio); **en móvil es estricta siempre**.

Medido con Chrome bajo `--autoplay-policy=document-user-activation-required`:

| | `AudioContext` | reloj del audio |
|---|---|---|
| sin tocar | `suspended` | 0 → 0 en 12 s |
| tocando el canvas | `suspended → running` | +12,13 s en 12 s |

⚠ **El prólogo SÍ avanza aunque el audio esté suspendido** (se comprobó con capturas: cambia de
estampa y teclea los versos). Por eso el fallo se presenta como "no hay música" y no como
"se quedó congelado" — pero significa que **la letra se desincroniza del canto**.

**Arreglo (`components/game/GodotGame.tsx`):** se dejó de llamar a `startGame()`, que descarga y
arranca de un tirón, y se partió en los dos pasos que hace por dentro:
1. `init(exe)` + `preloadFile(pack, pack)` → baja wasm y pck con su barra de progreso.
2. La pantalla de carga muestra **"Toca para empezar"** (fase `listo`) y **solo tras el gesto**
   se llama a `start({ args: ['--main-pack', pack] })` (`start` NO añade el `--main-pack` solo;
   eso lo hacía `startGame`).

Como el gesto ocurre **antes** de que el motor exista, Godot crea su contexto ya despierto:
verificado, el `AudioContext` **nace `running`** (nunca pasa por `suspended`) y la canción suena
desde el primer segundo. **Regla general: en el export web, nada que suene puede arrancar solo;
tiene que haber un gesto del jugador en la propia página del juego, antes de arrancar el motor.**

### ⭐ LA LETRA IBA MÁS TARDE EN EL NAVEGADOR QUE EN EL EDITOR (2026-07-28)

**Síntoma (Fernando):** *"en producción tarda un segundo aproximado más en mostrarse el texto,
la canción no es acorde a como se muestra"*.

**Lo que NO era** (descartado midiendo, no opinando): el tecleo va por **tween de tiempo**, no
por fotogramas, así que un móvil lento no lo alarga (medido: 1,599 s en navegador vs 1,594 s en
escritorio, previsto 1,60). Y el disparo del verso tampoco se retrasaba respecto al reloj
interno: **0,007 s en navegador vs 0,008 s en escritorio**.

**La causa: `AudioServer.get_output_latency()`.** `_pos_musica()` seguía la receta estándar de
Godot para juegos rítmicos, que **resta** la latencia de salida. Restarla hace `pos` más pequeño,
así que cada verso se dispara **exactamente `latencia` segundos MÁS TARDE** en tiempo real.
Y ahí está la asimetría entre los dos entornos:

| entorno | latencia medida | efecto sobre la letra |
|---|---|---|
| editor de Godot | **0,0000 s** | ninguno — es la referencia que ve Fernando |
| navegador (Chrome escritorio) | **0,0720 s** | 72 ms tarde |
| navegador (móvil, más aún por Bluetooth) | décimas de segundo | **el desfase que se nota** |

En el motor web la latencia es `ctx.baseLatency + ctx.outputLatency` y además **solo se refresca
una vez por segundo** (`setInterval` de 1 s en `index.js`).

**Arreglo:** `_pos_musica()` **ya no resta la latencia** — en el navegador se hace lo mismo que
en el editor, que es justo lo que pedía Fernando ("que se vea como cuando pruebo en Godot").
Verificado: el verso pasó a dispararse con la posición cruda en 76,509 en vez de ~76,58 (72 ms
antes, exactamente la latencia) y en escritorio no cambió nada.

Dos mandos nuevos en el Inspector (grupo *Música ▸ Sincronía de la letra*):
- **`ajuste_sincronia`** (−2…+2 s, por defecto 0): ajuste fino a mano. **Positivo = el texto sale
  ANTES**, negativo = después. Mueve el prólogo ENTERO contra la canción (versos, estampas y
  ráfaga a la vez), así que no descuadra nada entre sí. Es lo que hay que tocar si en algún
  aparato concreto la letra sigue sin caer donde se canta.
- **`compensar_latencia`** (por defecto `false`): devuelve el comportamiento anterior.

**Regla:** el reloj del prólogo tiene que comportarse **igual en el editor y en el navegador**;
cualquier corrección que dependa del aparato (latencia de salida) mete un desfase que solo se ve
en producción, que es donde peor se diagnostica.

### ⭐ LA LETRA ENTRA POR BARRIDO, NO TECLEÁNDOSE (2026-07-28)

Idea de Fernando después del arreglo anterior: *"que en vez de que parezca que se va escribiendo,
mejor que aparezca rápidamente de un tirón, de izquierda a derecha"* — para que un resto de
latencia **deje de notarse**. Y tiene razón de fondo: el tecleo tardaba hasta `tecleo_max` = 1,6 s
en completar la frase, y esa lentitud es justo lo que hace VISIBLE cualquier desfase; si la frase
entra en 0,3 s, el ojo la ancla de golpe al verso cantado.

**Cómo está hecho:** un `ShaderMaterial` sobre el `Label` (`_material_barrido()`) que revela el
texto de izquierda a derecha con un frente difuminado.

⚠ **El truco está en `vertex()`.** En un `Label` el `UV` del fragmento es el de la **textura de la
fuente** (el atlas de glifos), NO el del control: cortar por `UV.x` haría el barrido *dentro de
cada letra*, no a lo largo de la frase. Hay que pasar la posición **local** del vértice a un
`varying` (`x_local = VERTEX.x`) y cortar contra ella. Vale para cualquier efecto de revelado
sobre texto en Godot.

Mandos en el Inspector (grupo *Texto*):
- **`aparicion`**: `BARRIDO` (por defecto) o `TECLEO` (el efecto antiguo, intacto).
- **`barrido_dur`** (0,32 s por defecto): lo que tarda el frente en cruzar la frase.
- **`suavizado_barrido`** (46 px): anchura del frente difuminado. 0 = corte seco.

Verificado fotograma a fotograma capturando el viewport desde dentro del juego: en el primer
fotograma la frase está cortada a media palabra con el borde degradado y dos fotogramas después
está completa. (Truco de captura: instanciar `Prologo.tscn` desde un `Node` suelto, esperar a que
el uniform `progreso` esté entre 0 y 1 — con temporizador NO se acierta el instante, porque el
arranque de la música tiene su propio retardo — y guardar `get_viewport().get_texture()
.get_image().save_png()` tras `await RenderingServer.frame_post_draw`.)

**Prueba de humo antes de publicar** (saca los `SCRIPT ERROR` sin abrir el editor):
```bash
godot --headless --path godot --quit-after 900
```

**Cómo confirmar qué versión sirve producción** (Railway tarda unos minutos):
```bash
curl -sI https://app.grupocc.org/game/index.pck | grep -i content-length   # producción
stat -f%z public/game/index.pck                                            # local
```
⚠ **Evitar publicar mientras alguien está cargando el juego**: desincroniza los tamaños que lee
la pantalla de carga (se autocorrige, pero da un salto raro). ⚠ **Para VER el juego en
producción hay que iniciar sesión**: `/juego` está tras `GameEntryGate` — se entra por la
portada → "Entrar" → login; escribir la URL a pelo devuelve a la portada.

40. **⭐ "AURA" ≠ "PINTADO": son dos cosas distintas y hay que pedir la que se quiere.**
    Pedir *"un AURA de color alrededor de X"* da un **HALO que rodea** la silueta, dejándola
    negra por dentro (así están las auras de las escenas 111-113, y así se pidió la 117). Si lo
    que se quiere es que **la silueta ESTÉ RELLENA** de ese color, hay que decirlo con esas
    palabras: *"toda la silueta PINTADA ENTERA de rojo, relleno SÓLIDO Y PLANO, es el color del
    propio brazo, NO algo que lo rodee"*, y **prohibir explícitamente** el aura, el halo, el
    resplandor, las lenguas de llama y las chispas.
    Pasó el 2026-08-02: la 117 salió con el brazo izquierdo pintado entero de azul y a Fernando
    le gustó así; al pedir el rojo de la 118 como "aura", salió el halo y hubo que rehacerlo en
    la 119 pidiéndolo como relleno. **Antes de pedir un color, mirar cómo está el que ya está
    aprobado y copiar esa forma de decirlo.**

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
- ## ⛔⛔ REGLA Nº 1 DEL ARTE — SOLO FERNANDO EVALÚA LAS IMÁGENES
  **NUNCA calificar una imagen generada ni decidir regenerarla por criterio propio.**
  Textual, el 2026-08-02: *"deja para siempre de estar calificando las imágenes, tú tienes
  mala capacidad para distinguir detalles muy específicos… solo yo decido eso"*.
  - **Prohibido** decir que una imagen "no es lo que pidió", "salió mal", "sigue sin coger la
    escala" o cualquier juicio sacado de mirarla. **Prohibido** lanzar otra tirada apoyándose
    en ese juicio.
  - **El flujo es: generar UNA vez → entregar y PARAR.** Se corrige solo con una indicación
    suya, y se aplica lo que él diga, no lo que yo crea ver.
  - **Por qué importa doble:** (a) distingo mal los detalles finos del pixel-art, así que mi
    veredicto no vale; (b) cada tirada gasta **créditos de prepago de su cuenta de Gemini** —
    regenerar por iniciativa propia le cuesta dinero.
  - **Lo que SÍ debo seguir comprobando** (es objetivo, no opinión): que el `.png` se
    reescribió de verdad (md5, regla §4.21/§4.39), que no fue un 429/503, que la escena está
    en `TRAMOS` donde toca y que el reparto de tiempos cuadra.
  - **Se incumplió el 2026-08-02** con la escena 115: cinco tiradas seguidas juzgando yo cada
    resultado, sin enseñarle ninguna. La norma ya estaba escrita justo debajo.
- ## ⛔ REGLA Nº 2 DEL ARTE — CADA INTENTO VA A UNA ESCENA NUEVA, NO SE SOBRESCRIBE
  **Nunca se regenera encima de una estampa existente.** Cada nuevo intento del mismo momento
  se guarda con el **número siguiente libre** (115 → 116 → 117…), y el anterior se queda tal
  cual. Dicho por Fernando el 2026-08-02: *"ya no iremos reemplazando lo ya creado, sino que
  iremos grabando lo nuevo en nuevas escenas, no importa que se generen cientas… para que no se
  me pierda lo ya generado"*.
  - **Por qué:** regenerando encima se perdía trabajo bueno. Antes se paliaba copiando a mano
    la versión previa (regla §4.25) y aun así se perdían variantes. Con una escena por intento,
    **nada se pierde y él compara**.
  - **Numerar es barato, perder una versión no.** No importa acumular cientos de archivos.
  - Consecuencias prácticas: `INSERTADAS` necesita su entrada para heredar el tono; el
    `.png.import` nace SIN comprimir y hay que ponerle `mode=1` + `lossy_quality=0.85` antes de
    publicar (§4-bis); y **el prólogo solo muestra la que Fernando elija** — las demás se quedan
    en disco sin entrar en `TRAMOS`.
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
- **Audio (convención, 2026-07-26):** la música del juego vive en
  **`godot/assets/Audio/Musica/`** (los efectos irán en `godot/assets/Audio/Efectos/`).
  Primera pista: `Pixel Heart Quest - AI Music (8).mp3` (2:15) = música del prólogo, la
  eligió Fernando.
- Docs: `HISTORIA.md`, `GUION_VISUAL.md`, este `Videojuego.md`.

## 7-bis. 🎬 VÍDEO GENERADO (Veo) — decisión del 2026-07-28

Fernando quiere que **algunos tramos del final del prólogo sean VÍDEO** intercalado entre
estampas (no todo el final: un clip, luego imágenes, luego otro clip).

- **Modelos disponibles con su clave:** `veo-3.1-generate-preview`,
  `veo-3.1-fast-generate-preview` y `veo-3.1-lite-generate-preview` (acción
  `predictLongRunning`). Se usa **imagen→vídeo** partiendo de una estampa ya aprobada, que
  es lo que mejor conserva el estilo.
- **Límite: 8 s por clip.** El hueco que pidió (del verso 13 al 15) son **11 s exactos**, así
  que necesita DOS clips. Cada clip se genera por separado, así que **la continuidad entre
  clips es mala**: por eso funciona intercalando estampas entre ellos, no encadenando vídeo.
- **Script:** `scratchpad/generar_video.py` (imagen + prompt → mp4). Salida: 1280×720, 24 fps,
  ~6 MB por clip, **con pista de audio que hay que quitar**.
- **Godot solo reproduce Ogg Theora:** convertir con
  `ffmpeg -i clip.mp4 -q:v 8 -an assets/Video/clip.ogv` (el `-an` quita el audio para no
  pisar la canción).
- **Soporte ya montado en `Prologo.gd`:** la lista `VIDEOS` ata cada clip a un verso o a un
  segundo; mientras dura, la estampa se oculta; al acabar vuelven las estampas. El clip va
  mudo y se adelanta solo si se entra a mitad con `empezar_en`.
- **Aviso de estilo:** el vídeo suaviza el pixel-art. El primer clip salió con el zoom, el
  aura de fuego creciendo y el fondo oscureciéndose bien, pero con un dibujo más blando y
  más saturado que las estampas.

## 8. Estado actual (2026-07-28)

**Lo hecho entre el 2026-07-27 y el 2026-07-28** (no estaba recogido aquí; el detalle largo vive
en `MEMORIA.md` → *Decisiones recientes*):

- ✅✅ **PUBLICADO EN PRODUCCIÓN el 2026-07-28** con `npm run juego:publicar` (ver §4-bis):
  `.pck` **14,9 MB**, prueba de humo sin errores. Incluye las 83 estampas y el personaje
  articulado.
- ✅ **17 estampas nuevas (67–83)** y **Acto 4 reescrito**: los hijos ya **no se esconden en una
  caja**, escapan por la ventana. Las nuevas cuentan la vida ANTES del colapso (la noche de
  convivencia junto al Hoyo, la aldea que se retira, el interior de la casa, la pareja, la luz
  violeta del Hoyo, los canales de riego, la fábrica, el periódico, la partida de los jóvenes).
  **Se numeran a partir de 67 y NUNCA se renumera** (regla §4.22); el orden real lo manda
  `TRAMOS` en `Prologo.gd`.
- ✅ **Prólogo CANTADO**: todo se compara contra la posición de reproducción del mp3, los versos
  salen en el segundo en que se cantan y Fernando calibró él mismo los 18 tiempos. El
  instrumental es una **ráfaga en mosaico** (la pantalla se subdivide 1→2→4→6 paneles) que mete
  ~37 estampas en 10 s sin estrobo.
- ✅ **CREADOR DE PERSONAJE PROPIO** (vive en la app, no en Godot): se retiró la librería LPC
  porque el personaje no se parecía a las estampas. Las piezas se generan con el **mismo modelo
  del prólogo** (`gemini-3-pro-image`) anclando el estilo en la **aldeana de `escena_01`**. La
  plantilla es la hoja base generada (`public/personajes/base/{mujer,hombre}.png`, 384×128 = 4
  vistas de 96×128) y todo lo demás se genera **editándola**, por eso todas las piezas encajan.
  Composición **por bandas** (cabeza 0–42 · torso 42–80 · piernas 80–128), no por capas con alfa.
  Color de pelo/piel, rasgos de la cara y complexión **no cuestan generaciones**: 26 dibujos dan
  >2 millones de combinaciones. Se guarda **la elección, no la imagen**.
  ⚠ **La hoja NO la descarga Godot** (el endpoint exige sesión y la cookie no viaja en el export
  web): la baja la app y se la **inyecta al motor** con `copyToFS('/userfs/...')`.
- ✅ **ANIMACIÓN — camino Guardian Tales (esqueleto + anclajes)**, decidido por Fernando. El
  motivo no fue la calidad sino **el coste por pieza**: con capas sincronizadas un casco hay que
  dibujarlo en CADA fotograma; con esqueleto se dibuja **una vez**. ⚠ **Las piezas se DIBUJAN,
  no se recortan**: se intentó recortar el esqueleto de la hoja compuesta y no funciona — en un
  dibujo plano el brazo no existe como objeto, son píxeles pegados al torso, y al girarlo se abre
  el hombro. `scripts/despiezar.mjs` le pide al modelo el personaje **desmontado en piezas de
  marioneta** (articulación redondeada, material de sobra en la unión) y `scripts/armar-piezas.mjs`
  las detecta, clasifica, calcula pivotes y las empaqueta para Godot.
- ⏳ **Falta despiezar al chico** (hoy solo está `piezas-mujer`), afinar cuello y hombros, y luego
  **armas/equipo** (anclaje de la mano) y el **combate**.

**Base anterior (2026-07-26), sigue vigente:**

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

**⏳ Foco tras la publicación del 2026-07-28 (por orden):**
1. **Despiezar al chico** (hoy solo existe `assets/piezas-mujer.png/json`) y **afinar cuello y
   hombros** de la marioneta.
2. **Armas y equipo** (anclaje de la mano) y después el **combate**.
3. **Orden y reparto definitivos de las estampas** en `TRAMOS` — lo lleva Fernando; hay 83
   estampas para una canción de 2:15 (recomendación abierta: generar una versión de ~4:30).
4. **Fase 1** del juego (creador → lobby de nieve → caminos con condiciones).

**⏳ Lo que quedó a medias el 2026-07-27:**
- **Escena 4:** la corrección a SEIS figuras **nunca llegó a probarse** (los 5 reintentos se
  cayeron por 503 y el `.png` conservó la versión anterior). Relanzar.
- **Escena 5:** salió con 8-9 ancianos en vez de 5 (ver regla §4.32: el modelo no cuenta).
- **Escena 80:** se quedó SIN el cajón cerrado tras 3 intentos (ver regla §4.35).
- **Ordenar el prólogo:** Fernando lleva él mismo `TRAMOS`; hay estampas fuera de la
  secuencia (4, 5, 6, 10, 12, 71, 72 en algún momento) y hay que cuadrar el reparto: el
  bloque de la devoción va con más estampas que hueco y la consola avisa.
- **La tensión de fondo:** ~80 estampas para una canción de 2:15. Recomendación dada a
  Fernando: **generar una versión más larga de la canción (~4:30)**.


- **Prólogo COMPLETO** ✅ (66/66). Opcional: revisar la **42** (industrias contaminando) por si
  se quiere rehacer al estilo actual.
- **Integrar el prólogo en Godot** ✅ (2026-07-26): 66 estampas reproduciéndose, layout de
  tamaños fijos, música, y todo **sincronizado con la canción**. `Prologo.tscn` es la escena
  principal. **Lo que falta, por orden de importancia:**
  1. **⏳ CALIBRAR LOS 16 TIEMPOS de la letra** — los `"t"` de `LETRAS` son hoy una
     ESTIMACIÓN sacada de la envolvente de energía del mp3. Fernando tiene que ejecutar el
     prólogo con `calibrar_letras = true` y pulsar ESPACIO a cada verso; luego se pega el
     bloque que imprime la consola. **Hasta entonces el texto NO cae donde se canta.**
  2. **⏳ ORDEN Y REPARTO DE LAS ESCENAS** — Fernando dijo (2026-07-26) que él dirá cómo
     ordenar y mostrar las estampas. Los `TRAMOS` actuales son un relleno provisional.
  3. **Tensión real que hay que resolver:** la canción dura **2:15** y hay **66 estampas**
     (≈1,8 s por estampa de media). Además la letra dedica ~2 versos al Acto 3 (34 estampas)
     y 8 versos al final (14 estampas). Opciones: (a) aceptar que el Acto 3 sea una ráfaga
     rápida (así está hoy, 1,2 s); (b) **conseguir una canción más larga** (~4:30) — la
     recomendada, porque Fernando genera la música con IA; (c) usar menos estampas.
  4. Validar el **volumen** (−6 dB) y el tamaño de imagen/letra.
  5. Probar el flujo completo `Prologo → Intro → Encuentro` (la `Intro.tscn` necesita que
     Fernando arrastre su imagen de fondo al nodo `Fondo`, hoy está vacío).
- **Limpieza propuesta (pendiente del ok de Fernando):** quitar los 2 mensajes de
  `Intro.gd` (`mensajes` = "Hay alguien aquí, ¿Hola?." / "Tengo miedo...") porque **duplican**
  los diálogos de la niña en `Encuentro.gd`, donde sí tienen sentido (los dice ella).
- **Fase 1 del juego** (ver §5): creador de personaje → lobby de nieve → primer camino
  "perfil cero" (guía plataforma+juego) → tutoriales de controles → caminos con condiciones +
  economía. Fernando aprende Godot guiado en paralelo.

## 10. Registro de aprendizajes/decisiones

- **2026-08-02 (⛔ CORRECCIÓN DE MÉTODO — solo Fernando evalúa las imágenes):** al generar la
  estampa 115 encadené **cinco tiradas seguidas** decidiendo yo, mirando cada resultado, que
  "no era lo pedido" y relanzando. Fernando lo cortó: *"deja para siempre de estar calificando
  las imágenes, tú tienes mala capacidad para distinguir detalles muy específicos… solo yo
  decido eso"*. La regla queda en §6 como la **nº 1 del arte** y manda sobre cualquier otra:
  **generar una vez, entregar y parar**; solo se corrige con su indicación. Dos motivos, y el
  segundo es el caro: mi lectura de un pixel-art no es fiable, y **cada tirada gasta créditos
  de prepago de su cuenta de Gemini**. Lo objetivo (md5, 429/503, reparto de tiempos, que la
  escena esté en `TRAMOS`) sí se sigue comprobando: eso no es opinión.
  ⚠ Ojo: las reglas §4.34 y §4.34-bis ("una corrección por tirada", "añadir sobre el prompt que
  funciona") describen **cómo** corregir cuando él pide una corrección — **no** son permiso
  para iterar solo.

- **2026-07-28 (Acto 4 rehecho a fondo + primer vídeo):** se regeneraron/crearon la **53**
  (familia de 5 huyendo, caótica, con las tres tallas y las figuras granate distintas), la
  **62** (piernas en fases distintas de la zancada), y las nuevas **84** (el cráter solo con
  los perseguidores asomados al hueco), **85/86** (los pequeños abrazados al mayor, que se
  dispone a saltar; la 86 corrige que son niño y niña), **87/88** (POV mirando al fondo del
  Hoyo, con el Hoyo ya enorme y solo pies y piernas) y **89** (los tres ya en el aire). Se
  generó el **primer clip de vídeo** con Veo a partir de la 66.
  **Reglas nuevas y confirmadas (§4.31–39 y siguientes):** la referencia visual manda sobre
  el texto; el modelo NO cuenta figuras; las proporciones se piden COMPARANDO y con pruebas
  verificables en la imagen; cada tirada suelta lo ya conseguido, así que **se corrige por
  ADICIÓN sobre el prompt que funcionó, nunca reescribiendo**; **"EDITA conservando todo"
  bloquea cualquier cambio de las figuras** → generar de cero; **si el filtro bloquea,
  reescribir en clave de FORMAS Y MOVIMIENTO**; y **componer por código dos mitades ya
  aprobadas** es más fiable que pedirle a la IA que las rehaga.
  **Método de trabajo (2026-07-28):** Fernando pidió expresamente **no hacer regeneraciones
  que él no haya pedido**: yo genero, él revisa y decide. Mi criterio visual no sustituye al
  suyo — varias veces di por mala una imagen que él dio por buena.

- **2026-07-28 (publicación a producción + puesta al día del documento):** Fernando pidió
  **publicar todo lo nuevo de Godot aunque el juego no esté completo**. Aprendizajes:
  (a) **El comando es `npm run juego:publicar`** (`scripts/publicar-juego.sh`): reimporta →
  exporta a web → commit + `pull --rebase` + push a `main`; Railway despliega solo. Detalle
  completo en la §4-bis nueva.
  (b) ⚠ **Las estampas nuevas llegan al export SIN comprimir.** Sus `.png.import` nacen con
  `compress/mode=0`, así que las 15 añadidas desde la última publicación (69–83) iban a meter
  **26 MB de PNG** en el `.pck`. Al pasarlas a WebP con pérdida (`mode=1`, `lossy_quality=0.85`)
  el `.pck` quedó en **14,9 MB**. **Es un paso que hay que hacer a mano cada vez que se añade
  arte** — no lo hace ni el generador ni el script de publicar.
  (c) **Lo que el juego no abre no debe viajar al navegador.** Se descubrió que
  `Copia de escena_53.png` (un respaldo de la regla §4.34) estaba entrando al export: el prólogo
  carga por patrón `escena_%02d.png`, así que jamás la abre. Se añadió
  `assets/Prologo/escenas/Copia*` al `exclude_filter`, junto a las anclas y las referencias.
  **Regla: si guardas una versión descartada dentro de `escenas/`, excluye su patrón del export.**
  (d) **Este documento se había quedado desfasado** (paró el 26-jul mientras el trabajo de los
  días 27 y 28 —creador de personaje, personaje articulado, estampas 67–83— solo se registraba en
  `MEMORIA.md`). Corregido en §3, §8 y aquí. **Lección de proceso: al cerrar un bloque de trabajo
  del juego hay que actualizar `Videojuego.md`, no solo `MEMORIA.md`** — si no, la "fuente de
  verdad del videojuego" deja de serlo.

- **2026-07-27 (sesión larga: prólogo cantado, ráfaga y reescritura del Acto 4):** lo hecho:
  (a) **El prólogo va sincronizado con la canción** (`Pixel Heart Quest`, 2:15): los versos
  aparecen en el segundo en que se cantan y las estampas se anclan a los versos. Fernando
  calibró él mismo los 18 tiempos. (b) **Ráfaga del verso 8**: mosaico que se subdivide en
  1→2→4→6 paneles para meter ~37 estampas en 10 s **sin estrobo** (cada una aguanta ~0,8 s),
  con la PALABRA del problema estampada sobre cada panel y cierre en el mundo gris (OLVIDO).
  (c) **17 estampas nuevas (67–82)**: la noche de convivencia junto al Hoyo, la aldea que se
  retira, el camino a casa, el interior de la casa, el beso de buenas noches, la pareja, la
  luz violeta del Hoyo, los canales de riego (con y sin brillo), la inauguración de la
  fábrica, el periódico, la partida de los jóvenes, el Hoyo de noche con raíces, y la
  reescritura del Acto 4 (los hijos ya no se esconden en una caja: escapan por la ventana).
  (d) Se **regeneraron 4, 5, 6, 7 y 58**. (e) Herramientas nuevas: `empezar_en` para arrancar
  el prólogo en cualquier segundo, `DURACIONES` para clavar el tiempo de una estampa,
  `mostrar_reparto` para ver el reparto por consola, y `NOMBRES`/`PALABRAS` para ordenar.
  **Las lecciones de arte de esta sesión están en las reglas §4.31–§4.39** y son las más
  importantes del pipeline: la referencia visual manda sobre el texto, el modelo no cuenta
  figuras, las proporciones se piden comparando, cada tirada suelta lo ya conseguido, quitar
  elementos no funciona, y el filtro con menores se desbloquea partiendo la escena en dos.

- **2026-07-26 (⭐ el prólogo pasa a ir SINCRONIZADO CON LA CANCIÓN):** Fernando pidió que el
  texto del prólogo **sea la letra de su canción** y que **se vea al mismo ritmo que canta**;
  y confirmó: *"haz que el prólogo se base en el tiempo de la canción, luego te diré cómo
  ordenar y mostrar las escenas"*. Aprendizajes y decisiones:
  (a) **Nada por temporizador.** El reloj es `AudioStreamPlayer.get_playback_position()`, y
  para que sea exacto se le **suma `AudioServer.get_time_since_last_mix()` y se le resta
  `AudioServer.get_output_latency()`** (la posición solo se refresca por bloque de mezcla).
  Verificado: adelantando la canción con `seek()` a cualquier segundo, el verso y la estampa
  correctos aparecen al instante.
  (b) **Dos relojes independientes** leyendo la misma canción: `LETRAS` (verso ↔ segundo) y
  `TRAMOS` (estampas ↔ segundos por estampa, por acto). Hacía falta separarlos porque la
  letra no reparte las 66 estampas de forma pareja.
  (c) **El bucle se quita:** el prólogo dura lo que dura la canción (2:15), no 4:24.
  (d) **TENSIÓN DE FONDO sin resolver:** 66 estampas en 2:15 = 1,8 s de media, y la letra da
  ~2 versos al Acto 3 (34 estampas) frente a 8 versos al final (14 estampas). Recomendación
  dada a Fernando: **generar una canción más larga (~4:30)**, ya que la hace con IA.
  (e) **Yo no puedo oír el audio** → se construyó el **modo `calibrar_letras`** para que él
  marque los tiempos con ESPACIO y el juego imprima el bloque `LETRAS`. Regla general: cuando
  la sincronía dependa de oír algo, la solución es una **herramienta de calibración dentro
  del juego**, no adivinar.
  (f) Lo que SÍ se puede sacar sin oír: la **envolvente de energía** del mp3 con `ffmpeg`
  (→ wav mono 8 kHz, banda 250–3500 Hz) y RMS por tramos en Python puro (`wave` + `array`,
  no hay numpy en la Mac). Sirve para ver la ESTRUCTURA (intro ~10 s, subidas ~36 s y ~99 s,
  hueco en ~120 s, cola hasta 135,6 s), no para clavar versos.
- **2026-07-26 (música del prólogo):** Fernando eligió `Pixel Heart Quest - AI Music (8).mp3`
  y pidió moverla a una carpeta de músicas del juego → se creó la convención
  `assets/Audio/Musica/`. Aprendizajes: (a) la pista dura **2:15** y el prólogo **4:24**, así
  que hay que **poner el `loop` a mano**: el importador de Godot deja los MP3 sin bucle, y se
  activa en código con `(pista as AudioStreamMP3).loop = true` (equivalentes para
  `AudioStreamOggVorbis.loop` y `AudioStreamWAV.loop_mode`). (b) Para que la música **entre**
  suave se arranca en `musica_db - 40` y se hace tween de `volume_db`; para apagarla, tween a
  −60 dB y `stop()`. (c) El cierre del prólogo cortaba en seco → ahora `_ir_a_siguiente()`
  **funde a negro (velo) y baja la música en paralelo** antes de `change_scene_to_file`.
  (d) Para verificar audio sin hacer ruido: `godot --audio-driver Dummy` (el `playing` y la
  posición de reproducción siguen siendo reales).
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
