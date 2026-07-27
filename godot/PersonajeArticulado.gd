extends Node2D

## El personaje del jugador, montado con PIEZAS DIBUJADAS COMO PIEZAS.
##
## Es el camino de Guardian Tales. La diferencia con lo que había antes —y es
## toda la diferencia— está en de dónde salen las piezas: antes se recortaban de
## un dibujo plano, donde el brazo no existe como objeto sino como unos píxeles
## pegados al torso; por eso al girarlo se abría el hombro y quedaban manos
## sueltas. Ahora **el modelo dibuja cada pieza entera**, con el extremo de la
## articulación redondeado y material de sobra en la unión.
##
## Lo que esto desbloquea: un casco o una armadura se dibujan UNA vez, como
## pieza, y valen para caminar, correr y atacar.
##
## CÓMO SE MONTA EN LA ESCENA
##   Jugador          (CharacterBody2D)
##     └─ Articulado  (Node2D)  ← este script
## Los sprites los crea el script; no hay que colocar nada a mano.
##
## LA JERARQUÍA
## El torso manda y todo cuelga de él, así que inclinarlo arrastra cabeza y
## brazos sin moverlos uno a uno:
##   torso ├─ cabeza · brazoLejano · brazoCercano
##         └─ faldon · piernaIzq · piernaDer

const PIEZAS_PNG := "res://assets/piezas-mujer.png"
const PIEZAS_JSON := "res://assets/piezas-mujer.json"
## En el juego real, la app deja aquí las piezas del personaje del jugador.
const PIEZAS_PNG_JUGADOR := "user://piezas.png"
const PIEZAS_JSON_JUGADOR := "user://piezas.json"

@export var vista: int = 0
@export var pasos_por_segundo: float = 1.9

@export_group("Caminar")
## Afinar un paso es oficio, no cálculo: estos números están para moverlos y
## mirar. El único límite duro es la rotación — pasados unos 16° el pixel art
## empieza a enseñar el escalonado en los bordes.
@export_range(0.0, 30.0) var grados_piernas: float = 16.0
@export_range(0.0, 30.0) var grados_brazos: float = 13.0
## La tela no dobla como una pierna: el faldón se mece mucho menos.
@export_range(0.0, 12.0) var grados_faldon: float = 5.0
@export_range(0.0, 8.0) var rebote_px: float = 2.0

var _datos: Dictionary = {}
var _nodos: Dictionary = {}
var _reloj := 0.0
var _andando := false

func _ready() -> void:
	_montar()

func _montar() -> void:
	for hijo in get_children():
		hijo.queue_free()
	_nodos.clear()

	var ruta_json := PIEZAS_JSON_JUGADOR if FileAccess.file_exists(PIEZAS_JSON_JUGADOR) else PIEZAS_JSON
	var ruta_png := PIEZAS_PNG_JUGADOR if FileAccess.file_exists(PIEZAS_PNG_JUGADOR) else PIEZAS_PNG

	var texto := FileAccess.get_file_as_string(ruta_json)
	if texto.is_empty():
		push_warning("No hay piezas del personaje (%s)" % ruta_json)
		return
	_datos = JSON.parse_string(texto)

	# Dos formas de cargar, y no son intercambiables: `res://` es un recurso ya
	# importado y se pide con `load`; `user://` es un archivo suelto y se lee
	# como imagen. Usar el camino equivocado funciona en el editor pero el export
	# lo deja fuera.
	var textura: Texture2D
	if ruta_png.begins_with("res://"):
		textura = load(ruta_png)
	else:
		var img := Image.new()
		if img.load(ruta_png) != OK:
			push_warning("No se pudo leer %s" % ruta_png)
			return
		textura = ImageTexture.create_from_image(img)

	var v: Variant = _datos["vistas"][vista]
	if v == null:
		push_warning("La vista %d no tiene piezas" % vista)
		return
	var piezas: Dictionary = v
	if not piezas.has("torso") or not piezas.has("_union"):
		push_warning("Faltan el torso o los puntos de unión en la vista %d" % vista)
		return
	var union: Dictionary = piezas["_union"]

	# El TORSO es la raíz. Se coloca de modo que su cadera caiga en el origen de
	# este nodo: así el personaje se apoya donde se ponga el nodo.
	var t_pivote: Dictionary = piezas["torso"]["pivote"]
	var torso := _crear_sprite(textura, piezas["torso"], Vector2.ZERO)
	torso.name = "torso"
	add_child(torso)
	_nodos["torso"] = torso

	# Todo lo demás cuelga del torso, en su punto de unión. Las posiciones son
	# RELATIVAS al pivote del torso, que es su cadera.
	_colgar(textura, piezas, torso, "cabeza", _relativo(union["cuello"], t_pivote))
	_colgar(textura, piezas, torso, "brazoLejano", _relativo(union["hombroLejano"], t_pivote))
	_colgar(textura, piezas, torso, "brazoCercano", _relativo(union["hombroCercano"], t_pivote))
	_colgar(textura, piezas, torso, "faldon", _relativo(union["cadera"], t_pivote))
	_colgar(textura, piezas, torso, "piernaIzq", _relativo(union["caderaIzq"], t_pivote))
	_colgar(textura, piezas, torso, "piernaDer", _relativo(union["caderaDer"], t_pivote))

	# Orden de dibujo: lo de detrás primero. El brazo lejano queda tapado por el
	# torso; el cercano, por delante de todo.
	for nombre in ["brazoLejano", "piernaIzq", "piernaDer", "faldon", "cabeza", "brazoCercano"]:
		if _nodos.has(nombre):
			var n: Node2D = _nodos[nombre]
			torso.move_child(n, torso.get_child_count() - 1)

func _relativo(punto: Dictionary, pivote_torso: Dictionary) -> Vector2:
	return Vector2(float(punto["x"]) - float(pivote_torso["x"]), float(punto["y"]) - float(pivote_torso["y"]))

func _colgar(textura: Texture2D, piezas: Dictionary, padre: Node2D, clave: String, donde: Vector2) -> void:
	if not piezas.has(clave):
		return
	var sp := _crear_sprite(textura, piezas[clave], donde)
	sp.name = clave
	padre.add_child(sp)
	_nodos[clave] = sp

func _crear_sprite(textura: Texture2D, pieza: Dictionary, donde: Vector2) -> Sprite2D:
	var region: Dictionary = pieza["region"]
	var pivote: Dictionary = pieza["pivote"]
	var trozo := AtlasTexture.new()
	trozo.atlas = textura
	trozo.region = Rect2(region["x"], region["y"], region["w"], region["h"])

	var sp := Sprite2D.new()
	sp.texture = trozo
	sp.centered = false
	# La pieza se corre para que su PIVOTE caiga en la posición del nodo: así
	# `rotation` gira por el hombro o la cadera, no por la esquina del recorte.
	sp.offset = Vector2(-float(pivote["x"]), -float(pivote["y"]))
	sp.position = donde
	sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return sp

func andar(activo: bool) -> void:
	_andando = activo
	if not activo:
		_reloj = 0.0
		_postura(0.0)

func _process(delta: float) -> void:
	if _nodos.is_empty():
		return
	if _andando:
		_reloj += delta * pasos_por_segundo * TAU
	_postura(_reloj)

func _postura(t: float) -> void:
	var s := sin(t)
	_girar("piernaIzq", s * grados_piernas)
	_girar("piernaDer", -s * grados_piernas)
	_girar("faldon", s * grados_faldon)
	_girar("brazoCercano", -s * grados_brazos)
	_girar("brazoLejano", s * grados_brazos)
	_girar("torso", sin(t * 2.0) * 1.5)
	_girar("cabeza", -sin(t * 2.0) * 1.5)
	# El rebote va en el torso y, como todo cuelga de él, sube y baja el
	# personaje entero de una sola vez.
	if _nodos.has("torso"):
		(_nodos["torso"] as Sprite2D).position.y = absf(s) * -rebote_px

func _girar(nombre: String, grados: float) -> void:
	if _nodos.has(nombre):
		(_nodos[nombre] as Sprite2D).rotation_degrees = grados

## Cambia la vista. Se vuelve a montar porque cada vista tiene sus propias
## piezas y sus propias uniones.
func mirar(nueva_vista: int) -> void:
	if nueva_vista == vista:
		return
	vista = nueva_vista
	_montar()

## Dónde poner un arma o una herramienta, para cuando llegue el combate.
func punto_mano() -> Node2D:
	return _nodos.get("brazoCercano")
