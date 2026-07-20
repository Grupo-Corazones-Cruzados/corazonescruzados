extends SceneTree

## Crea un segundo mundo y una puerta condicionada, para poder probar el paso
## entre mapas y el bloqueo por etapa.
##
##   godot --headless --path godot --script res://tools/sembrar_transicion.gd
##
## Es andamiaje de pruebas, no contenido definitivo: el mundo que crea es un
## rectángulo de piedra. Sirve para comprobar que la mecánica funciona antes de
## que haya contenido de verdad.
##
## La puerta exige la etapa `primer-ticket`, así que se cierra hasta que el
## jugador cierre un ticket real en el dashboard. Esa es la mecánica que define
## el proyecto: se avanza por lo que pasa fuera del juego.

const MUNDO_ORIGEN := "res://mundos/main.tscn"
const MUNDO_DESTINO := "res://mundos/refugio.tscn"
const TILE := 32
const TILE_PX := 64.0

## Un trozo de suelo de interior del tileset de terreno.
const SUELO := Vector2i(6, 13)


func _initialize() -> void:
	_crear_refugio()
	_colocar_puerta()
	quit(0)


## Mundo de destino: una sala pequeña con suelo y borde.
func _crear_refugio() -> void:
	if ResourceLoader.exists(MUNDO_DESTINO):
		print("El refugio ya existe; no se toca.")
		return

	var origen: PackedScene = load(MUNDO_ORIGEN)
	if origen == null:
		push_error("No se pudo cargar el mundo de origen")
		return
	var muestra: Node = origen.instantiate()

	# Se reutiliza el TileSet del mundo existente: crear otro obligaría a
	# duplicar las texturas en el paquete.
	var tile_set: TileSet = null
	for hijo in muestra.get_children():
		if hijo is TileMapLayer:
			tile_set = (hijo as TileMapLayer).tile_set
			break
	if tile_set == null:
		push_error("El mundo de origen no tiene TileSet")
		muestra.free()
		return

	var raiz := Node2D.new()
	raiz.name = "Mapa"

	var capa := TileMapLayer.new()
	capa.name = "Suelo"
	capa.tile_set = tile_set
	capa.scale = Vector2(2, 2)

	# La fuente 0 es la hoja de terreno; el tile ya está creado en el atlas
	# porque el mundo original lo usa.
	for x in range(0, 14):
		for y in range(0, 10):
			capa.set_cell(Vector2i(x, y), 0, SUELO, 0)

	raiz.add_child(capa)
	capa.owner = raiz

	var spawn := Marker2D.new()
	spawn.name = "Spawn"
	spawn.position = Vector2(2.5 * TILE_PX, 5.5 * TILE_PX)
	raiz.add_child(spawn)
	spawn.owner = raiz

	# Puerta de vuelta, siempre abierta: entrar sin poder salir es una trampa.
	var vuelta := Transicion.new()
	vuelta.name = "Salida"
	vuelta.destino = "main"
	vuelta.casilla_destino = Vector2i(29, 33)
	vuelta.position = Vector2(0.5 * TILE_PX, 5.5 * TILE_PX)
	raiz.add_child(vuelta)
	vuelta.owner = raiz

	var escena := PackedScene.new()
	if escena.pack(raiz) == OK:
		ResourceSaver.save(escena, MUNDO_DESTINO)
		print("✔ Refugio creado → %s" % MUNDO_DESTINO)
	raiz.free()
	muestra.free()


## Puerta en el mundo principal, cerrada tras la etapa `primer-ticket`.
func _colocar_puerta() -> void:
	var empaquetada: PackedScene = load(MUNDO_ORIGEN)
	if empaquetada == null:
		return
	var raiz: Node = empaquetada.instantiate()

	if raiz.get_node_or_null("Puerta") != null:
		print("La puerta ya existe; no se toca.")
		raiz.free()
		return

	var puerta := Transicion.new()
	puerta.name = "Puerta"
	puerta.destino = "refugio"
	puerta.etapa_requerida = "primer-ticket"
	puerta.tamano = Vector2i(1, 1)
	# Justo al norte del punto de aparición, para encontrarla enseguida.
	puerta.position = Vector2(29.5 * TILE_PX, 32.5 * TILE_PX)
	raiz.add_child(puerta)
	puerta.owner = raiz

	var escena := PackedScene.new()
	if escena.pack(raiz) == OK:
		ResourceSaver.save(escena, MUNDO_ORIGEN)
		print("✔ Puerta colocada en 29,32 (exige etapa 'primer-ticket')")
	raiz.free()
