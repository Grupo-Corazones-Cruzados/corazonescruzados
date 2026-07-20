extends Node2D

## Esqueleto del juego (NIVEL GODOT).
##
## Orquesta lo que es del motor: carga el mundo, monta al personaje, conecta los
## sistemas (NPCs, objetos, transiciones) y dibuja el HUD. NO decide nada
## autoritativo: para sesión, personaje, progreso, etapas y economía pregunta a
## la app (NIVEL APP) por sus rutas `/api/*`.
##
## Arranca LIMPIO, sin contenido de prueba. Los mundos se construyen en el editor
## de Godot y se guardan en `res://mundos/`. Mientras no exista ninguno, se
## genera un lienzo mínimo para poder probar el personaje y la entrada.
##
## Flujo de entrada (el contrato con la app):
##   1. La app valida al usuario y hace la transición a negro ANTES de montar
##      esta escena, así que aquí ya hay sesión (o se juega sin recompensas).
##   2. Se recupera el punto de guardado: escena + posición donde se quedó.
##   3. Si no hay guardado (partida nueva), se arranca en la primera escena.

const TILE_VISUAL := 64.0  ## 32 px de tile a escala 2
const ALCANCE := 120.0  ## distancia para hablar/recoger, en píxeles

@onready var hud: Label = $UI/Hud

var _mundo: Node2D
var _jugador: Personaje
var _camara: Camera2D
var _velocidad := 190.0

var _dialogo: Dialogo
var _npcs: Array[Personaje] = []
var _objetos: Array[Objeto] = []
var _transiciones: Array[Transicion] = []
var _pista: Label

var _npc_cerca: Personaje = null
var _objeto_cerca: Objeto = null
var _recogiendo := {}
var _etapas_abiertas := {}
var _etapas_pendientes := {}
var _transicion_en_curso := false

var _escena := "inicio"
var _origen := ""
var _ultima_casilla := Vector2i(-9999, -9999)
var _http_pos: HTTPRequest
var _aviso_hasta := 0.0


func _ready() -> void:
	_dialogo = Dialogo.new()
	add_child(_dialogo)
	_crear_pista()

	# La sesión se consulta ya: alimenta el HUD y las etapas que gobiernan las
	# puertas, mientras el resto se prepara.
	_leer_origen()
	_consultar_sesion()

	# Recuperar la partida: en qué escena y posición se quedó el usuario.
	var guardado := await _recuperar_partida()
	var slug: String = guardado.get("scene", "inicio")
	await _cargar_mundo(slug, false)

	await _crear_jugador()
	# Colocar al jugador donde se quedó, si el guardado es de esta escena.
	if guardado.has("x") and guardado.has("y") and guardado.get("scene", "") == _escena:
		_jugador.position = _a_pixeles(int(guardado["x"]), int(guardado["y"]))

	await _crear_npcs()
	_recolectar_entidades()


func _leer_origen() -> void:
	if not OS.has_feature("web"):
		return
	var o: Variant = JavaScriptBridge.eval("window.location.origin", true)
	if typeof(o) == TYPE_STRING:
		_origen = str(o)


func _a_pixeles(tx: int, ty: int) -> Vector2:
	return Vector2((tx + 0.5) * TILE_VISUAL, (ty + 0.5) * TILE_VISUAL)


# --- Recuperar partida --------------------------------------------------------


## Pregunta al servidor dónde se quedó el usuario. Devuelve {} si no hay
## guardado o sesión: entonces se arranca la primera escena desde su spawn. Es
## el paso que faltaba para "recuperar la partida donde se quedó".
func _recuperar_partida() -> Dictionary:
	if _origen.is_empty():
		return {}
	var http := HTTPRequest.new()
	add_child(http)
	if http.request(_origen + "/api/world/position") != OK:
		http.queue_free()
		return {}
	var res: Array = await http.request_completed
	http.queue_free()
	if int(res[1]) != 200:
		return {}
	var datos: Variant = JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())
	if typeof(datos) != TYPE_DICTIONARY:
		return {}
	var pos: Variant = datos.get("position", null)
	return pos if typeof(pos) == TYPE_DICTIONARY else {}


# --- Mundo --------------------------------------------------------------------


## Carga la escena del mundo. Si el archivo no existe (aún no hay mundos
## construidos), genera un lienzo mínimo para que el personaje tenga dónde estar.
func _cargar_mundo(slug: String, cambio: bool) -> void:
	var ruta := "res://mundos/%s.tscn" % slug
	var nuevo: Node2D = null

	if ResourceLoader.exists(ruta):
		var empaquetada: PackedScene = load(ruta)
		if empaquetada != null:
			nuevo = empaquetada.instantiate()

	if nuevo == null:
		# Sin mundo construido todavía: lienzo mínimo, honesto sobre su estado.
		nuevo = _lienzo_minimo()
		slug = "inicio"

	if cambio and _mundo != null:
		for npc in _npcs:
			if is_instance_valid(npc):
				npc.queue_free()
		_npcs.clear()
		_objetos.clear()
		_transiciones.clear()
		_mundo.queue_free()

	_mundo = nuevo
	add_child(_mundo)
	move_child(_mundo, 0)
	_escena = slug


## Suelo pequeño de color, con un rótulo. No es contenido de juego: es el estado
## "aún no has construido tu primer mundo", visible mientras se desarrolla.
func _lienzo_minimo() -> Node2D:
	var raiz := Node2D.new()
	raiz.name = "LienzoMinimo"

	var suelo := ColorRect.new()
	suelo.color = Color(0.29, 0.42, 0.24)  # verde apagado
	suelo.size = Vector2(30 * TILE_VISUAL, 20 * TILE_VISUAL)
	raiz.add_child(suelo)

	var spawn := Marker2D.new()
	spawn.name = "Spawn"
	spawn.position = Vector2(15 * TILE_VISUAL, 10 * TILE_VISUAL)
	raiz.add_child(spawn)

	return raiz


# --- Jugador y cámara ---------------------------------------------------------


func _crear_jugador() -> void:
	var p := Personaje.new()
	p.name = "Jugador"
	p.add_to_group(Transicion.GRUPO_JUGADOR)
	_jugador = p

	var spawn := _mundo.get_node_or_null("Spawn")
	_jugador.position = spawn.position if spawn != null else Vector2(400, 400)
	add_child(_jugador)
	p.z_index = 100

	if not await p.cargar_desde_servidor():
		# Sin sesión o sin personaje creado: marcador, para distinguirlo de un
		# fallo del motor.
		var marca := ColorRect.new()
		marca.color = Color(0.47, 0.35, 0.85)
		marca.size = Vector2(28, 44)
		marca.position = Vector2(-14, -40)
		p.add_child(marca)

	_camara = Camera2D.new()
	_camara.position_smoothing_enabled = true
	_camara.position_smoothing_speed = 6.0
	_jugador.add_child(_camara)
	_camara.make_current()


# --- NPCs y entidades ---------------------------------------------------------


## Monta los NPCs que el mundo trae como marcadores. Un mundo recién construido
## puede no tener ninguno.
func _crear_npcs() -> void:
	var cont := _mundo.get_node_or_null("NPCs")
	if cont == null:
		return
	for marca in cont.get_children():
		if not marca is Marker2D:
			continue
		var npc := Personaje.new()
		npc.name = marca.name
		npc.position = marca.position
		npc.z_index = 90
		add_child(npc)
		npc.set_meta("dialogo", marca.get_meta("dialogo", []))
		npc.set_meta("titulo", marca.name)
		_npcs.append(npc)

		var capas: Array = marca.get_meta("capas", [])
		var ok := false
		if not capas.is_empty():
			ok = await npc.componer_desde(
				capas, str(marca.get_meta("complexion", "medio")), float(marca.get_meta("escala", 1))
			)
		if ok:
			npc.reproducir("idle", str(marca.get_meta("mirando", "s")))


## Indexa objetos y transiciones del mundo actual.
func _recolectar_entidades() -> void:
	_objetos.clear()
	_transiciones.clear()
	_buscar(_mundo)


func _buscar(nodo: Node) -> void:
	if nodo is Objeto:
		_objetos.append(nodo as Objeto)
	elif nodo is Transicion:
		var t := nodo as Transicion
		_transiciones.append(t)
		t.cruzada.connect(_on_transicion)
	for hijo in nodo.get_children():
		_buscar(hijo)


# --- Bucle --------------------------------------------------------------------


func _physics_process(_delta: float) -> void:
	if _jugador == null:
		return

	if _dialogo != null and _dialogo.activo():
		_jugador.velocity = Vector2.ZERO
		_jugador.reproducir("idle", _jugador.mirando())
		return

	_actualizar_cercanos()

	var dir := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	_jugador.velocity = dir.normalized() * _velocidad
	_jugador.move_and_slide()

	if dir == Vector2.ZERO:
		_jugador.reproducir("idle", _jugador.mirando())
	else:
		var mirando := _jugador.mirando()
		if absf(dir.x) > absf(dir.y):
			mirando = "e" if dir.x > 0.0 else "w"
		else:
			mirando = "s" if dir.y > 0.0 else "n"
		_jugador.reproducir("walk", mirando)

	_guardar_posicion()


func _actualizar_cercanos() -> void:
	var mejor_npc: Personaje = null
	var d_npc := ALCANCE
	for npc in _npcs:
		if not is_instance_valid(npc):
			continue
		var d := _jugador.position.distance_to(npc.position)
		if d <= d_npc:
			d_npc = d
			mejor_npc = npc
	_npc_cerca = mejor_npc

	_objeto_cerca = null
	var d_obj := ALCANCE
	for obj in _objetos:
		if not is_instance_valid(obj):
			continue
		var d := _jugador.position.distance_to(obj.global_position)
		if d <= d_obj:
			d_obj = d
			_objeto_cerca = obj

	if _pista == null:
		return
	if Time.get_ticks_msec() / 1000.0 < _aviso_hasta:
		return
	if _objeto_cerca != null:
		_pista.visible = true
		_pista.text = "Pulsa E para recoger"
	elif mejor_npc != null:
		_pista.visible = true
		_pista.text = "Pulsa E para hablar con %s" % str(mejor_npc.get_meta("titulo", "…"))
	else:
		_pista.visible = false


func _unhandled_input(evento: InputEvent) -> void:
	if _dialogo == null or _dialogo.activo():
		return
	if _npc_cerca == null and _objeto_cerca == null:
		return

	var actuar := false
	if evento is InputEventKey and evento.pressed and not evento.echo:
		var k := (evento as InputEventKey).keycode
		actuar = k == KEY_E or k == KEY_ENTER or k == KEY_KP_ENTER
	elif evento is InputEventScreenTouch and (evento as InputEventScreenTouch).pressed:
		actuar = true
	if not actuar:
		return
	get_viewport().set_input_as_handled()

	if _objeto_cerca != null:
		_recoger(_objeto_cerca)
		return

	var lineas: Array = _npc_cerca.get_meta("dialogo", [])
	if lineas.is_empty():
		return
	_npc_cerca.reproducir("idle", _direccion_hacia(_npc_cerca.position, _jugador.position))
	_dialogo.iniciar(str(_npc_cerca.get_meta("titulo", "")), lineas)


func _direccion_hacia(desde: Vector2, hasta: Vector2) -> String:
	var d := hasta - desde
	if absf(d.x) > absf(d.y):
		return "e" if d.x > 0.0 else "w"
	return "s" if d.y > 0.0 else "n"


# --- Transiciones -------------------------------------------------------------


func _on_transicion(t: Transicion) -> void:
	if _transicion_en_curso:
		return
	if not t.abierta(_etapas_abiertas):
		_aviso(t.motivo(_etapas_pendientes))
		return
	if t.destino.is_empty():
		return
	_transicion_en_curso = true
	await _cargar_mundo(t.destino, true)
	if t.casilla_destino.x >= 0 and t.casilla_destino.y >= 0:
		_jugador.position = _a_pixeles(t.casilla_destino.x, t.casilla_destino.y)
	else:
		var spawn := _mundo.get_node_or_null("Spawn")
		if spawn != null:
			_jugador.position = spawn.position
	await _crear_npcs()
	_recolectar_entidades()
	# Forzar reenvío de posición: el servidor debe saber que cambió de escena, o
	# rechazará las recogidas del mundo nuevo por "demasiado lejos".
	_ultima_casilla = Vector2i(-9999, -9999)
	_transicion_en_curso = false


# --- Recogida ----------------------------------------------------------------


func _recoger(obj: Objeto) -> void:
	if _origen.is_empty() or _recogiendo.has(obj):
		return
	_recogiendo[obj] = true
	var http := HTTPRequest.new()
	add_child(http)
	var cuerpo := JSON.stringify({"sceneSlug": _escena, "placementId": obj.id_colocacion()})
	if (
		http.request(
			_origen + "/api/world/inventory",
			["Content-Type: application/json"],
			HTTPClient.METHOD_POST,
			cuerpo
		)
		!= OK
	):
		_recogiendo.erase(obj)
		http.queue_free()
		return
	var res: Array = await http.request_completed
	http.queue_free()
	_recogiendo.erase(obj)

	var codigo := int(res[1])
	if codigo == 200:
		_objetos.erase(obj)
		obj.queue_free()
		_aviso("Recogido")
	elif codigo == 409:
		_aviso("Inventario lleno")
	elif codigo == 403:
		_aviso("No se pudo recoger aquí")
	else:
		_aviso("Error al recoger (%d)" % codigo)


# --- Guardar posición ---------------------------------------------------------


func _guardar_posicion() -> void:
	if _origen.is_empty():
		return
	var casilla := Vector2i(
		int(floor(_jugador.position.x / TILE_VISUAL)), int(floor(_jugador.position.y / TILE_VISUAL))
	)
	if casilla == _ultima_casilla:
		return
	if _http_pos == null:
		_http_pos = HTTPRequest.new()
		add_child(_http_pos)
	if _http_pos.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return
	# `_ultima_casilla` se actualiza SOLO tras conseguir enviar: marcarla antes
	# perdería las casillas atravesadas con una petición en vuelo.
	var cuerpo := JSON.stringify(
		{"sceneSlug": _escena, "x": casilla.x, "y": casilla.y, "facing": _jugador.mirando()}
	)
	var ok := _http_pos.request(
		_origen + "/api/world/position",
		["Content-Type: application/json"],
		HTTPClient.METHOD_POST,
		cuerpo
	)
	if ok == OK:
		_ultima_casilla = casilla


# --- Sesión / HUD -------------------------------------------------------------


func _consultar_sesion() -> void:
	if _origen.is_empty():
		hud.text = "Modo escritorio (sin sesión)"
		return
	var http := HTTPRequest.new()
	add_child(http)
	http.request_completed.connect(_on_sesion)
	http.request(_origen + "/api/game/stages")


func _on_sesion(_r: int, codigo: int, _h: PackedStringArray, cuerpo: PackedByteArray) -> void:
	if codigo == 401:
		hud.text = "Sin sesión iniciada"
		return
	if codigo != 200:
		hud.text = "Servidor: HTTP %d" % codigo
		return
	var datos: Variant = JSON.parse_string(cuerpo.get_string_from_utf8())
	if typeof(datos) != TYPE_DICTIONARY:
		return
	var saldos: Variant = datos.get("balances", {})
	var fichas: int = int(saldos.get("ficha", 0)) if typeof(saldos) == TYPE_DICTIONARY else 0
	var etapas: Array = datos.get("stages", [])
	var abiertas := 0
	_etapas_abiertas.clear()
	_etapas_pendientes.clear()
	for e in etapas:
		var slug := str(e.get("slug", ""))
		if bool(e.get("unlocked", false)):
			abiertas += 1
			_etapas_abiertas[slug] = true
		else:
			_etapas_pendientes[slug] = str(e.get("pending", ""))
	hud.text = "Fichas: %d    Etapas: %d/%d" % [fichas, abiertas, etapas.size()]


func _crear_pista() -> void:
	_pista = Label.new()
	_pista.add_theme_font_size_override("font_size", 15)
	_pista.add_theme_color_override("font_color", Color(1, 1, 1, 0.9))
	_pista.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_pista.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_pista.offset_top = -90.0
	_pista.offset_left = -160.0
	_pista.offset_right = 160.0
	_pista.visible = false
	($UI as CanvasLayer).add_child(_pista)


func _aviso(texto: String, segundos := 2.2) -> void:
	if _pista == null:
		return
	_pista.text = texto
	_pista.visible = true
	_aviso_hasta = Time.get_ticks_msec() / 1000.0 + segundos
