extends CanvasLayer
class_name ControlesTactiles

## ============================================================================
##  JOYSTICK TÁCTIL EN PANTALLA (para móvil / web táctil)
## ============================================================================
##  Muestra un joystick abajo a la izquierda. Al arrastrar el dedo, "presiona"
##  virtualmente las acciones ui_left/right/up/down, así que el personaje se
##  mueve EXACTAMENTE igual que con el teclado, sin cambiar su script.
##
##  Se muestra SOLO en dispositivos táctiles. En PC no aparece (ahí va el teclado),
##  salvo que actives "siempre_visible" para probarlo con el mouse.
##
##  Uso: se puede crear por código (var j := ControlesTactiles.new(); add_child(j))
##  o añadirlo como nodo en cualquier escena de juego.
## ============================================================================

## Fuérzalo a mostrarse en PC (para probar con el mouse). Déjalo en false para producción.
@export var siempre_visible: bool = false

const RADIO_BASE := 90.0   ## Tamaño del círculo grande.
const RADIO_KNOB := 45.0   ## Tamaño de la perilla.
const MARGEN := 60.0       ## Separación desde la esquina inferior izquierda.

var _base: TextureRect
var _knob: TextureRect
var _activo := false
var _touch_id := -1
var _centro := Vector2.ZERO
var _vector := Vector2.ZERO


func _ready() -> void:
	layer = 5  # sobre el mundo, debajo de diálogos (10) y fundidos (20)

	# ¿Este dispositivo es táctil? (o forzamos con siempre_visible)
	_activo = DisplayServer.is_touchscreen_available() or siempre_visible
	if not _activo:
		set_process_input(false)
		return

	_construir_ui()


func _construir_ui() -> void:
	# Círculo base, anclado a la esquina inferior izquierda.
	_base = TextureRect.new()
	_base.texture = _circulo(int(RADIO_BASE), Color(1, 1, 1, 0.14))
	_base.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_base.offset_left = MARGEN
	_base.offset_top = -(MARGEN + RADIO_BASE * 2.0)
	_base.offset_right = MARGEN + RADIO_BASE * 2.0
	_base.offset_bottom = -MARGEN
	_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_base)

	# Perilla, hija de la base, centrada.
	_knob = TextureRect.new()
	_knob.texture = _circulo(int(RADIO_KNOB), Color(1, 1, 1, 0.35))
	_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_base.add_child(_knob)
	_centrar_knob()


## Dibuja un círculo relleno en una imagen (para no depender de archivos).
func _circulo(radio: int, color: Color) -> Texture2D:
	var d := radio * 2
	var img := Image.create(d, d, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var c := Vector2(radio, radio)
	for y in d:
		for x in d:
			if Vector2(x, y).distance_to(c) <= float(radio):
				img.set_pixel(x, y, color)
	return ImageTexture.create_from_image(img)


func _centrar_knob() -> void:
	_knob.position = Vector2(RADIO_BASE - RADIO_KNOB, RADIO_BASE - RADIO_KNOB)


func _input(evento: InputEvent) -> void:
	if not _activo:
		return
	if evento is InputEventScreenTouch:
		if evento.pressed:
			_intentar_tomar(evento.position, evento.index)
		elif evento.index == _touch_id:
			_soltar()
	elif evento is InputEventScreenDrag and evento.index == _touch_id:
		_mover(evento.position)
	elif siempre_visible and evento is InputEventMouseButton:
		if evento.pressed:
			_intentar_tomar(evento.position, -2)
		elif _touch_id == -2:
			_soltar()
	elif siempre_visible and evento is InputEventMouseMotion and _touch_id == -2:
		_mover(evento.position)


## Si el toque cae sobre el joystick, lo "toma".
func _intentar_tomar(pos: Vector2, id: int) -> void:
	_centro = _base.get_global_rect().get_center()
	if pos.distance_to(_centro) <= RADIO_BASE * 1.3:
		_touch_id = id
		_mover(pos)
		get_viewport().set_input_as_handled()


## Mueve la perilla y traduce la posición a dirección de movimiento.
func _mover(pos: Vector2) -> void:
	var offset := (pos - _centro).limit_length(RADIO_BASE)
	_knob.position = Vector2(RADIO_BASE - RADIO_KNOB, RADIO_BASE - RADIO_KNOB) + offset
	_vector = offset / RADIO_BASE
	_aplicar_movimiento()


func _soltar() -> void:
	_touch_id = -1
	_vector = Vector2.ZERO
	_centrar_knob()
	_aplicar_movimiento()


## Convierte el vector del joystick en "pulsaciones" de las acciones de movimiento.
func _aplicar_movimiento() -> void:
	_set_eje("ui_right", "ui_left", _vector.x)
	_set_eje("ui_down", "ui_up", _vector.y)


func _set_eje(accion_pos: String, accion_neg: String, valor: float) -> void:
	if valor > 0.0:
		Input.action_press(accion_pos, valor)
		Input.action_release(accion_neg)
	elif valor < 0.0:
		Input.action_press(accion_neg, -valor)
		Input.action_release(accion_pos)
	else:
		Input.action_release(accion_pos)
		Input.action_release(accion_neg)
