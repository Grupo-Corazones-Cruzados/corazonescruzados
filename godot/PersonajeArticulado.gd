extends Node2D

## El personaje del jugador, montado por piezas y animado por rotación.
##
## Es el camino de Guardian Tales: el cuerpo se corta en piezas (cabeza, torso,
## brazos, piernas o faldón) y cada una cuelga de un pivote. Caminar, correr y
## atacar son rotaciones de esas piezas, no dibujos nuevos. Y lo que se lleva
## puesto —un casco, una armadura— se dibuja UNA vez y sigue a su pieza.
##
## CÓMO SE MONTA EN LA ESCENA
##   Jugador            (CharacterBody2D)
##     └─ Articulado    (Node2D)  ← este script
## Nada más. Los sprites de cada parte los crea el propio script al arrancar; no
## hay que colocarlos a mano, y así el día que cambie el rig no hay que rehacer
## la escena.
##
## DE DÓNDE SALEN LOS DATOS
##   · `user://personaje.png` — la hoja del personaje, que deja la app (ver
##     components/game/GodotGame.tsx; no la descarga Godot porque la sesión vive
##     en una cookie del navegador que sus peticiones no arrastran).
##   · `res://assets/rig-personaje.json` — dónde cortar y por dónde articula.
##     Lo exporta `scripts/exportar-rig.mjs` desde el MISMO módulo que usa la
##     web, para que las dos partes corten por idéntico sitio.

const RUTA_HOJA := "user://personaje.png"
## Hoja de repuesto para probar EN EL EDITOR. En el navegador la hoja de verdad
## llega a `user://`, pero ahí no existe al abrir el proyecto en el escritorio, y
## sin esto no habría forma de ver el personaje sin desplegar la web entera.
const RUTA_HOJA_PRUEBA := "res://assets/personaje-prueba.png"
const RUTA_RIG := "user://personaje-rig.json"
## Rig de repuesto, medido sobre la hoja de prueba, para trabajar en el editor.
const RUTA_RIG_PRUEBA := "res://assets/rig-prueba.json"

## Vista que se está mostrando: 0 frente · 1 espalda · 2 izquierda · 3 derecha.
@export var vista: int = 0
## Velocidad del ciclo de caminar, en pasos por segundo.
@export var pasos_por_segundo: float = 1.9

## Cuánto se mueve cada cosa al caminar.
##
## Se dejan a la vista en el Inspector a propósito: **afinar un paso es oficio,
## no cálculo**. Lo que se ve bien no sale de una fórmula, sale de mover el
## número y mirar. El único límite duro es la rotación: pasados unos 14° el
## pixel art empieza a enseñar el escalonado en los bordes.
@export_group("Caminar")
@export_range(0.0, 20.0) var grados_piernas: float = 14.0
@export_range(0.0, 20.0) var grados_brazos: float = 12.0
## La tela no dobla como una pierna: el faldón se mece mucho menos.
@export_range(0.0, 10.0) var grados_faldon: float = 4.0
@export_range(0.0, 6.0) var rebote_px: float = 2.5
## Cuánto sube el pie que da el paso.
@export_range(0.0, 6.0) var levanta_pie_px: float = 2.0

var _piezas: Dictionary = {}      ## nombre → Sprite2D
var _rig: Dictionary = {}         ## nombre → definición (caja, pivote)
var _reloj := 0.0
var _andando := false
var _ruta_hoja_actual := ""

func _ready() -> void:
	if not _cargar_rig():
		return
	await _esperar_hoja()

func _cargar_rig() -> bool:
	# El rig del jugador llega junto a su hoja; si no está (escritorio), se usa
	# el de la hoja de prueba.
	var ruta := RUTA_RIG if FileAccess.file_exists(RUTA_RIG) else RUTA_RIG_PRUEBA
	if not FileAccess.file_exists(ruta) and not ResourceLoader.exists(ruta):
		push_warning("Falta el rig (%s)" % ruta)
		return false
	var texto := FileAccess.get_file_as_string(ruta)
	var datos: Variant = JSON.parse_string(texto)
	if typeof(datos) != TYPE_DICTIONARY:
		push_warning("El rig no se pudo leer")
		return false
	_rig = datos
	return true

## La app copia la hoja justo después de arrancar el motor, así que puede tardar
## un instante en aparecer. Se espera en vez de dar el personaje por perdido; y
## si no llega —caso típico: abrir el proyecto en el escritorio— se usa la de
## prueba, para poder trabajar el rig sin depender de la web.
func _esperar_hoja() -> void:
	# Solo tiene sentido esperar en el navegador: la hoja de verdad la deja ahí
	# la app. En el escritorio no va a llegar nunca, así que se va directo al
	# repuesto en vez de tener al personaje invisible cinco segundos.
	var intentos := 20 if OS.has_feature("web") else 1
	for i in intentos:
		if FileAccess.file_exists(RUTA_HOJA):
			_montar(RUTA_HOJA)
			return
		await get_tree().create_timer(0.25).timeout
	if ResourceLoader.exists(RUTA_HOJA_PRUEBA):
		print("Sin hoja del jugador; se usa la de prueba.")
		_montar(RUTA_HOJA_PRUEBA)
	else:
		push_warning("No llegó la hoja del personaje")

func _montar(ruta: String) -> void:
	_ruta_hoja_actual = ruta
	# Dos formas de cargar, y no son intercambiables: lo que viene de `user://`
	# es un archivo suelto y hay que leerlo como imagen; lo que está en `res://`
	# es un recurso ya importado y hay que pedirlo con `load`, o el export lo
	# deja fuera.
	var textura: Texture2D
	if ruta.begins_with("res://"):
		textura = load(ruta)
	else:
		var imagen := Image.new()
		if imagen.load(ruta) != OK:
			push_warning("La hoja no se pudo leer")
			return
		textura = ImageTexture.create_from_image(imagen)
	if textura == null:
		push_warning("La hoja no se pudo cargar: %s" % ruta)
		return
	var celda: Dictionary = _rig["celda"]
	var ancho_celda: int = celda["ancho"]

	# El rig trae UN JUEGO DE CAJAS POR VISTA: de espaldas los brazos caen en
	# otro sitio y de perfil la figura es mucho más estrecha. Usar las de frente
	# en todas dejaba manos sueltas flotando.
	var esqueleto: Dictionary = _rig["vistas"][vista]
	for nombre in _rig["orden"]:
		if not esqueleto.has(nombre):
			continue  # la variante de falda y la de pantalón no coexisten
		var def: Dictionary = esqueleto[nombre]
		if not def.has("caja"):
			continue  # el anclaje de la mano no es una pieza dibujada
		var caja: Dictionary = def["caja"]
		var pivote: Dictionary = def["pivote"]

		var trozo := AtlasTexture.new()
		trozo.atlas = textura
		trozo.region = Rect2(vista * ancho_celda + caja["x"], caja["y"], caja["w"], caja["h"])

		var sp := Sprite2D.new()
		sp.name = String(nombre)
		sp.texture = trozo
		sp.centered = false
		# La pieza se coloca de modo que su PIVOTE caiga en el punto del rig: así
		# `rotation` gira por donde tiene que girar (el hombro, la cadera…).
		sp.offset = Vector2(-(pivote["x"] - caja["x"]), -(pivote["y"] - caja["y"]))
		sp.position = Vector2(pivote["x"], pivote["y"])
		sp.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
		add_child(sp)
		_piezas[nombre] = sp

## Lo llama el controlador del jugador cuando empieza o deja de moverse.
func andar(activo: bool) -> void:
	_andando = activo
	if not activo:
		_reloj = 0.0
		_postura(0.0)

func _process(delta: float) -> void:
	if _piezas.is_empty():
		return
	if _andando:
		_reloj += delta * pasos_por_segundo * TAU
	_postura(_reloj)

## El ciclo de caminar: todo son rotaciones sobre los pivotes.
##
## Los ángulos son CORTOS a propósito. Rotar pixel art ensucia el borde, y
## midiendo se vio que hasta unos 12° aguanta; más allá empieza a verse el
## escalonado. Por eso el paso se apoya también en un pequeño rebote vertical,
## que no cuesta calidad ninguna.
func _postura(t: float) -> void:
	var s := sin(t)
	var rebote := absf(sin(t)) * -rebote_px

	_girar("piernaIzq", s * grados_piernas)
	_girar("piernaDer", -s * grados_piernas)
	# Con falda no hay dos piernas: el faldón se mece entero y los pies dan el
	# paso por debajo. La tela no dobla como una pierna, así que se mueve poco.
	_girar("faldon", s * grados_faldon)
	_girar("pieIzq", s * grados_piernas * 0.7)
	_girar("pieDer", -s * grados_piernas * 0.7)
	_girar("brazoCercano", -s * grados_brazos)
	_girar("brazoLejano", s * grados_brazos)
	_girar("torso", sin(t * 2.0) * 1.5)
	_girar("cabeza", -sin(t * 2.0) * 1.5)

	# El pie que va adelante se despega del suelo: es lo que de verdad hace que
	# se lea como un paso y no como un balanceo.
	_subir("pieIzq", maxf(0.0, s) * -levanta_pie_px)
	_subir("pieDer", maxf(0.0, -s) * -levanta_pie_px)

	for nombre in ["torso", "cabeza", "brazoCercano", "brazoLejano"]:
		if _piezas.has(nombre):
			var sp: Sprite2D = _piezas[nombre]
			var def: Dictionary = _rig["vistas"][vista][nombre]
			sp.position.y = float(def["pivote"]["y"]) + rebote

func _subir(nombre: String, px: float) -> void:
	if _piezas.has(nombre):
		var sp: Sprite2D = _piezas[nombre]
		sp.position.y = float(_rig["vistas"][vista][nombre]["pivote"]["y"]) + px

func _girar(nombre: String, grados: float) -> void:
	if _piezas.has(nombre):
		(_piezas[nombre] as Sprite2D).rotation_degrees = grados

## Cambia la vista al girar el personaje.
##
## Se vuelve a montar entero en vez de mover los recortes: cada vista tiene sus
## propias cajas Y sus propios pivotes, así que reaprovechar los sprites de la
## anterior dejaría los brazos girando por donde no es.
func mirar(nueva_vista: int) -> void:
	if nueva_vista == vista or _piezas.is_empty():
		return
	vista = nueva_vista
	for hijo in get_children():
		hijo.queue_free()
	_piezas.clear()
	_montar(_ruta_hoja_actual)
