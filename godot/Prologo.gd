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
	{ "t": 40.5,  "texto": "y cambiamos el sol por un brillo más frío." },
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
const TRAMOS := [
	# Antes de que empiece a cantar: una sola estampa, quieta, abriendo el prólogo.
	{ "desde_verso": -1, "escenas": [1] },

	# Versos 1-3 · la devoción: lo único bonito del prólogo, va lento.
	# La 67 (noche de convivencia), la 68 (la aldea se retira del Hoyo) y la 69
	# (ya de camino a casa, otra zona) van detrás de la 3. Las estampas nuevas se
	# numeran a partir de 67 para no renumerar las 66 originales: el ORDEN lo
	# manda esta lista, no el número de archivo.
	{ "desde_verso": 0, "escenas": [2, 3, 67, 68, 69, 4, 5, 6] },

	# Verso 4 ("un alma en el suelo y un suelo en el mar") · la isla y el mar.
	{ "desde_verso": 3, "escenas": [10, 12] },

	# Verso 5 ("lo nuestro fue mío") · el Hoyo abandonado y las raíces.
	{ "desde_verso": 4, "escenas": [7, 8, 9, 11] },

	# Versos 6-8 + instrumental · LA RÁFAGA: todo lo que el humano rompió.
	# Van agrupadas por tema (no por número) para que los destellos tengan lógica:
	# el mundo gris → la codicia → la violencia → los que debían cuidar → la
	# tierra → la guerra y el gris final.
	{ "desde_verso": 5, "escenas": [
		13, 14, 15,
		39, 36, 35, 30, 31, 29, 23, 45, 46, 44,
		16, 17, 18, 19, 33, 22, 32, 40, 24,
		21, 34, 26, 25, 38, 27, 28, 37, 20,
		41, 42, 43,
		47, 48, 49, 50, 51, 52,
	] },

	# Verso 10 ("los pequeños corrieron al borde del día") · el Acto 4 entero,
	# respirando otra vez. La caída (65) y el fondo del Hoyo (66) caen justo en
	# los dos últimos versos.
	{ "desde_verso": 9, "escenas": [
		53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,
	] },
]


## A dónde ir al terminar el prólogo.
@export_file("*.tscn") var escena_siguiente: String = "res://Intro.tscn"

@export_group("Calibración de la letra")
## Actívalo para MEDIR los tiempos de la letra pulsando ESPACIO al ritmo del canto.
## Al terminar imprime el bloque LETRAS listo para pegar en este script.
@export var calibrar_letras: bool = false

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
## Qué parte del hueco de un verso se tarda en teclearlo (0.35 = el 35 %).
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
var _terminado := false

# --- Estado de la reproducción ----------------------------------------------
## Guion de imágenes ya calculado: [{ "t": segundo, "escena": nº }, ...]
var _plan_imagenes: Array = []
var _idx_imagen := 0
var _idx_verso := -1
var _tween_texto: Tween = null
var _cruzando := false

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


## Segundo EXACTO de la canción, compensando el buffer de audio. Es la receta
## estándar de Godot para sincronizar cosas con música: `get_playback_position`
## solo se actualiza cada bloque de mezcla, así que se le suma el tiempo
## transcurrido desde la última mezcla y se le resta la latencia de salida.
func _pos_musica() -> float:
	if _musica == null or not _musica.playing:
		return 0.0
	return _musica.get_playback_position() \
		+ AudioServer.get_time_since_last_mix() \
		- AudioServer.get_output_latency()


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

## Segundo en que ARRANCA un tramo: el del verso al que está anclado.
func _inicio_tramo(tramo: Dictionary) -> float:
	var v := int(tramo.get("desde_verso", -1))
	if v < 0 or v >= LETRAS.size():
		return inicio_imagenes
	return float(LETRAS[v]["t"])


## Convierte los TRAMOS en una lista plana de { "t": segundo, "escena": nº }.
## Cada tramo ocupa desde su verso hasta el verso del tramo siguiente, y reparte
## sus estampas por igual dentro de ese hueco. Se saltan las que no existan.
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
		var seg: float = hueco / float(escenas.size())
		for j in escenas.size():
			plan.append({ "t": desde + seg * float(j), "escena": escenas[j] })

		# Aviso honesto: si las estampas van a menos de 1 s se ven como un
		# destello y no se llegan a leer.
		if seg < 1.0:
			push_warning("Prólogo: el tramo que empieza en %.1f s mete %d estampas en %.1f s "
				% [desde, escenas.size(), hueco]
				+ "(%.2f s cada una). Quita estampas de ese tramo o alarga la canción." % seg)
		print("Prólogo · tramo desde %6.2f s → %6.2f s : %2d estampas, %.2f s cada una"
			% [desde, hasta, escenas.size(), seg])

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

	# 3) ¿Se acabó la canción? Cerramos con tiempo para el fundido.
	var dur := _duracion_musica()
	if dur > 0.0 and pos >= dur - musica_salida:
		_ir_a_siguiente()


## Pone el verso en pantalla y lo teclea al ritmo de lo que dura ese verso.
func _mostrar_verso(i: int) -> void:
	var verso: Dictionary = LETRAS[i]
	var cuerpo := str(verso["texto"])

	if _tween_texto != null and _tween_texto.is_valid():
		_tween_texto.kill()

	if cuerpo == "":
		_fundir(_texto, 0.0, 0.5)
		return

	_texto.text = cuerpo
	_texto.visible_characters = 0
	_texto.modulate.a = 1.0

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
