extends Node2D

## ============================================================================
##  DIRECTOR DEL ENCUENTRO — el fondo del Hoyo, frente a la niña
## ============================================================================
##  El jugador aparece (desde negro), tiene control y se mueve libremente. A
##  medida que SE ACERCA a la niña, van saliendo sus diálogos. En el grito
##  "¿QUIÉN ERES?" tiembla la pantalla, y al final todo se funde a negro.
##
##  Estructura de la escena (este script va en el nodo RAÍZ):
##    (raíz Node2D)                 ← aquí va este script
##     ├─ TileMapLayer              ← el suelo de la cueva (lo pintas tú)
##     ├─ CharacterBody2D (Violeta) ← el jugador
##     │    └─ Camera2D
##     └─ Nina                      ← la niña demacrada (Sprite2D o AnimatedSprite2D)
##
##  Ajusta las distancias y los textos en la sección GUION de abajo.
## ============================================================================

@export_file("*.tscn") var escena_siguiente: String = ""  ## A dónde ir al final (vacío = solo funde a negro).

@export_group("Distancias a la niña (px)")
## LEJOS: a esta distancia aparece el primer mensaje ("¿Hay alguien ahí?").
@export var dist_lejos: float = 420.0
## MEDIA: más cerca, aparece el segundo ("¿Quién está ahí? / Tengo miedo").
@export var dist_medio: float = 260.0
## CERCA: cara a cara, empieza el grito y la conversación.
@export var dist_cerca: float = 150.0

@export_group("Ayuda")
## Muestra en pantalla la distancia actual a la niña, para calibrar las de arriba.
## Actívalo, corre la escena, camina, anota a qué distancia quieres cada mensaje,
## ponlas arriba y vuelve a desactivarlo.
@export var mostrar_distancia_debug: bool = false
## Fuerza el joystick táctil en PC (para probarlo con el mouse). En móvil aparece solo.
@export var probar_controles_en_pc: bool = false

# --- Nodos de la escena -----------------------------------------------------
@onready var _jugador: CharacterBody2D = get_node_or_null("CharacterBody2D")
@onready var _camara: Camera2D = get_node_or_null("CharacterBody2D/Camera2D")
@onready var _nina: Node2D = get_node_or_null("Nina")

# --- Creados por código -----------------------------------------------------
var _caja: CajaDialogo
var _velo: ColorRect
var _debug: Label = null

var _beat := 0
var _en_dialogo := false
var _terminado := false


## El guion se arma en _ready() usando las distancias del Inspector.
var _guion: Array = []


## Arma la lista de "beats". Cada beat se dispara cuando el jugador está a <=
## "dist" px de la niña. "lineas" son los diálogos; "shake" hace temblar;
## "final" cierra la escena.
func _construir_guion() -> Array:
	return [
		# 1) LEJOS: la niña nota que hay alguien.
		{
			"dist": dist_lejos,
			"lineas": [
				{"hablante": "¿?", "texto": "¿Hay alguien ahí? ¿Hola?"},
			],
		},
		# 2) MEDIA: se asusta.
		{
			"dist": dist_medio,
			"lineas": [
				{"hablante": "¿?", "texto": "¿Quién está ahí?"},
				{"hablante": "¿?", "texto": "Tengo miedo..."},
			],
		},
		# 3) CERCA: el grito (tiembla la pantalla).
		{
			"dist": dist_cerca,
			"shake": true,
			"lineas": [
				{"hablante": "Niña", "texto": "¿QUIÉN ERES?"},
			],
		},
		# 4) CARA A CARA: la conversación.
		{
			"dist": dist_cerca,
			"final": true,
			"lineas": [
				{"hablante": "Tú", "texto": "(dices tu nombre...)"},
				{"hablante": "Niña", "texto": "¿Por qué estás aquí? Nadie debería estar aquí."},
				{"hablante": "Niña", "texto": "En este lugar todos deberían morir."},
				{"hablante": "Tú", "texto": "No sabía dónde ir. Afuera todo está mal. Corrimos hacia aquí porque nos iban a matar."},
				{"hablante": "Niña", "texto": "Esto es culpa de todos. Esto es culpa de todos ustedes."},
			],
		},
	]


func _ready() -> void:
	_guion = _construir_guion()
	_construir_caja()
	_construir_controles()
	_construir_velo()
	if mostrar_distancia_debug:
		_construir_debug()

	# Empezamos en negro y con el jugador congelado; luego aclaramos.
	if _jugador != null:
		_jugador.control_habilitado = false
	await _fundir(_velo, 0.0, 2.0)   # aclarar desde negro
	if _jugador != null:
		_jugador.control_habilitado = true


func _process(_delta: float) -> void:
	# Ayuda visual: mostrar la distancia actual a la niña (para calibrar).
	if _debug != null and _jugador != null and _nina != null:
		_debug.text = "Distancia a la niña: %d px" % int(
			_jugador.global_position.distance_to(_nina.global_position))

	if _en_dialogo or _terminado:
		return
	if _beat >= _guion.size():
		return
	if _jugador == null or _nina == null:
		return
	# ¿El jugador ya está lo bastante cerca para disparar el siguiente beat?
	var dist := _jugador.global_position.distance_to(_nina.global_position)
	if dist <= float(_guion[_beat]["dist"]):
		_reproducir_beat()


func _reproducir_beat() -> void:
	_en_dialogo = true
	if _jugador != null:
		_jugador.control_habilitado = false   # congelar mientras habla

	var beat: Dictionary = _guion[_beat]
	if beat.get("shake", false):
		_sacudir(0.6, 8.0)

	await _caja.reproducir(beat["lineas"])
	_beat += 1

	if beat.get("final", false):
		await _climax()
	else:
		if _jugador != null:
			_jugador.control_habilitado = true
		_en_dialogo = false


## El cierre: temblor fuerte, todo se apaga.
func _climax() -> void:
	_sacudir(1.5, 18.0)
	await get_tree().create_timer(1.6).timeout
	await _fundir(_velo, 1.0, 2.0)   # fundir a negro
	_terminado = true
	if escena_siguiente != "":
		get_tree().change_scene_to_file(escena_siguiente)


# ============================================================================
#  UTILIDADES
# ============================================================================

func _construir_caja() -> void:
	_caja = CajaDialogo.new()
	add_child(_caja)


## Joystick táctil en pantalla (solo aparece en dispositivos táctiles).
func _construir_controles() -> void:
	var controles := ControlesTactiles.new()
	controles.siempre_visible = probar_controles_en_pc
	add_child(controles)


## Etiqueta amarilla arriba-izquierda con la distancia actual (solo para calibrar).
func _construir_debug() -> void:
	var capa := CanvasLayer.new()
	capa.layer = 30
	add_child(capa)
	_debug = Label.new()
	_debug.position = Vector2(16, 12)
	_debug.add_theme_font_size_override("font_size", 20)
	_debug.add_theme_color_override("font_color", Color.YELLOW)
	capa.add_child(_debug)


func _construir_velo() -> void:
	var capa := CanvasLayer.new()
	capa.layer = 20  # por encima de la caja de diálogo
	add_child(capa)
	_velo = ColorRect.new()
	_velo.color = Color.BLACK
	_velo.set_anchors_preset(Control.PRESET_FULL_RECT)
	_velo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	capa.add_child(_velo)  # empieza opaco (negro), se aclara en _ready


func _fundir(nodo: CanvasItem, destino: float, dur: float) -> void:
	var t := create_tween()
	t.tween_property(nodo, "modulate:a", destino, dur)
	await t.finished


## Sacude la cámara durante "duracion" segundos con "intensidad" px.
func _sacudir(duracion: float, intensidad: float) -> void:
	if _camara == null:
		return
	var t := 0.0
	while t < duracion:
		_camara.offset = Vector2(
			randf_range(-intensidad, intensidad),
			randf_range(-intensidad, intensidad))
		await get_tree().process_frame
		t += get_process_delta_time()
	_camara.offset = Vector2.ZERO
