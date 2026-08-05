# Ilustraciones de los pasos — cómo se piden

> Las escenas que acompañan a cada paso de un tema en `/negocio/<puerta>`.
> La primera tanda (Progreso · «Cómo funciona») salió bien con estas instrucciones, así que
> se conservan **literales**: cambiar el bloque de estilo es cambiar el aspecto de todas.

## El bloque de estilo — va SIEMPRE al principio

> Ilustración vectorial de línea, minimalista y geométrica, **sobre fondo transparente**.
> Trazo uniforme de 2 px, extremos y uniones redondeados, sin relleno salvo toques planos de violeta.
> **Paleta estricta:** líneas en violeta claro `#a78bfa`; superficies rellenas en violeta `#7B5FBF` al 20-30 % de opacidad; el fondo de la web es `#0b0d14` (casi negro azulado), así que la ilustración debe leerse sobre oscuro.
> **Prohibido:** degradados, sombras, brillos, efecto 3D, perspectiva isométrica, blanco puro, texturas, y **cualquier texto, letra o número dentro de la imagen**.
> Emparentado con los iconos de Lucide, pero un paso más elaborado: **una escena pequeña, no un pictograma**.
> Composición **cuadrada**, centrada, **con bastante aire por abajo**, y que siga entendiéndose a 240 px de ancho.

## Requisitos técnicos

> Formato PNG con canal alfa, 1024 × 1024 px o más, un solo objeto centrado, sin marco ni
> recuadro alrededor, sin firma.

## Las cuatro reglas que se aprendieron por las malas (2026-08-04)

1. **Pídelas una a una y en la MISMA conversación.** En conversaciones distintas salen tres
   estilos distintos. Es el mismo problema de consistencia que el prólogo del videojuego.
2. ~~Deja aire abajo por la marca de Gemini.~~ **YA NO HACE FALTA RECORTAR** (Fernando,
   2026-08-04): las imágenes vienen sin la estrella. Y aunque venga —pasó con una de la
   última tanda, en gris tenue—, **la limpieza se la lleva sola**: al dejar invisible todo
   lo que no es violeta, una marca neutra desaparece con el fondo.
   `scripts/recortar-marca.mjs` se conserva por si vuelve a aparecer sobre el dibujo, donde
   la limpieza no podría distinguirla.
3. **Nómbralas bien al guardarlas.** En la primera tanda, la 1 y la 3 se guardaron
   intercambiadas y solo se vio al componerlas en orden para revisarlas.
4. **⚠️ NO las mandes por el chat: déjalas en `public/negocio/`.** Unas veces llegan y
   otras no, y cuando llegan pueden convertirse a JPEG y perder la transparencia.
5. **El fondo puede venir con un damero incrustado** — píxeles semitransparentes de
   verdad, que sobre el fondo del sitio se notan. Se limpia al pasarlas a WebP dejando
   invisible todo lo que no es violeta. Eso además las baja de ~2,5 MB a ~15 kB, que es lo
   que permite publicarlas sin cargarse la velocidad de la página.

## Dónde dejarlas

`public/negocio/`, con el nombre del paso. El original recortado se archiva en
`documentos-negocio/arte-negocio/` y en la web va la versión WebP limpia.

---

## Tanda 1 — Progreso · «Cómo funciona» ✅ hecha

1. **Lo publicas** — Una tarjeta de requerimiento vista de frente, ligeramente elevada, con tres ranuras marcadas dentro: un símbolo de moneda, un cuadradito de calendario y una etiqueta con forma de marcador. Una flecha limpia sale de la tarjeta hacia arriba, indicando que se publica.
2. **Lo toma quien sabe hacerlo** — Una tarjeta de perfil con un círculo de avatar sencillo y una insignia con forma de estrella o rombo, alcanzando la misma tarjeta de requerimiento que flota al lado. Un reloj pequeño en una esquina sugiere disponibilidad.
3. **Lo sigues sin arrear** — Una línea de tiempo horizontal con marcas regulares de días y una bandera al final. Sobre la línea, dos burbujas de conversación pequeñas y un tic de comprobado en el último tramo.

## Tanda 2 — Progreso · «De la idea al proyecto» ⏳ pendiente

1. **Hablas con un talento** — Dos burbujas de conversación enfrentadas. Dentro de la de la izquierda, una bombilla sencilla y geométrica (la idea); dentro de la de la derecha, una hoja de documento con dos renglones y una moneda pequeña al pie (la cotización). Nada más: las dos burbujas y su contenido.
2. **Negocias el presupuesto** — Una balanza de dos platos, muy geométrica y simétrica. En el plato izquierdo una moneda; en el derecho una hoja de documento. El fiel de la balanza, centrado y en equilibrio. Dos flechas cortas convergen hacia el centro desde los lados, indicando que las dos partes se acercan.
3. **El responsable toma el control** — Una tarjeta de perfil con avatar e insignia en el centro, algo mayor que el resto. De ella salen tres líneas rectas hacia tres círculos de avatar más pequeños, colocados en abanico a su alrededor. En una esquina, una cartera o bolsa pequeña con una moneda, que representa el presupuesto que gestiona.
