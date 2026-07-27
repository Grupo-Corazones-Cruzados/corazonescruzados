extends Control

## ============================================================================
##  REPRODUCTOR DE ESTAMPAS — el prólogo estilo Undertale (auto + máquina de escribir)
## ============================================================================
##  Reproduce SOLO (sin clic) una serie de BLOQUES. Cada bloque tiene un texto y
##  un grupo de escenas (imágenes de assets/Prologo/escenas/). Estilo Undertale:
##  la imagen va CENTRADA en una caja de TAMAÑO FIJO y el texto se va ESCRIBIENDO
##  DEBAJO, sobre negro. Al terminar, carga la intro del juego.
##
##  ⚠ TAMAÑOS FIJOS: todo se mide sobre el lienzo base de 960×540 que define
##  `project.godot` (stretch mode = canvas_items, aspect = keep). El motor escala
##  ese lienzo completo a la ventana, así que la imagen y las letras conservan
##  SIEMPRE el mismo tamaño y proporción, sin importar la pantalla o el navegador.
##  Si algún día cambias el viewport del proyecto, cambia también BASE_ANCHO/ALTO.
##
##  Todo es editable: cambia los textos, el orden de las escenas de cada bloque,
##  o los tiempos y tamaños (abajo, @export en el Inspector).
## ============================================================================

## Lienzo base del proyecto (debe coincidir con display/window/size del project.godot).
const BASE_ANCHO := 960.0
const BASE_ALTO := 540.0

## A dónde ir al terminar el prólogo.
@export_file("*.tscn") var escena_siguiente: String = "res://Intro.tscn"

@export_group("Tiempos")
## Segundos que dura cada imagen en pantalla.
@export var seg_por_escena: float = 4.0
## Velocidad de tecleo del texto (caracteres por segundo).
@export var velocidad_texto: float = 20.0
## Duración del cruce (crossfade) entre imágenes.
@export var crossfade: float = 1.0

@export_group("Música")
## Pista que suena durante todo el prólogo. Dura 2:15 y el prólogo ~4:24, así que
## se pone en BUCLE automáticamente (se repite una vez).
@export_file("*.mp3", "*.ogg", "*.wav") var musica: String = "res://assets/Audio/Musica/Pixel Heart Quest - AI Music (8).mp3"
## Volumen de la música, en decibelios (0 = tal cual viene; negativo = más bajo).
@export_range(-40.0, 6.0, 0.5) var musica_db: float = -6.0
## Segundos que tarda la música en entrar al empezar el prólogo.
@export var musica_entrada: float = 3.0
## Segundos que tarda en apagarse al terminar (o al saltar el prólogo).
@export var musica_salida: float = 2.5

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


## --- EL GUION: bloques de (texto + escenas que lo acompañan) -----------------
## Reorganización temática de las 66 escenas para que cada frase tenga imágenes
## que de verdad la representen. Puedes reordenar escenas o mover números de un
## bloque a otro libremente.
const GUION := [
	{ "texto": "Hace mucho tiempo, los humanos amaban un lugar.\nLo llamaban el Hoyo, y le daban las gracias,\ncreyendo que en lo hondo alguien los cuidaba.",
	  "escenas": [1, 2, 3, 4] },

	{ "texto": "Pero dar las gracias se volvió costumbre...\ny la costumbre, olvido.\nHasta que un día, ya nadie volvió.",
	  "escenas": [5, 6, 7] },

	{ "texto": "Y algo, muy adentro, empezó a marchitarse.",
	  "escenas": [8, 9] },

	{ "texto": "Lo que se deja de cuidar se pudre;\ny lo podrido, tarde o temprano, se hunde.",
	  "escenas": [10, 11, 12] },

	{ "texto": "El mundo siguió girando, creyéndose libre,\nsin notar que se apagaba por dentro.",
	  "escenas": [13, 14, 15] },

	{ "texto": "Donde faltó el cuidado, creció el miedo.\nY el miedo enseñó a los hombres a destruirse.",
	  "escenas": [16, 17, 18, 19, 20] },

	{ "texto": "Cada quien se creyó mejor que el otro,\ny despreció lo que no quiso entender.",
	  "escenas": [21, 34, 26] },

	{ "texto": "Cada quien tomó lo que pudo,\nsin mirar a quién dejaba sin nada.",
	  "escenas": [23, 29, 45, 46, 44] },

	{ "texto": "El trabajo apenas alcanzaba para no morir;\ny muchos, para no ver, prefirieron huir.",
	  "escenas": [27, 30, 37] },

	{ "texto": "Y hasta en casa, quien debía cuidar, hería.",
	  "escenas": [31, 28] },

	{ "texto": "Los que debían guiar y proteger...\ncallaron, o enseñaron a hacer el mal.",
	  "escenas": [22, 25, 24, 40, 33, 32, 38] },

	{ "texto": "Y en las sombras, unos pocos\njugaban con la vida de todos.",
	  "escenas": [35, 36, 39] },

	{ "texto": "Le cobramos a la tierra hasta su última gota.",
	  "escenas": [41, 42, 43] },

	{ "texto": "Hasta que la tierra nos cobró a nosotros.",
	  "escenas": [47, 48, 49] },

	{ "texto": "Y el gris lo cubrió todo.",
	  "escenas": [50, 51, 52] },

	{ "texto": "Al final quedaron muy pocos.\nY los pocos, huían.",
	  "escenas": [53, 54] },

	{ "texto": "Uno de ellos, todavía sin nombre,\nreconoció a lo lejos aquel viejo lugar.",
	  "escenas": [55, 56] },

	{ "texto": "El mundo le quitó casi todo...\nmenos a sus hermanos.",
	  "escenas": [57, 58, 59, 60] },

	{ "texto": "Corrió, con ellos de la mano,\nhacia lo único que le quedaba.",
	  "escenas": [61, 62, 63, 64] },

	{ "texto": "No sabía si algo lo esperaba allá abajo.\nSolo saltó.",
	  "escenas": [65, 66] },
]


# --- Nodos construidos por código -------------------------------------------
var _capa_a: TextureRect   # imagen visible
var _capa_b: TextureRect   # imagen entrante (para el crossfade)
var _texto: Label          # la narración, debajo de la imagen (tamaño fijo)
var _musica: AudioStreamPlayer
var _velo: ColorRect       # negro por encima de todo, para el cierre
var _terminado := false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_construir_ui()
	_construir_musica()
	_reproducir()


func _construir_ui() -> void:
	# --- Composición (todo en coordenadas fijas del lienzo 960×540) -----------
	# El bloque "imagen + texto" se centra verticalmente como un conjunto.
	var ancho_img := float(caja_imagen.x)
	var alto_img := float(caja_imagen.y)
	var alto_total := alto_img + separacion + alto_texto
	var img_x := (BASE_ANCHO - ancho_img) / 2.0      # centrada horizontalmente
	var img_y := (BASE_ALTO - alto_total) / 2.0
	var texto_y := img_y + alto_img + separacion
	var margen_texto := 60.0                          # aire lateral de la narración

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

	# La narración: DEBAJO de la imagen, centrada, tamaño de letra FIJO.
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


## Arranca la música del prólogo, en bucle y entrando con un fundido suave.
func _construir_musica() -> void:
	if musica == "":
		return
	var pista: AudioStream = load(musica) as AudioStream
	if pista == null:
		push_warning("Prólogo: no se pudo cargar la música '%s'." % musica)
		return
	# La pista es más corta que el prólogo → que se repita.
	if pista is AudioStreamMP3:
		(pista as AudioStreamMP3).loop = true
	elif pista is AudioStreamOggVorbis:
		(pista as AudioStreamOggVorbis).loop = true
	elif pista is AudioStreamWAV:
		(pista as AudioStreamWAV).loop_mode = AudioStreamWAV.LOOP_FORWARD

	_musica = AudioStreamPlayer.new()
	_musica.stream = pista
	_musica.bus = &"Master"
	_musica.volume_db = musica_db - 40.0   # arranca casi en silencio
	add_child(_musica)
	_musica.play()

	var t := create_tween()
	t.tween_property(_musica, "volume_db", musica_db, musica_entrada)


## Apaga la música con un fundido y espera a que termine.
func _apagar_musica() -> void:
	if _musica == null or not _musica.playing:
		return
	var t := create_tween()
	t.tween_property(_musica, "volume_db", -60.0, musica_salida)
	await t.finished
	_musica.stop()


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
#  REPRODUCCIÓN
# ============================================================================

func _reproducir() -> void:
	for bloque in GUION:
		# Solo las escenas de este bloque cuya imagen ya exista.
		var escenas: Array = []
		for n in bloque["escenas"]:
			if _existe(n):
				escenas.append(n)
		if escenas.is_empty():
			continue

		# 1) Empezar a teclear el texto (dura casi todo el bloque).
		var dur_bloque := escenas.size() * seg_por_escena
		_texto.text = str(bloque["texto"])
		_texto.visible_characters = 0
		var total := _texto.get_total_character_count()
		_fundir(_texto, 1.0, 0.4)
		var dur_texto: float = clampf(float(total) / velocidad_texto, 1.0, dur_bloque - 0.6)
		var tw := create_tween()
		tw.tween_property(_texto, "visible_characters", total, dur_texto)

		# 2) Ir cruzando las imágenes del bloque.
		for n in escenas:
			await _crossfade(_cargar(n))
			await get_tree().create_timer(seg_por_escena - crossfade).timeout
			if _terminado:
				return

		# 3) Fin del bloque: desvanecer el texto antes del siguiente.
		await _fundir(_texto, 0.0, 0.5)

	_ir_a_siguiente()


## Cruza la imagen actual con la nueva (crossfade suave, sin tocar el texto).
func _crossfade(tex: Texture2D) -> void:
	if tex == null:
		return
	_capa_b.texture = tex
	_capa_b.modulate.a = 0.0
	var t := create_tween()
	t.tween_property(_capa_b, "modulate:a", 1.0, crossfade)
	await t.finished
	_capa_a.texture = tex
	_capa_a.modulate.a = 1.0
	_capa_b.modulate.a = 0.0


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
	# Esc salta todo el prólogo.
	if evento is InputEventKey and evento.pressed and evento.keycode == KEY_ESCAPE:
		_ir_a_siguiente()
