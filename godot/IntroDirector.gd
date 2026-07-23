extends Node2D

## ============================================================================
##  DIRECTOR DE INTRO — va en el nodo RAÍZ de Main.tscn
## ============================================================================
##  Hace la intro SIN cortes, dentro de la misma escena del juego:
##    1. La pantalla arranca en negro y se aclara.
##    2. La cámara de Violeta arranca ARRIBA (en el cielo) y baja despacio hasta
##       ella, mientras llueve. Al bajar aparecen el suelo y el personaje.
##    3. Van saliendo los mensajes ("Hay alguien aquí, ¿Hola?." / "Tengo miedo...").
##    4. Al aterrizar, se DEVUELVE el control y ya puedes mover a Violeta.
##
##  Requisitos de la escena (así está armada Main.tscn):
##    Violeta (Node2D)              ← aquí va ESTE script
##     ├─ TileMapLayer
##     └─ CharacterBody2D  (Violeta.gd)
##          └─ Camera2D             ← la cámara que bajará del cielo
##
##  Todo lo ajustable está en las CONSTANTES de abajo.
## ============================================================================


# --- TEXTOS -----------------------------------------------------------------
const MENSAJES: Array[String] = [
	"Hay alguien aquí, ¿Hola?.",
	"Tengo miedo...",
]

# --- TIEMPOS (segundos) -----------------------------------------------------
const FADE_INICIAL := 1.5       ## Aclarado desde negro al inicio.
const TEXTO_APARECER := 1.2
const TEXTO_QUEDARSE := 2.5
const TEXTO_DESAPARECER := 1.2
const PAUSA_ENTRE_TEXTOS := 0.6

# --- CÁMARA -----------------------------------------------------------------
const ALTURA_CIELO := 900.0     ## Cuántos px por ENCIMA de Violeta arranca la
								## cámara. Más grande = descenso más largo.

# --- LLUVIA -----------------------------------------------------------------
const LLUVIA_CANTIDAD := 400
const LLUVIA_VELOCIDAD := 900.0


# --- Referencias a nodos que YA existen en la escena ------------------------
@onready var _jugador: CharacterBody2D = $CharacterBody2D
@onready var _camara: Camera2D = $CharacterBody2D/Camera2D

# --- Referencias que creamos por código -------------------------------------
var _label: Label
var _velo_negro: ColorRect
var _tam_pantalla: Vector2


func _ready() -> void:
	_tam_pantalla = get_viewport_rect().size

	# Congelar a Violeta mientras dura la intro.
	if _jugador != null:
		_jugador.control_habilitado = false

	# Subir la cámara al "cielo" (posición local respecto a Violeta).
	if _camara != null:
		_camara.position.y = -ALTURA_CIELO

	_construir_fondo_cielo()
	_construir_lluvia()
	_construir_texto()
	_construir_velo_negro()
	_reproducir_intro()


# ============================================================================
#  ELEMENTOS QUE SE CREAN POR CÓDIGO
# ============================================================================

## Un degradado alto detrás de todo: cielo azul-noche arriba → casi negro abajo.
## Se coloca cubriendo el tramo por donde baja la cámara, para que el descenso
## se note. (Donde hay suelo pintado, el suelo tapa el degradado.)
func _construir_fondo_cielo() -> void:
	var origen_y := _jugador.global_position.y if _jugador != null else 0.0

	var grad := Gradient.new()
	grad.set_color(0, Color(0.10, 0.11, 0.18))
	grad.set_color(1, Color(0.02, 0.02, 0.05))

	var textura := GradientTexture2D.new()
	textura.gradient = grad
	textura.fill_from = Vector2(0, 0)
	textura.fill_to = Vector2(0, 1)
	textura.width = int(_tam_pantalla.x) + 800
	textura.height = int(ALTURA_CIELO + _tam_pantalla.y) + 400

	var fondo := Sprite2D.new()
	fondo.texture = textura
	fondo.centered = false
	# Arranca bien arriba (cielo) y baja hasta un poco más abajo del personaje.
	fondo.position = Vector2(-textura.width / 2.0, origen_y - ALTURA_CIELO - _tam_pantalla.y / 2.0 - 100)
	fondo.z_index = -100  # detrás de todo
	add_child(fondo)


## Lluvia con partículas, en capa de pantalla (siempre cubre la vista).
func _construir_lluvia() -> void:
	var capa := CanvasLayer.new()
	capa.layer = 1
	add_child(capa)

	var lluvia := CPUParticles2D.new()
	lluvia.amount = LLUVIA_CANTIDAD
	lluvia.lifetime = 2.0
	lluvia.preprocess = 1.0
	lluvia.local_coords = false
	lluvia.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	lluvia.emission_rect_extents = Vector2(_tam_pantalla.x / 2.0 + 100, 4)
	lluvia.position = Vector2(_tam_pantalla.x / 2.0, -20)
	lluvia.direction = Vector2(0.1, 1)
	lluvia.spread = 4.0
	lluvia.gravity = Vector2(0, 200)
	lluvia.initial_velocity_min = LLUVIA_VELOCIDAD * 0.8
	lluvia.initial_velocity_max = LLUVIA_VELOCIDAD
	lluvia.texture = _textura_gota()
	lluvia.scale_amount_min = 0.45   # chiquitas, pero visibles sobre el suelo claro
	lluvia.scale_amount_max = 0.75
	capa.add_child(lluvia)


## Gota fina de 2x8, casi opaca y blanco-azulada: se lee bien tanto sobre el
## cielo oscuro como sobre el suelo claro.
func _textura_gota() -> Texture2D:
	var img := Image.create(2, 8, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.85, 0.92, 1.0, 0.9))
	return ImageTexture.create_from_image(img)


## Texto centrado en pantalla, en Silkscreen (igual que la landing), invisible al inicio.
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
	# La cámara baja del cielo (posición local y: -ALTURA_CIELO → 0) durante
	# TODA la intro, en paralelo con los textos.
	var duracion_total := FADE_INICIAL + MENSAJES.size() * (
		TEXTO_APARECER + TEXTO_QUEDARSE + TEXTO_DESAPARECER + PAUSA_ENTRE_TEXTOS)
	var t_camara: Tween = null
	if _camara != null:
		t_camara = create_tween()
		t_camara.tween_property(_camara, "position:y", 0.0, duracion_total) \
			.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

	# Aclarar desde negro.
	await _fundir(_velo_negro, 0.0, FADE_INICIAL)

	# Mostrar cada mensaje.
	for texto in MENSAJES:
		await _mostrar_mensaje(texto)

	# Asegurar que la cámara terminó de aterrizar.
	if t_camara != null and t_camara.is_running():
		await t_camara.finished

	# ¡Devolver el control!
	if _jugador != null:
		_jugador.control_habilitado = true


func _mostrar_mensaje(texto: String) -> void:
	_label.text = texto
	await _fundir(_label, 1.0, TEXTO_APARECER)
	await get_tree().create_timer(TEXTO_QUEDARSE).timeout
	await _fundir(_label, 0.0, TEXTO_DESAPARECER)
	await get_tree().create_timer(PAUSA_ENTRE_TEXTOS).timeout


func _fundir(nodo: CanvasItem, destino: float, dur: float) -> void:
	var t := create_tween()
	t.tween_property(nodo, "modulate:a", destino, dur)
	await t.finished
