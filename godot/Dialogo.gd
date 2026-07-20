class_name Dialogo
extends CanvasLayer

## Panel de diálogo.
##
## Reproduce lo que hacía el juego anterior —una lista de líneas que se avanza
## con una tecla— pero con dos mejoras que se notan al jugar:
##
##  * **Efecto de escritura.** La primera pulsación completa la línea en vez de
##    saltarla, así quien lee rápido no pierde texto por accidente.
##  * **Funciona con toque.** Tocar la pantalla avanza igual que la tecla, que
##    en móvil es la única forma de continuar.
##
## Sigue siendo lineal: sin ramas ni condiciones. Los diálogos con decisiones
## son otro trabajo, y conviene hacerlo cuando existan las misiones que los
## necesiten.

signal terminado

const VELOCIDAD_TEXTO := 45.0  ## caracteres por segundo

var _lineas: Array = []
var _indice := 0
var _mostrado := 0.0
var _activo := false

var _panel: PanelContainer
var _nombre: Label
var _texto: RichTextLabel
var _pista: Label


func _ready() -> void:
	layer = 10
	_construir()
	visible = false
	# Recibe entrada aunque el árbol esté pausado, para poder pausar el mundo
	# mientras se habla.
	process_mode = Node.PROCESS_MODE_ALWAYS


func _construir() -> void:
	var raiz := MarginContainer.new()
	raiz.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	raiz.add_theme_constant_override("margin_left", 16)
	raiz.add_theme_constant_override("margin_right", 16)
	raiz.add_theme_constant_override("margin_bottom", 16)
	raiz.offset_top = -230.0
	add_child(raiz)

	_panel = PanelContainer.new()
	var estilo := StyleBoxFlat.new()
	estilo.bg_color = Color(0.05, 0.04, 0.08, 0.95)
	estilo.border_color = Color(0.47, 0.35, 0.85)
	estilo.set_border_width_all(2)
	estilo.set_corner_radius_all(6)
	estilo.set_content_margin_all(16)
	_panel.add_theme_stylebox_override("panel", estilo)
	raiz.add_child(_panel)

	var caja := VBoxContainer.new()
	caja.add_theme_constant_override("separation", 8)
	_panel.add_child(caja)

	_nombre = Label.new()
	_nombre.add_theme_font_size_override("font_size", 16)
	_nombre.add_theme_color_override("font_color", Color(0.68, 0.55, 0.95))
	caja.add_child(_nombre)

	_texto = RichTextLabel.new()
	_texto.fit_content = true
	_texto.scroll_active = false
	_texto.custom_minimum_size = Vector2(0, 96)
	_texto.add_theme_font_size_override("normal_font_size", 17)
	caja.add_child(_texto)

	_pista = Label.new()
	_pista.add_theme_font_size_override("font_size", 13)
	_pista.add_theme_color_override("font_color", Color(1, 1, 1, 0.45))
	_pista.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	caja.add_child(_pista)


## Abre el panel con las líneas indicadas. No hace nada si no hay ninguna.
func iniciar(quien: String, lineas: Array) -> void:
	if lineas.is_empty():
		return
	_lineas = lineas
	_indice = 0
	_activo = true
	_nombre.text = quien
	visible = true
	_mostrar_linea()


func activo() -> bool:
	return _activo


func _mostrar_linea() -> void:
	_texto.text = str(_lineas[_indice])
	_texto.visible_characters = 0
	_mostrado = 0.0
	_actualizar_pista()


func _actualizar_pista() -> void:
	var ultima := _indice >= _lineas.size() - 1
	_pista.text = (
		"%d/%d   ·   %s" % [_indice + 1, _lineas.size(), "Cerrar" if ultima else "Continuar"]
	)


func _process(delta: float) -> void:
	if not _activo:
		return
	var total := _texto.get_total_character_count()
	if _texto.visible_characters < total:
		_mostrado += delta * VELOCIDAD_TEXTO
		_texto.visible_characters = mini(int(_mostrado), total)


func _unhandled_input(evento: InputEvent) -> void:
	if not _activo:
		return

	var avanzar := false
	if evento is InputEventKey and evento.pressed and not evento.echo:
		var k := (evento as InputEventKey).keycode
		if k == KEY_E or k == KEY_ENTER or k == KEY_SPACE or k == KEY_KP_ENTER:
			avanzar = true
		elif k == KEY_ESCAPE:
			_cerrar()
			get_viewport().set_input_as_handled()
			return
	elif evento is InputEventScreenTouch and (evento as InputEventScreenTouch).pressed:
		avanzar = true
	elif evento is InputEventMouseButton:
		var mb := evento as InputEventMouseButton
		if mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			avanzar = true

	if not avanzar:
		return
	get_viewport().set_input_as_handled()

	# Si la línea aún se está escribiendo, la primera pulsación la completa.
	# Sin esto, quien lee rápido se salta texto sin querer.
	var total := _texto.get_total_character_count()
	if _texto.visible_characters < total:
		_texto.visible_characters = total
		_mostrado = float(total)
		return

	_indice += 1
	if _indice >= _lineas.size():
		_cerrar()
	else:
		_mostrar_linea()


func _cerrar() -> void:
	_activo = false
	visible = false
	_lineas = []
	terminado.emit()
