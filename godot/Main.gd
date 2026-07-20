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

## Distancia, en píxeles de mundo, a la que se puede hablar con un NPC.
##
## Poco menos de dos tiles (el tile se ve a 64 px). Con un tile justo parecía
## roto: dos personajes visualmente pegados pero en diagonal ya superaban el
## límite, y el aviso de hablar no salía aunque el jugador estuviera encima.
const ALCANCE_DIALOGO := 120.0

var _mundo: Node2D
var _jugador: Personaje
var _camara: Camera2D
var _velocidad := 190.0

var _dialogo: Dialogo
var _npcs: Array[Personaje] = []
var _pista: Label
var _npc_cerca: Personaje = null
var _objetos: Array[Objeto] = []
var _objeto_cerca: Objeto = null
## Recogidas en vuelo, para que pulsar dos veces no envie dos peticiones.
var _recogiendo := {}

## Nombre de la escena actual, tal como lo conoce el servidor.
var _escena := "main"
var _origen := ""
## Última casilla enviada, para no repetir la escritura en cada frame.
var _ultima_casilla := Vector2i(-9999, -9999)
var _http_pos: HTTPRequest


func _ready() -> void:
	var escena: PackedScene = load(MUNDO)
	if escena == null:
		hud.text = "No se encontró el mundo.\nEjecuta el importador de mapas."
		return

	_mundo = escena.instantiate()
	add_child(_mundo)

	_dialogo = Dialogo.new()
	add_child(_dialogo)

	_crear_pista()

	# La sesión se consulta ANTES de esperar al personaje: así el HUD muestra
	# fichas y etapas mientras las capas todavía se descargan.
	_consultar_sesion()
	await _crear_jugador()
	# Los NPCs se componen después del jugador: si se hiciera a la vez, las
	# descargas competirían y el jugador (que es lo primero que se mira)
	# tardaría más en aparecer.
	await _crear_npcs()
	_recolectar_objetos()


## Indexa los objetos que vienen colocados en la escena del mundo.
func _recolectar_objetos() -> void:
	_objetos.clear()
	_buscar_objetos(_mundo)


func _buscar_objetos(nodo: Node) -> void:
	if nodo is Objeto:
		_objetos.append(nodo as Objeto)
	for hijo in nodo.get_children():
		_buscar_objetos(hijo)


## Aviso flotante de "pulsa para hablar". Va en la interfaz y no en el mundo
## para que no se escale con la cámara ni lo tapen los tiles.
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


## Instancia los NPCs que el importador dejó como marcadores con sus datos.
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
		npc.z_index = 90  # bajo el jugador, sobre el mapa
		add_child(npc)

		npc.set_meta("dialogo", marca.get_meta("dialogo", []))
		npc.set_meta("titulo", marca.name)
		_npcs.append(npc)

		var capas: Array = marca.get_meta("capas", [])
		var ok := false
		if not capas.is_empty():
			ok = await npc.componer_desde(
				capas,
				str(marca.get_meta("complexion", "medio")),
				float(marca.get_meta("escala", 1))
			)
		if ok:
			npc.reproducir("idle", str(marca.get_meta("mirando", "s")))
		else:
			# Sin capas (configuración incompleta en el editor viejo) se dibuja
			# un marcador: mejor un NPC feo que un NPC invisible con el que se
			# puede hablar desde la nada.
			var m := ColorRect.new()
			m.color = Color(0.85, 0.65, 0.25)
			m.size = Vector2(26, 40)
			m.position = Vector2(-13, -36)
			npc.add_child(m)


func _crear_jugador() -> void:
	var p := Personaje.new()
	p.name = "Jugador"
	_jugador = p

	var spawn := _mundo.get_node_or_null("Spawn")
	_jugador.position = spawn.position if spawn != null else Vector2(400, 400)
	add_child(_jugador)

	# Se dibuja por encima del mapa. Sin esto quedaría bajo las capas de tiles.
	p.z_index = 100

	# La carga es asíncrona (descarga ~11 imágenes). Si falla —sin sesión, o el
	# jugador aún no creó su personaje— se deja un marcador visible en vez de
	# nada, para que se distinga de un fallo del motor.
	if not await p.cargar_desde_servidor():
		var marca := ColorRect.new()
		marca.color = Color(0.47, 0.35, 0.85)
		marca.size = Vector2(28, 44)
		marca.position = Vector2(-14, -40)
		p.add_child(marca)

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

	# Mientras se habla, el personaje se queda quieto. Si no, se camina sin
	# querer al pulsar la tecla de avanzar el diálogo.
	if _dialogo != null and _dialogo.activo():
		_jugador.velocity = Vector2.ZERO
		_jugador.reproducir("idle", _jugador.mirando())
		_pista.visible = false
		return

	_actualizar_npc_cercano()

	var dir := Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
	# Normalizar para que la diagonal no sea más rápida que recto.
	_jugador.velocity = dir.normalized() * _velocidad
	_jugador.move_and_slide()

	# Animación según el movimiento. La dirección se decide por el eje dominante:
	# LPC solo tiene 4 vistas, no diagonales.
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


## Envía la casilla del jugador cuando cambia.
##
## No es telemetría: el servidor la necesita para poder comprobar que una
## recogida ocurre CERCA del objeto. Sin posición conocida rechaza la recogida,
## que es lo correcto cuando hay fichas canjeables de por medio.
##
## Solo se envía al cambiar de casilla, no por frame: cada envío es una
## escritura en base de datos.
func _guardar_posicion() -> void:
	if _origen.is_empty():
		return
	var casilla := Vector2i(
		int(floor(_jugador.position.x / TILE_VISUAL)), int(floor(_jugador.position.y / TILE_VISUAL))
	)
	if casilla == _ultima_casilla:
		return
	_ultima_casilla = casilla

	if _http_pos == null:
		_http_pos = HTTPRequest.new()
		add_child(_http_pos)
	# Si el envío anterior sigue en vuelo se descarta este: la próxima casilla
	# lo corregirá, y encolar peticiones por cada paso saturaría la conexión.
	if _http_pos.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return

	var cuerpo := JSON.stringify(
		{
			"sceneSlug": _escena,
			"x": casilla.x,
			"y": casilla.y,
			"facing": _jugador.mirando(),
		}
	)
	_http_pos.request(
		_origen + "/api/world/position",
		["Content-Type: application/json"],
		HTTPClient.METHOD_POST,
		cuerpo
	)


## Busca el NPC hablable más cercano y muestra el aviso.
##
## Se compara contra la posición REAL del NPC, no contra su casilla de origen.
## En el juego anterior se usaba la casilla, así que un NPC que caminaba seguía
## siendo hablable desde donde había estado y no desde donde se veía.
func _actualizar_npc_cercano() -> void:
	var mejor: Personaje = null
	var mejor_dist := ALCANCE_DIALOGO
	for npc in _npcs:
		var d := _jugador.position.distance_to(npc.position)
		if d <= mejor_dist:
			mejor_dist = d
			mejor = npc

	_npc_cerca = mejor

	# Objeto recogible más cercano. Tiene prioridad sobre hablar: si hay un
	# objeto a los pies, lo que uno espera al pulsar es recogerlo.
	_objeto_cerca = null
	var dist_obj := ALCANCE_DIALOGO
	for obj in _objetos:
		if not is_instance_valid(obj):
			continue
		var d := _jugador.position.distance_to(obj.global_position)
		if d <= dist_obj:
			dist_obj = d
			_objeto_cerca = obj

	if _pista == null:
		return
	if _objeto_cerca != null:
		_pista.visible = true
		_pista.text = "Pulsa E para recoger"
	elif mejor != null:
		_pista.visible = true
		_pista.text = "Pulsa E para hablar con %s" % str(mejor.get_meta("titulo", "…"))
	else:
		_pista.visible = false


## Pide al servidor recoger el objeto.
##
## El cliente solo dice QUÉ colocación toca; el servidor decide qué objeto es y
## cuántos entrega, comprobando además que el jugador esté cerca de verdad. El
## objeto no desaparece hasta que el servidor confirma: si se quitara antes,
## un rechazo dejaría el mundo y el inventario descuadrados.
func _recoger(obj: Objeto) -> void:
	if _origen.is_empty() or _recogiendo.has(obj):
		return
	_recogiendo[obj] = true

	var http := HTTPRequest.new()
	add_child(http)
	var cuerpo := JSON.stringify(
		{"sceneSlug": _escena, "placementId": obj.id_colocacion()}
	)
	var err := http.request(
		_origen + "/api/world/inventory",
		["Content-Type: application/json"],
		HTTPClient.METHOD_POST,
		cuerpo
	)
	if err != OK:
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
		# Pasa si el servidor aún no conoce la posición del jugador, o si el
		# manifiesto no está sincronizado con lo que hay en el mapa.
		_aviso("No se pudo recoger aquí")
	else:
		_aviso("Error al recoger (%d)" % codigo)


## Mensaje breve en el aviso inferior. Se restaura solo.
func _aviso(texto: String) -> void:
	if _pista == null:
		return
	_pista.text = texto
	_pista.visible = true
	await get_tree().create_timer(1.6).timeout


func _unhandled_input(evento: InputEvent) -> void:
	if _dialogo == null or _dialogo.activo():
		return
	if _npc_cerca == null and _objeto_cerca == null:
		return

	var hablar := false
	if evento is InputEventKey and evento.pressed and not evento.echo:
		var k := (evento as InputEventKey).keycode
		hablar = k == KEY_E or k == KEY_ENTER or k == KEY_KP_ENTER
	elif evento is InputEventScreenTouch and (evento as InputEventScreenTouch).pressed:
		# En móvil no hay tecla: tocar cerca del NPC inicia la conversación.
		hablar = true

	if not hablar:
		return

	# Recoger tiene prioridad: si hay un objeto a los pies, es lo que se espera.
	if _objeto_cerca != null:
		get_viewport().set_input_as_handled()
		_recoger(_objeto_cerca)
		return

	var lineas: Array = _npc_cerca.get_meta("dialogo", [])
	if lineas.is_empty():
		return

	# El NPC mira al jugador antes de hablar: pequeño detalle que hace que la
	# conversación no parezca dirigida a la pared.
	_npc_cerca.reproducir("idle", _direccion_hacia(_npc_cerca.position, _jugador.position))
	_dialogo.iniciar(str(_npc_cerca.get_meta("titulo", "")), lineas)
	get_viewport().set_input_as_handled()


func _direccion_hacia(desde: Vector2, hasta: Vector2) -> String:
	var d := hasta - desde
	if absf(d.x) > absf(d.y):
		return "e" if d.x > 0.0 else "w"
	return "s" if d.y > 0.0 else "n"


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
	_origen = str(origen)
	http.request(_origen + "/api/game/stages")


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
	# El saldo es un entero: JSON lo entrega como float y se vería "0.0", que
	# parece un precio y no una cantidad de fichas.
	var fichas: int = int(saldos.get("ficha", 0)) if typeof(saldos) == TYPE_DICTIONARY else 0
	var etapas: Array = datos.get("stages", [])
	var abiertas := 0
	for e in etapas:
		if bool(e.get("unlocked", false)):
			abiertas += 1
	hud.text = "Fichas: %d    Etapas: %d/%d" % [fichas, abiertas, etapas.size()]
