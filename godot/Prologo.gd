extends Control

## ============================================================================
##  REPRODUCTOR DE ESTAMPAS — el prólogo (estilo Undertale, cantado)
## ============================================================================
##  LA CANCIÓN MANDA. Todo el prólogo va sincronizado con la posición de
##  reproducción de la música, NO con temporizadores (los temporizadores se
##  desfasan poco a poco; la posición de la canción nunca miente).
##
##  Dos relojes, los dos leyendo la misma canción:
##    1. LETRAS  → cada verso aparece en el segundo EXACTO en que se canta.
##    2. TRAMOS  → las estampas, ANCLADAS a los versos: cada tramo arranca en un
##                 verso y reparte sus estampas hasta el tramo siguiente. Si
##                 mueves un tiempo de LETRAS, las estampas se recolocan solas.
##
##  Al arrancar, la consola imprime el reparto real (cuántas estampas y cuántos
##  segundos cada una en cada tramo) y avisa si alguna baja de 1 s.
##
##  ⚠ TAMAÑOS FIJOS: todo se mide sobre el lienzo base de 960×540 que define
##  `project.godot` (stretch mode = canvas_items, aspect = keep). El motor escala
##  ese lienzo completo a la ventana, así que la imagen y las letras conservan
##  SIEMPRE el mismo tamaño, sin importar la pantalla o el navegador.
##
##  ⚠ PARA CLAVAR LOS TIEMPOS DE LA LETRA: activa `calibrar_letras` en el
##  Inspector y ejecuta la escena. Suena la canción, aparece el verso que toca y
##  tú pulsas ESPACIO justo cuando empieza a cantarse. Al acabar, la consola
##  imprime el bloque `LETRAS` ya listo para pegar aquí. (BORRAR = deshacer el
##  último, ESC = terminar antes.)
## ============================================================================

## Lienzo base del proyecto (debe coincidir con display/window/size del project.godot).
const BASE_ANCHO := 960.0
const BASE_ALTO := 540.0


## --- LA LETRA: cada verso con el segundo en que se canta ---------------------
## "t" = segundo de la canción en que aparece el verso. Cada verso se queda en
## pantalla hasta que le toca al siguiente. Un verso con texto "" limpia la
## pantalla (útil para los tramos instrumentales).
##
## ⚠ Los tiempos de abajo son una ESTIMACIÓN (sacada de la envolvente de energía
## del mp3). Hay que sustituirlos por los reales usando `calibrar_letras`.
const LETRAS := [
	{ "t": 8.5,  "texto": "Antes lo nuestro era simple y sincero," },
	{ "t": 15.0,  "texto": "gratitud a la tierra, calor verdadero." },
	{ "t": 20.5,  "texto": "Nos bastaba el abrazo, nos bastaba el hogar," },
	{ "t": 28.0,  "texto": "un alma en el suelo y un suelo en el mar." },

	{ "t": 36,  "texto": "Pero basta fue más y lo nuestro fue mío," },
	{ "t": 40.5,  "texto": "y cambiamos el sol, por un brillo más frío." },
	{ "t": 46,  "texto": "Lo que daba de comer lo dejamos morir," },
	{ "t": 51.5,  "texto": "y el verde del mundo se hizo gris al partir." },
	{ "t": 60.5,  "texto": "" },

	{ "t": 70.5,  "texto": "Los pequeños corrieron al borde del día," },
	{ "t": 76.5,  "texto": "sin más puerta que el hueco, sin más compañía." },
	{ "t": 82.5,  "texto": "Perseguidos se dieron la mano y saltaron" },
	{ "t": 88.5,  "texto": "al fondo del mundo, a la noche bajaron." },

	{ "t": 98.5,  "texto": "Pero aquellos que olvidamos guardaron la llama," },
	{ "t": 104.0,  "texto": "la bajaron al fondo en la caída en el drama." },
	{ "t": 109.5, "texto": "Lo que arriba rompimos sus manos sabrán," },
	{ "t": 115.0, "texto": "y los niños que fallamos..." },
	{ "t": 119.0, "texto": "el alba serán." },
]


## --- LAS ESTAMPAS: tramos ANCLADOS A LOS VERSOS ------------------------------
## Cada tramo dice: en qué VERSO empieza (`desde_verso`, el índice dentro de
## LETRAS; -1 = antes de cantar, en `inicio_imagenes`) y QUÉ estampas se ven.
## El tramo dura hasta que empieza el tramo siguiente, y sus estampas se
## reparten SOLAS dentro de ese hueco.
##
## ⭐ La gracia: si mueves un tiempo en LETRAS, las estampas se recolocan solas.
## Para que una estampa caiga en un verso concreto, basta con abrir un tramo ahí.
##
## ⚠ AVISO DE REPARTO (lo dice la consola al arrancar): la canción dura 135,6 s y
## hasta que entra el Acto 4 (verso 9, 70,5 s) solo hay ~68 s para 52 estampas.
## Por eso el tramo de la decadencia va como RÁFAGA. Si se quiere que respire,
## hay que quitar estampas de esa lista o alargar la canción.
## ⏱ DURACIÓN A MANO DE UNA ESTAMPA CONCRETA — { nº de escena: segundos }
## Aquí se le clava el tiempo a una estampa suelta. MANDA SOBRE TODO LO DEMÁS:
## por encima del "seg" de su tramo y por encima del reparto automático.
## Ejemplo:  const DURACIONES := { 4: 1.5, 70: 6.0 }
## OJO: el tramo dura lo que dura su trozo de canción. Si al fijar duraciones la
## suma del tramo se pasa de su hueco, la consola te avisa y las últimas
## estampas se solaparían con el tramo siguiente.
const DURACIONES := {
	4: 2,
	75: 1.5,
	76: 2,
	77: 2.5,
	63: 2.5,
	65: 2,
	84: 3,
	95: 0.5,
	105:0.2,
	106: 0.2,
	98: 0.2,
	107: 0.2,
	99: 0.2
	
}


## --- NOMBRE DE CADA ESTAMPA (para saber qué es cada número al ordenarlas) -----
## Solo sirve para leer y reordenar cómodo; no afecta a la reproducción. Se
## imprime junto al reparto cuando `mostrar_reparto` está activado.
const NOMBRES := {
	13: "El planeta desde el espacio",
	14: "El mapa con las manchas grises",
	15: "Zoom a una zona gris",
	16: "Balacera entre bandas",
	17: "Guerra civil",
	18: "Guerra entre países",
	19: "La bomba nuclear",
	20: "La pandemia",
	21: "La religión que se cree superior",
	22: "El arma en manos de un niño",
	23: "La basura y el que pide comida",
	24: "El líder de la secta",
	25: "El que debía proteger",
	26: "El odio en la pantalla",
	27: "Sin trabajo, y la cola de parados",
	28: "La violencia dentro de casa",
	29: "La vejez pidiendo en la calle",
	30: "Dieciséis horas por unas monedas",
	31: "La extorsión en la puerta",
	32: "La droga en el colegio",
	33: "El sicariato",
	34: "La xenofobia en el estadio",
	35: "Los que compran personas",
	36: "El reparto del mundo a puerta cerrada",
	37: "La vida encerrada en la pantalla",
	38: "Contra el que enseña",
	39: "La coima bajo la ventanilla",
	40: "El barrio que protege al que hace daño",
	41: "La tala hasta el desierto",
	42: "El humo de las fábricas",
	43: "La sed de las máquinas",
	44: "El agua que hay que pagar",
	45: "Las calles de la miseria",
	46: "El muro entre los que tienen y los que no",
	47: "La guerra nuclear",
	48: "El mundo golpeado",
	49: "El terremoto",
	50: "El gris se extiende por el mapa",
	52: "El mundo entero cubierto de gris",
}


## --- LA PALABRA DE CADA ESTAMPA ----------------------------------------------
## Una sola palabra que NOMBRA el problema. Se estampa sobre la imagen durante la
## ráfaga: es el adelanto de todo aquello a lo que se va a enfrentar el jugador.
const PALABRAS := {
	13: "EL MUNDO",
	16: "VIOLENCIA",
	17: "TIRANÍA",
	18: "GUERRA",
	19: "EXTERMINIO",
	20: "PESTE",
	21: "DESPRECIO",
	22: "MANIPULACIÓN",
	23: "INDIFERENCIA",
	24: "FANATISMO",
	25: "ABUSO",
	26: "ODIO",
	27: "DESEMPLEO",
	28: "MALTRATO",
	29: "ABANDONO",
	30: "EXPLOTACIÓN",
	31: "EXTORSIÓN",
	32: "ADICCIÓN",
	33: "SICARIATO",
	34: "XENOFOBIA",
	35: "TRATA",
	36: "AMBICIÓN",
	37: "EVASIÓN",
	38: "IRRESPETO",
	39: "SOBORNO",
	40: "COMPLICIDAD",
	41: "TALA",
	42: "CONTAMINACIÓN",
	43: "DERROCHE",
	44: "ESCASEZ",
	45: "MISERIA",
	46: "DESIGUALDAD",
	47: "ANIQUILACIÓN",
	48: "DEVASTACIÓN",
	49: "CATÁSTROFE",
	50: "AGONÍA",
	52: "OLVIDO",
}


## --- 🎬 CLIPS DE VÍDEO intercalados entre las estampas -----------------------
## Trozos del prólogo que en vez de estampa fija son un VÍDEO. Se colocan igual
## que todo lo demás: atados al segundo de la canción. Mientras dura el clip, la
## estampa se oculta; al acabar, vuelven las estampas donde tocaría.
##
## ⚠ FORMATO: Godot solo reproduce **Ogg Theora (.ogv)** de serie. Para convertir
## un mp4/webm que venga de la IA:
##     ffmpeg -i clip.mp4 -q:v 8 -an assets/Video/clip.ogv
## (el `-an` quita su audio: la música del prólogo no se debe pisar).
##
## Cada entrada admite:
##   "desde_verso": en qué verso arranca el clip (índice de LETRAS)
##   "t":           (alternativa) segundo exacto de la canción en que arranca
##   "archivo":     ruta al .ogv
##   "dur":         segundos que ocupa en la línea de tiempo
const VIDEOS := [
	# { "desde_verso": 11, "archivo": "res://assets/Video/caida.ogv", "dur": 8.0 },
]


## --- ⚡ LA RÁFAGA: el mosaico que resume la caída del mundo -------------------
## Un tramo especial que mete MUCHAS estampas en poco tiempo SIN que se vuelva
## un estrobo ilegible. El truco: la pantalla se SUBDIVIDE en paneles y cada
## panel cambia su estampa de forma ESCALONADA, así se ven varias a la vez y
## cada una aguanta en pantalla mucho más de lo que duraría a pantalla completa.
##
## Las fases van de menos a más paneles, para que la sensación sea de avalancha
## que crece. Al final, todo colapsa en UNA sola imagen a pantalla completa
## (`final`), que se queda hasta que entra el verso siguiente.
const RAFAGA := {
	"desde_verso": 8,          # arranca con el verso 8 (el instrumental)
	"final": 52,               # la última, a pantalla completa: el mundo gris
	"cierre": 1.4,             # segundos que dura ese cierre a pantalla completa
	# El orden de esta lista es el orden en que aparecen. Reordénala a tu gusto.
	# (La 51 queda fuera a propósito; la 52 va aparte, como cierre.)
	"escenas": [
		16, 17, 18, 19, 20,
		21, 34, 26, 25, 38, 27,
		23, 29, 45, 46, 44,
		30, 31, 32, 33, 22, 24, 40,
		35, 36, 39, 37, 28,
		41, 42, 43,
		47, 48, 49, 50,
	],
	# Cada fase: en cuántos PANELES se parte la pantalla y qué PESO (porción del
	# tiempo disponible) ocupa. Más paneles = más estampas a la vez.
	"fases": [
		{ "paneles": 1, "peso": 0.22 },
		{ "paneles": 2, "peso": 0.26 },
		{ "paneles": 4, "peso": 0.28 },
		{ "paneles": 6, "peso": 0.24 },
	],
}


## --- 🕳 LA CAÍDA: cuadritos que se van quedando en pantalla -------------------
## El verso "a la noche bajaron" no puede ir a estampa completa: todas las
## estampas de la caída son el MISMO plano (las siluetas en el pozo), así que una
## detrás de otra se leen como cortes secos.
##
## Aquí van como CUADROS PEQUEÑOS: aparece uno, y se QUEDA; luego aparece el
## siguiente, y se queda también, y así hasta tener los ocho a la vez. Cada nuevo
## cuadro cae un poco MÁS ABAJO que el anterior, en zigzag, de modo que el propio
## reparto de los cuadros por la pantalla va dibujando el descenso.
const CAIDA := {
	"desde_verso": 12,         # "al fondo del mundo, a la noche bajaron."
	# El orden es el orden en que van apareciendo.
	"escenas": [94, 95, 105, 106, 101, 102, 98, 107],
	"tam": 0.34,               # ancho de cada cuadro, en fracción de la caja
	"entrada": 0.22,           # segundos que tarda un cuadro en aparecer
	"zigzag": true,            # true = alternan izquierda/derecha al bajar
	"borde": 2.0,              # grosor del marco claro de cada cuadro (0 = sin marco)
}


## --- LAS ESTAMPAS: tramos ANCLADOS A LOS VERSOS ------------------------------
## Cada tramo admite:
##   "desde_verso": en qué verso arranca (índice de LETRAS; -1 = antes de cantar)
##   "escenas":     qué estampas se ven, EN ESE ORDEN
##   "seg":         (opcional) segundos que dura CADA estampa de este tramo.
##                  Si no lo pones, se reparte el hueco a partes iguales.
const TRAMOS := [
	# Antes de que empiece a cantar: una sola estampa, quieta, abriendo el prólogo.
	{ "desde_verso": -1, "escenas": [1] },

	# Versos 1-3 · la devoción: lo único bonito del prólogo, va lento.
	# La 67 (noche de convivencia), la 68 (la aldea se retira del Hoyo) y la 69
	# (ya de camino a casa, otra zona) van detrás de la 3. Las estampas nuevas se
	# numeran a partir de 67 para no renumerar las 66 originales: el ORDEN lo
	# manda esta lista, no el número de archivo.
	{ "desde_verso": 0, "escenas": [2, 3, 67, 68, 69, 70, 73, 75, 74], "seg": 3.0 },

	# Verso 5 ("lo nuestro fue mío") · el Hoyo abandonado y las raíces.
	{ "desde_verso": 4, "escenas": [76, 77, 4, 78], "seg": 2   },

	# Versos 6-8 + instrumental · LA RÁFAGA: todo lo que el humano rompió.
	# Van agrupadas por tema (no por número) para que los destellos tengan lógica:
	# el mundo gris → la codicia → la violencia → los que debían cuidar → la
	# tierra → la guerra y el gris final.
	{ "desde_verso": 6, "escenas": [
	 5, 6
	], "seg": 2  },
	
	{ "desde_verso": 7, "escenas": [
	 14, 42
	], "seg": 3  },
	
	{ "desde_verso": 8, "escenas": [
	 39
	], "seg": 3  },

	# Verso 10 ("los pequeños corrieron al borde del día") · el Acto 4 entero,
	# respirando otra vez. La caída (65) y el fondo del Hoyo (66) caen justo en
	# los dos últimos versos.
	{ "desde_verso": 9, "escenas": [
		53, 55, 57, 82
	], "seg": 1  },
	
	{ "desde_verso": 10, "escenas": [
		83, 61, 62, 63
	], "seg": 1.5  },
	
	{ "desde_verso": 11, "escenas": [
		64, 86, 89, 84, 65
	], "seg": 2  },
	
	# Verso 12 ("a la noche bajaron") · manda la CAÍDA (la cinta vertical continua).
	# Este tramo existe solo para MARCAR el corte con el verso anterior; su estampa
	# queda debajo de la cinta, que la tapa mientras dura el descenso.
	{ "desde_verso": 12, "escenas": [94] },

	{"desde_verso": 13, "escenas": [
		92, 93, 111, 112, 113, 114
	], "seg": 1  },
]


## A dónde ir al terminar el prólogo.
@export_file("*.tscn") var escena_siguiente: String = "res://Intro.tscn"

@export_group("Calibración de la letra")
## Actívalo para MEDIR los tiempos de la letra pulsando ESPACIO al ritmo del canto.
## Al terminar imprime el bloque LETRAS listo para pegar en este script.
@export var calibrar_letras: bool = false

@export_group("Pruebas")
## ⏩ PARA PROBAR UN TROZO SIN VERTE TODO EL PRÓLOGO: pon aquí el segundo de la
## canción por el que quieres empezar y el prólogo arranca directamente ahí
## (la música se adelanta y los versos, las estampas y la ráfaga se recolocan
## solos, porque todo va atado a la posición de la canción).
## Ejemplos: 60.5 = el verso 8 (la ráfaga) · 70.5 = el verso 9 · 98.5 = el 14.
## Déjalo en 0 para el prólogo entero. ¡Acuérdate de volver a 0 al terminar!
@export var empezar_en: float = 0.0

@export_group("Ritmo")
## Segundo de la canción en que aparece la primera estampa.
@export var inicio_imagenes: float = 2.0
## Segundo en que se apaga la última estampa. 0 = automático: el ÚLTIMO VERSO
## más `cola_final`. Así las últimas estampas caen sobre las últimas palabras y
## no se quedan para el instrumental del final.
@export var fin_imagenes: float = 0.0
## Segundos que las estampas siguen después del último verso (solo si
## `fin_imagenes` = 0).
@export var cola_final: float = 4.0
## Duración del cruce entre estampas (se recorta solo si la estampa dura poco).
@export var crossfade: float = 0.6
## Imprime en la consola, al arrancar, cuánto dura EXACTAMENTE cada estampa.
## Úsalo para ajustar DURACIONES y los cortes de TRAMOS.
@export var mostrar_reparto: bool = true
## Cómo APARECE cada verso en pantalla.
##   · BARRIDO (por defecto) → la frase se revela de un tirón de IZQUIERDA a
##     DERECHA, con un frente suave. Entra entera en `barrido_dur` segundos, así
##     que el ojo la ancla al instante y un desfase pequeño con la canción deja
##     de notarse.
##   · TECLEO → el efecto antiguo de máquina de escribir, carácter a carácter.
##     Es bonito pero LENTO (hasta `tecleo_max`), y esa lentitud es justo lo que
##     hacía visible cualquier retraso.
enum Aparicion { BARRIDO, TECLEO }
@export var aparicion: Aparicion = Aparicion.BARRIDO
## Segundos que tarda el barrido en cruzar la frase. Corto a propósito.
@export_range(0.1, 1.5, 0.05) var barrido_dur: float = 0.32
## Anchura del frente difuminado del barrido, en píxeles del lienzo 960×540.
## 0 = corte seco; más alto = entrada más mullida.
@export_range(0.0, 200.0, 2.0) var suavizado_barrido: float = 46.0
## Qué parte del hueco de un verso se tarda en teclearlo (0.35 = el 35 %).
## Solo aplica con `aparicion = TECLEO`.
@export_range(0.1, 1.0, 0.05) var proporcion_tecleo: float = 0.35
## Tope de segundos para teclear un verso. Es lo que garantiza que la frase
## TERMINE de escribirse ANTES de que se acabe de cantar: aunque el hueco hasta
## el verso siguiente sea largo (por un instrumental), el tecleo nunca dura más
## que esto.
@export var tecleo_max: float = 1.6

@export_group("Música")
## La canción que MARCA EL RITMO de todo el prólogo.
@export_file("*.mp3", "*.ogg", "*.wav") var musica: String = "res://assets/Audio/Musica/Pixel Heart Quest - AI Music (8).mp3"
## Volumen de la música, en decibelios (0 = tal cual viene; negativo = más bajo).
@export_range(-40.0, 6.0, 0.5) var musica_db: float = -6.0
## Segundos que tarda la música en entrar.
@export var musica_entrada: float = 3.0
## Segundos de fundido final (imagen y música bajan juntas antes de cambiar de escena).
@export var musica_salida: float = 4.0

@export_subgroup("Sincronía de la letra")
## ⏱ AJUSTE FINO de la letra respecto al canto, en segundos.
##
## Solo hace falta si en algún aparato la letra no cae justo donde se canta:
##   ·  POSITIVO (p. ej. 0.3) → el texto y las estampas salen ANTES.
##   ·  NEGATIVO (p. ej. -0.3) → salen DESPUÉS.
## Afecta a TODO el prólogo a la vez (versos, estampas y ráfaga), así que no
## descuadra nada entre sí: mueve el prólogo entero contra la canción.
## Con 0 el navegador va igual que el editor, que es lo que se busca.
@export_range(-2.0, 2.0, 0.05) var ajuste_sincronia: float = 0.0
## Restar la latencia de salida del audio (la receta estándar de Godot).
##
## ⚠ Apagado a propósito: es lo que hacía que en el navegador el texto saliera
## MÁS TARDE que en el editor. En el editor la latencia medida es 0 s, así que
## no corrige nada; en el navegador vale decenas o cientos de milisegundos (más
## aún por Bluetooth) y retrasa cada verso justo esa cantidad. Encenderlo
## devuelve el comportamiento anterior.
@export var compensar_latencia: bool = false

@export_group("Tamaños fijos (en el lienzo de 960×540)")
## Caja donde se dibuja la estampa, centrada en pantalla. Las imágenes son 16:9
## (1344×768), así que conviene mantener esa proporción (672×384 = la mitad exacta).
@export var caja_imagen := Vector2i(672, 384)
## Tamaño de la letra de la narración (fijo, NO depende de la ventana).
@export var tamano_letra: int = 24
## Alto reservado para el texto debajo de la imagen (3–4 líneas).
@export var alto_texto: float = 118.0
## Aire entre la imagen y el texto.
@export var separacion: float = 16.0


# --- Nodos construidos por código -------------------------------------------
var _capa_a: TextureRect   # imagen visible
var _capa_b: TextureRect   # imagen entrante (para el crossfade)
var _texto: Label          # la letra, debajo de la imagen (tamaño fijo)
var _musica: AudioStreamPlayer
var _velo: ColorRect       # negro por encima de todo, para el cierre
var _video: VideoStreamPlayer   # los clips intercalados
var _clip_actual := -1          # índice del clip que se está viendo
var _terminado := false

# --- Estado de la reproducción ----------------------------------------------
## Guion de imágenes ya calculado: [{ "t": segundo, "escena": nº }, ...]
var _plan_imagenes: Array = []
var _idx_imagen := 0
var _idx_verso := -1
var _tween_texto: Tween = null
var _cruzando := false

# --- Estado de la RÁFAGA (el mosaico) ---------------------------------------
var _caja: Rect2                  # la caja de imagen, en coordenadas del lienzo
var _capa_paneles: Control        # contenedor de los paneles del mosaico
var _flash: ColorRect             # fogonazo blanco sobre la caja
var _paneles: Array = []          # los TextureRect de la fase actual
var _rafaga: Dictionary = {}      # guion calculado
var _idx_rafaga := 0
var _paneles_actuales := 0
var _rafaga_cerrada := false

# --- Estado de la CAÍDA (los cuadritos que se acumulan) ---------------------
var _ventana_caida: Control       # capa donde viven los cuadros, sobre la caja
var _cuadros: Array = []          # un nodo por estampa, ya colocado y oculto
var _caida_t0 := -1.0             # segundo en que arranca (calculado en _ready)
var _caida_t1 := -1.0             # y en que termina
var _caida_n := 0                 # cuántos cuadros hay
var _idx_caida := 0               # cuántos han aparecido ya
var _caida_activa := false

# --- Estado del modo calibración --------------------------------------------
var _tiempos_medidos: Array[float] = []


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_construir_ui()
	_construir_musica()
	if calibrar_letras:
		_arrancar_calibracion()
	else:
		_plan_imagenes = _calcular_plan_imagenes()
		_rafaga = _calcular_rafaga()
		_montar_caida()
		if mostrar_reparto and not _rafaga.is_empty():
			_informar_rafaga()
		# ⏩ Salto de prueba: adelantar la canción hace que todo lo demás salte con
		# ella, porque versos, estampas y ráfaga se comparan contra su posición.
		if empezar_en > 0.0 and _musica != null:
			_musica.seek(empezar_en)
			print("⏩ Prólogo arrancando en el segundo %.2f (empezar_en)" % empezar_en)


func _construir_ui() -> void:
	# --- Composición (todo en coordenadas fijas del lienzo 960×540) -----------
	# El bloque "imagen + texto" se centra verticalmente como un conjunto.
	var ancho_img := float(caja_imagen.x)
	var alto_img := float(caja_imagen.y)
	var alto_total := alto_img + separacion + alto_texto
	var img_x := (BASE_ANCHO - ancho_img) / 2.0      # centrada horizontalmente
	var img_y := (BASE_ALTO - alto_total) / 2.0
	var texto_y := img_y + alto_img + separacion
	var margen_texto := 60.0                          # aire lateral de la letra

	# Fondo negro (también hace de marco alrededor de la estampa).
	var fondo := ColorRect.new()
	fondo.color = Color.BLACK
	fondo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fondo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fondo)

	# Las dos capas de imagen, en la MISMA caja fija (una encima de otra para el
	# crossfade).
	_capa_a = _nueva_capa_imagen(img_x, img_y, ancho_img, alto_img)
	add_child(_capa_a)
	_capa_b = _nueva_capa_imagen(img_x, img_y, ancho_img, alto_img)
	_capa_b.modulate.a = 0.0
	add_child(_capa_b)

	# La caja de imagen, guardada para el mosaico de la ráfaga.
	_caja = Rect2(img_x, img_y, ancho_img, alto_img)

	# Capa donde vive el mosaico (encima de las estampas normales).
	_capa_paneles = Control.new()
	_capa_paneles.set_anchors_preset(Control.PRESET_FULL_RECT)
	_capa_paneles.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_capa_paneles.visible = false
	add_child(_capa_paneles)

	# 🕳 La capa de la CAÍDA: ocupa la caja de imagen y dentro se van quedando los
	# cuadritos, uno tras otro.
	_ventana_caida = Control.new()
	_ventana_caida.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_ventana_caida.offset_left = img_x
	_ventana_caida.offset_top = img_y
	_ventana_caida.offset_right = img_x + ancho_img
	_ventana_caida.offset_bottom = img_y + alto_img
	_ventana_caida.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ventana_caida.visible = false
	add_child(_ventana_caida)

	# Fogonazo blanco, solo sobre la caja de imagen.
	_flash = ColorRect.new()
	_flash.color = Color.WHITE
	_flash.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_flash.offset_left = img_x
	_flash.offset_top = img_y
	_flash.offset_right = img_x + ancho_img
	_flash.offset_bottom = img_y + alto_img
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_flash.modulate.a = 0.0
	add_child(_flash)

	# La letra: DEBAJO de la imagen, centrada, tamaño de letra FIJO.
	_texto = Label.new()
	_texto.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_texto.offset_left = margen_texto
	_texto.offset_right = BASE_ANCHO - margen_texto
	_texto.offset_top = texto_y
	_texto.offset_bottom = texto_y + alto_texto
	_texto.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_texto.vertical_alignment = VERTICAL_ALIGNMENT_TOP
	_texto.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_texto.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_texto.modulate.a = 0.0
	var fuente: FontFile = load("res://assets/Fonts/Silkscreen-Regular.ttf")
	if fuente != null:
		_texto.add_theme_font_override("font", fuente)
	_texto.add_theme_font_size_override("font_size", tamano_letra)
	_texto.add_theme_color_override("font_color", Color(0.93, 0.93, 0.98))
	_texto.material = _material_barrido(BASE_ANCHO - margen_texto * 2.0)
	add_child(_texto)

	# Botón discreto para saltar el prólogo (útil en web/móvil).
	var saltar := Button.new()
	saltar.text = "Saltar  >>"
	saltar.flat = true
	saltar.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	saltar.offset_left = -150
	saltar.offset_top = 10
	saltar.offset_right = -14
	if fuente != null:
		saltar.add_theme_font_override("font", fuente)
	saltar.add_theme_font_size_override("font_size", 14)
	saltar.add_theme_color_override("font_color", Color(0.55, 0.55, 0.62))
	saltar.add_theme_color_override("font_hover_color", Color(0.9, 0.9, 0.95))
	saltar.pressed.connect(_ir_a_siguiente)
	add_child(saltar)

	# Reproductor de los clips de vídeo, en la MISMA caja que las estampas.
	_video = VideoStreamPlayer.new()
	_video.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_video.offset_left = img_x
	_video.offset_top = img_y
	_video.offset_right = img_x + ancho_img
	_video.offset_bottom = img_y + alto_img
	_video.expand = true
	_video.volume_db = -80.0        # mudo: la canción manda
	_video.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_video.visible = false
	add_child(_video)

	# Velo negro POR ENCIMA de todo (transparente), para fundir el cierre del
	# prólogo a la vez que se apaga la música y no cortar de golpe.
	_velo = ColorRect.new()
	_velo.color = Color.BLACK
	_velo.set_anchors_preset(Control.PRESET_FULL_RECT)
	_velo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_velo.modulate.a = 0.0
	add_child(_velo)


## Una capa de imagen anclada a la caja FIJA (misma posición y tamaño siempre).
func _nueva_capa_imagen(x: float, y: float, ancho: float, alto: float) -> TextureRect:
	var t := TextureRect.new()
	t.set_anchors_preset(Control.PRESET_TOP_LEFT)
	t.offset_left = x
	t.offset_top = y
	t.offset_right = x + ancho
	t.offset_bottom = y + alto
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	# Las estampas son ilustraciones de 1344×768 que se reducen dentro de la caja:
	# con filtro LINEAR la reducción sale limpia (el "nearest" del proyecto está
	# pensado para los sprites de pixel-art, no para estas imágenes grandes).
	t.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


# ============================================================================
#  MÚSICA — es el reloj de todo el prólogo
# ============================================================================

func _construir_musica() -> void:
	if musica == "":
		push_warning("Prólogo: sin música no hay sincronía; solo se verá el texto quieto.")
		return
	var pista: AudioStream = load(musica) as AudioStream
	if pista == null:
		push_warning("Prólogo: no se pudo cargar la música '%s'." % musica)
		return
	# La canción suena UNA vez: el prólogo dura lo que dura la canción.
	if pista is AudioStreamMP3:
		(pista as AudioStreamMP3).loop = false
	elif pista is AudioStreamOggVorbis:
		(pista as AudioStreamOggVorbis).loop = false
	elif pista is AudioStreamWAV:
		(pista as AudioStreamWAV).loop_mode = AudioStreamWAV.LOOP_DISABLED

	_musica = AudioStreamPlayer.new()
	_musica.stream = pista
	_musica.bus = &"Master"
	_musica.volume_db = musica_db - 40.0   # arranca casi en silencio
	add_child(_musica)
	_musica.play()

	var t := create_tween()
	t.tween_property(_musica, "volume_db", musica_db, musica_entrada)


## Material del BARRIDO de la letra: revela el verso de IZQUIERDA a DERECHA con
## un frente suave, en vez de escribirlo carácter a carácter.
##
## ⚠ El truco está en `vertex()`. En un `Label` el `UV` del fragmento es el de la
## textura de la FUENTE (el atlas de glifos), no el del control, así que con UV
## el barrido saldría por cada letra en vez de por la frase. Se pasa la posición
## LOCAL del vértice a un `varying` y se corta contra ella: así el frente avanza
## por el ancho real del Label, cruzando las letras a su paso.
func _material_barrido(ancho_control: float) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = """
shader_type canvas_item;

// 0 = nada visible · 1 = todo visible.
uniform float progreso : hint_range(0.0, 1.0) = 1.0;
// Ancho del control, en píxeles del lienzo.
uniform float ancho = 1.0;
// Anchura del frente difuminado, en píxeles. 0 = corte seco.
uniform float suavizado = 46.0;

varying float x_local;

void vertex() {
	x_local = VERTEX.x;
}

void fragment() {
	// El frente recorre [0 .. ancho+suavizado] para que al final NADA quede a
	// medio desvanecer.
	float frente = progreso * (ancho + suavizado);
	COLOR.a *= smoothstep(frente, frente - suavizado, x_local);
}
"""
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("progreso", 1.0)
	mat.set_shader_parameter("ancho", ancho_control)
	mat.set_shader_parameter("suavizado", suavizado_barrido)
	return mat


## Segundo EXACTO de la canción. `get_playback_position` solo se refresca cada
## bloque de mezcla, así que se le suma el tiempo transcurrido desde la última.
##
## ⭐ POR QUÉ YA NO SE RESTA LA LATENCIA DE SALIDA (2026-07-28):
## la receta estándar de Godot resta `AudioServer.get_output_latency()`, y ESA
## era la causa de que en el navegador el texto saliera más tarde que probando
## en el editor. Restar la latencia hace que `pos` sea menor, así que cada verso
## se dispara exactamente `latencia` segundos MÁS TARDE en tiempo real.
##   · En el editor la latencia medida es **0,0000 s** → no corrige nada.
##   · En el navegador es `baseLatency + outputLatency` (medido 0,072 s en un
##     Chrome de escritorio, y MUCHO más en un móvil, sobre todo con altavoz
##     Bluetooth) → el texto se iba hacia atrás y la letra dejaba de caer donde
##     se canta.
## Como la referencia es "que se vea igual que probando en Godot", en el
## navegador se hace lo mismo que en el editor: NO restar. Si algún día hace
## falta, `compensar_latencia` lo devuelve, y `ajuste_sincronia` permite afinar
## a mano sin tocar código.
func _pos_musica() -> float:
	if _musica == null or not _musica.playing:
		return 0.0
	var pos := _musica.get_playback_position() + AudioServer.get_time_since_last_mix()
	if compensar_latencia:
		pos -= AudioServer.get_output_latency()
	return pos + ajuste_sincronia


func _duracion_musica() -> float:
	if _musica == null or _musica.stream == null:
		return 0.0
	return _musica.stream.get_length()


## Apaga la música con un fundido (no espera: se solapa con el fundido a negro).
func _apagar_musica() -> void:
	if _musica == null or not _musica.playing:
		return
	var t := create_tween()
	t.tween_property(_musica, "volume_db", -60.0, musica_salida)
	await t.finished
	_musica.stop()


# ============================================================================
#  EL PLAN DE IMÁGENES — se calcula una sola vez, al empezar
# ============================================================================

# ============================================================================
#  ⚡ LA RÁFAGA — mosaico de paneles escalonados
# ============================================================================

## Calcula el guion completo de la ráfaga: cuándo cambia de fase, y para cada
## panel en qué segundo le toca cada estampa.
## Devuelve { "t0", "t1", "fases": [...], "cambios": [ {t, fase, panel, escena} ] }
func _calcular_rafaga() -> Dictionary:
	var v := int(RAFAGA["desde_verso"])
	if v < 0 or v + 1 >= LETRAS.size():
		return {}
	var t0 := float(LETRAS[v]["t"])
	var t1 := float(LETRAS[v + 1]["t"])
	var cierre: float = float(RAFAGA["cierre"])
	var util: float = maxf(0.5, (t1 - t0) - cierre)

	# Solo las estampas que existen en disco.
	var lista: Array = []
	for n in RAFAGA["escenas"]:
		if _existe(int(n)):
			lista.append(int(n))
		else:
			push_warning("Ráfaga: falta la estampa %d, se salta." % int(n))
	if lista.is_empty():
		return {}

	# 1) Duración de cada fase y cuántos "huecos de estampa" caben en ella.
	var fases: Array = []
	var peso_total := 0.0
	for f in RAFAGA["fases"]:
		peso_total += float(f["peso"])
	var cap_total := 0.0
	var t_acum := t0
	for f in RAFAGA["fases"]:
		var dur: float = util * float(f["peso"]) / peso_total
		var pan := int(f["paneles"])
		var cap: float = dur * float(pan)      # más paneles y más tiempo = más sitio
		fases.append({ "paneles": pan, "desde": t_acum, "dur": dur, "cap": cap })
		cap_total += cap
		t_acum += dur

	# 2) Repartir las estampas entre las fases, en proporción a su sitio.
	var restantes := lista.size()
	for i in fases.size():
		var f: Dictionary = fases[i]
		var n := int(round(float(lista.size()) * f["cap"] / cap_total))
		n = maxi(int(f["paneles"]), n)               # al menos una vuelta de paneles
		if i == fases.size() - 1:
			n = restantes                            # la última se queda con lo que falte
		n = mini(n, restantes)
		f["n"] = n
		restantes -= n
	# Si sobró alguna por redondeo, se la queda la última fase.
	if restantes > 0:
		fases[fases.size() - 1]["n"] = int(fases[fases.size() - 1]["n"]) + restantes

	# 3) Repartir el tiempo dentro de cada fase y asignar las estampas EN ORDEN.
	var cambios: Array = []
	var idx := 0
	for f in fases:
		var n := int(f["n"])
		if n <= 0:
			f["seg"] = f["dur"]
			continue
		var pan := int(f["paneles"])
		var seg: float = float(f["dur"]) * float(pan) / float(n)   # cada panel cambia cada `seg`
		f["seg"] = seg
		# Huecos de todos los paneles, ESCALONADOS para que no salten a la vez.
		var huecos: Array = []
		for p in pan:
			var desfase: float = seg * float(p) / float(pan)
			var t: float = float(f["desde"]) + desfase
			while t < float(f["desde"]) + float(f["dur"]) - 0.01:
				huecos.append({ "t": t, "panel": p })
				t += seg
		huecos.sort_custom(func(a, b): return float(a["t"]) < float(b["t"]))
		for h in huecos:
			if idx >= lista.size():
				break
			cambios.append({ "t": float(h["t"]), "paneles": pan,
				"panel": int(h["panel"]), "escena": lista[idx] })
			idx += 1

	# Lo que no haya cabido, se cuela al final de la última fase (nunca se pierde).
	while idx < lista.size():
		cambios.append({ "t": t1 - cierre - 0.01, "paneles": int(fases[-1]["paneles"]),
			"panel": idx % int(fases[-1]["paneles"]), "escena": lista[idx] })
		idx += 1

	return { "t0": t0, "t1": t1, "cierre": t1 - cierre, "fases": fases, "cambios": cambios }


## Imprime por consola cómo queda repartida la ráfaga, para poder afinarla.
func _informar_rafaga() -> void:
	print("\n⚡ RÁFAGA · del verso %d (%.2f s) al %d (%.2f s) — %d estampas + el cierre (%d)"
		% [int(RAFAGA["desde_verso"]), float(_rafaga["t0"]),
			int(RAFAGA["desde_verso"]) + 1, float(_rafaga["t1"]),
			_rafaga["cambios"].size(), int(RAFAGA["final"])])
	for f in _rafaga["fases"]:
		print("   fase de %d panel(es): %5.2f s → %5.2f s · %2d estampas · cada una %.2f s en pantalla"
			% [int(f["paneles"]), float(f["desde"]), float(f["desde"]) + float(f["dur"]),
				int(f.get("n", 0)), float(f.get("seg", 0.0))])
	for c in _rafaga["cambios"]:
		print("      %6.2f s · panel %d/%d · escena %2d  %s"
			% [float(c["t"]), int(c["panel"]) + 1, int(c["paneles"]), int(c["escena"]),
				str(NOMBRES.get(int(c["escena"]), ""))])
	print("      %6.2f s · CIERRE a pantalla completa · escena %d  %s\n"
		% [float(_rafaga["cierre"]), int(RAFAGA["final"]),
			str(NOMBRES.get(int(RAFAGA["final"]), ""))])


# ============================================================================
#  🕳 LA CAÍDA — cinta vertical continua
# ============================================================================

## Prepara los cuadritos de la caída: cada estampa en su sitio, ya colocada pero
## invisible, esperando su turno. Se hace una vez, al arrancar.
##
## El reparto: cada cuadro baja un escalón respecto al anterior y, si `zigzag`
## está puesto, va alternando lado. Así los ocho cuadros terminan trazando una
## diagonal descendente por la caja de imagen.
func _montar_caida() -> void:
	var v := int(CAIDA["desde_verso"])
	if v < 0 or v >= LETRAS.size():
		return
	_caida_t0 = float(LETRAS[v]["t"])
	_caida_t1 = float(LETRAS[v + 1]["t"]) if v + 1 < LETRAS.size() \
		else _caida_t0 + 8.0

	# Solo las que existen en disco.
	var lista: Array = []
	for n in CAIDA["escenas"]:
		if _existe(int(n)):
			lista.append(int(n))
		else:
			push_warning("Caída: falta la estampa %d, se salta." % int(n))
	if lista.is_empty():
		return

	# Tamaño del cuadro: se mantiene el 16:9 de las estampas.
	var ancho: float = _caja.size.x * clampf(float(CAIDA.get("tam", 0.4)), 0.15, 0.9)
	var alto: float = ancho * _caja.size.y / _caja.size.x
	var borde: float = float(CAIDA.get("borde", 0.0))
	var zigzag: bool = bool(CAIDA.get("zigzag", true))
	var n_total := lista.size()

	for i in n_total:
		var t: float = 0.0 if n_total <= 1 else float(i) / float(n_total - 1)
		# Baja un escalón por cuadro, de arriba del todo a abajo del todo.
		var y: float = (_caja.size.y - alto) * t
		# Y alterna lado, acercándose al centro según baja (así no queda un
		# zigzag mecánico y el último cae casi en medio).
		var x: float = (_caja.size.x - ancho) * 0.5
		if zigzag:
			var lado: float = 1.0 if i % 2 == 0 else -1.0
			x += lado * (_caja.size.x - ancho) * 0.5 * (1.0 - t * 0.55)

		# Marco claro detrás (el cuadro se despega del negro del fondo).
		var marco := ColorRect.new()
		marco.set_anchors_preset(Control.PRESET_TOP_LEFT)
		marco.offset_left = x - borde
		marco.offset_top = y - borde
		marco.offset_right = x + ancho + borde
		marco.offset_bottom = y + alto + borde
		marco.color = Color(0.75, 0.75, 0.82, 0.9) if borde > 0.0 else Color(0, 0, 0, 0)
		marco.mouse_filter = Control.MOUSE_FILTER_IGNORE
		marco.pivot_offset = Vector2(ancho + borde * 2.0, alto + borde * 2.0) / 2.0
		marco.modulate.a = 0.0
		_ventana_caida.add_child(marco)

		var img := TextureRect.new()
		img.set_anchors_preset(Control.PRESET_TOP_LEFT)
		img.offset_left = borde
		img.offset_top = borde
		img.offset_right = borde + ancho
		img.offset_bottom = borde + alto
		img.texture = _cargar(lista[i])
		img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		img.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		img.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		img.clip_contents = true
		img.mouse_filter = Control.MOUSE_FILTER_IGNORE
		marco.add_child(img)

		_cuadros.append(marco)
		_caida_n += 1

	if _caida_n > 0 and mostrar_reparto:
		print("\n🕳 CAÍDA · del verso %d (%.2f s) al %d (%.2f s) — %d cuadros que se van quedando"
			% [v, _caida_t0, v + 1, _caida_t1, _caida_n])
		print("   orden: %s" % str(lista))
		print("   aparece uno cada %.2f s · cuadro de %d×%d px\n"
			% [(_caida_t1 - _caida_t0) / float(_caida_n), int(ancho), int(alto)])


## Lleva la caída segundo a segundo: enciende la capa al entrar en su verso y va
## soltando un cuadro cada vez que toca. Los que ya salieron NO se quitan.
func _procesar_caida(pos: float) -> void:
	if _caida_n <= 0:
		return

	# Fuera de su verso: la capa no pinta nada y manda la estampa normal.
	if pos < _caida_t0 or pos >= _caida_t1:
		if _caida_activa:
			_caida_activa = false
			_ventana_caida.visible = false
			_capa_a.visible = true
			_capa_b.visible = true
		return

	# Al entrar, la caída tapa la estampa normal y se parte de cero.
	if not _caida_activa:
		_caida_activa = true
		_ventana_caida.visible = true
		_capa_a.visible = false
		_capa_b.visible = false      # la capa del crossfade también, o se asoma debajo
		for c in _cuadros:
			c.modulate.a = 0.0
		_idx_caida = 0

	# ¿Toca soltar cuadro? (se sueltan todos los pendientes, por si hubo un salto)
	var paso: float = maxf(0.05, (_caida_t1 - _caida_t0) / float(_caida_n))
	while _idx_caida < _caida_n and pos >= _caida_t0 + paso * float(_idx_caida):
		_aparecer_cuadro(_idx_caida)
		_idx_caida += 1


## Un cuadro entra: cae un poco desde arriba, con un golpecito de escala.
func _aparecer_cuadro(i: int) -> void:
	if i < 0 or i >= _cuadros.size():
		return
	var c: Control = _cuadros[i]
	if not is_instance_valid(c):
		return
	var y_final := c.position.y
	c.position.y = y_final - 14.0
	c.scale = Vector2(1.12, 1.12)
	c.modulate.a = 0.0
	var dur: float = maxf(0.06, float(CAIDA.get("entrada", 0.22)))
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(c, "modulate:a", 1.0, dur * 0.7)
	tw.tween_property(c, "position:y", y_final, dur) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(c, "scale", Vector2.ONE, dur) \
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


## Segundo en que arranca un clip (por verso o por "t" explícito).
func _inicio_clip(clip: Dictionary) -> float:
	if clip.has("t"):
		return float(clip["t"])
	var v := int(clip.get("desde_verso", -1))
	if v >= 0 and v < LETRAS.size():
		return float(LETRAS[v]["t"])
	return -1.0


## Enciende o apaga el clip que toque según el segundo de la canción.
func _procesar_videos(pos: float) -> void:
	if _video == null:
		return
	var toca := -1
	for i in VIDEOS.size():
		var t0 := _inicio_clip(VIDEOS[i])
		if t0 >= 0.0 and pos >= t0 and pos < t0 + float(VIDEOS[i].get("dur", 8.0)):
			toca = i
			break

	if toca == _clip_actual:
		return

	if toca < 0:                      # se acabó el clip: vuelven las estampas
		_video.stop()
		_video.visible = false
		_capa_a.visible = true
		_clip_actual = -1
		return

	var ruta := str(VIDEOS[toca].get("archivo", ""))
	var flujo: VideoStream = load(ruta) as VideoStream if ResourceLoader.exists(ruta) else null
	if flujo == null:
		push_warning("Prólogo: no encuentro el clip '%s'; sigo con las estampas." % ruta)
		_clip_actual = -1
		return

	_clip_actual = toca
	_video.stream = flujo
	_video.visible = true
	_capa_a.visible = false
	_capa_paneles.visible = false
	_video.play()
	# Si entramos a mitad (por `empezar_en` o por un salto), lo adelantamos.
	var desfase := pos - _inicio_clip(VIDEOS[toca])
	if desfase > 0.2:
		_video.stream_position = desfase
	print("🎬 clip %s desde %.2f s" % [ruta.get_file(), _inicio_clip(VIDEOS[toca])])


## Lleva el mosaico segundo a segundo: enciende/apaga la capa, cambia de fase
## cuando toca, va metiendo estampas en los paneles y hace el cierre final.
func _procesar_rafaga(pos: float) -> void:
	if _rafaga.is_empty():
		return
	var t0: float = float(_rafaga["t0"])
	var t1: float = float(_rafaga["t1"])

	# Fuera de su tramo: el mosaico no pinta nada.
	if pos < t0 or pos >= t1:
		if _capa_paneles.visible and pos >= t1:
			_capa_paneles.visible = false
			_capa_a.visible = true
		return

	# Al entrar, el mosaico tapa la estampa normal.
	if not _capa_paneles.visible and not _rafaga_cerrada:
		_capa_paneles.visible = true
		_capa_a.visible = false
		_fogonazo(0.6, 0.25)

	# Cierre: todo colapsa en la estampa final a pantalla completa.
	if not _rafaga_cerrada and pos >= float(_rafaga["cierre"]):
		_rafaga_cerrada = true
		_cerrar_rafaga()
		return
	if _rafaga_cerrada:
		return

	# Cambios que ya tocan (se procesan todos los pendientes, por si hubo un salto).
	var cambios: Array = _rafaga["cambios"]
	while _idx_rafaga < cambios.size() and pos >= float(cambios[_idx_rafaga]["t"]):
		var c: Dictionary = cambios[_idx_rafaga]
		_idx_rafaga += 1
		var pan := int(c["paneles"])
		if pan != _paneles_actuales:
			_paneles_actuales = pan
			_montar_paneles(pan)
		var seg := 0.8
		for f in _rafaga["fases"]:
			if int(f["paneles"]) == pan:
				seg = float(f.get("seg", 0.8))
				break
		_poner_en_panel(int(c["panel"]), int(c["escena"]), seg)


## Rectángulos (dentro de la caja de imagen) para repartir la pantalla en N paneles.
func _rejilla(n: int) -> Array:
	var cols := 1
	var filas := 1
	match n:
		1: cols = 1; filas = 1
		2: cols = 2; filas = 1
		3: cols = 3; filas = 1
		4: cols = 2; filas = 2
		6: cols = 3; filas = 2
		8: cols = 4; filas = 2
		9: cols = 3; filas = 3
		_: cols = n; filas = 1
	var hueco := 4.0 if n > 1 else 0.0
	var ancho: float = (_caja.size.x - hueco * float(cols - 1)) / float(cols)
	var alto: float = (_caja.size.y - hueco * float(filas - 1)) / float(filas)
	var rects: Array = []
	for f in filas:
		for c in cols:
			rects.append(Rect2(
				_caja.position.x + float(c) * (ancho + hueco),
				_caja.position.y + float(f) * (alto + hueco),
				ancho, alto))
	return rects


## Rehace los paneles cuando cambia la fase (y da un fogonazo blanco).
func _montar_paneles(n: int) -> void:
	for p in _paneles:
		if is_instance_valid(p):
			p.queue_free()
	_paneles.clear()
	for r in _rejilla(n):
		var t := TextureRect.new()
		t.set_anchors_preset(Control.PRESET_TOP_LEFT)
		t.offset_left = r.position.x
		t.offset_top = r.position.y
		t.offset_right = r.position.x + r.size.x
		t.offset_bottom = r.position.y + r.size.y
		t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED   # llena el panel
		t.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		t.clip_contents = true
		t.mouse_filter = Control.MOUSE_FILTER_IGNORE
		t.pivot_offset = r.size / 2.0
		t.modulate.a = 0.0
		_capa_paneles.add_child(t)

		# La PALABRA del problema, estampada abajo en el propio panel.
		var etiqueta := Label.new()
		etiqueta.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		etiqueta.offset_top = -_tam_palabra(n) - 14.0
		etiqueta.offset_bottom = -6.0
		etiqueta.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		etiqueta.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		etiqueta.autowrap_mode = TextServer.AUTOWRAP_OFF
		etiqueta.mouse_filter = Control.MOUSE_FILTER_IGNORE
		# MISMA tipografía que los subtítulos de la narración: Silkscreen Regular y
		# el mismo blanco azulado. Solo se le añade un contorno FINO, porque aquí
		# la palabra va sobre la imagen y no sobre negro como los subtítulos.
		var fuente: FontFile = load("res://assets/Fonts/Silkscreen-Regular.ttf")
		if fuente != null:
			etiqueta.add_theme_font_override("font", fuente)
		etiqueta.add_theme_font_size_override("font_size", _tam_palabra(n))
		etiqueta.add_theme_color_override("font_color", Color(0.93, 0.93, 0.98))
		etiqueta.add_theme_constant_override("outline_size", 5)
		etiqueta.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
		etiqueta.modulate.a = 0.0
		t.add_child(etiqueta)

		_paneles.append(t)
	_fogonazo(0.5, 0.22)


## Tamaño de letra de la palabra, tomando como base el de los subtítulos
## (`tamano_letra`) para que se lean como la misma voz. Cuantos más paneles,
## más pequeña, para que quepa en su hueco.
func _tam_palabra(paneles: int) -> int:
	match paneles:
		1: return tamano_letra + 10
		2: return tamano_letra + 2
		3: return tamano_letra - 2
		4: return tamano_letra - 4
		_: return tamano_letra - 8


## Mete una estampa en un panel, con un golpe de escala y una entrada rápida.
func _poner_en_panel(i: int, escena: int, seg: float) -> void:
	if i < 0 or i >= _paneles.size():
		return
	var t: TextureRect = _paneles[i]
	var tex := _cargar(escena)
	if tex == null:
		return
	t.texture = tex
	t.modulate.a = 0.25
	t.scale = Vector2(1.06, 1.06)
	var dur: float = clampf(seg * 0.35, 0.06, 0.16)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(t, "modulate:a", 1.0, dur)
	tw.tween_property(t, "scale", Vector2.ONE, minf(seg * 0.9, 0.35))

	# La palabra entra un pelín después que la imagen, subiendo desde abajo.
	if t.get_child_count() > 0:
		var etq := t.get_child(0) as Label
		if etq != null:
			etq.text = str(PALABRAS.get(escena, ""))
			etq.modulate.a = 0.0
			var y0 := etq.position.y
			etq.position.y = y0 + 10.0
			var tw2 := create_tween()
			tw2.set_parallel(true)
			tw2.tween_property(etq, "modulate:a", 1.0, minf(seg * 0.30, 0.18)) \
				.set_delay(minf(seg * 0.20, 0.10))
			tw2.tween_property(etq, "position:y", y0, minf(seg * 0.45, 0.26)) \
				.set_delay(minf(seg * 0.20, 0.10)).set_trans(Tween.TRANS_CUBIC) \
				.set_ease(Tween.EASE_OUT)


## Fogonazo blanco sobre la caja de imagen (para marcar los saltos de fase).
func _fogonazo(fuerza: float, dur: float) -> void:
	if _flash == null:
		return
	_flash.modulate.a = fuerza
	var tw := create_tween()
	tw.tween_property(_flash, "modulate:a", 0.0, dur)


## Cierra la ráfaga: se quitan los paneles y entra la estampa final a pantalla
## completa, que se queda hasta el verso siguiente.
func _cerrar_rafaga() -> void:
	for p in _paneles:
		if is_instance_valid(p):
			p.queue_free()
	_paneles.clear()
	_fogonazo(0.75, 0.35)
	var tex := _cargar(int(RAFAGA["final"]))
	if tex != null:
		_capa_a.texture = tex
		_capa_a.modulate.a = 1.0
		_capa_b.modulate.a = 0.0
	_capa_paneles.visible = true      # sigue viva: aquí va la palabra final
	_capa_a.visible = true

	# La última palabra, grande y centrada sobre la imagen del mundo gris.
	var final_txt := str(PALABRAS.get(int(RAFAGA["final"]), ""))
	if final_txt == "":
		return
	var etq := Label.new()
	etq.set_anchors_preset(Control.PRESET_TOP_LEFT)
	etq.offset_left = _caja.position.x
	etq.offset_right = _caja.position.x + _caja.size.x
	etq.offset_top = _caja.position.y + _caja.size.y * 0.42
	etq.offset_bottom = _caja.position.y + _caja.size.y * 0.62
	etq.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	etq.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	etq.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fuente: FontFile = load("res://assets/Fonts/Silkscreen-Regular.ttf")
	if fuente != null:
		etq.add_theme_font_override("font", fuente)
	etq.add_theme_font_size_override("font_size", tamano_letra * 2)
	etq.add_theme_color_override("font_color", Color(0.93, 0.93, 0.98))
	etq.add_theme_constant_override("outline_size", 6)
	etq.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
	etq.text = final_txt
	etq.modulate.a = 0.0
	etq.scale = Vector2(1.15, 1.15)
	etq.pivot_offset = Vector2(_caja.size.x / 2.0, _caja.size.y * 0.10)
	_capa_paneles.add_child(etq)
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(etq, "modulate:a", 1.0, 0.45)
	tw.tween_property(etq, "scale", Vector2.ONE, 0.7) \
		.set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


## Segundo en que ARRANCA un tramo: el del verso al que está anclado.
func _inicio_tramo(tramo: Dictionary) -> float:
	var v := int(tramo.get("desde_verso", -1))
	if v < 0 or v >= LETRAS.size():
		return inicio_imagenes
	return float(LETRAS[v]["t"])


## Convierte los TRAMOS en una lista plana de { "t": segundo, "escena": nº }.
##
## Cómo se decide cuánto dura cada estampa, por orden de prioridad:
##   1. Si la estampa está en DURACIONES → dura EXACTAMENTE esos segundos.
##   2. Si su tramo tiene "seg" → dura esos segundos.
##   3. Si no → se reparte a partes iguales el tiempo que sobre en el tramo.
## El tramo termina cuando empieza el siguiente (lo marca la canción), así que
## alargar una estampa acorta a las demás del mismo tramo.
func _calcular_plan_imagenes() -> Array:
	var plan: Array = []
	var final := fin_imagenes
	if final <= 0.0:
		# Automático: un poco después del último verso, para que las últimas
		# estampas caigan sobre las últimas palabras cantadas.
		final = float(LETRAS[LETRAS.size() - 1]["t"]) + cola_final
		var dur := _duracion_musica()
		if dur > 0.0:
			final = minf(final, dur - musica_salida)

	for i in TRAMOS.size():
		var tramo: Dictionary = TRAMOS[i]
		var desde := _inicio_tramo(tramo)
		var hasta := _inicio_tramo(TRAMOS[i + 1]) if i + 1 < TRAMOS.size() else final

		# Solo las estampas que de verdad están en disco.
		var escenas: Array = []
		for n in tramo["escenas"]:
			if _existe(n):
				escenas.append(int(n))
			else:
				push_warning("Prólogo: falta la estampa %d, se salta." % int(n))
		if escenas.is_empty():
			continue

		var hueco: float = maxf(0.1, hasta - desde)
		var seg_tramo: float = float(tramo.get("seg", 0.0))   # 0 = sin ritmo propio

		# 1) Duración fija de cada estampa (si la tiene) y cuánto tiempo queda
		#    para repartir entre las que no la tienen.
		var duraciones: Array = []
		var ocupado := 0.0
		var libres := 0
		for n in escenas:
			var d := 0.0
			if DURACIONES.has(n):
				d = float(DURACIONES[n])
			elif seg_tramo > 0.0:
				d = seg_tramo
			if d > 0.0:
				ocupado += d
			else:
				libres += 1
			duraciones.append(d)

		# 2) Lo que sobra, a partes iguales entre las estampas sin duración fija.
		var seg_libre := 0.0
		if libres > 0:
			seg_libre = maxf(0.15, (hueco - ocupado) / float(libres))
			for j in duraciones.size():
				if duraciones[j] <= 0.0:
					duraciones[j] = seg_libre

		# 3) Colocarlas una detrás de otra desde el inicio del tramo.
		var t := desde
		var minimo := 999.0
		for j in escenas.size():
			plan.append({ "t": t, "escena": escenas[j] })
			minimo = minf(minimo, duraciones[j])
			t += duraciones[j]

		# Avisos honestos.
		if minimo < 1.0:
			push_warning("Prólogo: en el tramo que empieza en %.1f s hay estampas de solo %.2f s "
				% [desde, minimo]
				+ "(%d estampas en %.1f s). Se ven como un destello: quítale estampas, "
				% [escenas.size(), hueco]
				+ "muévele el corte a un verso posterior o alarga la canción.")
		if t > hasta + 0.05:
			push_warning("Prólogo: el tramo que empieza en %.1f s se pasa %.1f s de su hueco "
				% [desde, t - hasta]
				+ "(las duraciones fijas suman de más). Las siguientes estampas irán tarde.")

		print("Prólogo · tramo %6.2f s → %6.2f s : %2d estampas, %.2f s cada una%s"
			% [desde, hasta, escenas.size(), hueco / float(escenas.size()),
				("  (con duraciones fijas)" if ocupado > 0.0 else "")])

		if mostrar_reparto:
			for j in escenas.size():
				print("    escena %2d  ->  entra en %6.2f s   dura %5.2f s%s"
					% [escenas[j], plan[plan.size() - escenas.size() + j]["t"],
						duraciones[j], ("  [FIJA]" if DURACIONES.has(escenas[j]) else "")])

	plan.sort_custom(func(a, b): return float(a["t"]) < float(b["t"]))
	return plan


# ============================================================================
#  REPRODUCCIÓN — un solo _process leyendo el reloj de la canción
# ============================================================================

func _process(_delta: float) -> void:
	if _terminado or calibrar_letras:
		return
	var pos := _pos_musica()

	# 1) ¿Toca cambiar de verso?
	var siguiente := _idx_verso + 1
	while siguiente < LETRAS.size() and pos >= float(LETRAS[siguiente]["t"]):
		_idx_verso = siguiente
		_mostrar_verso(_idx_verso)
		siguiente += 1

	# 2) ¿Toca cambiar de estampa?
	while _idx_imagen < _plan_imagenes.size() \
			and pos >= float(_plan_imagenes[_idx_imagen]["t"]):
		var paso: Dictionary = _plan_imagenes[_idx_imagen]
		_idx_imagen += 1
		_cambiar_imagen(int(paso["escena"]))

	# 2-bis) 🎬 LOS CLIPS DE VÍDEO mandan sobre todo lo demás mientras duran.
	_procesar_videos(pos)

	# 2-ter) ⚡ LA RÁFAGA: el mosaico manda mientras dura su tramo.
	if _clip_actual < 0:
		_procesar_rafaga(pos)
		# 2-quáter) 🕳 LA CAÍDA: la cinta manda mientras dura su verso.
		_procesar_caida(pos)

	# 3) ¿Se acabó la canción? Cerramos con tiempo para el fundido.
	var dur := _duracion_musica()
	if dur > 0.0 and pos >= dur - musica_salida:
		_ir_a_siguiente()


## Pone el verso en pantalla. Según `aparicion`:
##   · BARRIDO → la frase se revela ENTERA de izquierda a derecha en
##     `barrido_dur` segundos (rápido: el ojo la ancla al instante).
##   · TECLEO → se escribe carácter a carácter, al ritmo del hueco del verso.
func _mostrar_verso(i: int) -> void:
	var verso: Dictionary = LETRAS[i]
	var cuerpo := str(verso["texto"])

	if _tween_texto != null and _tween_texto.is_valid():
		_tween_texto.kill()

	if cuerpo == "":
		_fundir(_texto, 0.0, 0.5)
		return

	_texto.text = cuerpo
	_texto.modulate.a = 1.0

	if aparicion == Aparicion.BARRIDO:
		# Todas las letras puestas desde el primer fotograma; quien las va
		# descubriendo es el frente del shader.
		_texto.visible_ratio = 1.0
		var mat := _texto.material as ShaderMaterial
		if mat == null:
			return
		mat.set_shader_parameter("suavizado", suavizado_barrido)
		mat.set_shader_parameter("progreso", 0.0)
		_tween_texto = create_tween()
		# EASE_OUT: entra decidido y frena al final, así el arranque de la frase
		# coincide con el golpe de voz y el remate no se siente brusco.
		_tween_texto.tween_property(mat, "shader_parameter/progreso", 1.0, barrido_dur) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
		return

	# --- TECLEO (el efecto antiguo) ---
	# El barrido se deja abierto del todo para que no recorte nada.
	var mat_t := _texto.material as ShaderMaterial
	if mat_t != null:
		mat_t.set_shader_parameter("progreso", 1.0)
	_texto.visible_characters = 0

	# Cuánto dura el hueco de este verso: hasta el siguiente (o un margen si es
	# el último).
	var fin: float = float(LETRAS[i + 1]["t"]) if i + 1 < LETRAS.size() \
		else float(verso["t"]) + 6.0
	var hueco: float = maxf(0.6, fin - float(verso["t"]))

	# El tecleo ocupa una parte del hueco, PERO nunca más de `tecleo_max`: así la
	# frase termina de escribirse antes de que se acabe de cantar, aunque después
	# venga un instrumental largo.
	var dur_tecleo: float = minf(hueco * proporcion_tecleo, tecleo_max)

	var total := _texto.get_total_character_count()
	_tween_texto = create_tween()
	_tween_texto.tween_property(_texto, "visible_characters", total, dur_tecleo)


## Cruza a la estampa nueva. Si las estampas van muy seguidas, el cruce se
## acorta solo para que no se solapen tres imágenes a la vez.
func _cambiar_imagen(n: int) -> void:
	var tex := _cargar(n)
	if tex == null:
		return
	# Primera imagen del prólogo: entra sin cruce.
	if _capa_a.texture == null:
		_capa_a.texture = tex
		_capa_a.modulate.a = 1.0
		return
	# Si veníamos de un cruce a medias, lo damos por terminado.
	if _cruzando:
		_capa_a.texture = _capa_b.texture
		_capa_a.modulate.a = 1.0
	_cruzando = true
	_capa_b.texture = tex
	_capa_b.modulate.a = 0.0
	var t := create_tween()
	t.tween_property(_capa_b, "modulate:a", 1.0, _dur_cruce())
	await t.finished
	_capa_a.texture = tex
	_capa_a.modulate.a = 1.0
	_capa_b.modulate.a = 0.0
	_cruzando = false


## El cruce nunca puede durar más de la mitad de lo que dura la estampa.
func _dur_cruce() -> float:
	var seg := 1.2
	if _idx_imagen > 0 and _idx_imagen < _plan_imagenes.size():
		seg = float(_plan_imagenes[_idx_imagen]["t"]) \
			- float(_plan_imagenes[_idx_imagen - 1]["t"])
	return clampf(crossfade, 0.1, maxf(0.1, seg * 0.5))


func _existe(n: int) -> bool:
	return ResourceLoader.exists("res://assets/Prologo/escenas/escena_%02d.png" % n)


func _cargar(n: int) -> Texture2D:
	return load("res://assets/Prologo/escenas/escena_%02d.png" % n) as Texture2D


func _fundir(nodo: CanvasItem, destino: float, dur: float) -> void:
	var t := create_tween()
	t.tween_property(nodo, "modulate:a", destino, dur)
	await t.finished


## Cierra el prólogo: funde a negro y apaga la música a la vez, y luego cambia de
## escena (así no se corta en seco ni la imagen ni el sonido).
func _ir_a_siguiente() -> void:
	if _terminado:
		return
	_terminado = true
	_apagar_musica()
	if _velo != null:
		await _fundir(_velo, 1.0, musica_salida)
	if escena_siguiente != "":
		get_tree().change_scene_to_file(escena_siguiente)


func _input(evento: InputEvent) -> void:
	if calibrar_letras:
		_input_calibracion(evento)
		return
	# Esc salta todo el prólogo.
	if evento is InputEventKey and evento.pressed and not evento.is_echo() \
			and evento.keycode == KEY_ESCAPE:
		_ir_a_siguiente()


# ============================================================================
#  MODO CALIBRACIÓN — pulsar ESPACIO al ritmo del canto para medir la letra
# ============================================================================

func _arrancar_calibracion() -> void:
	_capa_a.modulate.a = 0.0
	_capa_b.modulate.a = 0.0
	_texto.modulate.a = 1.0
	_texto.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	# Se usa toda la pantalla para las instrucciones.
	_texto.offset_top = 60.0
	_texto.offset_bottom = BASE_ALTO - 40.0
	_pintar_calibracion()
	print("\n=== CALIBRACIÓN DE LA LETRA ===")
	print("Pulsa ESPACIO justo cuando empiece a cantarse cada verso.")
	print("BORRAR = deshacer el último · ESC = terminar antes.\n")


func _pintar_calibracion() -> void:
	var i := _tiempos_medidos.size()
	if i >= LETRAS.size():
		_texto.text = "LISTO\n\nMira la consola:\nahí está el bloque LETRAS para pegar."
		return
	var anterior := ""
	if i > 0:
		anterior = "\n\nanterior: %.2f s  ->  %s" % [
			_tiempos_medidos[i - 1], str(LETRAS[i - 1]["texto"])]
	_texto.text = "CALIBRANDO  %d / %d\n\nESPACIO cuando empiece:\n\n%s%s" % [
		i + 1, LETRAS.size(), str(LETRAS[i]["texto"]), anterior]


func _input_calibracion(evento: InputEvent) -> void:
	if not (evento is InputEventKey) or not evento.pressed or evento.is_echo():
		return
	var k := evento as InputEventKey
	match k.keycode:
		KEY_SPACE:
			if _tiempos_medidos.size() < LETRAS.size():
				_tiempos_medidos.append(_pos_musica())
				_pintar_calibracion()
				if _tiempos_medidos.size() == LETRAS.size():
					_volcar_calibracion()
		KEY_BACKSPACE:
			if not _tiempos_medidos.is_empty():
				_tiempos_medidos.remove_at(_tiempos_medidos.size() - 1)
				_pintar_calibracion()
		KEY_ESCAPE:
			_volcar_calibracion()


## Escribe el bloque LETRAS ya formateado, en la consola y en un archivo.
func _volcar_calibracion() -> void:
	var lineas := "const LETRAS := [\n"
	for i in LETRAS.size():
		var t := _tiempos_medidos[i] if i < _tiempos_medidos.size() \
			else float(LETRAS[i]["t"])
		lineas += "\t{ \"t\": %.2f, \"texto\": \"%s\" },\n" % [t, str(LETRAS[i]["texto"])]
	lineas += "]\n"

	print("\n--- PEGA ESTO EN Prologo.gd -------------------------------------")
	print(lineas)
	var ruta := "user://letras_calibradas.txt"
	var f := FileAccess.open(ruta, FileAccess.WRITE)
	if f != null:
		f.store_string(lineas)
		f.close()
		print("También guardado en: ", ProjectSettings.globalize_path(ruta))
	print("-----------------------------------------------------------------\n")
