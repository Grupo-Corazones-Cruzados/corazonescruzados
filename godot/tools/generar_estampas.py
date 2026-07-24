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


def tono(n: int) -> str:
    """Arco de dessaturación: el mundo pierde color según pierde virtud."""
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
    (20, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo de personajes/edificios y MISMA escala que la imagen de "
        "referencia (pixel-art consistente con la serie). Escena de PANDEMIA en una calle "
        "gris y decadente de ciudad: MUCHA GENTE ENFERMA —personas débiles tiradas en "
        "camillas y colchones improvisados, envueltas en mantas, tosiendo, muchas con "
        "MASCARILLAS—, y personal médico con TRAJES DE PROTECCIÓN (hazmat) y máscaras "
        "atendiéndolas; cinta de CUARENTENA acordonando la zona; ambiente de hospital "
        "colapsado y desesperanza. ELEMENTO CLAVE que pide el usuario: en un lado hay una "
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
    (25, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo 2D pixel-art y escala que la imagen de referencia (consistente "
        "con la serie). Escena SIMBÓLICA, sobria y perturbadora, en una sala tenue de iglesia "
        "con una PUERTA ENTREABIERTA por la que entra un haz de luz. En el suelo, iluminada "
        "por esa luz, hay una PEQUEÑA FLOR BLANCA que se está MARCHITANDO, doblada y "
        "perdiendo pétalos (símbolo de la inocencia herida). Sobre ella cae una SOMBRA "
        "ALARGADA, oscura y AMENAZANTE, con la silueta de una figura con SOTANA (un cura/"
        "pastor) que se cierne desde la puerta. IMPORTANTE: NO debe aparecer NINGUNA persona "
        "de cuerpo entero, NINGÚN niño ni niña, NADA explícito: SOLO la sombra amenazante de "
        "la sotana proyectada sobre la florecita marchita. Tono oscuro, opresivo y triste. "
        "Es un símbolo del abuso de la inocencia por una figura de confianza. Estilo "
        "pixel-art consistente con la serie."),
    (26, ["assets/Prologo/escenas/escena_16.png"],
        "MISMO estilo de dibujo 2D pixel-art y escala coherente con la serie. Escena ÍNTIMA y "
        "FRÍA de ACOSO DIGITAL por la APARIENCIA (body-shaming), de NOCHE: un CUARTO oscuro y "
        "solitario, iluminado SOLO por la luz AZULADA fría de la pantalla de un móvil. Sentada "
        "sola está una MUJER de complexión MUY GRANDE / OBESA, encorvada sobre el teléfono, "
        "con la cara iluminada por la pantalla y una expresión DESTROZADA —LLORANDO, con "
        "lágrimas, profundamente herida por lo que lee—. Es la VÍCTIMA: se la retrata con "
        "DIGNIDAD y compasión mientras sufre (NADA de caricatura grotesca ni burlona). A su "
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
    (28, ["A1"], "SÍMBOLO: un niño pequeño encogido en un rincón oscuro tapándose los oídos con las manos; en la pared, una sombra alargada y amenazante; en el suelo, una silla volcada y un plato roto. Sin violencia visible, sin golpes, sin figuras peleando. Transmite un hogar donde reina el miedo."),
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
        "uno SIN CAMISA y tatuado); el que va atrás en la moto sostiene una PISTOLA en la mano "
        "(el arma con la que acaban de disparar al profesor) y mira hacia atrás con una "
        "sonrisa cínica y sin remordimiento mientras huyen. Es el clásico SICARIATO EN MOTO. "
        "(3) A LO LEJOS, corriendo hacia el cuerpo, la HIJA del "
        "profesor (una joven) LLORANDO desesperada, con los brazos extendidos y cara de "
        "horror y sufrimiento al ver a su padre asesinado. Alrededor, algunos vecinos "
        "normales. NO pongas cinta policial. Tono crudo, trágico y realista: se debe entender "
        "CLARAMENTE que la banda asesinó al profesor y huye. Sé MUY detallista con el "
        "entorno. MANTÉN el estilo y la escala pequeña."),
    (34, ["A1"], "Una hinchada xenófoba lanza un vaso a una persona de espaldas que lleva una bandera de Ecuador; agresión de multitud."),
    (35, ["A1"], "Adultos aparentemente millonarios charlan en un salón lujoso; por una puerta al fondo, en sombra, se intuyen niños secuestrados. Nada explícito."),
    (36, ["A1"], "Ancianos en un salón misterioso ante un mapamundi con alfileres rojos, azules, amarillos y verdes, repartiéndose los países; aire conspirativo."),
    (37, ["A1"], "Un joven absorto en videojuegos en penumbra, mientras por la ventana se ven niños jugando afuera bajo el sol."),
    (38, ["A1"], "Un padre increpa a un profesor en un pasillo escolar, señalándolo con el dedo; el profesor a la defensiva."),
    (39, ["A1"], "Un funcionario recibe un sobre (coima) por debajo de una ventanilla, para amañar un concurso público de energía."),
    (40, ["A1"], "Vecinos y familiares rodean y protegen a un delincuente frente a policías o militares, impidiendo su arresto."),
    (41, ["A1", "A5"], "Personas talan árboles; alrededor, tierra reseca y desértica."),
    (42, ["A1", "A5"], "Industrias vierten humo y desechos que contaminan el ambiente."),
    (43, ["A1", "A5"], "Enormes centros de datos de IA consumiendo ríos de agua que se secan."),
    (44, ["A1"], "Un niño pide agua; el padre, con gesto de resignación, indica que está cara."),
    (45, ["A1"], "Calles abarrotadas de gente pidiendo dinero y vendiendo cualquier cosa para sobrevivir."),
    (46, ["A1"], "Contraste partido: a un lado ricos con todos los recursos en una zona privilegiada; al otro, gente sin apenas agua ni comida."),
    (47, ["A1"], "El mundo cruzado por misiles nucleares que van y vienen entre continentes."),
    (48, ["A1"], "El mundo impactado por explosiones nucleares en varias partes."),
    (49, ["A1"], "El mundo temblando, con grietas recorriéndolo."),
    (50, ["A1", "A5"], "El gris se expande por todo el mundo, de forma intensa."),
    (51, ["A1", "A5"], "El gris avanza un poco más, casi total."),
    (52, ["A1", "A5"], "El mundo completamente cubierto de gris."),
    # ACTO 4 — El sobreviviente y la caída
    (53, ["A1", "A5"], "Calles destruidas, desérticas, casi sin gente; las pocas siluetas huyen de otras que las persiguen."),
    (54, ["A1"], "Una familia con hijos huye de gente que quiere matarlos."),
    (55, ["A1", "A3"], "El personaje misterioso (sombra sin rostro) mira hacia una loma desértica mientras huye con su familia."),
    (56, ["A1", "A2", "A3"], "Zoom en la loma: a lo lejos se ve el Hoyo; el personaje se queda mirándolo."),
    (57, ["A1", "A3"], "La familia sigue huyendo y encuentra una casa destruida para esconderse."),
    (58, ["A1", "A3"], "Gente armada amenaza a los padres, mientras los tres niños se esconden dentro de una caja grande en la casa."),
    (59, ["A1"], "Primer plano de una mano abriendo la tapa de una caja grande desde dentro."),
    (60, ["A1", "A3"], "POV del personaje: ve a lo lejos a sus padres asesinados, en sombra, implícito, sin gore."),
    (61, ["A1", "A3"], "POV del personaje corriendo, tomado de la mano de sus hermanos; visión borrosa por el llanto."),
    (62, ["A1", "A2", "A3"], "Corren hacia la loma donde se vio el Hoyo a lo lejos."),
    (63, ["A1", "A3"], "Los niños tomados de las manos; a lo muy lejos, sus perseguidores."),
    (64, ["A1", "A2", "A3"], "POV del personaje mirando el Hoyo: se ven sus pies y el borde del Hoyo."),
    (65, ["A1", "A2", "A3"], "Los niños deciden lanzarse al Hoyo."),
    (66, ["A1", "A2", "A3"], "Los TRES niños caen juntos al vacío del Hoyo: el personaje misterioso (sin rostro, en sombra) y sus dos hermanos menores, cerca entre sí, ojos cerrados, gritando de miedo."),
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
    anclas = asegurar_anclas(client, forzar)
    if solo_anclas:
        print("Anclas listas.")
        return

    escenas = [e for e in ESCENAS if not numeros or e[0] in numeros]
    for (n, refs_ids, prompt) in escenas:
        ruta = DIR_ESCENAS / f"escena_{n:02d}.png"
        if ruta.exists() and not forzar and not numeros:
            continue
        print(f"[escena {n:02d}/66] {prompt[:60]}...")
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
