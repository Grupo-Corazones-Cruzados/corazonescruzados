#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de estampas del prólogo de GCC World (estilo Undertale) con la API de
Gemini ("Nano Banana"). Mantiene la consistencia generando primero 5 "anclas"
(estilo, Hoyo, personaje, isla, raíces) y adjuntándolas como referencia en cada
escena.

--------------------------------------------------------------------------------
REQUISITOS
    pip install google-genai pillow

    Consigue una API key en https://aistudio.google.com/apikey y expórtala:
        export GEMINI_API_KEY="tu_key"

USO
    # 1) Genera las anclas (si faltan) y TODAS las escenas que falten:
    python tools/generar_estampas.py

    # 2) Regenera solo algunas escenas (por número), p. ej. 10 y 25:
    python tools/generar_estampas.py 10 25

    # 3) Regenera las anclas:
    python tools/generar_estampas.py --anchors

    # 4) Fuerza regenerar aunque el archivo ya exista:
    python tools/generar_estampas.py 10 --force

SALIDA
    godot/assets/Prologo/anclas/A1..A5.png
    godot/assets/Prologo/escenas/escena_01.png ... escena_66.png
    (cada imagen guarda su prompt en un .txt al lado, como registro)

NOTA: el ID del modelo puede cambiar con el tiempo. Si Google actualiza el
nombre, ajusta MODELO abajo con el que veas en AI Studio (p. ej.
"gemini-3-pro-image-preview" o "gemini-2.5-flash-image").
--------------------------------------------------------------------------------
"""

import os
import sys
import time
from io import BytesIO
from pathlib import Path

try:
    from google import genai
    from google.genai import types
    from PIL import Image
except ImportError:
    sys.exit("Falta instalar dependencias:  pip install google-genai pillow")

# --- Modelo (ajústalo si Google cambia el nombre) ---------------------------
MODELO = "gemini-2.5-flash-image"   # "Nano Banana". Pro: "gemini-3-pro-image-preview"

# --- Carpetas de salida (dentro del proyecto Godot) -------------------------
BASE = Path(__file__).resolve().parent          # .../godot/tools
DIR_ANCLAS = BASE.parent / "assets" / "Prologo" / "anclas"
DIR_ESCENAS = BASE.parent / "assets" / "Prologo" / "escenas"

# --- Estilo obligatorio que se pega a CADA prompt ---------------------------
ESTILO = (
    " || ESTILO OBLIGATORIO: ilustración 2D en PIXEL ART dibujada a mano, estilo de "
    "videojuego 2D de 16 bits (referencias: Undertale, Sea of Stars, Hyper Light Drifter, "
    "Owlboy): sombreado plano por zonas, contornos definidos, paleta limitada y sombría, "
    "dithering sutil, atmósfera de fábula oscura y melancólica. Vista 2D plana (de lado o "
    "cenital de RPG). "
    "PROHIBIDO ABSOLUTAMENTE: estilo Minecraft, voxels, cubos, bloques 3D, render 3D, "
    "isométrico con cubos o cualquier cosa que parezca tridimensional. Debe verse como un "
    "DIBUJO 2D, no como un mundo 3D. "
    "Relación de aspecto 16:9 horizontal. "
    "PROHIBIDO cualquier texto, palabra, letra, número, título, subtítulo, cartel, firma o "
    "marca de agua: la imagen NO debe contener NINGÚN texto. "
    "Respeta EXACTAMENTE el mismo estilo, paleta y diseño de las imágenes de referencia."
)


# --- Estampas AÑADIDAS después de las 66 originales -------------------------
# Para NO renumerar 66 archivos ya aprobados (y no romper sus .import ni el
# historial de git), las estampas nuevas se numeran a partir de 67. Aquí se
# anota DETRÁS DE QUÉ escena va cada una en el relato: ese número es el que
# manda para el color/tono del arco de dessaturación.
# El ORDEN REAL en que se ven se decide en Godot (Prologo.gd → TRAMOS), no aquí.
INSERTADAS = {
    67: 3,   # la noche de convivencia alrededor del Hoyo va justo tras la 3
    68: 3,   # la aldea se va a dormir a sus casas, justo tras la 67
}


def tono(n: int) -> str:
    """Arco de dessaturación: el mundo pierde color según pierde virtud."""
    n = INSERTADAS.get(n, n)   # una estampa insertada hereda el tono de su sitio
    if n <= 6:      # Acto 1 — devoción
        return " Colores cálidos y vivos, luz dorada, esperanza."
    if n <= 12:     # Acto 2 — abandono
        return " Colores apagándose, entra el gris, melancolía."
    if n <= 52:     # Acto 3 — decadencia
        return " Gris dominante, apenas manchas de color, desesperanza."
    return " Casi monocromo gris, frío, solo detalles con tinte."  # Acto 4 — colapso


# --- Referencia de ESTILO: la escena que aprobó Fernando (se pasa a todo) ----
ESTILO_REF = "assets/Prologo/escenas/escena_53.png"

# --- Las ANCLAS (referencias maestras) --------------------------------------
# Cada ref puede ser el nombre de otra ancla, o una ruta a un .png (p. ej. la
# escena_53 de estilo). Se generan en orden; "isla" usa "hoyo" y "raices".
ANCLAS = {
    "hoyo": ([ESTILO_REF],
        "HOJA DE REFERENCIA — EL HOYO. Un agujero natural, oscuro e insondable, abierto "
        "en la tierra como si el suelo se hubiera partido sin explicación. NO es un pozo "
        "ni una alcantarilla: NO tiene muros, ni ladrillos, ni cemento, ni piedras "
        "colocadas, ni borde construido por el hombre. Solo un boquete de tierra y roca "
        "cruda, con el interior en negro absoluto, insondable. Suelo árido alrededor. "
        "Vista ligeramente cenital. Fondo sobrio."),

    "personaje": ([ESTILO_REF],
        "HOJA DE REFERENCIA — EL PROTAGONISTA (es el jugador). Una persona de pie, de "
        "complexión normal, PERO renderizada de modo que sea IMPOSIBLE reconocer NADA de "
        "ella: ni el rostro, ni los rasgos, ni el cuerpo, ni la ropa, ni si es hombre o "
        "mujer, ni su edad. NO lleva capa, NI capucha, NI se cubre con las manos: es una "
        "persona normal a la que la propia luz de la imagen deja como una SILUETA "
        "completamente negra, un vacío con forma humana a contraluz. Ningún detalle "
        "visible. Fondo neutro. Mismo estilo de dibujo de personajes que la referencia."),

    "raices": ([ESTILO_REF],
        "HOJA DE REFERENCIA — LAS RAÍCES DE LA CORRUPCIÓN. Raíces retorcidas de color gris "
        "ceniza que se ennegrecen en las puntas, brotando de la tierra y pudriendo la "
        "naturaleza a su alrededor. Es el mal que se expande desde el Hoyo. Fondo sobrio."),

    "isla": ([ESTILO_REF, "hoyo", "raices"],
        "HOJA DE REFERENCIA — LA ISLA. Una isla MUY GRANDE y amplia en medio del mar. En "
        "un punto de ella se ve el Hoyo (un agujero natural oscuro en la tierra, sin muros "
        "de piedra), PEQUEÑO en proporción a la isla enorme. Alrededor del Hoyo, raíces "
        "grises que empiezan a extenderse por el terreno. Vista amplia y elevada."),

    "contexto": ([ESTILO_REF],
        "HOJA DE REFERENCIA DE TONO — CRUDEZA REALISTA. Una escena cruda y realista con "
        "PELIGRO REAL y contexto claro, con el mismo dramatismo y sentido aventurero de la "
        "imagen de referencia: figuras adultas armadas con armas de fuego amenazando en "
        "una calle en ruinas, tensión palpable, atmósfera sombría. Sirve para fijar el "
        "nivel de crudeza y detalle realista de la serie (nada de símbolos vacíos)."),
}


# --- Las 66 escenas: (nº, [anclas], prompt) ---------------------------------
ESCENAS = [
    # ACTO 1 — La devoción
    (1, ["hoyo"], "Una mujer campesina camina llevando una cesta de frutos hacia el Hoyo (un agujero natural oscuro en la tierra, SIN muros de piedra), para dejarlos como ofrenda. Campo fértil y verde, luz dorada del atardecer, ambiente de gratitud y respeto."),
    (2, ["assets/Prologo/escenas/escena_02.png"],
        "EDITA la imagen de referencia. CONSERVA TODO EXACTAMENTE IGUAL (no cambies nada): la "
        "misma mujer campesina arrodillada al borde del Hoyo volcando su cesta con unos pocos "
        "frutos que caen DENTRO del agujero natural oscuro, el mismo campo verde florido, la "
        "misma luz dorada de atardecer y el mismo estilo de dibujo. ÚNICO CAMBIO: AGREGA a lo "
        "LEJOS, en el fondo y hacia los BORDES/márgenes de la imagen, algunas figuras "
        "PEQUEÑAS y distantes de aldeanos —FAMILIAS: adultos caminando junto a sus NIÑOS— que "
        "se ACERCAN caminando por el campo hacia el Hoyo, viniendo a la ofrenda. Son pocas, "
        "pequeñas y simples, en la MISMA escala y estilo que el resto de la serie. No "
        "modifiques a la mujer del primer plano ni el resto de la escena: solo suma esas "
        "familias acercándose a lo lejos, para que se entienda que la comunidad está llegando."),
    (3, ["assets/Prologo/escenas/escena_02.png", "hoyo"],
        "MISMO lugar y estilo que la imagen de referencia: el MISMO campo verde y florido, "
        "el MISMO Hoyo (agujero natural oscuro en la tierra, SIN muros de piedra) y la MISMA "
        "luz dorada del atardecer. Plano un poco más amplio. Ahora un GRUPO de aldeanos "
        "—varios adultos y también NIÑOS, con ropa campesina humilde de tonos tierra y "
        "pañuelos— están ARRODILLADOS formando un semicírculo ALREDEDOR del borde del Hoyo, "
        "de cara al agujero, con las cabezas inclinadas y las manos juntas en oración "
        "reverente. Ambiente de comunidad, fe y esperanza, sereno y cálido. Se ve el Hoyo "
        "en el centro y la gente rezando en torno a él. Deben verse CLARAMENTE VARIOS NIÑOS "
        "pequeños (de distintas edades) arrodillados junto a sus padres, como familias que "
        "transmiten la costumbre a sus hijos. Mantén IDÉNTICO el estilo de dibujo de "
        "personajes, los colores y el lugar de la referencia."),
    # --- INSERTADA: va justo DESPUÉS de la 3 (mismo escenario, ahora de noche) ---
    (67, ["assets/Prologo/escenas/escena_03.png", "hoyo"],
        "MISMO LUGAR, MISMA ESCALA y MISMO ESTILO DE DIBUJO que la imagen de referencia: el "
        "MISMO campo verde y florido, el MISMO Hoyo (agujero natural oscuro en la tierra, SIN "
        "muros de piedra, SIN ladrillos, SIN borde construido) casi CENTRADO y del MISMO "
        "TAMAÑO, y las MISMAS figuras humanas PEQUEÑAS, simples y algo distantes (sprites "
        "pequeños como los de la referencia, NUNCA primeros planos ni caras detalladas). "
        "AMBIENTE — AHORA ES DE NOCHE: cielo nocturno azul oscuro con la luna y estrellas, el "
        "campo bañado por una luz lunar plateada y fría, sombras largas azuladas. La ÚNICA "
        "luz cálida de toda la imagen sale de una FOGATA (ya NO hay atardecer dorado). "
        "QUÉ PASA — MUY IMPORTANTE: NADIE está rezando. NINGUNA figura arrodillada, NINGUNA "
        "con las manos juntas, NINGUNA inclinada hacia el Hoyo. Es una noche de convivencia "
        "de la aldea alrededor del Hoyo, gente que vive junto a él con naturalidad: "
        "(a) una FOGATA encendida a un lado del Hoyo, con llamas naranjas y un halo de luz "
        "cálida sobre la hierba; junto a ella DOS adultos COCINANDO, uno de pie removiendo "
        "con un cucharón una olla grande puesta al fuego y otro en cuclillas a su lado "
        "alcanzándole algo; "
        "(b) CUATRO NIÑOS pequeños JUGANDO y CORRIENDO alrededor del Hoyo, persiguiéndose "
        "unos a otros, con los brazos en alto y las piernas en carrera, se les nota el "
        "movimiento y la alegría; "
        "(c) TRES adultos DE PIE conversando en corrillo, de cara unos a otros, uno de ellos "
        "gesticulando con las manos mientras habla; "
        "(d) DOS adultos ACOSTADOS boca arriba sobre la hierba, con las manos detrás de la "
        "cabeza, mirando el cielo estrellado; "
        "(e) alguna manta extendida y una cesta en el suelo cerca de la fogata. "
        "SENSACIÓN: comunidad, calor humano, sobremesa tranquila. Nada solemne, nada triste, "
        "nada de ritual. Mantén IDÉNTICOS el trazo, la paleta y el TAMAÑO de las figuras de "
        "la referencia: lo único que cambia es la HORA (noche con fogata) y lo que HACEN."),
    # --- INSERTADA: va justo DESPUÉS de la 67 (la aldea se va a dormir) ---
    (68, ["assets/Prologo/escenas/escena_67.png", "hoyo"],
        "MISMO LUGAR, MISMA ESCALA, MISMA PALETA y MISMO ESTILO DE DIBUJO que la imagen de "
        "referencia: el MISMO campo de hierba, el MISMO Hoyo (agujero natural oscuro en la "
        "tierra, SIN muros de piedra, SIN ladrillos, SIN borde construido) en la MISMA "
        "posición y del MISMO TAMAÑO, y las MISMAS figuras humanas PEQUEÑAS y simples "
        "(sprites pequeños y distantes como los de la referencia, NUNCA primeros planos ni "
        "caras detalladas). "
        "AMBIENTE — ES MÁS TARDE, YA BIEN ENTRADA LA NOCHE: el cielo está MÁS OSCURO que en "
        "la referencia, azul casi negro, con MUCHAS más estrellas y la luna MÁS ALTA. La luz "
        "lunar plateada es ahora la luz principal de la escena, fría, con sombras largas y "
        "azuladas. La fogata ya NO arde: quedan solo BRASAS rojizas y un hilo fino de humo, "
        "con un halo de luz cálida muy pequeño y débil a su alrededor. "
        "EL ESCENARIO NO CAMBIA NADA: es EXACTAMENTE la misma zona de la referencia, un campo "
        "de hierba ABIERTO y VACÍO con el Hoyo. PROHIBIDO ABSOLUTAMENTE añadir NADA nuevo al "
        "paisaje: NI casas, NI cabañas, NI tejados, NI ventanas encendidas, NI luces, NI "
        "muros, NI vallas, NI caminos, NI carteles, NI construcciones de ningún tipo, NI "
        "siquiera muy pequeñas o muy lejanas en el horizonte. En la zona del Hoyo NO HAY NADA "
        "construido: solo hierba, flores y el cielo. El horizonte debe quedar LIMPIO, igual "
        "que en la referencia. "
        "QUÉ PASA — LA ALDEA SE ESTÁ YENDO. Esto es lo MÁS IMPORTANTE de la imagen y tiene "
        "que leerse de un vistazo: TODAS las personas están CAMINANDO, EN PLENO PASO, "
        "ALEJÁNDOSE del Hoyo y SALIENDO DEL ENCUADRE HACIA LA IZQUIERDA. "
        "DIRECCIÓN OBLIGATORIA: todo el mundo avanza HACIA LA IZQUIERDA de la imagen, con el "
        "cuerpo orientado a la izquierda, vistos de espaldas y de tres cuartos (se les ve más "
        "la espalda que la cara). El grupo va en fila hacia el lado izquierdo: los primeros ya "
        "están MUY CERCA del borde izquierdo del cuadro (alguno medio saliendo), y los "
        "últimos aún a media distancia. La MITAD DERECHA de la imagen queda prácticamente "
        "vacía de gente. "
        "OBLIGATORIO en cada figura: una pierna ADELANTADA y otra ATRASADA bien separadas en "
        "zancada, los brazos en movimiento. PROHIBIDO: figuras de pie quietas, figuras de "
        "FRENTE mirando al espectador, figuras de perfil paradas, corrillos charlando, gente "
        "sentada, arrodillada o rezando. Si una figura no está caminando hacia la izquierda, "
        "está MAL. "
        "PROHIBIDO que haya NADIE junto al borde del Hoyo: alrededor del agujero debe quedar "
        "un ANILLO de hierba COMPLETAMENTE VACÍO y solitario. "
        "(a) TRES grupos familiares, todos caminando hacia la izquierda en zancada: en uno, un "
        "adulto lleva EN BRAZOS a un niño pequeño dormido apoyado en su hombro; en otro, dos "
        "adultos cargan entre los dos una cesta y una manta enrollada; en el tercero, una "
        "persona ANCIANA encorvada camina apoyada en un bastón, sostenida del brazo por "
        "alguien más joven. "
        "(b) ÚNICA excepción a la marcha: junto al Hoyo, donde estaba la fogata, quedan unas "
        "BRASAS rojizas con un hilo fino de humo y UN adulto en cuclillas de espaldas "
        "recogiendo la olla. Es la ÚNICA figura que no camina, y ya está de salida. "
        "(c) DOS niños caminando de la mano detrás de sus padres, algo rezagados, también "
        "hacia la izquierda; UNO de esos dos niños ha GIRADO LA CABEZA hacia atrás (hacia la "
        "derecha), MIRANDO el Hoyo por encima del hombro mientras SIGUE caminando (es el "
        "único que todavía lo mira, y aun así se está yendo). "
        "SENSACIÓN: fin del día, calma, sueño, un lugar que se queda solo. Nada dramático, "
        "nada triste todavía. Mantén IDÉNTICOS el trazo, la paleta, el escenario y el TAMAÑO "
        "de las figuras de la referencia: lo que cambia es que es MÁS DE NOCHE, la fogata es "
        "solo brasas y la gente SE VA caminando hacia la izquierda."),
    (4, ["assets/Prologo/escenas/escena_01.png", "hoyo"],
        "MISMO estilo de dibujo 2D pixel-art de la primera referencia y, MUY IMPORTANTE, la "
        "MISMA ESCALA: las figuras humanas deben ser PEQUEÑAS y algo distantes, del MISMO "
        "TAMAÑO reducido que la mujer de la referencia (sprites pequeños y simples, NO "
        "primeros planos grandes ni caras detalladas). Toma AMPLIA y ELEVADA de todo el "
        "campo. COMPOSICIÓN: el Hoyo (agujero natural oscuro, SIN muros de piedra) va CASI "
        "CENTRADO, y 6 personas PEQUEÑAS lo RODEAN formando un anillo: un par detrás del "
        "agujero, un par delante y uno a cada lado, todas de cara al Hoyo, arrodilladas "
        "rezando; una deja caer una flor dentro. Son ADOLESCENTES (jóvenes, NADIE más: sin "
        "adultos ni niños) con ROPA MODERNA (sudaderas, chaquetas, jeans, zapatillas), pero "
        "dibujados PEQUEÑOS y simples EXACTAMENTE con el mismo estilo y tamaño de figura que "
        "la referencia. Cielo NUBLADO y gris (día frío). El campo alrededor, amplio y vacío."),
    (5, ["assets/Prologo/escenas/escena_01.png", "hoyo"],
        "MISMO estilo de dibujo 2D pixel-art de la referencia y la MISMA ESCALA: figuras "
        "humanas PEQUEÑAS y algo distantes, del mismo tamaño reducido y trazo simple que la "
        "mujer de la referencia (NO caras grandes ni detalladas). Toma AMPLIA y ELEVADA del "
        "campo. El Hoyo (agujero natural oscuro, SIN muros de piedra) va CASI CENTRADO. "
        "AMBIENTE: es de NOCHE, con LUZ DE LUNA — cielo nocturno oscuro azulado con una luna "
        "y estrellas, el campo bañado por una fría luz lunar plateada, sombras largas y "
        "azuladas (ya NO es de día ni atardecer dorado). Es la ÚLTIMA generación de "
        "creyentes: SOLO 4 ANCIANOS (viejitos de pelo blanco o canoso, encorvados, ropa "
        "humilde y abrigada), y NADIE más. Los 4 ancianos están arrodillados MUY CERCA, "
        "JUNTO AL BORDE MISMO del Hoyo, rodeándolo de cerca (repartidos alrededor del "
        "agujero, no dispersos por el campo), rezando con las manos juntas; uno deja caer "
        "una flor dentro. Sensación de olvido, soledad y despedida. Estilo y tamaño de "
        "figura IDÉNTICOS a la referencia."),
    (6, ["assets/Prologo/escenas/escena_01.png", "hoyo"],
        "MISMO estilo de dibujo 2D pixel-art de la referencia y la MISMA ESCALA: figura "
        "humana PEQUEÑA y algo distante, del mismo tamaño reducido y trazo simple que la "
        "mujer de la referencia (NO cara grande ni detallada). Toma AMPLIA y ELEVADA del "
        "campo. El Hoyo (agujero natural oscuro, SIN muros de piedra) casi CENTRADO y GRANDE, "
        "del MISMO TAMAÑO que en las escenas anteriores del rito (no lo hagas más pequeño). "
        "AMBIENTE — OTRA hora del día: un AMANECER FRÍO y NEBLINOSO, cielo pálido y grisáceo "
        "con niebla baja, luz tenue y fría (nada de noche con luna ni atardecer dorado). El "
        "ENTORNO ya se ve DESCUIDADO y en abandono: la hierba está MARCHITA y amarillenta, "
        "con zonas resecas y peladas, malezas secas, flores marchitas — el campo perdió su "
        "verdor y su cuidado. AHORA queda UNA SOLA persona: una ÚNICA VIEJITA (anciana de "
        "pelo blanco, encorvada, ropa humilde y abrigada), COMPLETAMENTE SOLA, arrodillada "
        "al borde mismo del Hoyo, haciendo el ÚLTIMO gesto de rezar y dejando caer una "
        "florecita dentro. NADIE más: solo ella y el vasto campo marchito y neblinoso. "
        "Soledad absoluta, el final del rito. Estilo y tamaño de figura IDÉNTICOS a la "
        "referencia."),
    # ACTO 2 — El abandono y la corrupción del Hoyo
    (7, ["assets/Prologo/escenas/escena_06.png", "hoyo"],
        "MISMO AMBIENTE que la imagen de referencia: el mismo campo MARCHITO y amarillento, "
        "el mismo AMANECER FRÍO y NEBLINOSO (cielo pálido grisáceo, bruma baja), la misma "
        "paleta apagada, el mismo estilo de dibujo 2D pixel-art y la misma escala. Toma "
        "AMPLIA y ELEVADA. El Hoyo (agujero natural oscuro, SIN muros de piedra, GRANDE, del "
        "mismo tamaño que antes) va ahora en el CENTRO del encuadre. CLAVE: NO hay NINGUNA "
        "persona — el campo está COMPLETAMENTE VACÍO, en silencio y abandono total, ya nadie "
        "viene. Y el terreno JUSTO ALREDEDOR del Hoyo se ve MÁS DEGENERADO que antes: tierra "
        "agrietada y reseca, hierba ennegrecida y muerta pegada al borde, alguna primera "
        "señal de podredumbre asomando en la orilla del agujero. Sensación de abandono, "
        "silencio y decadencia que empieza. Estilo y escala IDÉNTICOS a la referencia."),
    (8, ["assets/Prologo/escenas/escena_08.png"],
        "EDITA la imagen de referencia. CONSERVA EXACTAMENTE IGUAL: el mismo encuadre y zoom "
        "(plano general amplio, el Hoyo pequeño y centrado a lo lejos), el mismo campo reseco "
        "y marchito, las mismas raíces grises que asoman del Hoyo, el mismo estilo de dibujo "
        "y escala. ÚNICO CAMBIO: pásalo a NOCHE con LUZ DE LUNA — cielo nocturno azul oscuro "
        "con una luna y estrellas, el campo bañado en fría luz lunar plateada-azulada, "
        "sombras nocturnas, atmósfera oscura y silenciosa. No cambies el encuadre, ni el "
        "Hoyo, ni las raíces, ni el terreno: SOLO la hora (noche) y la iluminación (luz de "
        "luna)."),
    (9, ["assets/Prologo/escenas/escena_08.png", "raices"],
        "MISMA escena EXACTA que la primera imagen de referencia: la MISMA NOCHE con luna y "
        "estrellas, el MISMO encuadre amplio y el MISMO zoom, el MISMO Hoyo pequeño y "
        "centrado a lo lejos, el mismo campo bañado en luz lunar azulada, el mismo estilo de "
        "dibujo y escala. ÚNICO CAMBIO: las RAÍCES GRISES se han MULTIPLICADO MUCHÍSIMO "
        "(muchas más que en la referencia, como 4 veces más o más) y se EXTIENDEN cubriendo "
        "MUCHO MÁS terreno alrededor del Hoyo: se ramifican y se retuercen por el campo en "
        "todas direcciones, ennegreciéndose, invadiendo y pudriendo una zona amplia "
        "alrededor del agujero. Raíces gris ceniza (como en la segunda referencia), densas y "
        "extendidas. NO cambies el encuadre, el zoom, la noche ni el Hoyo: solo multiplica y "
        "expande las raíces por el terreno."),
    (10, ["raices"],
        "Vista AÉREA CENITAL (desde arriba, casi en picado) tomada desde MUY ALTO. Una isla "
        "COLOSAL y vastísima que LLENA TODO el encuadre de borde a borde: la masa de tierra "
        "ocupa prácticamente TODA la imagen (más del 90%), quedando solo finas franjas de mar "
        "oscuro en las esquinas. La isla es ENORME, árida y agrietada, de tierra grisácea-"
        "parda muerta y reseca, sin vegetación. "
        "En una zona hacia el CENTRO de esta isla inmensa está el Hoyo: un agujero natural "
        "oscuro, circular, SIN muros de piedra, PEQUEÑO en proporción a la isla gigante. PERO "
        "de ese pequeño agujero brota una RED ENORME, MUY DENSA e INTRINCADA de MUCHÍSIMAS "
        "raíces grises: DECENAS y decenas de raíces finas, retorcidas, que se ramifican una y "
        "otra vez y se extienden en TODAS direcciones cubriendo una AMPLIA región de la isla "
        "alrededor del agujero, como venas y telaraña de podredumbre que infecta el terreno. "
        "Las raíces se ennegrecen en las puntas; son ABUNDANTES y TUPIDAS (muchísimas, no un "
        "puñado), formando una gran mancha radial de corrupción alrededor del pequeño Hoyo. "
        "LO ESENCIAL: la ISLA es GIGANTESCA y llena el encuadre; el HOYO es pequeño, pero la "
        "RED DE RAÍCES a su alrededor es GRANDE, DENSA y de MUCHÍSIMAS raíces ramificadas. "
        "Ambiente sombrío y frío, crepúsculo/noche apagada, mar oscuro. Estilo 2D pixel-art "
        "detallado y consistente con la serie."),
    (11, ["assets/Prologo/escenas/escena_10.png"],
        "MISMA vista aérea cenital, mismo Hoyo central con su red densa de raíces grises, "
        "mismo estilo 2D pixel-art y mismo ambiente sombrío de la imagen de referencia. "
        "CAMBIO CLAVE: el nivel del MAR ha SUBIDO mucho y ahora la MITAD EXTERIOR de la isla "
        "está BAJO EL AGUA. Es decir: la zona de TIERRA SECA con raíces visibles se ha "
        "REDUCIDO a un DISCO CENTRAL más pequeño alrededor del Hoyo (aprox. la mitad o menos "
        "del tamaño anterior); y todo el ANILLO EXTERIOR de la isla —con la mitad exterior de "
        "la red de raíces— queda ya SUMERGIDO bajo el agua oscura: esas raíces exteriores se "
        "ven TENUES, apagadas y borrosas por debajo de la superficie del agua, con reflejos. "
        "Así se ve claramente cómo el AGUA HA AVANZADO hacia el Hoyo, cubriendo ya buena parte "
        "de las raíces, y solo falta el tramo final para llegar al agujero central (que aún "
        "sigue sobre tierra seca). Regla: el disco de tierra seca es MÁS PEQUEÑO que en la "
        "referencia y el agua rodea y cubre más raíces. Estilo y vista IDÉNTICOS a la "
        "referencia."),
    (12, ["assets/Prologo/escenas/escena_11.png"],
        "CONTINUACIÓN de la imagen de referencia: MISMA vista aérea cenital, mismo estilo 2D "
        "pixel-art y mismo ambiente sombrío y frío. Ahora el AGUA ha CUBIERTO CASI POR "
        "COMPLETO todo: la isla está prácticamente SUMERGIDA y desaparecida, y CASI TODO el "
        "encuadre es MAR/agua oscura (apenas quedan restos de tierra y puntas de raíces "
        "asomando, medio hundidos). CLAVE — en el CENTRO, donde está el Hoyo, el agua está "
        "CAYENDO y DRENÁNDOSE HACIA DENTRO del agujero: se forma un gran REMOLINO / torbellino "
        "(un maelstrom) de agua que GIRA en espiral y se PRECIPITA hacia abajo, cayendo en "
        "CASCADA dentro de la boca negra del Hoyo, tragándose el mar hacia la oscuridad del "
        "abismo. Se ven las líneas del agua girando en espiral hacia el embudo central, "
        "espuma blanca en los remolinos, y el chorro de agua desplomándose dentro del agujero "
        "negro. El Hoyo se TRAGA el océano. Detalles: agua en espiral cayendo dentro del "
        "Hoyo, embudo/vórtice central, todo lo demás inundado y oscuro. Estilo y vista "
        "IDÉNTICOS a la referencia."),
    # ACTO 3 — El mundo se vuelve gris
    (13, [],
        "El planeta Tierra visto desde el espacio: un GLOBO completo y redondo con sus "
        "continentes y océanos, flotando en el espacio oscuro y estrellado. MUY IMPORTANTE: "
        "SIN NINGÚN anillo, aro, halo ni órbita alrededor del planeta (nada de anillos tipo "
        "Saturno, ninguna línea circular rodeándolo): solamente el mundo, limpio y solo. "
        "Estilo de ILUSTRACIÓN 2D PIXEL-ART detallada, coherente con la serie (mismo trazo "
        "pixel dibujado a mano, paleta sombría y apagada, atmósfera de fábula oscura; NO 3D, "
        "NO Minecraft, NO voxels). El mundo se ve un poco apagado y sombrío pero TODAVÍA "
        "reconocible y ENTERO (aún NO está gris ni corrompido). Fondo de espacio negro con "
        "estrellas tenues. Encuadre 16:9 con el planeta centrado."),
    (14, ["assets/Prologo/escenas/escena_14.png"],
        "EDITA la imagen de referencia (el mapa del mundo). CONSERVA todo el mapa IGUAL, con "
        "sus colores normales (continentes verdes/marrones, océanos azules) y la misma vista. "
        "ÚNICO CAMBIO: AGREGA en 3 o 4 zonas PEQUEÑAS y dispersas del mapa (sobre algunos "
        "continentes) unas MANCHAS GRISES pequeñas pero CLARAMENTE VISIBLES: parches de color "
        "gris apagado/ceniza que contrastan con el verde y el azul de alrededor, mostrando "
        "que la corrupción EMPIEZA en esos puntos. Deben ser pequeñas (no cubren mucho "
        "terreno) pero perceptibles a simple vista. TODO el resto del mapa se mantiene con "
        "sus colores normales y vivos. No cambies nada más del mapa."),
    (15, ["assets/Prologo/escenas/escena_15.png"],
        "MANTÉN la MISMA vista de mapa de la imagen de referencia (todo el continente de "
        "SUDAMÉRICA con el MAR alrededor —Pacífico al oeste, Atlántico al este—, mismo estilo "
        "de mapa plano y mismos colores normales verdes/marrones). CAMBIO CLAVE en la posición "
        "de la corrupción: QUITA cualquier mancha gris que esté en el CENTRO del continente "
        "(zona amazónica/Perú), y coloca la MANCHA GRIS SOLO en el EXTREMO NOROESTE de "
        "Sudamérica —arriba a la izquierda, justo donde la costa toca el océano Pacífico y "
        "cruza la LÍNEA ECUATORIAL: ahí está ECUADOR, un país pequeño entre Colombia (arriba) "
        "y Perú (abajo)—. La mancha gris ceniza va EXACTAMENTE en esa esquina noroeste "
        "costera, CLARAMENTE VISIBLE y bien marcada, pero de tamaño acorde a un país pequeño "
        "(no enorme). El resto del continente con sus colores normales, sin gris. Mismo estilo "
        "y encuadre que la referencia."),
    (16, ["assets/Prologo/escenas/escena_01.png"],
        "USA la imagen de referencia SOLO para el ESTILO DE DIBUJO de personajes y su ESCALA: "
        "figuras PEQUEÑAS, algo distantes y de trazo simple, EXACTAMENTE el mismo estilo "
        "pixel-art de personajes de las escenas 1–3 (NO un estilo nuevo, NO caras grandes ni "
        "detalladas). La escena es un BARRIO MARGINAL POBRE de Latinoamérica en una zona gris "
        "y decadente: la CALLE es de TIERRA sin pavimentar (polvo, charcos), y las casas son "
        "HUMILDES, hechas de CAÑA/bambú y madera, con techos de zinc, muy pobres y "
        "descuidadas. Es una ESCENA CRUDA Y REALISTA de realidad social: varios PANDILLEROS "
        "(hombres, algunos SIN CAMISA con tatuajes, otros con ropa CALLEJERA de pandilla —"
        "camisetas sin mangas, gorras, pantalones anchos) están en plena BALACERA, "
        "DISPARÁNDOSE con armas de fuego reales (pistolas y fusiles) de un lado a otro de la "
        "calle de tierra, con fogonazos y casquillos. En la calle hay VARIAS PERSONAS (vecinos "
        "pobres): unos corren asustados, otros se agachan y se cubren. En PRIMER PLANO, una "
        "persona ESCONDIDA agachada tras una pared de caña, aterrada. Y en el suelo, más al "
        "fondo, hay una PERSONA CAÍDA/HERIDA por los disparos, tendida e inmóvil con algo de "
        "sangre en el piso de tierra (mostrado de forma sobria, sin gore extremo). Realismo "
        "social duro: pobreza, miedo, violencia de pandillas con víctimas reales. MANTÉN "
        "IDÉNTICO el estilo de dibujo de personajes y el TAMAÑO PEQUEÑO de figura de la "
        "referencia; solo cambian el lugar (barrio pobre de tierra y caña) y la acción."),
    (17, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y MISMA escala que la imagen de referencia "
        "(figuras pixel-art consistentes, coherentes con la serie; NO un estilo nuevo). PERO "
        "el LUGAR es distinto: una PLAZA o avenida de ciudad frente a un gran EDIFICIO de "
        "gobierno / palacio, en una zona gris y decadente, con humo y tensión en el aire. Es "
        "una escena CRUDA Y REALISTA de GUERRA CIVIL: a un lado, una MULTITUD de CIUDADANOS "
        "comunes (el pueblo: hombres y mujeres con ropa normal, algunos con palos, piedras o "
        "pancartas improvisadas) avanza furiosa y desesperada; enfrente, una LÍNEA/muro de "
        "MILITARES uniformados (cascos, escudos antidisturbios y fusiles) los contiene y "
        "reprime. Hay choque, empujones, humo de gases, alguna persona caída en el suelo. "
        "DETRÁS y PROTEGIDO por la línea de militares, en lo alto (un balcón o podio del "
        "edificio de gobierno), está un DICTADOR: un hombre con uniforme militar pomposo "
        "lleno de medallas y una banda presidencial, mirando con desdén, resguardado por sus "
        "soldados mientras el pueblo sufre. Realismo social duro: represión estatal, pueblo "
        "contra el poder. MANTÉN idéntico el estilo de personajes y la escala de la "
        "referencia; solo cambian el lugar (plaza/gobierno) y la acción."),
    (18, ["assets/Prologo/escenas/escena_17.png"],
        "MISMO estilo de dibujo de personajes/soldados y MISMA escala que la imagen de "
        "referencia (pixel-art consistente con la serie). Ahora es una GUERRA ENTRE DOS "
        "PAÍSES: un CAMPO DE BATALLA devastado en una zona gris y apocalíptica —tierra llena "
        "de cráteres, trincheras, alambre de púas, ruinas humeantes, fuego y columnas de humo "
        "negro, cielo plomizo—. DOS EJÉRCITOS enfrentados de DOS NACIONES DISTINTAS (uniformes "
        "de colores diferentes y una BANDERA nacional distinta en cada bando) chocan de frente: "
        "soldados disparando fusiles con fogonazos, cargando desde las trincheras, TANQUES de "
        "guerra avanzando y disparando, explosiones de artillería estallando por el campo, "
        "aviones o misiles cruzando el cielo a lo lejos. Por el suelo, cascos y soldados "
        "CAÍDOS (mostrado de forma sobria, sin gore extremo). Es una escena ÉPICA, CRUDA y "
        "desesperada de guerra total: destrucción, muerte y caos entre dos países. MANTÉN el "
        "estilo de personajes y la escala de la referencia; despliega toda la escala y el "
        "dramatismo de una gran batalla."),
    (19, ["assets/Prologo/escenas/escena_19.png"],
        "EDITA la imagen de referencia. CONSERVA todo IGUAL: la pareja de espaldas en primer "
        "plano, la ciudad en ruinas con sus edificios destruidos, el estilo pixel-art y la "
        "escala. ÚNICO CAMBIO: corrige el HONGO NUCLEAR para que esté ENRAIZADO EN LA TIERRA, "
        "no flotando en el cielo. Es decir: la BOLA DE FUEGO y la base del hongo deben estar "
        "A NIVEL DEL SUELO, en el HORIZONTE detrás de los edificios, y el TALLO/columna del "
        "hongo debe SUBIR DESDE EL SUELO conectando la tierra con la nube en forma de hongo "
        "de arriba. Debe verse CLARAMENTE que la bomba detonó SOBRE LA CIUDAD/EL SUELO (con "
        "el resplandor y el fuego naciendo desde el horizonte), NO una nube separada colgando "
        "en el aire. El tallo del hongo toca la tierra."),
    (20, ["assets/Prologo/escenas/escena_20.png"],
        "CONSERVA la escena de la referencia (escena_20): MISMA calle gris de ciudad, MISMO "
        "cartel/pantalla de ALERTA con el icono de VIRUS y el mapa, misma cinta de CUARENTENA, "
        "mismos CUERPOS tendidos en camillas/colchones por el suelo, mismo estilo pixel-art y "
        "escala. Es una PANDEMIA donde encontraron muchas PERSONAS MUERTAS: los cuerpos "
        "tendidos en las camillas están MUERTOS (envueltos, con mascarillas). El personal con "
        "TRAJES DE PROTECCIÓN blancos (hazmat) y máscaras está RECOGIENDO y CARGANDO los "
        "CUERPOS: unos levantan camillas, otros acomodan/trasladan los cadáveres, con las manos "
        "OCUPADAS en esa labor. "
        "CAMBIO CRÍTICO respecto a la referencia: los de TRAJE BLANCO NO LLEVAN ARMAS — QUÍTALES "
        "TODAS las armas. PROHIBIDO cualquier arma, rifle, pistola, escopeta o cosa parecida en "
        "sus manos; sus manos están VACÍAS o cargando camillas/cuerpos. Son RECOLECTORES DE "
        "CADÁVERES de la pandemia, NO soldados ni gente armada. "
        "ELEMENTO CLAVE: en un lado hay una "
        "gran PANTALLA / cartel de NOTICIERO (pantalla de TV grande o valla publicitaria) que "
        "muestra la GRAVEDAD de la pandemia mediante un ICONO GRANDE DE VIRUS (una esfera roja "
        "con púas, tipo coronavirus) y gráficos de ALERTA ROJA (barra de 'noticia urgente' "
        "roja, mapa con zonas rojas), transmitiendo que hay un VIRUS grave causando la "
        "pandemia. También símbolos de BIOSEGURIDAD (biohazard) por ahí. (No hace falta texto "
        "legible: la gravedad se entiende por los íconos de virus, la alerta roja y la "
        "bioseguridad.) Tono gris, crudo y desesperanzado. MANTÉN el estilo y la escala de la "
        "referencia."),
    (21, ["assets/Prologo/escenas/escena_16.png"],
        "MUY IMPORTANTE: las figuras humanas deben tener EXACTAMENTE el mismo ESTILO DE DIBUJO "
        "y la misma ESCALA PEQUEÑA que en la imagen de referencia (personajes pixel-art "
        "simples, pequeños y algo distantes; NO caras grandes, redondeadas ni de estilo "
        "cartoon/anime; NO un estilo nuevo). Usa una TOMA un poco más AMPLIA de la calle para "
        "que las personas se vean más pequeñas y de trazo simple, como en el resto de la "
        "serie. Escena MODERNA y REALISTA de DISCRIMINACIÓN "
        "POR RELIGIÓN en la vereda de una calle de ciudad actual. A un lado, una FAMILIA "
        "cristiana/evangélica (padre, madre e hijo con ropa MODERNA; uno sostiene una BIBLIA, "
        "llevan COLLARES DE CRUZ bien visibles) hace GESTOS de RECHAZO y DESPRECIO: señalan "
        "con el dedo, ponen cara de asco/superioridad, giran la cara, y la madre aparta y "
        "protege a su hijo como evitando un 'contagio', mirando por encima del hombro. Al "
        "OTRO lado, una FAMILIA de OTRA RELIGIÓN, claramente distinta por su VESTIMENTA y "
        "SÍMBOLOS (por ejemplo una mujer con HIYAB / velo islámico y ropa tradicional, o "
        "atuendos y adornos religiosos diferentes reconocibles), que se ve TRISTE, HERIDA y "
        "EXCLUIDA por ese rechazo, pero digna. Debe entenderse CLARAMENTE que están siendo "
        "DISCRIMINADOS por creer y vestir distinto (fanatismo e intolerancia). La escena "
        "CRITICA la discriminación: la familia rechazada es la víctima simpática. Ambiente "
        "urbano moderno, tono gris y crudo. MANTÉN el estilo y la escala de la referencia."),
    (22, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y MISMA escala pequeña/simple que la imagen de "
        "referencia (pixel-art consistente con la serie; NO caras grandes ni estilo nuevo). "
        "Escena CRUDA en un CALLEJÓN oscuro y sórdido de un barrio marginal, frente a la "
        "ENTRADA TENEBROSA de un antro/guarida (una puerta oscura, paredes con grafitis, "
        "basura, luz tenue). Un MAFIOSO adulto (hombre rudo, tatuado, con pinta de pandillero "
        "callejero, sin camisa o con ropa de pandilla) LLEVA/ARRASTRA de la mano a un NIÑO "
        "PEQUEÑO asustado, tirando de él hacia la entrada oscura del antro. El niño se ve "
        "ATERRADO y reticente, resistiéndose un poco, arrastrado hacia ese mundo criminal "
        "contra su voluntad. La escena denuncia cómo las mafias se llevan y reclutan a los "
        "niños. MUY IMPORTANTE: NO debe haber NINGÚN arma de fuego, NI droga, NI armas "
        "visibles en la imagen — la amenaza es IMPLÍCITA por el ambiente sórdido y el aspecto "
        "del mafioso. Tono oscuro, gris y perturbador. MANTÉN el estilo y la escala de la "
        "referencia."),
    (23, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y MISMA escala PEQUEÑA/simple que la imagen de "
        "referencia (pixel-art consistente; figuras pequeñas, NO caras grandes ni estilo "
        "nuevo). TOMA AMPLIA de una CALLE de BARRIO POBRE muy CONCURRIDO, CAÓTICO y "
        "DESORDENADO, en zona gris y decadente. La calle y las veredas están LLENAS DE BASURA "
        "ya botada (bolsas, cartones, desechos por todas partes). MUCHÍSIMA GENTE de bajos "
        "recursos por toda la zona: multitudes caminando, gente incluso en la calzada entre "
        "los VEHÍCULOS que pasan (autos viejos, motos, triciclos). Hay muchos VENDEDORES "
        "informales con pequeños QUIOSCOS y carritos: un puesto de LIMONADAS/jugos, un "
        "TRICICLO de HELADOS, alguien vendiendo ROPA colgada, puestitos de comida y de "
        "cualquier cosa. EN PRIMER PLANO, el foco de la escena: una PERSONA POBRE sentada en "
        "el suelo PIDIENDO DINERO/limosna (con la mano extendida o un vasito), y justo al "
        "lado otra PERSONA que TIRA BASURA al suelo e IGNORA por completo al que pide, "
        "pasando de largo con indiferencia. Ambiente de pobreza, desorden, ruido y "
        "indiferencia social. Tono gris y crudo. MANTÉN el estilo y la escala pequeña de la "
        "referencia."),
    (24, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y MISMA escala pequeña/simple que la imagen de "
        "referencia (pixel-art consistente; NO caras grandes ni estilo nuevo). Escena OSCURA "
        "y PERTURBADORA de una SECTA en un ritual de noche, en un templo lúgubre o un claro "
        "con antorchas y velas, ambiente ominoso. (NO debe haber NINGÚN hoyo, agujero ni "
        "abismo: esta escena NO tiene nada que ver con el Hoyo.) En lo alto, sobre una "
        "TARIMA/altar, el LÍDER de la secta (túnica, aire fanático y manipulador) sostiene "
        "una DAGA en alto y hace el GESTO de llevársela al pecho, DEMOSTRANDO a sus fieles lo "
        "que deben hacer. Abajo, una MASA de SEGUIDORES en túnicas, arrodillados y en trance: "
        "varios sostienen dagas contra su propio pecho a punto de obedecer, y algunos ya "
        "están CAÍDOS e INMÓVILES en el suelo (insinuados, SIN sangre ni gore explícito, solo "
        "tendidos). Es una escena que DENUNCIA la manipulación y el fanatismo que lleva a la "
        "gente a la muerte. Tono muy oscuro y trágico, pero SIN mostrar el acto de clavarse "
        "ni heridas ni sangre. MANTÉN el estilo y la escala de la referencia."),
    (25, ["assets/Prologo/escenas/escena_25.png"],
        "CONSERVA la escena de la referencia (escena_25): MISMA sala tenue de iglesia con la "
        "CRUZ en la pared, la PUERTA por la que entra un haz de luz, la figura oscura del "
        "PADRE/cura con SOTANA de pie en la puerta iluminada, la FLOR BLANCA marchita caída en "
        "el suelo bajo la luz, y su SOMBRA alargada y amenazante proyectada hacia adelante. "
        "MISMO estilo pixel-art. ÚNICO AÑADIDO: en un RINCÓN del cuarto, a un lado, se ve la "
        "SOMBRA de una NIÑA pequeña ENCOGIDA y ASUSTADA —SOLO su SOMBRA proyectada en la pared/"
        "suelo, NO se dibuja a la niña— agachada, abrazándose las rodillas, temblando de miedo, "
        "indicando que hay una niña aterrada escondida del cura. Todo SIMBÓLICO y SOBRIO, NADA "
        "explícito, ningún contacto. Tono oscuro, opresivo y triste; símbolo del abuso de la "
        "inocencia por una figura de confianza. Estilo pixel-art consistente. NADA de texto."),
    (26, ["assets/Prologo/escenas/escena_40.png"],
        "MUY IMPORTANTE — ESTILO Y DISEÑO DE PERSONAJES: usa EXACTAMENTE el mismo DISEÑO DE "
        "PERSONAJES y estilo de dibujo pixel-art de la referencia (escena_40): mismas "
        "proporciones algo robustas/estilizadas, mismo trazo, mismas caras y cuerpos dibujados "
        "de esa manera de videojuego. NO uses un estilo realista ni fotográfico ni caras finas "
        "detalladas: la persona debe verse DIBUJADA IGUAL que en la escena_40. "
        "Escena ÍNTIMA y FRÍA de ACOSO DIGITAL por la APARIENCIA (body-shaming), de NOCHE: un "
        "CUARTO oscuro y solitario, iluminado SOLO por la luz AZULADA fría de la pantalla de un "
        "móvil. Sentada sola está una MUJER de complexión MUY GRANDE / OBESA, encorvada sobre "
        "el teléfono, con la cara iluminada por la pantalla y una expresión DESTROZADA "
        "—LLORANDO, con lágrimas, profundamente herida por lo que lee—. Es la VÍCTIMA: se la "
        "retrata con DIGNIDAD y compasión mientras sufre (NADA de caricatura grotesca ni "
        "burlona). A su "
        "alrededor, saliendo de la pantalla y ABRUMÁNDOLA, flota un enjambre de BURBUJAS DE "
        "COMENTARIOS crueles de burla, con PALABRAS CORTAS de insulto bien legibles como "
        "'GORDA', 'FEA' y 'ASCO', junto a emojis burlones (caritas riéndose, pulgares abajo, "
        "caritas de enojo, emoji de vómito) y notificaciones con números enormes. La pantalla "
        "muestra su foto/publicación inundada de reacciones negativas. La escena DENUNCIA la "
        "crueldad del acoso por el físico. Tono frío, azulado, opresivo y triste. Estilo "
        "pixel-art consistente."),
    (27, ["assets/Prologo/escenas/escena_16.png"],
        "USA la referencia SOLO para el ESTILO de dibujo de personajes y su ESCALA pequeña/"
        "simple (pixel-art consistente; NO caras grandes ni estilo nuevo). Escena NATURAL y "
        "CASUAL, cotidiana, en una vereda/avenida de una zona urbana comercial gris (NO "
        "mercado de barrio, NO basura, NO mendigos). EL PROTAGONISTA: un SEÑOR MAYOR (adulto "
        "grande, pelo canoso, ropa sencilla, cara cansada) caminando DE PERFIL (vista "
        "lateral) por la vereda, sosteniendo su CARPETA con el CURRÍCULUM (unas hojas/CV), "
        "yendo de camino a buscar trabajo, algo agotado. ALREDEDOR, de forma ORGÁNICA y "
        "NATURAL (nada de filas perfectamente alineadas ni cuadrículas artificiales), se ve "
        "que en ese mismo lugar está pasando LO MISMO con otra gente: pequeñas COLAS y grupos "
        "de personas esperando de manera natural en las puertas de VARIOS negocios/locales y "
        "una oficina de empleo, todos buscando trabajo. Ambiente de precariedad laboral, pero "
        "compuesto de forma realista y casual, como una foto de la calle. Tono gris. MANTÉN "
        "el estilo y la escala pequeña de la referencia."),
    (28, ["assets/Prologo/escenas/escena_40.png"],
        "MUY IMPORTANTE — ESTILO Y DISEÑO DE PERSONAJES: usa EXACTAMENTE el mismo DISEÑO DE "
        "PERSONAJES y estilo de dibujo pixel-art de la referencia (escena_40): las MISMAS "
        "proporciones algo robustas/estilizadas, el MISMO trazo, las MISMAS caras y cuerpos "
        "dibujados de esa manera de videojuego. NO uses un estilo realista ni fotográfico ni "
        "caras finas detalladas: la gente debe verse DIBUJADA IGUAL que en la escena_40. "
        "Escenario: interior de un HOGAR humilde y pobre en penumbra (cuarto sencillo de "
        "paredes sucias y piso de madera, con una SILLA VOLCADA y un PLATO ROTO en el suelo). "
        "Escena REALISTA de VIOLENCIA DOMÉSTICA entre ADULTOS: el PADRE (hombre ADULTO), furioso "
        "y agresivo, MALTRATA a su ESPOSA (mujer ADULTA) — la agarra del brazo/la empuja y tiene "
        "el otro brazo en ALTO en actitud de golpearla, mientras ella está ENCOGIDA, aterrada, "
        "cubriéndose la cara. Violencia ADULTA realista pero SOBRIA: sin gore ni sangre "
        "excesiva, sin mostrar el golpe conectando. "
        "IMPORTANTE: los NIÑOS NO se ven directamente (no se dibujan los niños) — solo se "
        "insinúan sus SOMBRAS: las sombras de los DOS niños JUNTAS y apiñadas en UNA MISMA "
        "ESQUINA del cuarto, encogidas y escondidas juntas (los dos hermanos pegados/abrazados "
        "en el mismo rincón, tapándose, asustados). NO en esquinas separadas: las dos sombras "
        "van JUNTAS en un solo rincón. "
        "Ambiente de un hogar humilde donde reina el miedo, penumbra cálida y sucia. Estilo y "
        "diseño de personajes IGUAL a la escena_40. NADA de texto."),
    (29, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y MISMA escala pequeña/simple que la imagen de "
        "referencia (pixel-art consistente; NO caras grandes ni estilo nuevo). Escena "
        "REALISTA y triste en una VEREDA de ciudad gris y decadente MUY CONCURRIDA: MUCHA "
        "GENTE camina apurada haciendo su vida (algunos mirando el móvil, otros de paso), "
        "TODOS IGNORANDO por completo a la anciana. EN PRIMER PLANO, el foco: una ABUELITA "
        "muy POBRE sentada en el suelo contra una pared, PIDIENDO DINERO con la mano "
        "extendida y un vasito/lata. Se la ve en MUY MAL ESTADO: extremadamente delgada y "
        "demacrada, encorvada, con VESTIMENTA muy DAÑADA, rota, sucia y pobre, y una CARA de "
        "mucha HAMBRE, cansancio y tristeza. Alrededor de ella hay BASURA tirada. Nadie se "
        "detiene ni la mira: indiferencia total ante el que sufre. Tono gris, crudo y "
        "conmovedor. MANTÉN el estilo y la escala pequeña de la referencia."),
    (30, ["assets/Prologo/escenas/escena_16.png"],
        "MUY IMPORTANTE: usa EXACTAMENTE el mismo ESTILO de dibujo de personajes y la misma "
        "ESCALA PEQUEÑA y de TRAZO SIMPLE de las escenas anteriores de la serie (figuras "
        "pequeñas, NO caras grandes ni redondeadas, NO estilo nuevo). Toma un poco más "
        "AMPLIA. Escena REALISTA de EXPLOTACIÓN LABORAL en una CAMARONERA (granja de "
        "camarón): grandes PISCINAS/pozas de agua barrosa y una nave de procesamiento, cielo "
        "gris. Al FONDO se ve a OTROS CHICOS JÓVENES trabajando duro en la camaronera "
        "(cargando redes y baldes, procesando camarón en mesas, con botas de caucho y "
        "delantales). (NO pongas NINGÚN arma en la escena; nadie con armas.) EN PRIMER PLANO, "
        "TRES personajes con gestos claros: (1) un TRABAJADOR MUY JOVEN, con ropa de trabajo "
        "sucia y botas, EXHAUSTO y derrotado (encorvado, sudoroso, cara de agotamiento), que "
        "extiende su mano y recibe apenas UN PAR de MONEDAS; (2) el DUEÑO del negocio, bien "
        "vestido y con aire adinerado, que le paga esas pocas monedas mientras SOSTIENE un "
        "GRUESO FAJO de BILLETES / un maletín lleno de DINERO (tiene muchísimo, paga casi "
        "nada); (3) un SUPERVISOR/capataz explotador al lado, con gesto ABUSIVO y "
        "autoritario, gritando y señalando con desprecio a los trabajadores. Se debe entender "
        "la injusticia y el abuso. Tono gris, opresivo y crudo. MANTÉN el estilo y la escala "
        "pequeña de la referencia."),
    (31, ["assets/Prologo/escenas/escena_31.png"],
        "EDITA la imagen de referencia. CONSERVA IGUAL todo: el HOMBRE de rodillas de frente "
        "suplicando con las manos juntas, la MUJER de pie en el porche con el teléfono en "
        "alto amenazante exigiendo dinero, el entorno de la casa (porche, puerta, reja, "
        "buzón, triciclo, juguetes, macetas), el vecindario y el estilo. AGREGA TRES cosas: "
        "(1) un NIÑO PEQUEÑO (el HIJO de la señora, unos 5-7 años) DETRÁS de la mujer, en el "
        "porche, medio escondido tras las piernas de ella, asomándose tímido hacia el padre "
        "—la madre lo TAPA/bloquea para que el padre no pueda acercarse ni verlo bien—. "
        "(2) al FONDO, en la calle del barrio, unas cuantas OTRAS PERSONAS (vecinos) haciendo "
        "su vida normal o mirando de lejos lo que sucede. (3) un BOCADILLO/globo de diálogo "
        "saliendo de la MUJER con el texto en mayúsculas: \"QUIERO MÁS DINERO\". Mantén el "
        "mismo estilo de dibujo, las poses y el entorno; solo suma esos tres elementos."),
    (32, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes). TOMA AMPLIA. El lugar es un COLEGIO "
        "FISCAL que SE VE NORMAL como escuela (NO parece una cárcel): el PATIO PRINCIPAL / "
        "zona de recreo de un colegio, con el edificio escolar, ventanas normales, una cancha, "
        "árboles y bancas, algo gris pero claramente una ESCUELA cotidiana. Está LLENO de "
        "MUCHOS ESTUDIANTES NORMALES con uniforme haciendo cosas normales de recreo "
        "(conversando en grupos, caminando, sentados, jugando) — la gran MAYORÍA se ve "
        "normal. PERO, en un RINCÓN/a un costado, MEDIO ESCONDIDO detrás de una pared o "
        "columna, un PEQUEÑO grupo (3 o 4 jóvenes, el 5–10% metido en bandas) FUMA y consume "
        "a escondidas, mezclándose casi con normalidad. Cerca, DOS o TRES PROFESORES adultos "
        "(con aspecto de docente, camisa/corbata, carpetas) los VEN con cara de MIEDO e "
        "IMPOTENCIA y NO hacen nada; uno desvía la mirada. FUERA del colegio, al otro lado de "
        "la REJA/entrada, en la calle, un VENDEDOR DE DROGA con vestimenta de PANDILLA le "
        "pasa/vende algo a un estudiante a través de la reja, y alrededor de ese vendedor hay "
        "otros PANDILLEROS ya ADULTOS (hombres de 30 años o más, rudos, tatuados) de la misma "
        "banda vigilando. Tono gris y realista: la corrupción mezclada con un día de colegio "
        "casi normal. Sé muy detallista. MANTÉN el estilo y la escala pequeña."),
    (33, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes). TOMA AMPLIA, realista y detallada. "
        "AMANECER frío y gris en una CALLE de un barrio decadente (el profesor iba camino al "
        "trabajo): veredas, casas modestas, poste de luz, cables, cielo pálido. Es el MOMENTO "
        "justo tras el crimen, escena DINÁMICA con tres focos: "
        "(1) EN PRIMER PLANO yace un PROFESOR ASESINADO: hombre MAYOR con aspecto de docente "
        "(camisa, corbata, chaleco, LENTES), tendido en el suelo junto a su MALETÍN abierto y "
        "cuadernos desparramados, con una MANCHA de SANGRE roja bajo el cuerpo que deja CLARO "
        "que fue ASESINADO (no desmayado) —sangre sobria, sin heridas explícitas ni gore—. "
        "(2) ESCAPANDO en una MOTOCICLETA a toda velocidad, los SICARIOS/pandilleros que "
        "acaban de matarlo: DOS hombres JÓVENES ADULTOS con pinta callejera de banda (gorras, "
        "uno SIN CAMISA y tatuado). El que va ATRÁS sostiene una PISTOLA en la mano, pero el "
        "arma NO está disparando (SIN fogonazo, SIN destello: el profesor ya está muerto en el "
        "suelo, solo la lleva empuñada tras el crimen), y tiene la cara SERIA, fría y sin "
        "emoción. El que CONDUCE la moto, en cambio, sonríe con cinismo mientras huyen. Es el "
        "clásico SICARIATO EN MOTO. "
        "(3) A LO LEJOS, corriendo hacia el cuerpo, la HIJA del "
        "profesor (una joven) LLORANDO desesperada, con los brazos extendidos y cara de "
        "horror y sufrimiento al ver a su padre asesinado. Alrededor, los VECINOS están "
        "ASUSTADOS y aterrados (con las manos en la boca, caras de MIEDO y horror), NUNCA "
        "sonriendo. NO pongas cinta policial. Tono crudo, trágico y realista: se debe entender "
        "CLARAMENTE que la banda asesinó al profesor y huye. Sé MUY detallista con el "
        "entorno. MANTÉN el estilo y la escala pequeña."),
    (34, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes). TOMA AMPLIA, realista y detallada. Escena "
        "REALISTA de XENOFOBIA en la ZONA DE CIRCULACIÓN/PASILLO de acceso de un gran ESTADIO "
        "de fútbol (como el Estadio Azteca), NO en las gradas ni en la cancha: es el ÁREA "
        "cubierta POR DONDE LA GENTE CAMINA para luego subir y entrar al estadio, bajo la "
        "estructura de hormigón —COLUMNAS/pilares de concreto, RAMPAS, piso de cemento—, de "
        "día. MUY IMPORTANTE: el pasillo está LLENO DE GENTE POR TODAS PARTES (una multitud "
        "densa, NO un corredor infinito ni vacío al fondo): CIENTOS de hinchados MEXICANOS "
        "con camisetas VERDES de México, gorras y banderas mexicanas caminando en varias "
        "direcciones, CADA QUIEN A LO SUYO (rumbo a entrar), casi todos INDIFERENTES y SIN "
        "mirar a nadie en particular. Entre la multitud camina una PAREJA ECUATORIANA (un "
        "SEÑOR y una SEÑORA), vista de ESPALDAS/tres cuartos, con CAMISETAS AMARILLAS de "
        "Ecuador; uno lleva una BANDERA DE ECUADOR (franjas horizontales AMARILLA ancha, AZUL, "
        "ROJA, con el escudo) COLGANDO suelta sobre la ESPALDA como capa (NO anudada al "
        "cuello) y GORRA amarilla. El FOCO del acto: SOLO UNA MUJER/joven mexicana —con "
        "camiseta VERDE de México y vista DE ESPALDAS/de perfil— les ARROJA su BEBIDA (un "
        "vaso de COLA/refresco) con MALA INTENCIÓN hacia los ecuatorianos, con el LÍQUIDO "
        "salpicando por el aire; junto a ella, su pequeño GRUPO de 2-3 amigos mexicanos "
        "también hostiles y burlones. El RESTO de la multitud NO está mirando a los "
        "ecuatorianos (siguen caminando a su bola). Se entiende la HUMILLACIÓN xenófoba (la "
        "pareja ecuatoriana es la víctima). NO logos ni textos de noticiero. Multitud densa y "
        "realista por todo el pasillo. MANTÉN el estilo y la escala pequeña."),
    (35, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes). TOMA AMPLIA, realista y detallada. Escena "
        "de RIQUEZA CORRUPTA: un SALÓN LUJOSO y opulento (lámpara de araña/candelabro, "
        "sillones de cuero elegantes, mármol, cuadros caros, alfombra, mesa con copas de "
        "champán y whisky, botellas caras, humo de puros). Varios ADULTOS aparentemente "
        "MILLONARIOS (hombres y mujeres con TRAJES elegantes y vestidos caros) están sentados "
        "en los sillones CONVERSANDO relajados, riendo, brindando, totalmente INDIFERENTES y "
        "cómodos. AL FONDO, un DETALLE PERTURBADOR pero SIMBÓLICO (SIN mostrar a ningún "
        "menor): una PUERTA oscura y PESADA con REJAS/barrotes, entreabierta hacia la NEGRURA, "
        "custodiada por un GUARDAESPALDAS (calvo, traje, lentes oscuros); en el suelo, junto a "
        "esa puerta enrejada, hay unos ZAPATITOS PEQUEÑOS de niño y un PELUCHE/osito "
        "abandonados —objetos infantiles que dan a entender que hay NIÑOS SECUESTRADOS "
        "encerrados detrás, sin mostrar ninguna figura de menor—. El contraste: opulencia e "
        "indiferencia adelante, horror oculto detrás. Tono crudo. NO aparece ninguna figura "
        "de niño. Sé MUY detallista con el entorno lujoso. MANTÉN el estilo y la escala."),
    (36, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes). TOMA AMPLIA, realista y detallada. Escena "
        "CONSPIRATIVA en una SALA DE REUNIONES SECRETA pero REALISTA y BIEN DEFINIDA (NO una "
        "negrura plana): un salón elegante con paneles de madera, cortinas, una gran MESA de "
        "reuniones ovalada, e iluminación TENUE pero CLARA (una lámpara colgante ilumina la "
        "mesa, se ve bien el lugar), ambiente serio y ominoso. Alrededor de la mesa hay un "
        "grupo de personas poderosas de élite que deben ser CLARAMENTE DISTINTAS entre sí: "
        "diferentes EDADES, complexiones (delgados y corpulentos), unos CALVOS y otros con "
        "pelo o barba, distintas ETNIAS, caras y trajes variados, incluso alguna MUJER —NO "
        "todos iguales—. Sobre la mesa hay un enorme MAPAMUNDI CUBIERTO de ALFILERES de "
        "colores (ROJOS, AZULES, AMARILLOS y VERDES) clavados por TODOS los países, como si se "
        "REPARTIERAN el mundo entre ellos; señalan regiones con la MANO o con un PUNTERO/vara "
        "y mueven fichas. IMPORTANTE: NINGUNO lleva ARMAS (nada de pistolas): solo señalan y "
        "conversan. DE FONDO, PLANES CONSPIRATIVOS: pizarras/pantallas con una GRÁFICA de "
        "POBLACIÓN cayendo, diagramas de control y un ojo de vigilancia. Se entiende que unos "
        "pocos deciden en secreto el destino del mundo. Tono serio y siniestro. MANTÉN el "
        "estilo y la escala pequeña."),
    (37, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA coherente con la serie (pixel-art "
        "consistente, NO estilo nuevo). Escena de ESCAPISMO/ADICCIÓN a los videojuegos con un "
        "CONTRASTE fuerte. INTERIOR: un CUARTO/habitación OSCURO y DESORDENADO, con las "
        "cortinas casi cerradas, iluminado SOLO por la luz AZULADA fría de una gran PANTALLA "
        "de videojuegos (monitor/TV con un juego). Un JOVEN (adolescente/joven adulto, pálido "
        "y ojeroso) está sentado ENCORVADO frente a la pantalla, con AUDÍFONOS y un CONTROL/"
        "mando en las manos, TOTALMENTE ABSORTO y aislado, sin despegar la vista. A su "
        "alrededor, el DESORDEN de la adicción: montones de envolturas de comida chatarra, "
        "latas de bebida energética, ropa sucia, basura. A un LADO hay una VENTANA por la que "
        "entra LUZ SOLAR brillante y se ve el EXTERIOR: un día soleado de cielo azul donde "
        "varios NIÑOS JUEGAN afuera felices (pateando una pelota, corriendo, riendo) en la "
        "calle o un parque, llenos de vida. El CONTRASTE es clave: adentro oscuridad, "
        "aislamiento y vida desperdiciada; afuera luz, movimiento y vida real que el joven "
        "IGNORA. Tono melancólico. Sé MUY detallista con el cuarto. MANTÉN el estilo y la escala."),
    (38, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes). Escena REALISTA en un PASILLO/aula de "
        "COLEGIO (con casilleros, puertas de aula, un pizarrón al fondo). CONFLICTO: un PADRE "
        "adulto ENFURECIDO le está INCREPANDO y gritando a un PROFESOR, con gesto AGRESIVO —"
        "señalándolo con el dedo, cara roja de rabia, postura dominante—, defendiendo "
        "indebidamente a su hijo. El PROFESOR (con camisa, corbata, carpetas/libros en la "
        "mano) está a la DEFENSIVA, con gesto de exasperación e impotencia, tratando de "
        "explicarse. JUNTO al padre, protegido tras él, está su HIJO (un NIÑO de escuela) con "
        "cara de MALCRIADO/impune, sabiéndose defendido. Al FONDO, se ve a OTRO NIÑO golpeado "
        "y lloroso (la víctima a la que el hijo malcriado le pegó), para entender que el hijo "
        "sí hizo algo malo. Un BOCADILLO del padre dice: \"¡NO LE GRITE A MI HIJO!\" y otro "
        "BOCADILLO del profesor dice: \"¡HAY QUE CORREGIRLO!\". Se entiende que los padres "
        "socavan la autoridad del profesor y encubren al hijo. Tono cotidiano y tenso. Sé MUY "
        "detallista con el entorno escolar. MANTÉN el estilo y la escala pequeña."),
    (39, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo de personajes y la MISMA ESCALA PEQUEÑA/simple que hemos "
        "llevado en toda la serie (figuras pequeñas, trazo simple, NO caras grandes ni estilo "
        "nuevo). Escena REALISTA de CORRUPCIÓN/SOBORNO (coima) en una OFICINA DE GOBIERNO: un "
        "mostrador con una VENTANILLA de atención al público (vidrio con una abertura abajo), "
        "ambiente burocrático gris (archivadores, sellos, una bandera oficial, carteles). "
        "DETRÁS de la ventanilla está un FUNCIONARIO del gobierno (camisa, corbata, aire "
        "burocrático). DELANTE, un EMPRESARIO bien vestido (traje). Usa un plano un poco más "
        "CERCANO para que se vean bien las MANOS. LO CLAVE, bien VISUAL: el intercambio del "
        "dinero ocurre POR DEBAJO del mostrador/la ventanilla (a la altura de las manos, bajo "
        "el borde del mostrador, medio oculto): se ve CLARAMENTE cómo la MANO del EMPRESARIO, "
        "por debajo, EXTIENDE un SOBRE lleno de BILLETES, y la MANO del FUNCIONARIO, también "
        "por debajo, lo AGARRA/recibe con disimulo y GESTO CODICIOSO. Mientras tanto, arriba, "
        "los dos DISIMULAN: mantienen una cara neutral y MIRAN DE REOJO a los lados, "
        "cómplices, cuidando que nadie los vea (como una transacción 'por debajo de la mesa'). "
        "Se debe entender a la primera la intención de ambos en el intercambio oculto del "
        "dinero. Sobre el mostrador hay CARPETAS y "
        "documentos de un CONCURSO PÚBLICO para un PROYECTO ENERGÉTICO (se puede ver una "
        "carpeta o cartel con un ícono de energía/rayo). Se entiende el soborno para dar "
        "VENTAJA amañada en el concurso del gobierno. Tono gris y turbio. Sé MUY detallista "
        "con el entorno de oficina pública. MANTÉN el estilo y la escala pequeña."),
    (40, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo de personajes y la MISMA ESCALA PEQUEÑA/simple que la serie "
        "(figuras pequeñas, trazo simple, NO caras grandes ni estilo nuevo). TOMA AMPLIA, "
        "realista y detallada. Escena en una CALLE de BARRIO POBRE (tierra, casas humildes de "
        "caña/madera, gris). CONFLICTO: la POLICÍA/MILITARES (2 o 3 uniformados con casco y "
        "chaleco) intentan ARRESTAR a un DELINCUENTE, pero un GRUPO de VECINOS y FAMILIARES "
        "(hombres y mujeres del barrio) lo RODEA y lo PROTEGE formando un MURO HUMANO a su "
        "alrededor: lo abrazan y sujetan, se interponen entre él y los policías, empujan y "
        "gritan a los uniformados para que NO se lo lleven, con los brazos extendidos "
        "bloqueándolos. EN EL CENTRO, protegido por la multitud, está el DELINCUENTE: un "
        "sujeto de pinta rufiana, TATUADO y con cara de matón (se intuye que es peligroso, que "
        "ha robado y matado), aprovechándose de que lo defienden. Los policías, frustrados, no "
        "logran pasar. Un BOCADILLO de una vecina grita: \"¡NO SE LO LLEVEN!\". Se entiende la "
        "IRONÍA: el barrio protege a un criminal conocido de la justicia. Tono gris y tenso. "
        "Sé MUY detallista con el entorno del barrio. MANTÉN el estilo y la escala pequeña."),
    (41, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo de personajes y la MISMA ESCALA PEQUEÑA/simple que la serie "
        "(figuras pequeñas, trazo simple, NO caras grandes ni estilo nuevo). TOMA AMPLIA de "
        "PAISAJE, realista y detallada. Escena de DEFORESTACIÓN y DESERTIFICACIÓN: a un LADO "
        "queda el ÚLTIMO trozo de BOSQUE VERDE, y unos TRABAJADORES/leñadores lo están "
        "TALANDO —con motosierras y hachas, un ÁRBOL cayéndose, TRONCOS apilados, un CAMIÓN "
        "maderero cargando troncos—. Hacia el otro lado y hasta el HORIZONTE, todo se ha "
        "convertido en un DESIERTO de TOCONES (cientos de tocones de árboles cortados), "
        "TIERRA reseca, AGRIETADA y polvorienta, muerta, sin vegetación, con polvo levantándose. "
        "Se ve CLARAMENTE la progresión: donde había bosque, la gente lo tala y deja tierra "
        "desértica. Cielo pardo/gris polvoriento. Tono árido y desolador. Sé MUY detallista "
        "con el paisaje. MANTÉN el estilo y la escala pequeña."),
    (42, ["A1", "A5"], "Industrias vierten humo y desechos que contaminan el ambiente."),
    (43, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo y ESCALA de la serie (pixel-art consistente, NO estilo nuevo). "
        "TOMA AMPLIA, realista y detallada. Escena sobre la IA CONSUMIENDO el AGUA del mundo: "
        "un ENORME CENTRO DE DATOS / granja de servidores de INTELIGENCIA ARTIFICIAL —un "
        "edificio industrial gigante con filas de RACKS de SERVIDORES con lucecitas, cables, y "
        "grandes TORRES DE ENFRIAMIENTO expulsando vapor—. Del centro de datos salen ENORMES "
        "TUBERÍAS que BOMBEAN y CHUPAN AGUA en cantidades masivas para enfriar los servidores "
        "(agua entrando a chorros, vapor saliendo). El CONTRASTE clave: al lado, un RÍO/lago "
        "que se está SECANDO por culpa de esa succión —el cauce casi vacío, tierra AGRIETADA y "
        "reseca, peces muertos—, mientras la máquina se traga toda el agua. Para que se "
        "entienda que es IA, incluye un gran SÍMBOLO de IA/chip o un cerebro digital brillante "
        "en el edificio o una pantalla. Tono tecnológico y distópico, gris. Se debe entender: "
        "la IA se bebe el agua del mundo mientras la naturaleza se seca. Sé MUY detallista. "
        "MANTÉN el estilo y la escala pequeña."),
    (44, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas, trazo simple, NO caras grandes ni estilo nuevo). Escena TRISTE de ESCASEZ "
        "de AGUA en el interior de una CASA HUMILDE y pobre, ambiente gris y seco. Un NIÑO "
        "pequeño, SEDIENTO (labios resecos, cara de sed), le extiende un VASO/taza VACÍA a su "
        "padre, PIDIÉNDOLE agua, mirándolo suplicante. El PADRE, agachado a su altura, tiene "
        "un gesto de IMPOTENCIA, tristeza y resignación: le muestra las manos vacías / un "
        "BIDÓN y una botella de agua VACÍOS, y un GRIFO/canilla seco que no da agua. Cerca se "
        "ve una botella de agua con una ETIQUETA de PRECIO ALTO (el agua está cara, casi no "
        "alcanza). Por una VENTANA se ve afuera la tierra AGRIETADA y seca por la sequía. Un "
        "BOCADILLO del padre dice: \"EL AGUA ESTÁ CARA\". Se entiende: el agua escasea y es "
        "carísima, y el padre no puede darle de beber a su hijo. Tono conmovedor y gris. Sé "
        "MUY detallista con el entorno. MANTÉN el estilo y la escala pequeña."),
    (45, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo de personajes y la MISMA ESCALA PEQUEÑA/simple que hemos "
        "llevado en toda la serie (figuras pequeñas, trazo simple, NO caras grandes ni estilo "
        "nuevo). TOMA AMPLIA, realista y detallada. Escena de MISERIA MASIVA y economía de "
        "supervivencia: una CALLE/avenida de ciudad gris y decadente TOTALMENTE ABARROTADA de "
        "MUCHÍSIMA gente pobre. Por todos lados hay personas PIDIENDO DINERO/limosna (sentadas "
        "en el suelo con la mano extendida, con vasitos, con cartones/carteles de ayuda, "
        "madres con niños), y a la vez MUCHÍSIMOS VENDEDORES INFORMALES vendiendo CUALQUIER "
        "COSA para sobrevivir: mercancía tirada sobre mantas y cartones en el suelo (ropa "
        "usada, chucherías, cachivaches, comida, objetos varios), carritos y puestitos "
        "improvisados, gente ofreciendo cosas al que pasa. Es una MULTITUD densa, caótica y "
        "desesperada: DEMASIADA gente tratando de sobrevivir, todos pidiendo o vendiendo. Tono "
        "gris, agobiante y desesperanzado. Sé MUY detallista con el entorno y la multitud. "
        "MANTÉN el estilo y la escala pequeña de los personajes."),
    (46, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO ESTILO de dibujo de personajes y la MISMA ESCALA PEQUEÑA/simple que la serie "
        "(figuras pequeñas, trazo simple, NO caras grandes ni estilo nuevo). TOMA AMPLIA y "
        "ELEVADA, realista y detallada. Escena de DESIGUALDAD extrema: una ciudad PARTIDA EN "
        "DOS por un gran MURO/frontera que atraviesa el centro de la imagen. A UN LADO (mitad "
        "izquierda), una ZONA RICA y PRIVILEGIADA: mansiones y edificios modernos limpios, "
        "PISCINAS azules, jardines VERDES cuidados, palmeras, autos de lujo, calles "
        "impecables, gente adinerada relajada —abundancia, color, agua y recursos de sobra—. "
        "AL OTRO LADO (mitad derecha), pegada al mismo muro, una ZONA MISERABLE sin recursos: "
        "un mar denso de CHOZAS/casuchas de lata y madera amontonadas, calles de TIERRA "
        "polvorienta, SIN vegetación, gente pobre haciendo fila por AGUA y comida escasa, "
        "todo gris, seco y hacinado. El CONTRASTE es el foco: lujo y abundancia de un lado, "
        "miseria y escasez del otro, separados por el muro. Tono crudo. Sé MUY detallista con "
        "ambos lados. MANTÉN el estilo y la escala pequeña de los personajes."),
    (47, ["assets/Prologo/escenas/escena_13.png"],
        "El mismo PLANETA TIERRA visto desde el espacio oscuro estrellado, mismo estilo "
        "pixel-art que la referencia. Escena de GUERRA NUCLEAR ENTRE PAÍSES: distintos "
        "PAÍSES/continentes se ATACAN entre sí lanzándose MISILES. MUY IMPORTANTE sobre los "
        "misiles: deben ser PEQUEÑOS (misilitos finos y diminutos, del tamaño acorde a la "
        "escala del globo, NO cohetes gigantes), con ESTELAS MUY FINAS, SUAVES y TENUES "
        "(delgadas líneas de luz/humo delicadas, casi sutiles, NADA de estelas enormes ni "
        "gruesas llamaradas). Se ven VARIAS trayectorias que ARQUEAN de un país a OTRO "
        "cruzando el globo en direcciones concretas (de un continente hacia otro, atacándose "
        "mutuamente), como líneas finas curvas. En algunos puntos de impacto hay pequeños "
        "destellos discretos. Un leve resplandor rojizo ominoso. Se debe entender: una guerra "
        "de misiles entre países, todos atacándose. Tono apocalíptico pero con misiles "
        "PEQUEÑOS y estelas SUAVES. Conserva la Tierra y el espacio de la referencia."),
    (48, ["A1"], "El mundo impactado por explosiones nucleares en varias partes."),
    (49, ["assets/Prologo/escenas/escena_45.png"],
        "MISMO ESTILO de dibujo de personajes y ESCALA PEQUEÑA/simple de la serie (figuras "
        "pequeñas como en la referencia, trazo simple, NO caras grandes ni estilo nuevo). TOMA "
        "AMPLIA de una CALLE de CIUDAD a nivel del SUELO. Escena de CATÁSTROFE: un TERREMOTO "
        "sacude la población. El PROTAGONISTA de la escena es el DERRUMBE de los EDIFICIOS: los "
        "edificios TIEMBLAN, se INCLINAN y se están CAYENDO/desmoronando, agrietados, soltando "
        "ESCOMBROS y trozos de fachada, con grandes NUBES de POLVO gris, cables reventados y "
        "postes torcidos. En el suelo/pavimento hay solo unas POCAS GRIETAS FINAS y PEQUEÑAS "
        "que zigzaguean (finas fisuras, baldosas levantadas), NO una gran grieta ni un cañón, "
        "NADA se traga autos, NO hay abismo. La GENTE (habitantes comunes, como los de la "
        "referencia) corre y HUYE en PÁNICO alejándose de los edificios, con las MANOS VACÍAS "
        "o cubriéndose la cabeza, mirando atrás con caras de TERROR. "
        "PROHIBIDO ABSOLUTAMENTE: NINGUNA persona lleva ARMAS, pistolas, rifles ni nada en las "
        "manos; NADIE apunta ni dispara; TODOS van desarmados solo huyendo del miedo. Es un "
        "desastre natural, no un conflicto. Tono apocalíptico, gris y caótico, polvo por todo. "
        "Sé MUY detallista con la destrucción de los edificios y el entorno urbano. MANTÉN el "
        "estilo y la escala pequeña de los personajes de la referencia."),
    (50, ["assets/Prologo/escenas/escena_14.png"],
        "Usa este mapa mundial plano como base (misma proyección cartográfica, mismos "
        "continentes en las mismas posiciones, mismo estilo pixel-art y encuadre). Debe quedar "
        "LIMPIO y LEGIBLE, con CONTRASTE CLARO entre tierra y agua (que se distingan bien, "
        "nada de mezcla turbia). "
        "TIERRA: los continentes, en sus formas normales y reconocibles, están al menos 90% "
        "GRIS ceniza OSCURO, apagados y muertos (sin verde ni tostado; a lo sumo un 10% de "
        "puntitos verdes minúsculos). Dibuja GRIETAS finas pero visibles en SUDAMÉRICA y "
        "AUSTRALIA (línea oscura quebrada con una delgada franja de agua colándose). "
        "AGUA: sigue HABIENDO agua y se ve CLARAMENTE como agua, de color AZUL OSCURO / NAVY "
        "apagado (NO verde-azulado, NO gris), pero hay MUCHA MENOS que en un mapa normal: los "
        "océanos se han ENCOGIDO y son más ESTRECHOS. Alrededor de las costas queda un MARGEN "
        "MODERADO de LECHO SECO expuesto (una franja de tierra reseca y cuarteada gris-parda "
        "bordeando los continentes), pero SIN invadir ni confundir todo el océano: la mayor "
        "parte del mar sigue siendo agua azul oscura, solo que reducida. Se debe leer de un "
        "vistazo: continentes GRISES muertos + océanos AZUL OSCURO más pequeños + una orilla "
        "seca. Leve BRUMA/smog gris sobre el mapa. NADA de texto ni etiquetas. Mantén el "
        "estilo pixel-art del mapa de referencia."),
    (51, ["assets/Prologo/escenas/escena_10.png"],
        "MISMA vista AÉREA CENITAL (desde muy alto, casi en picado) del Hoyo y su zona, MISMO "
        "estilo 2D pixel-art, misma escala y mismo Hoyo (agujero natural oscuro y circular en "
        "el CENTRO, SIN muros de piedra) que la imagen de referencia. Es la MISMA ZONA que "
        "antes se había inundado, pero AHORA está mucho MÁS DESÉRTICA, ÁRIDA y MUERTA que "
        "cualquier escena anterior. REGLA ABSOLUTA: NO hay NADA de AGUA en NINGUNA parte del "
        "encuadre — ni mar, ni lago, ni charco, ni el ANILLO/BORDE oscuro de agua alrededor de "
        "la isla. TODO el encuadre, de BORDE a BORDE (incluidas las esquinas), es DESIERTO "
        "seco: donde antes había mar ahora hay lecho seco. Toda la superficie es un DESIERTO "
        "muerto: tierra clara gris-parduzca/ocre PÁLIDA, reseca, muy CUARTEADA y agrietada por "
        "la sequía extrema, con polvo y dunas bajas, SIN una sola gota de agua, SIN vegetación "
        "ni vida — desolación total, más árido y sin vida que las escenas previas. Del Hoyo "
        "central brota la RED de RAÍCES GRISES (gris ceniza, ennegrecidas en las puntas) AÚN "
        "MÁS EXTENDIDA que en la referencia: la MISMA cantidad o MÁS de raíces, ramificándose y "
        "reptando aún MÁS LEJOS en todas direcciones hasta cerca de los bordes, como venas de "
        "podredumbre secas sobre el desierto. Luz dura y seca, ambiente muerto. NADA de texto. "
        "Estilo, vista y Hoyo IDÉNTICOS a la referencia; los cambios: CERO agua en todo el "
        "encuadre, desierto árido pálido cuarteado de borde a borde, y raíces más extendidas."),
    (52, ["assets/Prologo/escenas/escena_50.png"],
        "EDITA este MISMO mapa mundial (misma proyección, continentes, estilo pixel-art y "
        "encuadre) y lleva la corrupción al FINAL TOTAL: el mundo está ahora ABORDADO POR "
        "COMPLETO por el gris, muerto y casi MONOCROMO. TODA la TIERRA de todos los "
        "continentes es GRIS ceniza/oscuro uniforme, sin una sola mota de verde ni color. Y "
        "AHORA también el AGUA restante se apaga: los océanos y lo poco de mar que quedaba se "
        "vuelven GRIS oscuro/plomizo, turbios y muertos (ya NO azul), casi indistinguibles de "
        "la tierra, de modo que TODO el planeta es una masa GRIS uniforme. Conserva las "
        "grietas. Todo cubierto por una BRUMA/smog gris. Es la MUERTE del mundo: una imagen "
        "casi totalmente MONOCROMA gris, apagada, sin vida, desolada. NADA de texto ni "
        "etiquetas. Mantén el estilo pixel-art del mapa."),
    # ACTO 4 — El sobreviviente y la caída
    (53, ["assets/Prologo/escenas/escena_53.png", "assets/Prologo/escenas/escena_55.png"],
        "EDITA la PRIMERA imagen de referencia CONSERVANDO todo su estilo: MISMA calle de ciudad "
        "en RUINAS gris, mismo estilo pixel-art de SILUETAS pequeñas, misma paleta apagada, "
        "misma sangre SOBRIA. En el lado DERECHO van EXACTAMENTE TRES (3) PERSEGUIDORES "
        "(siluetas ROJO-OSCURAS/granate), ni uno más ni uno menos, y los TRES del MISMO tamaño "
        "ADULTO GRANDE: son los HOMBRES MÁS GRANDES y ALTOS de toda la escena (más grandes que "
        "papá y mamá), de complexión ROBUSTA y ancha de hombros (adultos musculosos / "
        "adolescentes grandes). PROHIBIDO que alguno sea pequeño, delgado o tamaño niño — los 3 "
        "son grandes. CORREN con carrera AGRESIVA, zancadas largas, cuerpos lanzados hacia "
        "adelante, brazos estirados para agarrar, feroces y DESEOSOS DE MATAR a la familia. "
        "En el lado IZQUIERDO va la FAMILIA COMPLETA de CINCO siluetas NEGRAS/oscuras, TODOS los "
        "CINCO MUY JUNTOS y PEGADOS en un SOLO BLOQUE COMPACTO (como el grupo familiar de la "
        "SEGUNDA referencia), corriendo hacia la IZQUIERDA. Deben estar PRESENTES los CINCO "
        "(cuéntalos: son 5, NO 4): PAPÁ, MAMÁ, el HERMANO MAYOR, el NIÑO y la NIÑA. REGLA "
        "ABSOLUTA: el HERMANO MAYOR va DENTRO del grupo (entre los padres y los hermanitos), NO "
        "suelto ni en el centro; el CENTRO de la calle está VACÍO (NADIE ahí); NINGÚN "
        "perseguidor rojo se mezcla con la familia (los rojos TODOS a la derecha). "
        "ALTURAS: PAPÁ y MAMÁ los más altos; el "
        "HERMANO MAYOR (personaje principal) un ADOLESCENTE CRECIDO, CASI tan alto como los "
        "padres (solo un poquito más bajo); y DOS HERMANITOS MUY PEQUEÑOS y bajitos (siluetas "
        "chiquitas, claramente más pequeñas que el hermano mayor). MUY IMPORTANTE sobre el "
        "HERMANO MAYOR: su silueta debe ser NEUTRA, SIN SEXO DISTINGUIBLE (NO forma de mujer, "
        "NO vestido/falda, NO curvas ni marcas de género) — solo una silueta oscura neutra de "
        "adolescente, imposible de reconocer (es el jugador). El VESTIDO va ÚNICAMENTE en la "
        "HERMANITA pequeña; el otro hermanito pequeño lleva pantalón. Que se note: padres≈"
        "hermano mayor altos, y los dos pequeños bastante más bajitos. Todos siluetas oscuras "
        "sin rostro. Mantén el escenario, el estilo, la escala y la sangre sobria de la "
        "referencia, y los perseguidores igual. NADA de texto."),
    (54, ["assets/Prologo/escenas/escena_53.png"],
        "CONTINUACIÓN directa de la referencia (escena_53): MISMA calle de ciudad en RUINAS "
        "gris, mismo estilo pixel-art, misma paleta apagada, misma niebla y misma sangre "
        "SOBRIA. Ahora la FAMILIA YA NO SE VE (ya salió del encuadre, huyó adelante): en la "
        "escena SOLO quedan los PERSEGUIDORES, sin ninguna silueta negra de la familia. "
        "Son los MISMOS ASESINOS de la referencia (siluetas ROJO-OSCURAS/granate, ADULTOS "
        "ROBUSTOS y MUSCULOSOS, de hombros anchos, feroces). Son UN POCO MÁS que en la "
        "referencia pero SIN exagerar: unos CINCO o SEIS (5–6), corriendo TODOS JUNTOS y "
        "ubicados en el CENTRO del encuadre. MUY IMPORTANTE — DIRECCIÓN: corren hacia la "
        "IZQUIERDA, es decir en la MISMA dirección hacia la que huía la familia en la "
        "referencia (persiguiéndola), NO hacia la cámara. ALGUNOS de ellos LLEVAN ARMAS "
        "BLANCAS en alto —CUCHILLOS, LANZAS, MACHETES— y esas armas deben ser de COLOR BLANCO, "
        "bien DISTINGUIBLES (hojas blancas brillando); los demás corren con las manos "
        "extendidas para agarrar. Todos con CARRERA AGRESIVA hacia la izquierda, zancadas "
        "largas, feroces y DESEOSOS DE MATAR. Mantén el escenario en ruinas, el estilo, la "
        "escala y la sangre sobria de la referencia. NADA de texto."),
    (55, ["assets/Prologo/escenas/escena_56.png", "personaje"],
        "MISMO desierto gris desolado, misma LOMA con el Hoyo y misma paleta de la primera "
        "referencia (escena_56), pero en PLANO ABIERTO y amplio (cámara lejos), con las figuras "
        "PEQUEÑAS y DISTANTES (ocupan solo una franja pequeña; NO las agrandes). El DESCAMPADO "
        "DESÉRTICO gris cuarteado, con la CIUDAD en RUINAS lejana atrás a la IZQUIERDA. La "
        "LOMA/colina debe verse EXACTAMENTE como en la referencia escena_56: un MONTÍCULO bajo "
        "con el HOYO como una PEQUEÑA ABERTURA oscura ARRIBA (en lo alto de la loma) y RAÍCES "
        "GRISES radiales que salen de él y reptan por el suelo alrededor de su base. MUY "
        "IMPORTANTE: el Hoyo NO es un agujero grande y frontal mirando a la cámara; es una "
        "pequeña boca oscura en lo alto del montículo, con raíces alrededor. SIN resplandor "
        "detrás de la loma. "
        "PERSONAJES — cuenta EXACTAMENTE CINCO (5) siluetas oscuras, NI UNA MÁS NI UNA MENOS, "
        "TODAS presentes y visibles, corriendo JUNTAS en un solo grupo hacia la DERECHA (la "
        "MISMA dirección de huida que en la referencia; NO la cambies), TODAS DESESPERADAS: "
        "cuerpos MUY inclinados hacia adelante, brazos bombeando, zancadas largas, huyendo por "
        "su vida con TERROR (NO trotando relajados). Los CINCO son, y TODOS deben aparecer: "
        "(1) PAPÁ — silueta ADULTA, una de las DOS MÁS ALTAS. "
        "(2) MAMÁ — silueta ADULTA, la otra de las DOS MÁS ALTAS (misma altura que papá). "
        "(3) HERMANO MAYOR = el personaje principal / el jugador — un ADOLESCENTE, CASI tan alto "
        "como los padres (solo un poquito más bajo). Su silueta es NEUTRA, SIN sexo "
        "distinguible: NADA de vestido, NADA de forma femenina ni marcas de género, solo una "
        "silueta oscura neutra sin rostro. Va corriendo, girando un poco la cabeza hacia la "
        "loma del fondo. "
        "(4) NIÑA (hermana menor, muy pequeña) — silueta BAJITA, CLARAMENTE mucho más pequeña "
        "que el hermano mayor, con un VESTIDITO/falda que la identifica como niña. "
        "(5) NIÑO (hermano menor, muy pequeño) — silueta BAJITA, CLARAMENTE mucho más pequeño, "
        "con pantalón. "
        "Debe notarse a simple vista: TRES figuras ALTAS (papá, mamá y el hermano mayor) y DOS "
        "NIÑITOS bastante más pequeños. Todos siluetas oscuras sin rostro. VERIFICA que en la "
        "imagen haya 5 figuras. "
        "SIN recuadros, SIN halos: una sola escena limpia. Ambiente desolado, polvo, cielo gris "
        "plomizo. Siluetas pequeñas y distantes, nada explícito, NADA de texto. Mantén el "
        "estilo y la escala de la referencia."),
    (56, ["assets/Prologo/escenas/escena_55.png", "personaje"],
        "Vista OVER-THE-SHOULDER (por encima del hombro) / POV del PERSONAJE PRINCIPAL (el "
        "hermano mayor), MIRANDO hacia el Hoyo. Mismo desierto gris desolado, misma paleta y "
        "mismo estilo pixel-art de la referencia (escena_55). "
        "En PRIMER PLANO, en el LADO DERECHO del encuadre, se ve DE ESPALDAS y CERCA la CABEZA "
        "y los HOMBROS/parte superior de la espalda del personaje. MUY IMPORTANTE sobre la "
        "silueta: es una SILUETA COMPLETAMENTE OSCURA, NEGRA SÓLIDA y PLANA (un vacío negro con "
        "forma humana), SIN NINGÚN sombreado, brillo ni detalle interno que revele músculos o "
        "forma del cuerpo; SIN rostro, SIN capucha (cabeza descubierta). ANDRÓGINA: NO se debe "
        "distinguir si es hombre o mujer (nada de hombros musculosos ni curvas). IMPORTANTE: el "
        "personaje va CORRIENDO hacia la IZQUIERDA (está en la parte DERECHA del encuadre y "
        "corre hacia la IZQUIERDA; así lleva la secuencia): hombros y torso en POSE DE CARRERA "
        "inclinados hacia adelante a la izquierda, con un brazo bombeando y el cuerpo dinámico; "
        "y a la vez GIRA la CABEZA MIRANDO hacia el Hoyo/loma del fondo mientras corre. NO está "
        "parado: se ve claramente que corre. Puede haber un leve motion-blur de movimiento. "
        "Más allá de su hombro se ve el MISMO desierto y la MISMA LOMA con el Hoyo (el "
        "montículo bajo con la pequeña boca oscura arriba y raíces grises radiales alrededor). "
        "IMPORTANTE — ZOOM del FONDO: la cámara está con TELEOBJETIVO/ZOOM hacia lo que el "
        "personaje MIRA, así que la LOMA con el Hoyo se ve MÁS GRANDE y PROMINENTE al fondo "
        "(llena buena parte del encuadre detrás de él, es claramente el FOCO de su mirada), con "
        "MENOS desierto vacío alrededor. Es un ZOOM de cámara (efecto teleobjetivo) hacia lo "
        "que él contempla, NO que el personaje se haya acercado caminando — sigue siendo su POV "
        "mirando la loma. Debe SENTIRSE coherente como su punto de vista. NO se ve a la familia "
        "(queda fuera del encuadre por el plano cercano). "
        "Cielo gris limpio, ambiente desolado, suelo cuarteado. Silueta, nada explícito, NADA "
        "de texto. Estilo y paleta idénticos a la referencia."),
    (57, ["assets/Prologo/escenas/escena_55.png", "personaje"],
        "CONTINUACIÓN del mismo estilo pixel-art, misma paleta gris apagada y la MISMA escala "
        "pequeña de siluetas de la referencia (figuras pequeñas y distantes, plano abierto; NO "
        "agrandes). La FAMILIA de CINCO siluetas OSCURAS (azul-oscuras/negras) —DOS PADRES más "
        "altos, DOS HERMANITOS pequeños y el HERMANO MAYOR (personaje principal, silueta sin "
        "rostro ni identidad, sin capucha, como la referencia 'personaje')— sigue HUYENDO por "
        "el paisaje gris desolado y ha LLEGADO a una CASA DESTRUIDA / en RUINAS (construcción "
        "baja con paredes agrietadas y rotas, techo parcialmente caído, huecos de ventanas y "
        "puerta vacía, escombros alrededor). Están AGACHÁNDOSE y METIÉNDOSE en la casa para "
        "ESCONDERSE, con urgencia y miedo, alguno mirando hacia atrás. "
        "MUY IMPORTANTE: SOLO aparece la familia (5 siluetas OSCURAS); NO hay NINGUNA figura "
        "ROJA, NI perseguidores, NI caníbales, NI otras personas — están SOLOS, todavía nadie "
        "los ha alcanzado. La casa en ruinas es el refugio; alrededor, tierra desértica gris y "
        "algún resto de ciudad al fondo. Siluetas pequeñas, nada explícito, NADA de texto. "
        "Estilo, escala y paleta idénticos a la referencia."),
    (58, ["assets/Prologo/escenas/escena_57.png", "assets/Prologo/escenas/escena_54.png"],
        "VISTA desde el INTERIOR de la MISMA casa en ruinas de la primera referencia (estamos "
        "DENTRO de la casa, mirando hacia la puerta de entrada), mismo estilo pixel-art de "
        "SILUETAS PEQUEÑAS y SIMPLES, misma paleta gris. Composición: "
        "(1) LA PUERTA AL FONDO: al fondo del cuarto está la PUERTA/entrada de la casa (un vano "
        "por el que se ve el exterior gris). Los DOS PADRES (dos siluetas oscuras más ALTAS) "
        "están de pie EN la puerta, de ESPALDAS a nosotros, BLOQUEANDO/CUBRIENDO la entrada con "
        "su cuerpo, de cara al exterior. "
        "(2) LOS ASESINOS ESTÁN AFUERA: al OTRO lado de la puerta, AFUERA (se ven en el exterior "
        "a través del vano), el grupo de ASESINOS amenaza hacia la entrada. CONSISTENCIA "
        "CRÍTICA: idénticos a la segunda referencia (escena_54): siluetas ROJO-GRANATE (maroon) "
        "PLANAS, SIMPLES y PEQUEÑAS, feroces, con UN cuchillo/machete blanco en alto; NADA de "
        "figuras grandes ni musculosas ni de otro color. Están FUERA de la casa. "
        "(3) LA CAJA ESTÁ DENTRO: en un RINCÓN del INTERIOR, en PRIMER PLANO/a un lado (bien "
        "DENTRO del cuarto, lejos de la puerta y sin ninguna ventana cerca), un GRAN CAJÓN de "
        "madera donde los NIÑOS (siluetas oscuras PEQUEÑAS) se están escondiendo — agachándose, "
        "entrando, cerrando la tapa. La CAJA está claramente DENTRO de la casa y OCULTA de los "
        "asesinos: ellos están AFUERA y NO pueden verla (los padres en la puerta les tapan la "
        "vista del interior). Los malos NO se percatan de los niños ni de la caja. "
        "Sangre sobria si acaso, nada de gore. Siluetas pequeñas y simples, paleta gris "
        "apagada, ambiente desolado. NADA de texto. Estilo, escala y paleta idénticos a las "
        "referencias."),
    (59, ["assets/Prologo/escenas/escena_58.png"],
        "PRIMER PLANO / close-up del MISMO GRAN CAJÓN de madera de la referencia (la caja donde "
        "se escondieron los niños), DENTRO de la casa en ruinas en penumbra. La escena es un "
        "PLANO CERCANO centrado en la CAJA: su TAPA se está ABRIENDO lentamente DESDE DENTRO — "
        "una MANO y parte del ANTEBRAZO (silueta oscura, sin identidad) SALEN por la rendija "
        "EMPUJANDO la tapa hacia arriba. El FOCO de la imagen es esa MANO abriendo la tapa. Por "
        "la rendija apenas se asoma la OSCURIDAD del interior (los niños siguen dentro, NO se "
        "ven). Gesto CAUTELOSO, como comprobando con miedo si el peligro ya pasó. Madera del "
        "cajón detallada, penumbra gris, la casa en ruinas apenas insinuada al fondo. Silueta "
        "oscura sin rostro ni identidad (es el jugador/niño). Nada explícito, NADA de texto. "
        "Mismo estilo pixel-art y paleta gris apagada que la referencia."),
    (60, ["assets/Prologo/escenas/escena_58.png"],
        "MISMA ZONA y encuadre que la referencia (escena_58): vista desde el INTERIOR de la "
        "casa en ruinas hacia la PUERTA del fondo, mismo estilo pixel-art de SILUETAS pequeñas, "
        "misma paleta gris, y con la MISMA CAJA de madera (tapa abierta) en su rincón. La "
        "diferencia con la referencia — ahora es DESPUÉS del ataque: "
        "(1) LOS PADRES YA ESTÁN MUERTOS: a través de la PUERTA, AFUERA y AL FRENTE, se ven "
        "CLARAMENTE y SIN OBSTRUCCIÓN las DOS (2) siluetas adultas de los padres CAÍDAS y "
        "tendidas en el suelo, una junto a la otra, inmóviles, en SOMBRA — IMPLÍCITO y SOBRIO, "
        "NADA de sangre ni gore. Deben verse los DOS cuerpos, y NINGÚN niño debe taparlos (el "
        "vano de la puerta queda despejado hacia ellos). "
        "(2) LOS ASESINOS YA SE FUERON: NINGÚN asesino cerca ni en la puerta; NO hay ninguna "
        "figura roja/granate en el vano. A lo sumo se ven DIMINUTOS y MUY AL FONDO, de espaldas, "
        "alejándose y marchándose. "
        "(3) LOS TRES HERMANOS MIRAN EL EVENTO: los TRES niños YA SALIERON de la caja (la CAJA "
        "queda VACÍA y abierta). Son EXACTAMENTE TRES niños (ni uno más), SILUETAS OSCURAS sin "
        "rostro ni detalle. COLOCACIÓN CLAVE: el HERMANO MAYOR (silueta un poco más grande = el "
        "personaje principal) está de pie a UN LADO del vano (no en el centro), mirando hacia "
        "la puerta; y los DOS HERMANITOS pequeños están DETRÁS de él, AGRUPADOS, "
        "escondiéndose/asomándose por detrás del hermano mayor (pegados a él, no dispersos). "
        "Así los tres NO tapan la puerta y se ven los padres muertos al frente. Los tres miran "
        "hacia sus padres muertos, paralizados de dolor. SOLO TRES niños en total. "
        "Tono de tragedia silenciosa, gris, desolado, ciudad en ruinas al fondo. Siluetas "
        "pequeñas, nada explícito, NADA de texto. Estilo, escala y paleta idénticos a la "
        "referencia."),
    (61, ["assets/Prologo/escenas/escena_55.png", "personaje"],
        "Mismo desierto gris desolado y mismo estilo de la referencia. Los TRES HERMANOS "
        "CORRIENDO (en plena CARRERA, piernas a media zancada, cuerpos inclinados y en "
        "MOVIMIENTO — claramente CORRIENDO, NO caminando) y COGIDOS DE LAS MANOS, vistos DESDE "
        "ATRÁS (de espaldas, alejándose de la cámara), huyendo hacia el desierto y la loma a lo "
        "lejos. En el CENTRO el HERMANO MAYOR = el personaje principal, cuya silueta es de "
        "ADOLESCENTE / joven (delgada y NO tan alta como un adulto; proporciones de "
        "adolescente, NO de adulto grande ni corpulento). A cada lado, un HERMANITO PEQUEÑO "
        "(niño chico, silueta bajita). Los TRES tomados de la mano y corriendo. "
        "REGLA ABSOLUTA: NO debe haber NINGÚN brazo ni mano GIGANTE en primer plano ni en las "
        "esquinas — NADA de manos ni garras grandes; SOLO los tres niños de cuerpo entero "
        "cogidos de las manos, a escala pequeña normal. "
        "Sensación de CARRERA con leve motion-blur, y un efecto de VISIÓN BORROSA/ACUOSA por el "
        "LLANTO (desenfoque suave, bordes difusos, imagen nublada) sobre toda la escena. Paleta "
        "gris apagada, tono de angustia y huida. Siluetas oscuras, nada explícito, NADA de "
        "texto. Estilo pixel-art y paleta de la referencia."),
    (62, ["assets/Prologo/escenas/escena_61.png", "hoyo"],
        "CONTINUACIÓN directa de la primera referencia (escena_61): los MISMOS TRES HERMANOS "
        "CORRIENDO cogidos de las manos, vistos DESDE ATRÁS (en el centro el HERMANO MAYOR con "
        "silueta de ADOLESCENTE = personaje principal, y a cada lado un HERMANITO pequeño), "
        "mismo desierto gris desolado y mismo estilo. Ahora CORREN DECIDIDOS HACIA la LOMA, que "
        "está MÁS CERCA y MÁS GRANDE/prominente que antes (se han acercado a ella, ocupa más el "
        "fondo). MUY IMPORTANTE sobre el HOYO: NO debe verse de FRENTE ni como un gran "
        "círculo/óvalo oscuro en la CARA de la loma mirando a los chicos (NADA de un portal "
        "frontal). El HOYO es un AGUJERO NATURAL en el SUELO, en lo ALTO de la loma, visto en "
        "ÁNGULO/escorzo desde abajo — por eso se ve solo como una abertura oscura DISCRETA y "
        "elíptica en la parte alta de la loma (tal como aparecía en las escenas 55/56/61), no "
        "grande ni de cara. En la ladera, algunas RAÍCES grises rastreras pegadas al suelo. Los "
        "tres van directo hacia la loma. Ambiente gris desolado, suelo cuarteado, leve neblina. "
        "Siluetas pequeñas, nada explícito, NADA de texto. Estilo, escala y paleta idénticos a "
        "la referencia."),
    (63, ["assets/Prologo/escenas/escena_51.png", "assets/Prologo/escenas/escena_62.png", "assets/Prologo/escenas/escena_54.png"],
        "Vista AMPLIA en TRES CUARTOS, ligeramente elevada, de una LOMA que en realidad es un "
        "GRAN CRÁTER / hoyo GIGANTE: una enorme DEPRESIÓN circular en el terreno gris, con su "
        "borde/rim elevado alrededor y sus laderas internas descendiendo hacia el fondo. Estilo "
        "pixel-art. PALETA GRIS ceniza, apagada y desaturada (misma tonalidad gris de las "
        "últimas escenas; NADA de tostado/beige). "
        "DENTRO del cráter, en su FONDO/CENTRO, está el VERDADERO HOYO tal como en la primera "
        "referencia (escena_51) pero en GRIS: un AGUJERO NEGRO insondable del que BROTAN las "
        "raíces grises. Las RAÍCES salen del Hoyo central y se EXPANDEN AÚN MÁS AFUERA: cubren "
        "todo el cráter y SIGUEN extendiéndose MÁS ALLÁ del borde del cráter, reptando por el "
        "terreno gris de alrededor (raíces por dentro Y por fuera del cráter, muy extendidas). "
        "Los TRES HERMANOS —cogidos de las manos, HERMANO MAYOR adolescente + DOS HERMANITOS "
        "pequeños, siluetas oscuras— están DESCENDIENDO por la ladera INTERIOR del cráter, "
        "bajando CORRIENDO hacia ese Hoyo del fondo. "
        "LOS PERSEGUIDORES/ASESINOS (siluetas GRANATE pequeñas, como la tercera referencia "
        "escena_54) vienen por el MISMO LADO por el que llegaron los niños: DETRÁS de los niños, "
        "en la misma ladera/borde por el que los niños entraron (NO en el borde opuesto). PERO "
        "deben estar MUCHO MÁS LEJOS y ATRÁS de los niños: MUY PEQUEÑOS y DISTANTES, allá arriba "
        "en el borde/cresta cercano del cráter, apenas asomando y CORRIENDO HACIA los niños "
        "desde lejos — claramente aún a BASTANTE DISTANCIA, sin estar cerca de alcanzarlos. "
        "Siluetas pequeñas, nada explícito, NADA de texto. Estilo pixel-art y PALETA GRIS "
        "ceniza de las últimas escenas."),
    (64, ["assets/Prologo/escenas/escena_51.png", "assets/Prologo/escenas/escena_63.png"],
        "Vista en PRIMERA PERSONA / POV del personaje principal que MIRA HACIA ABAJO A SUS "
        "PROPIOS PIES, parado al borde del HOYO justo antes de saltar. Encuadre tipo 'mirar "
        "hacia abajo': "
        "Los TRES están DE PIE (parados verticalmente, NO acostados) al borde del Hoyo, "
        "mirando hacia abajo. Por la perspectiva PICADA (mirar tus propios pies parado), sus "
        "PIERNAS se ven MUY ESCORZADAS y COMPRIMIDAS: se ven sobre todo las PUNTAS de los PIES "
        "apoyadas en el mismísimo BORDE/rim del Hoyo y solo un POCO de pierna (rodillas/"
        "espinillas) justo por encima/detrás, fuertemente acortada por el ángulo. NO pongas las "
        "piernas estiradas en horizontal hacia el hoyo (eso parecería que están acostados): "
        "están DE PIE, así que las piernas quedan casi verticales y muy cortas en escorzo, con "
        "los pies al borde. Alrededor del borde, tierra gris agrietada con RAÍCES GRISES. "
        "AL CENTRO: las dos PIERNAS y PIES del PERSONAJE principal, las más grandes/largas. "
        "A UN LADO: las dos PIERNAS y PIES de la HERMANA (NIÑA) — piernas más cortas con el bajo "
        "de un VESTIDITO/falda y zapatitos femeninos de niña, claramente FEMENINOS. "
        "AL OTRO LADO: las dos PIERNAS y PIES del HERMANO (NIÑO) — piernas cortas con pantalón y "
        "tenis/zapatos de niño, masculinos. "
        "MUY IMPORTANTE: los TRES se ven con el MISMO ángulo PICADO/escorzo (piernas bajando "
        "desde abajo hacia los pies); NO pongas pies PLANOS de perfil ni pies sueltos cortados "
        "en ángulo recto — deben verse las PIERNAS + PIES en la misma perspectiva del POV. Los "
        "cuerpos de cintura para arriba quedan fuera de cuadro. "
        "Justo DELANTE de las puntas de los pies, el BORDE se acaba y se abre el HOYO: un "
        "ABISMO NEGRO insondable que cae a la oscuridad total, ocupando la mayor parte del "
        "encuadre. Sensación de VÉRTIGO. Paleta GRIS ceniza. Nada explícito, NADA de texto. "
        "Estilo pixel-art y paleta gris de las últimas escenas."),
    (65, ["assets/Prologo/escenas/escena_51.png"],
        "Vista DESDE DENTRO del Hoyo MIRANDO HACIA ARRIBA, hacia la BOCA del agujero. Estilo "
        "pixel-art, paleta GRIS ceniza. ARRIBA, en lo alto del encuadre, se ve la ABERTURA "
        "circular del Hoyo: un óvalo de LUZ GRIS pálida (el cielo/exterior visto desde el "
        "fondo del pozo) con el BORDE y las RAÍCES grises recortadas alrededor de la boca. "
        "Los TRES HERMANOS —el HERMANO MAYOR adolescente (más alto), la HERMANA niña con "
        "vestido (pequeña) y el HERMANO niño (pequeño)— están CAYENDO hacia ABAJO / hacia el "
        "espectador, recortados en SILUETA oscura contra la luz de la abertura de arriba, "
        "COGIDOS DE LAS MANOS, con brazos y piernas algo abiertos y la ropa/pelo hacia arriba "
        "por la caída. Se debe leer CLARÍSIMO que están EN EL AIRE, CAYENDO dentro del pozo "
        "(suspendidos contra la boca iluminada, NO parados en ningún suelo). Alrededor y hacia "
        "abajo, la OSCURIDAD del pozo que se los traga. PROPORCIONES coherentes (mayor más "
        "alto, pequeños más bajitos). Nada explícito, NADA de texto. Estilo pixel-art y paleta "
        "gris."),
    (66, ["assets/Prologo/escenas/escena_65.png"],
        "Los TRES HERMANOS CAYENDO juntos DENTRO del Hoyo, COGIDOS DE LAS MANOS (el HERMANO "
        "MAYOR adolescente al centro, la HERMANA niña con vestido a un lado, el HERMANO niño al "
        "otro), como en la referencia. REGLA CRÍTICA — TODOS SON SILUETAS OSCURAS SIN ROSTRO NI "
        "IDENTIDAD: NO se ve la cara de NINGUNO (ni ojos, ni rasgos, ni expresión), y en "
        "especial el HERMANO MAYOR debe quedar OSCURO e imposible de reconocer (es el jugador). "
        "Solo se distinguen sus FORMAS oscuras (el vestidito de la niña, el tamaño mayor del "
        "adolescente, el niño pequeño). NADA de caras visibles. "
        "El LUGAR es el INTERIOR del Hoyo: oscuro, PERO con TEXTURAS de un HUECO de TIERRA "
        "ÁRIDA — paredes de TIERRA y roca seca, agrietada y terrosa, apenas visibles en la "
        "penumbra alrededor de ellos (NO un vacío negro plano; es un POZO de tierra árida). "
        "MUY IMPORTANTE: la LUZ y toda la PALETA son GRISES / gris ceniza FRÍO (NADA de tono "
        "marrón ni cálido/terroso en el color): la tierra y la penumbra se ven agrisadas, en "
        "escala de GRISES fríos, coherente con las escenas anteriores. Sin ninguna abertura ni "
        "luz de fondo. Caen envueltos por la penumbra gris del pozo. Proporciones coherentes. "
        "Tono de caída y terror. Paleta muy oscura en GRISES fríos. Nada explícito, NADA de "
        "texto. Estilo pixel-art."),
]


def cliente() -> "genai.Client":
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("Falta la variable GEMINI_API_KEY. Expórtala con tu API key de Google AI Studio.")
    return genai.Client(api_key=key)


def _config():
    """Config con 16:9 si el SDK lo soporta; si no, cae a lo básico."""
    try:
        return types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="16:9"),
        )
    except Exception:
        return types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])


def _extraer_imagen(resp) -> "Image.Image | None":
    for cand in getattr(resp, "candidates", []) or []:
        content = getattr(cand, "content", None)
        if content is None or not getattr(content, "parts", None):
            continue  # candidato bloqueado por filtros: sin contenido
        for part in content.parts:
            if getattr(part, "inline_data", None) and part.inline_data.data:
                return Image.open(BytesIO(part.inline_data.data))
    return None


def generar(client, prompt: str, refs: list) -> "Image.Image":
    """Llama al modelo con el prompt + imágenes de referencia. Reintenta con
    esperas progresivas, para aguantar los picos de demanda (503)."""
    contenidos = [prompt] + refs
    ultimo_error = None
    esperas = [8, 15, 25, 40, 60]   # segundos entre reintentos (backoff)
    for intento in range(1, len(esperas) + 2):
        try:
            resp = client.models.generate_content(
                model=MODELO, contents=contenidos, config=_config())
            img = _extraer_imagen(resp)
            if img is not None:
                return img
            ultimo_error = "La respuesta no trajo imagen (¿bloqueada por filtros de contenido?)."
        except Exception as e:  # noqa: BLE001
            ultimo_error = str(e)
        if intento <= len(esperas):
            espera = esperas[intento - 1]
            print(f"    reintento {intento}/{len(esperas)} en {espera}s... ({ultimo_error[:90]})")
            time.sleep(espera)
    raise RuntimeError(ultimo_error or "fallo desconocido")


def guardar(img: "Image.Image", ruta: Path, prompt: str) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    img.save(ruta)
    ruta.with_suffix(".txt").write_text(prompt, encoding="utf-8")


def asegurar_anclas(client, forzar: bool) -> dict:
    """Genera (si faltan) las anclas y devuelve {id: PIL.Image} para referenciarlas."""
    imgs = {}
    for aid, (refs_ids, prompt) in ANCLAS.items():
        ruta = DIR_ANCLAS / f"{aid}.png"
        if ruta.exists() and not forzar:
            imgs[aid] = Image.open(ruta)
            continue
        print(f"[ancla] {aid} ...")
        refs = []
        for r in refs_ids:
            if r in imgs:                       # otra ancla ya generada
                refs.append(imgs[r])
            else:                               # ruta a un archivo (p. ej. la escena_53)
                p = BASE.parent / r
                if p.exists():
                    refs.append(Image.open(p))
        img = generar(client, prompt + ESTILO, refs)
        guardar(img, ruta, prompt + ESTILO)
        imgs[aid] = img
        time.sleep(2)
    return imgs


def _cargar_refs(refs_ids: list, anclas: dict) -> list:
    """Referencias EXACTAS que pida la escena (por nombre de ancla o por ruta a un
    archivo, p. ej. la escena anterior para encadenar el estilo). Cada escena elige
    sus referencias; el estilo se hereda encadenando la escena previa."""
    refs = []
    for r in refs_ids:
        if r in anclas:
            refs.append(anclas[r])
        else:
            p = BASE.parent / r
            if p.exists():
                refs.append(Image.open(p))
    return refs


def main() -> None:
    args = [a for a in sys.argv[1:]]
    forzar = "--force" in args
    solo_anclas = "--anchors" in args
    numeros = [int(a) for a in args if a.isdigit()]

    client = cliente()
    # --anchors genera solo las que falten (borra una y vuelve a correr para rehacerla).
    # Para rehacer TODAS, usa: --anchors --force
    # ⚠ OJO: `forzar` NO puede propagarse aquí a secas. Si se pasa `--force` para
    # regenerar UNA escena, no debe rehacer las anclas ya aprobadas (pasó el
    # 2026-07-26: `68 --force` reescribió las 5 anclas y hubo que restaurarlas
    # con git). Las anclas solo se rehacen con `--anchors --force`.
    anclas = asegurar_anclas(client, forzar and solo_anclas)
    if solo_anclas:
        print("Anclas listas.")
        return

    escenas = [e for e in ESCENAS if not numeros or e[0] in numeros]
    for (n, refs_ids, prompt) in escenas:
        ruta = DIR_ESCENAS / f"escena_{n:02d}.png"
        if ruta.exists() and not forzar and not numeros:
            continue
        print(f"[escena {n:02d}/{len(ESCENAS)}] {prompt[:60]}...")
        refs = _cargar_refs(refs_ids, anclas)
        prompt_final = f"Escena {n} del prólogo. {prompt}{tono(n)}{ESTILO}"
        try:
            img = generar(client, prompt_final, refs)
            guardar(img, ruta, prompt_final)
        except Exception as e:  # noqa: BLE001
            print(f"    ⚠️  escena {n} falló: {e}")
        time.sleep(2)

    print("Listo. Revisa godot/assets/Prologo/ y regenera las que no te gusten "
          "con:  python tools/generar_estampas.py <número>")


if __name__ == "__main__":
    main()
