extends CanvasLayer
class_name CajaDialogo

## ============================================================================
##  CAJA DE DIÁLOGO REUSABLE
## ============================================================================
##  Un cuadro de texto abajo de la pantalla, con efecto "máquina de escribir".
##  Avanza al tocar la pantalla / pulsar una tecla. Sirve para TODA la narrativa
##  y los tutoriales del juego.
##
##  Cómo se usa desde otro script:
##      var caja := CajaDialogo.new()
##      add_child(caja)
##      await caja.reproducir([
##          "Primera frase.",
##          {"hablante": "Niña", "texto": "Segunda frase, con nombre de quien habla."},
##      ])
##      # ...cuando termina, sigue el código de abajo.
##
##  Cada línea puede ser un texto simple (String) o un diccionario
##  {"hablante": "...", "texto": "..."} si quieres mostrar quién habla.
## ============================================================================

## Velocidad del tipeo, en caracteres por segundo.
const VEL_TIPEO := 28.0

signal terminado          ## Se emite cuando se acabó toda la conversación.
signal _continuar         ## Interno: el jugador pidió avanzar.

var _panel: Panel
var _hablante: Label
var _texto: RichTextLabel
var _prompt: Label
var _activa := false


func _ready() -> void:
	layer = 10  # por encima del mundo, debajo de un fundido a negro (layer mayor)
	_construir_ui()
	_panel.visible = false


func _construir_ui() -> void:
	var fuente: FontFile = load("res://assets/Fonts/Silkscreen-Regular.ttf")

	# --- Panel de fondo, pegado abajo ---
	_panel = Panel.new()
	_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_panel.offset_left = 40
	_panel.offset_right = -40
	_panel.offset_top = -190
	_panel.offset_bottom = -30
	var estilo := StyleBoxFlat.new()
	estilo.bg_color = Color(0.05, 0.05, 0.09, 0.9)
	estilo.border_color = Color(0.55, 0.55, 0.7)
	estilo.set_border_width_all(2)
	estilo.set_corner_radius_all(8)
	estilo.set_content_margin_all(16)
	_panel.add_theme_stylebox_override("panel", estilo)
	add_child(_panel)

	# --- Nombre de quien habla ---
	_hablante = Label.new()
	_hablante.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_hablante.offset_left = 20
	_hablante.offset_top = 12
	if fuente != null:
		_hablante.add_theme_font_override("font", fuente)
	_hablante.add_theme_font_size_override("font_size", 16)
	_hablante.add_theme_color_override("font_color", Color(0.7, 0.75, 1.0))
	_panel.add_child(_hablante)

	# --- Texto principal (con máquina de escribir) ---
	_texto = RichTextLabel.new()
	_texto.set_anchors_preset(Control.PRESET_FULL_RECT)
	_texto.offset_left = 20
	_texto.offset_top = 46
	_texto.offset_right = -20
	_texto.offset_bottom = -16
	_texto.bbcode_enabled = false
	_texto.scroll_active = false
	if fuente != null:
		_texto.add_theme_font_override("normal_font", fuente)
	_texto.add_theme_font_size_override("normal_font_size", 20)
	_panel.add_child(_texto)

	# --- Flechita "▼" para avanzar ---
	_prompt = Label.new()
	_prompt.text = "Espacio ▼"
	_prompt.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_prompt.offset_left = -120
	_prompt.offset_top = -34
	_prompt.add_theme_font_size_override("font_size", 18)
	_prompt.add_theme_color_override("font_color", Color(0.8, 0.8, 0.9))
	_panel.add_child(_prompt)


## Reproduce una lista de líneas, una por una. Espera (await) hasta terminar.
func reproducir(lineas: Array) -> void:
	_activa = true
	_panel.visible = true
	for linea in lineas:
		await _mostrar_linea(linea)
	_panel.visible = false
	_activa = false
	terminado.emit()


func _mostrar_linea(linea) -> void:
	# Aceptar texto simple o {"hablante": ..., "texto": ...}
	var quien := ""
	var cuerpo := ""
	if typeof(linea) == TYPE_DICTIONARY:
		quien = str(linea.get("hablante", ""))
		cuerpo = str(linea.get("texto", ""))
	else:
		cuerpo = str(linea)

	_hablante.text = quien
	_hablante.visible = quien != ""
	_texto.text = cuerpo
	_texto.visible_characters = 0
	var total := _texto.get_total_character_count()

	# Efecto máquina de escribir con un tween.
	var tw := create_tween()
	tw.tween_property(_texto, "visible_characters", total, float(total) / VEL_TIPEO)

	# Primer input: si aún está tipeando, lo completa de golpe; si ya terminó, avanza.
	await _continuar
	if tw.is_running():
		tw.kill()
		_texto.visible_characters = total
		await _continuar   # segundo input para pasar de línea


func _input(evento: InputEvent) -> void:
	if not _activa:
		return

	# Solo avanza con ESPACIO (ignorando la repetición de tecla mantenida) o con
	# un toque/clic en pantalla. Así, mantener pulsada una tecla de movimiento no
	# pasa los diálogos de golpe.
	var avanzar := false
	if evento is InputEventKey:
		var k := evento as InputEventKey
		if k.pressed and not k.echo and k.keycode == KEY_SPACE:
			avanzar = true
	elif evento is InputEventScreenTouch and evento.pressed:
		avanzar = true
	elif evento is InputEventMouseButton and evento.pressed:
		avanzar = true

	if avanzar:
		_continuar.emit()
		get_viewport().set_input_as_handled()  # que este toque no mueva al personaje
