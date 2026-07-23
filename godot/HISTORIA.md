# GCC World — Guion, Historia y Diseño del Juego

> Documento vivo. Fuente de verdad del **contenido narrativo y de diseño** del videojuego.
> El estado técnico (Godot, escenas, scripts) vive en la memoria del proyecto; aquí va la
> **historia, el mundo y las mecánicas**.

---

## 1. Lore — El Hoyo

Hace mucho tiempo, los humanos antiguos adoraban un lugar al que llamaban **el Hoyo**. Era
visitado y respetado por todos: cada cierto tiempo celebraban y recordaban que el Hoyo era
el lugar donde quizás existiese **un ser que los protegiese** y los ayudase en los peores
momentos.

En esa época los humanos vivían en tranquilidad. Había lo suficiente para todos. Aunque las
adversidades llevaban a algunos a buscar formas distintas de sobrevivir, nunca fue
catastrófico.

Se volvió catastrófico cuando, tras varios años, **el humano dejó de interesarse por el
Hoyo**. Empezaron a enfocarse en producir, y a adorar otras cosas: **la tecnología, el dinero
y el poder**. Con los años, el mundo sufrió catástrofes en cadena:

1. Un **gran terremoto** que afectó a muchos países de cierta región.
2. **Enfermedades**, algunas tan graves que causaron muchísimas muertes.
3. **Guerras por los recursos**, porque cada vez había menos para todos.

Mientras tanto, el Hoyo se veía **cada vez más deteriorado**, rodeado de una **sombra oscura**.
La gente pasaba y se preguntaba para qué era eso, cuál era el sentido, por qué lo hacían — sin
darse cuenta de que **entre más se alejaron del Hoyo y de sus orígenes, peor iba el mundo**.

Llegó el punto en que quedaban muy pocos humanos, sobreviviendo como podían. No había comida,
ni refugio, ni descanso. El mundo estaba en su peor momento y la humanidad, cerca de
extinguirse.

---

## 2. Prólogo jugable — La caída (mapea a la intro cinemática)

> **Técnico:** hoy la intro es `Intro.tscn` (lluvia → descenso por la imagen → zoom a la
> cueva/Hoyo → oscurece → carga la siguiente escena). Ver memoria del proyecto.

- Un/a **joven** (el personaje; niño o niña según elección) junto a su familia se acerca de
  lejos al Hoyo y lo mira como algo sorprendente. Los padres, enfocados en sobrevivir, le
  dicen que no le preste atención y se van. Pero **el joven queda fascinado**.
- En la huida entre guerras y desastre, los padres esconden a sus hijos y **se sacrifican
  distrayendo a los atacantes**. Mueren. El joven queda solo con sus hermanos menores.
- El joven propone: *"¿Y si nos escondemos en el Hoyo?"*. Corren juntos hacia él. Al llegar
  de frente, el joven **mira al fondo y se lanza** — nadie lo había hecho antes.
- Caen **sin recibir daño** y quedan frente a una **niña** de rostro destruido, demacrado, casi
  esquelético, **amarrada a raíces**, como si la tierra consumiera su vitalidad. No puede
  moverse.

---

## 3. Primera escena jugable — El encuentro con la niña

> El jugador **ya tiene control** para moverse (adelante/atrás) mientras avanza, y los mensajes
> aparecen a medida que se acerca. (Nota de diseño: los mensajes que hoy están en la cinemática
> probablemente se muevan a ESTA escena, para que salgan mientras el jugador camina hacia ella.)

Diálogo / beats:

- Niña (en su desesperación): **"¿Hay alguien ahí? ¿Hola?"**
- Los jóvenes, asustados, caminan lentamente hacia ella.
- Niña: **"¿Quién está ahí? Tengo miedo."** Los jóvenes no saben qué contestar.
- Al acercarse más, la niña — asustada por ver seres nunca vistos — grita: **"¿Quién eres?"**
  El grito es tan fuerte que **hace temblar el lugar**.
- El joven, con miedo, responde diciendo **el nombre del personaje**. → *Aquí se **registra el
  nombre del personaje**.*
- Niña: **"¿Por qué estás aquí? Nadie debería estar aquí. En este lugar todos deberían morir."**
- Joven: *"No sabía dónde ir, afuera todo está mal. Corrimos hacia aquí porque nos iban a matar."*
- Niña (deprimida, agacha la cabeza): **"Esto es culpa de todos. Esto es culpa de todos ustedes."**

Clímax:

- Todo empieza a temblar, cada vez más fuerte. Cae una **piedra enorme** directo hacia uno de
  los hermanos: podría aplastarlo, pero **la piedra se transforma en una celda** que lo encierra
  y lo oculta antes de aplastarlo.
- A la otra hermana más pequeña, **unas raíces** emergen del suelo, la absorben y la llevan al
  fondo. **Los dos niños desaparecen.**
- Niña demacrada al joven: **"Necesito vivir, y estos niños me ayudarán."**
- Joven: *"No puedes llevarte a mis hermanos. Son muy pequeños. Si quieres a alguien, llévame a mí."*
- Niña: **"Yo no necesito a gente como tú."**
- Todo se apaga. **El joven desaparece.**

Transición:

- El joven **aparece en otro lugar**. Mientras despierta y se levanta, una **voz de fondo** se
  escucha en todo el lugar:

  > *"Valoro tu valentía de haberte lanzado hasta aquí. Pero mientras sigas siendo igual que los
  > demás, no voy a poder hacer nada para ayudarte."*

- Fin del prólogo. **Aquí inicia la primera escena/fase del juego** propiamente.

---

## 4. Antes del lobby — Creador de personaje

Antes de aparecer en el mundo de nieve, el jugador pasa por un **diseñador de personaje**:

- Sexo (hombre / mujer).
- Pelo, gafas, accesorios, ropa.
- (El **nombre** se registró en el prólogo, en el encuentro con la niña.)

---

## 5. El Lobby — Mundo de nieve (hub central)

El personaje **se levanta** en un lugar **estilo nieve**, **grande**, que funciona como **lobby /
hub**. Características:

- **Diferentes caminos / rutas** que parten de aquí; cada ruta lleva a lugares distintos, casi
  como **mundos diferentes**.
- El personaje puede moverse libremente por el hub.
- A futuro: **inventario** (dejar recursos aquí), **decoración** y personalización del espacio;
  el lobby es un lugar "para estar".
- **Mini-tutoriales** repartidos en pequeñas zonas del hub, que enseñan los controles (ver §7).

---

## 6. Caminos con condiciones (juego ↔ plataforma ↔ vida real)

Cada **personaje está asociado a la cuenta del usuario en la plataforma GCC World**. La cuenta
evalúa características: **talento, valores, dimensiones, red de apoyo**, etc.

- **Cada camino tiene condiciones** de acceso: qué debe tener tu cuenta (a nivel de plataforma)
  para poder entrar.
- **Primer camino = "perfil cero"**: disponible **sin condiciones**.
- **Los demás caminos están bloqueados**: para desbloquearlos hay **interacción juego ↔ vida
  real** — hacer cosas en la vida real / en la plataforma para subir el puntaje o clasificación
  y alcanzar rutas bloqueadas.

**Economía:** el juego otorga **monedas** que luego se **consumen en el marketplace** de la
plataforma → objetos, decoraciones, y **productos/servicios reales ofrecidos gratis** (a cambio
de monedas). Esto le da sentido a la economía, la dificultad y los bloqueos.

---

## 7. Tutoriales del lobby (controles a enseñar)

Pequeñas guías, cada una en una mini-zona:

- **Recoger / activar objetos** (activar y desactivar).
- **Armas**: recoger un arma y **atacar**.
- **Armadura**: recoger y equipar para **defenderse**.
- **Escudo**: equipar espada + escudo; **cubrirse** cuando algo te dispara (efecto de cobertura;
  *sin parry* — solo cubrirse es suficiente).
- **Estadísticas**: opción para **ver las estadísticas del personaje**.
- **Mini-puzzles**: p. ej. presionar un botón → se activa algo; buscar un 2º y 3er botón →
  al activar el tercero se **abre una puerta** y consigues algo. Guías cortas.

---

## 8. Estructura de progresión (~200 caminos)

Todo el juego se divide en **~200 caminos**, cada uno con un **propósito**. Por tramos
(aproximado):

| Tramo | Propósito principal |
|---|---|
| **Caminos ~1–10** | **Captar al usuario**: historia, jugabilidad, beneficios. Guía de uso del juego **y** de la plataforma. |
| **Caminos ~11–50** | **Combinar** lo que el usuario usa en la plataforma con lo del juego → **hacer negocios**, intercambio de recursos, aprovechar perfil avanzado. Educar en dar **productividad** al juego ligada a la plataforma. Detrás igual hay historia. |
| **Caminos ~51–150** | (Por definir; con historia y contenido.) |
| **Caminos ~150–250** | Enfoque **competitivo**; propósitos distintos, a analizar después. |

**Idea rectora:** llevar a gente que ama los videojuegos y sacarles provecho, con un sistema de
mercado donde **jugar da beneficios y recursos reales** vía marketplace.

---

## 9. Fase 1 — Lo que necesitamos AHORA

> El desarrollo profundo de historia/contenido se verá después. La **Fase 1** se enfoca en:

1. **Creador de personaje** (antes del lobby).
2. **Lobby de nieve** (grande) con **varios caminos**.
3. **Primer camino (perfil cero, sin condición)**: su función principal es **ser guía de cómo
   funcionan la plataforma y el juego** (tareas/misiones que llevan a la plataforma, más tareas
   internas del juego para quien no quiera ir a la plataforma aún; pero las tareas de plataforma
   dan **beneficios mayores**).
4. **Tutoriales** de controles (§7).
5. **Sistema de caminos con condiciones** ligadas al perfil de plataforma (§6) + **economía**.

---

## 10. Estado actual (2026-07-21)

- ✅ Personaje (Violeta) camina en 4 direcciones (teclado + táctil). Cámara que la sigue.
- ✅ Mapa pintado con TileMapLayer (tile 32×32, "Mundo Interno").
- ✅ Intro cinemática (`Intro.tscn`): lluvia + descenso por imagen de fondo + zoom a la
  cueva/Hoyo + oscurecido + cambio de escena. Fuente **Silkscreen** (igual que la landing).
- ⏳ Pendiente Fase 1: creador de personaje, escena del encuentro con la niña, lobby de nieve,
  caminos con condiciones, tutoriales, economía.
