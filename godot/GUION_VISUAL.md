# GCC World — Guion Visual del Prólogo (secuencia estilo Undertale)

> Secuencia de imágenes fijas ("estampas") que cuentan la caída del mundo antes del
> videojuego. El **texto va debajo, dentro de Godot** (no en la imagen). Todas las
> imágenes se generan con IA siguiendo la **Biblia de Estilo** de abajo para que
> personajes, ambientes y estilo **no cambien** entre escenas.

---

## 1. Herramienta recomendada (y por qué)

El problema difícil no es "generar una imagen bonita", es **mantener consistencia** en
decenas de escenas. Ranking para tu caso:

1. **★ Nano Banana Pro (Google — Gemini 3 Pro Image)** — *recomendada.*
   - La mejor hoy para **consistencia de personaje/objeto/estilo** entre muchas imágenes.
   - Es **conversacional**: le pasas imágenes de referencia y le dices *"misma isla, mismo
     Hoyo, mismo estilo que estas, pero ahora el mar la ahoga"*, y respeta el diseño.
   - Sin código: **app Gemini** o **Google AI Studio**. Con código: **Gemini API** (para
     generar las 66 en lote con un script).
2. **Midjourney** — estética espectacular; consistencia con `--sref` (estilo) + `--oref`
   (personaje) + `--ar 16:9`. Manual (web/Discord), sin API oficial cómoda.
3. **Scenario.gg / Leonardo.ai** — entrenas un "modelo de estilo" con pocas imágenes;
   ideal si quieres **pixel-art** muy uniforme para todo el juego. Tienen API.

**Mi recomendación:** empezar con **Nano Banana Pro** por su consistencia + facilidad. Si
más adelante quieres un pixel-art perfectamente uniforme para todo el juego, entrenamos un
estilo en Scenario/Leonardo.

---

## 2. El MÉTODO de consistencia (esto es lo que hace que funcione)

No generes escena por escena "a lo loco". Sigue este orden:

### Paso A — Genera primero las "anclas" (referencias maestras). Guárdalas.
Estas imágenes definen el canon y se **adjuntan como referencia** en casi todas las escenas:

- **A1 · Estilo maestro:** una imagen que fije el look (ver Biblia de Estilo). Todo cuelga de aquí.
- **A2 · El Hoyo:** cavidad/pozo circular de piedra antigua en la tierra, borde con símbolos
  tallados gastados; place sagrado. *Su forma exacta no debe cambiar nunca.*
- **A3 · El personaje misterioso (protagonista):** figura oscura, **rostro y cuerpo NO
  distinguibles** (silueta/sombra, capucha). Es un/a joven. Aparece en el Acto 4.
- **A4 · La isla:** isla con el Hoyo en su centro.
- **A5 · Las raíces de corrupción:** raíces grises→negras que salen del Hoyo y pudren todo.

### Paso B — Genera cada escena adjuntando las anclas que le tocan.
En Nano Banana: sube A1 (+ A2/A3/A4/A5 según la escena) y termina el prompt con:
> *"Mantén EXACTAMENTE el mismo estilo, paleta y diseño de las imágenes de referencia
> (mismo Hoyo / mismo personaje / misma isla). Encuadre 16:9. Sin texto en la imagen."*

### Paso C — Encadena.
Para variantes de una misma escena (p.ej. "lo gris se expande" en 4 pasos), usa la imagen
anterior como referencia y pide solo el cambio. Así el diseño se hereda.

### El "arco de dessaturación" (truco narrativo + consistencia)
El mundo **pierde el color a medida que pierde la virtud**. Es tu aliado:
- **Acto 1 (devoción):** cálido, colores vivos, luz dorada.
- **Acto 2 (abandono):** colores apagándose, entra el gris.
- **Acto 3 (decadencia):** gris dominante, apenas manchas de color.
- **Acto 4 (colapso):** casi monocromo gris, solo el Hoyo o una lágrima conservan tinte.

Esto además unifica visualmente todo aunque cada escena sea distinta.

---

## 3. Biblia de Estilo (el "sufijo" que repites en cada prompt)

**Sufijo de estilo (pégalo al final de CADA prompt):**
> *"Estilo: ilustración cinematográfica de pixel-art detallado, paleta limitada y sombría,
> luz dramática, grano sutil, sensación de fábula oscura/melancólica. Encuadre horizontal
> 16:9. SIN texto, SIN letras, SIN marcas de agua, SIN logos. Composición limpia que deje
> aire abajo para subtítulos."*

- **Relación de aspecto:** 16:9 (todas iguales).
- **Motivo recurrente:** el **gris/raíces** = corrupción; el **dorado/cálido** = la devoción perdida.
- **Regla de personajes:** rostros poco detallados salvo cuando importe; el protagonista
  del Acto 4 **siempre en sombra, sin rostro**.
- **Violencia:** siempre **implícita/silueta**, nunca explícita ni gore (tono + filtros).

---

## 4. Guion Visual — Shotlist (66 planos)

> Formato: `Nº — descripción del plano` · *(anclas a adjuntar)*. Añade siempre el sufijo de estilo.

### ACTO 1 — La devoción (cálido, colores vivos)
1. Una mujer camina llevando una cesta de frutos hacia el Hoyo, en ofrenda; luz dorada, campo fértil. *(A1, A2)*
2. La misma mujer lanza los frutos dentro del Hoyo, gesto de gratitud. *(A1, A2)*
3. Niños y adultos rezan arrodillados alrededor del Hoyo, en comunidad, esperanza. *(A1, A2)*
4. Un grupo de niños repite el rito: agradecen y rezan al Hoyo, imitando a los mayores. *(A1, A2)*
5. Ya menos personas rezan al Hoyo; el grupo es más pequeño, la luz más fría. *(A1, A2)*
6. Solo una viejita hace el último gesto de rezar al Hoyo, sola. *(A1, A2)*

### ACTO 2 — El abandono y la corrupción del Hoyo (el color se apaga)
7. El Hoyo, vacío; ya nadie reza. Silencio, hierba marchitándose. *(A1, A2)*
8. Del Hoyo empiezan a brotar **raíces grises**. *(A1, A2, A5)*
9. Raíces ennegrecidas empiezan a rodear el Hoyo. *(A1, A2, A5)*
10. Plano amplio de una **isla**. *(A1, A4)*
11. En el centro de la isla, el Hoyo ya muy rodeado de raíces grises; la naturaleza alrededor pudriéndose. *(A1, A2, A4, A5)*
12. El **mar ahoga la isla**; el agua la traga. *(A1, A4)*

### ACTO 3 — El mundo se vuelve gris (decadencia social)
13. Plano del **planeta** (el mundo) desde el espacio. *(A1)*
14. En varias partes del mundo aparecen **zonas grises** que se forman sobre el planeta. *(A1, A5)*
15. La cámara se acerca a una de esas zonas grises. *(A1, A5)*
16. Una persona asustada escondida de una **balacera entre bandas** (siluetas, implícito). *(A1)*
17. **Guerra civil**: siluetas de militares frente a ciudadanos, tensión, humo. *(A1)*
18. **Guerra entre dos países**: dos ejércitos enfrentados, banderas rotas, silueta. *(A1)*
19. Una **bomba nuclear**: una pareja de espaldas mira acercarse la onda expansiva. *(A1)*
20. Gente **enferma por una pandemia** incurable; hospital saturado, tono desesperanzado. *(A1)*
21. Una familia de una religión se muestra **superior** y mira con desprecio a otras personas de otra religión (vestimentas distintas). *(A1)*
22. *(SÍMBOLO)* Unas manos adultas en sombra guían las pequeñas manos de un niño sobre un arma; todo en silueta oscura, sin rostros. *(A1)*
23. Un adulto **tira basura** en la calle e **ignora** a alguien que pide comida sentado en la acera. *(A1)*
24. *(SÍMBOLO)* Un **líder de secta** en un púlpito con brazos abiertos ante una masa de siluetas que se inclinan hacia un abismo; ominoso, no explícito. *(A1)*
25. *(SÍMBOLO — sensible)* Una figura con sotana proyecta una **sombra alargada y amenazante** sobre una **florecita blanca que se marchita**, tras una puerta entreabierta. NADA explícito ni figura infantil. *(A1)*
26. Una persona frente al móvil rodeada de **burbujas de comentarios de odio** por su apariencia/creencias; rostro herido, luz azulada de pantalla. *(A1)*
27. Un hombre mayor cansado busca trabajo con su currículum en mano; al fondo, **largas colas** de gente buscando empleo. *(A1)*
28. *(implícito)* Un niño se **tapa los oídos** en primer plano; al fondo, en sombra, la silueta de violencia doméstica. Sin golpes visibles. *(A1)*
29. Una viejita **pide dinero** en la calle, encogida por el frío. *(A1)*
30. Un joven recibe **un par de monedas** tras 16 horas como operador en una fábrica gris. *(A1)*
31. *(implícito)* Una persona **chantajea/amenaza** a su pareja exigiéndole dinero mensual; gesto de coacción, ambiente opresivo. *(A1)*
32. Jóvenes **fumando/drogándose** en un colegio; profesores al fondo con cara de terror, obligados a "no ver". *(A1)*
33. Un recorte de **noticia**: un profesor asesinado camino al trabajo (escena de calle con cinta policial; el texto de la nota lo ponemos luego en Godot, no en la imagen). *(A1)*
34. Una hinchada **xenófoba** lanza un vaso a una persona de espaldas que lleva una **bandera de Ecuador**; agresión de multitud. *(A1)*
35. *(implícito)* Adultos aparentemente millonarios charlan en un salón lujoso; a través de una puerta al fondo, en sombra, se intuyen **niños secuestrados**. Sin detalle explícito. *(A1)*
36. Ancianos en un salón misterioso ante un **mapamundi con alfileres** rojos/azules/amarillos/verdes, repartiéndose países; aire conspirativo. *(A1)*
37. Un joven **absorto en videojuegos** en penumbra, mientras por la ventana se ven niños jugando afuera bajo el sol. *(A1)*
38. Un padre **increpa a un profesor** en un pasillo escolar, señalándolo con el dedo; el profesor a la defensiva. *(A1)*
39. Un funcionario recibe un **sobre (coima)** por debajo de una ventanilla, para amañar un concurso público de energía. *(A1)*
40. Vecinos/familiares **rodean y protegen a un delincuente** frente a policías/militares, impidiendo su arresto. *(A1)*
41. Personas **talan árboles**; alrededor, tierra reseca y desértica. *(A1, A5)*
42. **Industrias** vierten humo/desechos que **contaminan** el ambiente. *(A1, A5)*
43. Enormes servidores/**centros de datos de IA** consumiendo ríos de agua, que se secan. *(A1, A5)*
44. Un niño **pide agua**; el padre, con gesto de resignación, indica que "está cara". *(A1)*
45. Calles **abarrotadas** de gente pidiendo dinero y vendiendo cualquier cosa para sobrevivir. *(A1)*
46. **Contraste** partido: a un lado, ricos con todos los recursos en una zona privilegiada; al otro, gente sin apenas agua ni comida. *(A1)*
47. El **mundo** cruzado por **misiles nucleares** que van y vienen entre continentes. *(A1)*
48. El **mundo impactado** por explosiones nucleares en varias partes. *(A1)*
49. El **mundo temblando**, grietas recorriéndolo. *(A1)*
50. El **gris se expande** por todo el mundo, intenso. *(A1, A5)*
51. El gris **avanza un poco más**, casi total. *(A1, A5)*
52. El mundo **completamente cubierto de gris**. *(A1, A5)*

### ACTO 4 — El sobreviviente y la caída (casi monocromo)
53. Calles destruidas, desérticas, casi sin gente; las pocas siluetas **huyen** de otras que las persiguen. *(A1, A5)*
54. Una **familia con hijos huye** de gente que quiere matarlos. *(A1)*
55. El **personaje misterioso** (sombra sin rostro) mira hacia una **loma desértica** mientras huye con su familia. *(A1, A3)*
56. **Zoom** en la loma: a lo lejos se ve el **Hoyo**; el personaje se queda mirándolo. *(A1, A2, A3)*
57. La familia sigue huyendo y encuentra una **casa destruida** para esconderse. *(A1, A3)*
58. Gente armada **amenaza a los padres**, mientras los tres niños (el pequeño, la pequeña y el personaje misterioso) se esconden dentro de una **caja grande**. *(A1, A3)*
59. Primer plano de **una mano abriendo la caja** desde dentro. *(A1)*
60. **POV del personaje**: ve a lo lejos a sus **padres asesinados** (implícito, en sombra). *(A1, A3)*
61. **POV del personaje** corriendo, tomado de la mano de sus hermanos; **visión borrosa por el llanto**. *(A1, A3)*
62. Corren hacia la **loma** donde vio el Hoyo a lo lejos. *(A1, A2, A3)*
63. Los niños tomados de las manos; a lo **muy lejos**, sus perseguidores. *(A1, A3)*
64. **POV del personaje** (de la mano de sus hermanos) mirando el **Hoyo**: se ven sus pies y el **borde** del Hoyo. *(A1, A2, A3)*
65. Deciden **lanzarse** al Hoyo. *(A1, A2, A3)*
66. **Cayendo** al vacío, ojos cerrados, **gritando de miedo**. *(A1, A3)*

→ *Aquí enlaza con el videojuego (la intro/encuentro que ya construimos: la lluvia, la
cueva, la niña).*

---

## 5. Cómo lo mostraremos en Godot (para después)

Cuando tengas las imágenes, te construyo un **reproductor de estampas** (parecido a la
intro): muestra cada imagen a pantalla completa con un **subtítulo debajo** (fuente
Silkscreen), avanza con Espacio/toque o con temporizador, funde entre escenas y al final
carga la intro del juego. El **texto lo escribes tú en Godot**, escena por escena — no se
genera en la imagen.

---

## 6. Realidades de contenido (importante)

- Los generadores **rechazan** gore explícito, violencia gráfica y cualquier menor en
  contexto dañino. Por eso varias escenas van **por silueta/símbolo** (marcadas arriba):
  además de pasar filtros, quedan más sobrias y potentes.
- La escena del abuso (25) va **solo como símbolo**; no se hará ninguna versión que muestre
  a una menor de forma sexualizada.
