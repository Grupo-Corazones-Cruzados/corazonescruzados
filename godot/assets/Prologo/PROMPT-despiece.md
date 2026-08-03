# Prompt para la estampa del despiece (para probar en otra herramienta)

> Qué se busca: los tres hermanos, ya despiezados, en el interior del Hoyo. Todas las
> partes de sus cuerpos sueltas y esparcidas, **menos cuatro brazos con sus manos**, que
> siguen agarrados de dos en dos (cada brazo del hermano mayor sujetando el de un pequeño).
>
> Por qué está aquí: con Gemini/Nano Banana no se consigue. Al nombrar las partes las
> recoloca en su sitio y devuelve los cuerpos enteros (escenas 126 y 127); al describirlas
> como formas abstractas deja de parecer un cuerpo (escena 128). Ver `Videojuego.md` §4.41.

---

## Versión A — con imagen de referencia (recomendada)

Adjunta `assets/Prologo/escenas/escena_94.png` (o la 97) y pega esto:

```
Toma la imagen adjunta como referencia SOLO del escenario y del estilo de dibujo.

ESTILO Y ESCENARIO (copiar tal cual): ilustración en PIXEL ART 2D de 16 bits dibujada a
mano, con sombreado plano por zonas, contornos definidos, píxeles visibles y dithering
sutil. Encuadre horizontal 16:9. Misma posición de cámara, mismo plano general y lejano y
misma perspectiva que la referencia. El lugar es el interior de un pozo de roca: pared de
roca cuarteada oscura cubriendo el fondo, un halo de luz redondo y grisáceo en el centro
y penumbra que oscurece hacia las cuatro esquinas. Paleta monocroma de grises fríos,
blancos y negros. No hay suelo. Todas las figuras son siluetas negras macizas y planas,
sin detalle interior: sin caras, sin ojos, sin pliegues, sin sombreado.

QUÉ SE VE: los restos de tres personajes que se han despiezado en el aire — un hermano
mayor (el más alto), una hermana pequeña (falda acampanada y coletas) y un hermano
pequeño (silueta recta, pantalón, pelo corto).

LAS PARTES SUELTAS: en la franja central del cuadro, donde estaban los tres, flotan
sueltas y separadas todas las partes de sus cuerpos: las cabezas (una con coletas, dos
con pelo corto), los torsos (uno con camiseta recta y otro con la tela acampanada de la
falda), las piernas enteras y partidas, los pies con sus zapatos, y esquirlas sin forma
clara. Las del hermano mayor son visiblemente más grandes que las de los pequeños.

CÓMO SE COLOCAN — lo más importante: cada parte está GIRADA en un ángulo cualquiera
(muchas de lado, otras boca abajo, otras en diagonal) y DESPLAZADA lejos de donde le
correspondería en un cuerpo. Ninguna cabeza sobre un torso, ningún torso sobre unas
piernas, ningún pie debajo. Están todas separadas entre sí, sin tocarse, con el fondo de
roca visible entre unas y otras: hay más hueco vacío que parte. Es un montón de piezas
esparcidas por el aire, no un muñeco montado. Repártelas por toda la anchura y toda la
altura de esa franja, algunas ya alejándose hacia el borde del halo.
PROHIBIDO dibujar a ninguno de los tres entero o reconocible como persona. Si al terminar
se puede seguir con la vista la silueta de un cuerpo uniendo las piezas, está mal.

LOS CUATRO BRAZOS — lo único que sigue unido, y tiene que verse claramente: en medio de
todo eso hay exactamente CUATRO brazos con sus CUATRO manos, agarrados de dos en dos, en
DOS parejas.
· Pareja de la izquierda: un brazo largo y grueso (el del hermano mayor) que termina en
  una mano, y esa mano agarra la mano de un brazo corto y delgado (el de la hermana).
· Pareja de la derecha: otro brazo largo y grueso del hermano mayor agarrando la mano de
  otro brazo corto y delgado (el del hermano pequeño).
El brazo largo mide aproximadamente el doble que el corto y es claramente más ancho: a
simple vista se tiene que distinguir cuál es el del mayor y cuál el del pequeño. Las
manos están cerradas una sobre otra, unidas, sin separación.
Cuenta antes de terminar: dos parejas × dos brazos = cuatro brazos y cuatro manos, y dos
puntos de agarre. Ni uno más ni uno menos.
Estos cuatro brazos son lo único entero y nítido de la imagen: negro macizo, contorno
limpio, sin roturas. Están sueltos en el aire y se cortan en seco por el extremo del
hombro: de ahí no sale ningún hombro, cuello, cabeza ni torso, y no están pegados a
ninguna de las otras partes.

ADEMÁS: entre las partes hay polvo — puntitos y cuadraditos negros sueltos de unos pocos
píxeles, repartidos de forma irregular, más denso en unos sitios y más ralo en otros, sin
ningún centro. Nada de una bola o esfera que suelte partículas. El polvo está quieto: sin
estelas de movimiento ni partículas disparadas.

PROHIBIDO: caras, ojos o detalle interior en las piezas; sangre, líquidos, manchas rojas
o salpicaduras; cualquier color que no sea gris, blanco o negro; cualquier texto, letra,
número o marca de agua.
```

## Versión B — sin imagen de referencia

Si la herramienta no admite referencia, sustituye el primer párrafo por este y deja el
resto igual:

```
Ilustración en PIXEL ART 2D de 16 bits dibujada a mano, estilo de videojuego (referencias:
Undertale, Sea of Stars), con sombreado plano por zonas, contornos definidos, píxeles
visibles y dithering sutil. NADA de render 3D ni aspecto fotorrealista. Encuadre
horizontal 16:9. Vista frontal del interior de un pozo de roca, en plano general y lejano:
pared de roca cuarteada oscura cubriendo todo el fondo, un halo de luz redondo y grisáceo
en el centro del cuadro y penumbra que oscurece hacia las cuatro esquinas. Paleta monocroma
de grises fríos, blancos y negros. No hay suelo. Todas las figuras son siluetas negras
macizas y planas, sin detalle interior.
```

---

## Si la herramienta también lo esquiva

Dos salidas que ya han funcionado en este proyecto:

1. **Partir la escena en dos** (regla §4.36): una imagen solo con las partes esparcidas y
   otra solo con los cuatro brazos agarrados sobre el mismo fondo, y montarlas después.
2. **Componer por código** (regla §4.36-ter): coger las partes de una tirada y los brazos
   de otra y pegarlos sobre el fondo. Con el mismo encuadre y la misma luz, la costura no
   se nota.
