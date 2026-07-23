extends Node2D

## ============================================================================
##  INTRO CINEMÁTICA — sube por una imagen de fondo, hace zoom a la cueva,
##  oscurece y entra a la escena del jugador.
## ============================================================================
##  Secuencia:
##    1. Negro → se aclara.
##    2. La cámara SUBE por tu imagen de fondo (mientras llueve), desde el
##       marcador "Inicio" hasta el marcador "Cueva".
##    3. Al llegar, hace ZOOM hacia la cueva.
##    4. Oscurece (fundido a negro).
##    5. Carga la escena del jugador (Main.tscn).
##
##  Estructura de la escena (nombres EXACTOS de los nodos):
##    Intro (Node2D)          ← aquí va este script
##     ├─ Fondo   (Sprite2D)  ← tu imagen de background (la arrastras tú)
##     ├─ Camera2D
##     ├─ Inicio  (Marker2D)  ← dónde arranca la cámara (abajo en la imagen)
##     └─ Cueva   (Marker2D)  ← la zona de la cueva (la cámara termina y hace zoom)
##
##  Todo lo AJUSTABLE aparece en el Inspector al seleccionar el nodo Intro.
## ============================================================================


# --- AJUSTES (visibles en el Inspector) -------------------------------------
@export_group("Mensajes")
## Frases que aparecen mientras sube la cámara. Deja la lista vacía para ninguna.
@export var mensajes: Array[String] = [
	"Hay alguien aquí, ¿Hola?.",
	"Tengo miedo...",
]

@export_group("Tiempos (segundos)")
@export var fade_inicial: float = 1.5      ## Aclarado desde negro.
@export var duracion_subida: float = 8.0   ## Cuánto tarda en subir hasta la cueva.
@export var duracion_zoom: float = 3.0     ## Cuánto tarda el acercamiento a la cueva.
@export var duracion_oscurecer: float = 2.0## Cuánto tarda en fundirse a negro.

@export_group("Cámara")
@export var zoom_inicial: float = 1.0      ## Zoom al empezar (1 = normal).
@export var zoom_cueva: float = 3.0        ## Zoom final sobre la cueva (más = más cerca).

@export_group("Lluvia")
@export var lluvia_cantidad: int = 400
@export var lluvia_velocidad: float = 900.0

@export_group("Destino")
@export_file("*.tscn") var escena_siguiente: String = "res://Main.tscn"


# --- Nodos de la escena -----------------------------------------------------
@onready var _fondo: Sprite2D = $Fondo
@onready var _camara: Camera2D = $Camera2D
@onready var _inicio: Marker2D = $Inicio
@onready var _cueva: Marker2D = $Cueva

# --- Creados por código -----------------------------------------------------
var _label: Label
var _velo_negro: ColorRect
var _tam_pantalla: Vector2
var _yendo := false


func _ready() -> void:
	_tam_pantalla = get_viewport_rect().size

	# Colocar la cámara en el punto de inicio, con el zoom inicial.
	if _camara != null:
		_camara.make_current()
		_camara.zoom = Vector2(zoom_inicial, zoom_inicial)
		if _inicio != null:
			_camara.global_position = _inicio.global_position

	_construir_lluvia()
	_construir_texto()
	_construir_velo_negro()
	_reproducir_intro()


# ============================================================================
#  ELEMENTOS CREADOS POR CÓDIGO (lluvia, texto, velo negro)
# ============================================================================

func _construir_lluvia() -> void:
	var capa := CanvasLayer.new()
	capa.layer = 1
	add_child(capa)

	var lluvia := CPUParticles2D.new()
	lluvia.amount = lluvia_cantidad
	lluvia.lifetime = 2.0
	lluvia.preprocess = 1.0
	lluvia.local_coords = false
	lluvia.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	lluvia.emission_rect_extents = Vector2(_tam_pantalla.x / 2.0 + 100, 4)
	lluvia.position = Vector2(_tam_pantalla.x / 2.0, -20)
	lluvia.direction = Vector2(0.1, 1)
	lluvia.spread = 4.0
	lluvia.gravity = Vector2(0, 200)
	lluvia.initial_velocity_min = lluvia_velocidad * 0.8
	lluvia.initial_velocity_max = lluvia_velocidad
	lluvia.texture = _textura_gota()
	lluvia.scale_amount_min = 0.45
	lluvia.scale_amount_max = 0.75
	capa.add_child(lluvia)


func _textura_gota() -> Texture2D:
	var img := Image.create(2, 8, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.85, 0.92, 1.0, 0.9))
	return ImageTexture.create_from_image(img)


func _construir_texto() -> void:
	var capa := CanvasLayer.new()
	capa.layer = 2
	add_child(capa)

	_label = Label.new()
	_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	var fuente: FontFile = load("res://assets/Fonts/Silkscreen-Regular.ttf")
	if fuente != null:
		_label.add_theme_font_override("font", fuente)
	_label.add_theme_font_size_override("font_size", 28)
	_label.add_theme_color_override("font_color", Color(0.92, 0.92, 0.98))
	_label.add_theme_constant_override("outline_size", 8)
	_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_label.modulate.a = 0.0
	capa.add_child(_label)


func _construir_velo_negro() -> void:
	var capa := CanvasLayer.new()
	capa.layer = 3
	add_child(capa)

	_velo_negro = ColorRect.new()
	_velo_negro.color = Color.BLACK
	_velo_negro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_velo_negro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	capa.add_child(_velo_negro)


# ============================================================================
#  LA COREOGRAFÍA
# ============================================================================

func _reproducir_intro() -> void:
	# 1) Aclarar desde negro.
	await _fundir(_velo_negro, 0.0, fade_inicial)

	# 2) Subir por la imagen hasta la cueva (en paralelo con los mensajes).
	var t_subida: Tween = null
	if _camara != null and _cueva != null:
		t_subida = create_tween()
		t_subida.tween_property(_camara, "global_position",
			_cueva.global_position, duracion_subida) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

	for texto in mensajes:
		await _mostrar_mensaje(texto)

	# Esperar a que la cámara termine de subir.
	if t_subida != null and t_subida.is_running():
		await t_subida.finished

	# 3) Zoom hacia la cueva.
	if _camara != null:
		var t_zoom := create_tween()
		t_zoom.tween_property(_camara, "zoom",
			Vector2(zoom_cueva, zoom_cueva), duracion_zoom) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
		# 4) Oscurecer solapándose con la última mitad del zoom (efecto "la
		#    oscuridad se traga la escena").
		await get_tree().create_timer(duracion_zoom * 0.5).timeout

	# 4/5) Fundido a negro y saltar a la escena del jugador.
	await _fundir(_velo_negro, 1.0, duracion_oscurecer)
	_ir_a_siguiente()


func _mostrar_mensaje(texto: String) -> void:
	_label.text = texto
	await _fundir(_label, 1.0, 1.2)                        # aparece
	await get_tree().create_timer(2.5).timeout            # se queda
	await _fundir(_label, 0.0, 1.2)                        # se va
	await get_tree().create_timer(0.6).timeout            # pausa


func _fundir(nodo: CanvasItem, destino: float, dur: float) -> void:
	var t := create_tween()
	t.tween_property(nodo, "modulate:a", destino, dur)
	await t.finished


func _ir_a_siguiente() -> void:
	if _yendo:
		return
	_yendo = true
	get_tree().change_scene_to_file(escena_siguiente)


# --- Saltar la intro tocando/pulsando ---------------------------------------
func _unhandled_input(evento: InputEvent) -> void:
	if evento.is_pressed():
		_ir_a_siguiente()
