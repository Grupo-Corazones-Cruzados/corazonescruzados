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


# --- Las 5 ANCLAS (referencias maestras). A1 se hace primero. ---------------
ANCLAS = {
    "A1": ([], "Imagen maestra de estilo para toda la serie: ILUSTRACIÓN 2D en pixel "
               "art dibujada a mano (NO 3D, NO Minecraft, NO voxels), como el fondo de "
               "un RPG 2D de 16 bits. Un campo fértil al atardecer dorado; en el centro, "
               "un pozo circular de piedra antigua hundido en la tierra, con símbolos "
               "rúnicos gastados tallados en el borde; un lugar sagrado y sereno."),
    "A2": (["A1"], "Hoja de referencia: primer plano claro de un pozo circular de "
                   "piedra antigua con símbolos rúnicos tallados en el borde. "
                   "Diseño canónico que no debe cambiar nunca. Fondo neutro."),
    "A3": (["A1"], "HOJA DE REFERENCIA DEL PROTAGONISTA: un/a joven visto como una "
                   "SILUETA OSCURA con capucha; rostro y cuerpo NO distinguibles, "
                   "siempre en sombra. Misterioso. Fondo neutro."),
    "A4": (["A1"], "HOJA DE REFERENCIA DE LA ISLA: una isla vista de lejos, con el "
                   "Hoyo en su centro. Mar alrededor."),
    "A5": (["A1"], "HOJA DE REFERENCIA DE LA CORRUPCIÓN: raíces retorcidas de color "
                   "gris que se ennegrecen, brotando de la tierra y pudriendo la "
                   "naturaleza a su alrededor. Motivo visual del mal que se expande."),
}


# --- Las 66 escenas: (nº, [anclas], prompt) ---------------------------------
ESCENAS = [
    # ACTO 1 — La devoción
    (1, ["A1", "A2"], "Una mujer camina llevando una cesta de frutos hacia el Hoyo, en ofrenda; campo fértil, luz dorada."),
    (2, ["A1", "A2"], "La misma mujer lanza los frutos dentro del Hoyo en gesto de gratitud."),
    (3, ["A1", "A2"], "Niños y adultos rezan arrodillados alrededor del Hoyo, en comunidad, con esperanza."),
    (4, ["A1", "A2"], "Un grupo de niños repite el rito: agradecen y rezan al Hoyo imitando a los mayores."),
    (5, ["A1", "A2"], "Ya menos personas rezan al Hoyo; el grupo es más pequeño y la luz más fría."),
    (6, ["A1", "A2"], "Solo una viejita, sola, hace el último gesto de rezar al Hoyo."),
    # ACTO 2 — El abandono y la corrupción del Hoyo
    (7, ["A1", "A2"], "El Hoyo vacío; ya nadie reza. Silencio, hierba marchitándose."),
    (8, ["A1", "A2", "A5"], "Del Hoyo empiezan a brotar raíces grises."),
    (9, ["A1", "A2", "A5"], "Raíces ennegrecidas empiezan a rodear el Hoyo."),
    (10, ["A1", "A4"], "Plano amplio de una isla."),
    (11, ["A1", "A2", "A4", "A5"], "En el centro de la isla, el Hoyo muy rodeado de raíces grises; la naturaleza alrededor pudriéndose."),
    (12, ["A1", "A4"], "El mar ahoga la isla y la va tragando."),
    # ACTO 3 — El mundo se vuelve gris
    (13, ["A1"], "El planeta Tierra visto desde el espacio."),
    (14, ["A1", "A5"], "En varias partes del mundo se forman zonas grises sobre el planeta."),
    (15, ["A1", "A5"], "La cámara se acerca a una de esas zonas grises."),
    (16, ["A1"], "Una persona asustada escondida de una balacera entre bandas; todo en siluetas, implícito, sin gore."),
    (17, ["A1"], "Guerra civil: siluetas de militares frente a ciudadanos, humo, tensión."),
    (18, ["A1"], "Guerra entre dos países: dos ejércitos enfrentados en silueta, banderas rotas."),
    (19, ["A1"], "Una bomba nuclear: una pareja de espaldas mira acercarse la onda expansiva."),
    (20, ["A1"], "Gente enferma por una pandemia incurable; hospital saturado, tono desesperanzado."),
    (21, ["A1"], "Una familia de una religión se muestra superior y mira con desprecio a personas de otra religión (vestimentas distintas)."),
    (22, ["A1"], "SÍMBOLO: unas manos adultas en sombra guían las manos pequeñas de un niño sobre un arma; todo en silueta oscura, sin rostros."),
    (23, ["A1"], "Un adulto tira basura en la calle e ignora a alguien que pide comida sentado en la acera."),
    (24, ["A1"], "SÍMBOLO: un líder de secta en un púlpito con brazos abiertos ante una masa de siluetas que se inclinan hacia un abismo; ominoso, no explícito."),
    (25, ["A1"], "SÍMBOLO (sensible): una figura con sotana proyecta una sombra alargada y amenazante sobre una florecita blanca que se marchita, tras una puerta entreabierta. Nada explícito, ninguna figura infantil."),
    (26, ["A1"], "Una persona frente al móvil rodeada de burbujas de comentarios de odio por su apariencia o creencias; rostro herido, luz azulada de pantalla."),
    (27, ["A1"], "Un hombre mayor cansado busca trabajo con su currículum en mano; al fondo, largas colas de gente buscando empleo."),
    (28, ["A1"], "SÍMBOLO: un niño pequeño encogido en un rincón oscuro tapándose los oídos con las manos; en la pared, una sombra alargada y amenazante; en el suelo, una silla volcada y un plato roto. Sin violencia visible, sin golpes, sin figuras peleando. Transmite un hogar donde reina el miedo."),
    (29, ["A1"], "Una viejita pide dinero en la calle, encogida por el frío."),
    (30, ["A1"], "Un joven recibe un par de monedas tras 16 horas como operador en una fábrica gris."),
    (31, ["A1"], "Una persona chantajea y amenaza a su pareja exigiéndole dinero mensual; gesto de coacción, ambiente opresivo."),
    (32, ["A1"], "Jóvenes fumando y drogándose en un colegio; profesores al fondo con cara de terror, obligados a no ver."),
    (33, ["A1"], "Escena de calle con cinta policial: un profesor asesinado camino al trabajo. Sombrío, sin gore, sin texto."),
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
        refs = [imgs[r] for r in refs_ids if r in imgs]
        img = generar(client, prompt + ESTILO, refs)
        guardar(img, ruta, prompt + ESTILO)
        imgs[aid] = img
        time.sleep(2)
    return imgs


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
        refs = [anclas[r] for r in refs_ids if r in anclas]
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
