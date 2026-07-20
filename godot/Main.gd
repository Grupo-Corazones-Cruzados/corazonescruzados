extends Node2D

## Escena principal del juego.
##
## Carga el mundo convertido desde el editor anterior y lo muestra con una
## cámara que sigue al jugador. Sustituye a la prueba de humo, que ya cumplió su
## función: confirmó que el motor arranca en móvil (0,82 s en iPhone, sin que
## Safari recargue) y que la sesión de la app llega al juego.
##
## Pendiente de portar desde el motor anterior: personaje LPC compuesto, NPCs
## con diálogo, objetos recogibles, transiciones entre mapas y cinemáticas.

const MUNDO := "res://mundos/main.tscn"
const TILE_VISUAL := 64.0  ## 32 px de tile a escala 2

@onready var hud: Label = $UI/Hud

var _mundo: Node2D
var _jugador: CharacterBody2D
var _camara: Camera2D
var _velocidad := 190.0


func _ready() -> void:
	var escena: PackedScene = load(MUNDO)
	if escena == null:
		hud.text = "No se encontró el mundo.\nEjecuta el importador de mapas."
		return

	_mundo = escena.instantiate()
	add_child(_mundo)

	_crear_jugador()
	_consultar_sesion()


func _crear_jugador() -> void:
	# Marcador provisional: el personaje LPC son 12 capas que hay que componer,
	# y es el siguiente paso. Lo que importa ahora es validar que el mapa
	# convertido tiene colisiones reales y se puede recorrer.
	_jugador = CharacterBody2D.new()
	_jugador.name = "Jugador"

	var cuerpo := ColorRect.new()
	cuerpo.color = Color(0.47, 0.35, 0.85)
	cuerpo.size = Vector2(28, 44)
	cuerpo.position = Vector2(-14, -34)
	_jugador.add_child(cuerpo)

	var forma := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	# La caja son los pies, no el alto entero: si no, el personaje choca con
	# las paredes por la cabeza y no puede pasar por huecos de un tile.
	rect.size = Vector2(20, 12)
	forma.shape = rect
	forma.position = Vector2(0, -6)
	_jugador.add_child(forma)

	var spawn := _mundo.get_node_or_null("Spawn")
	_jugador.position = spawn.position if spawn != null else Vector2(400, 400)
	add_child(_jugador)

	_camara = Camera2D.new()
	# Suavizado: la cámara anterior se movía por traslación directa y daba
	# tirones al cambiar de dirección.
	_camara.position_smoothing_enabled = true
	_camara.position_smoothing_speed = 6.0

	# Límites al área realmente pintada, no al tamaño declarado del mapa.
	# El mapa dice 60×40 pero solo tiene contenido en parte; sin límites se ve
	# el vacío de fondo y parece que el juego está roto.
	var usado := _area_pintada()
	if usado.size != Vector2i.ZERO:
		_camara.limit_left = int(usado.position.x * TILE_VISUAL)
		_camara.limit_top = int(usado.position.y * TILE_VISUAL)
		_camara.limit_right = int((usado.position.x + usado.size.x + 1) * TILE_VISUAL)
		_camara.limit_bottom = int((usado.position.y + usado.size.y + 1) * TILE_VISUAL)

	_jugador.add_child(_camara)
	_camara.make_current()


## Rectángulo, en tiles, que abarca todo lo pintado en todas las capas.
func _area_pintada() -> Rect2i:
	var min_c := Vector2i(1 << 30, 1 << 30)
	var max_c := Vector2i(-(1 << 30), -(1 << 30))
	var hubo := false
	for hijo in _mundo.get_children():
		if hijo is TileMapLayer:
			for celda in (hijo as TileMapLayer).get_used_cells():
				min_c = min_c.min(celda)
				max_c = max_c.max(celda)
				hubo = true
	if not hubo:
		return Rect2i()
	return Rect2i(min_c, max_c - min_c)


func _physics_process(_delta: float) -> void:
	if _jugador == null:
		return
	var dir := Vector2(
		Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down")
	)
	# Normalizar para que la diagonal no sea más rápida que recto.
	_jugador.velocity = dir.normalized() * _velocidad
	_jugador.move_and_slide()


func _consultar_sesion() -> void:
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_sesion)

	# HTTPRequest NO acepta rutas relativas (da error 31), así que hay que leer
	# el origen del navegador y componer la URL absoluta. Fuera de la web no
	# hay sesión que consultar.
	if not OS.has_feature("web"):
		hud.text = "Modo escritorio (sin sesión)"
		return
	var origen: Variant = JavaScriptBridge.eval("window.location.origin", true)
	if typeof(origen) != TYPE_STRING:
		hud.text = "Sin origen"
		return
	http.request(str(origen) + "/api/game/stages")


func _on_sesion(
	_r: int, codigo: int, _h: PackedStringArray, cuerpo: PackedByteArray
) -> void:
	if codigo == 401:
		hud.text = "Sin sesión iniciada"
		return
	if codigo != 200:
		hud.text = "Servidor: HTTP %d" % codigo
		return
	var datos: Variant = JSON.parse_string(cuerpo.get_string_from_utf8())
	if typeof(datos) != TYPE_DICTIONARY:
		hud.text = "Respuesta inesperada"
		return
	var saldos: Variant = datos.get("balances", {})
	var fichas: Variant = saldos.get("ficha", 0) if typeof(saldos) == TYPE_DICTIONARY else 0
	var etapas: Array = datos.get("stages", [])
	var abiertas := 0
	for e in etapas:
		if bool(e.get("unlocked", false)):
			abiertas += 1
	hud.text = "Fichas: %s    Etapas: %d/%d" % [str(fichas), abiertas, etapas.size()]
