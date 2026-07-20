extends SceneTree

## Coloca unos objetos de ejemplo en el mundo, para tener algo con lo que probar.
##
##   godot --headless --path godot --script res://tools/sembrar_objetos.gd
##
## Es una herramienta de arranque, no parte del juego: a partir de aquí los
## objetos se colocan arrastrándolos en el editor de Godot. Se puede ejecutar
## varias veces sin duplicar nada — si el contenedor ya existe, no hace nada.

const MUNDO := "res://mundos/main.tscn"

## Cerca del punto de aparición (tile 29,36) para que se encuentren enseguida.
const SIEMBRA := [
	{"id": "coin", "nombre": "Moneda1", "tile": Vector2i(31, 36)},
	{"id": "apple", "nombre": "Manzana1", "tile": Vector2i(27, 36)},
	{"id": "sword", "nombre": "Espada1", "tile": Vector2i(29, 34)},
]

const TILE_PX := 64.0


func _initialize() -> void:
	var empaquetada: PackedScene = load(MUNDO)
	if empaquetada == null:
		push_error("No se pudo cargar %s" % MUNDO)
		quit(1)
		return

	var raiz: Node = empaquetada.instantiate()

	if raiz.get_node_or_null("Objetos") != null:
		print("Ya hay objetos colocados; no se toca nada.")
		raiz.free()
		quit(0)
		return

	var cont := Node2D.new()
	cont.name = "Objetos"
	raiz.add_child(cont)
	cont.owner = raiz

	for s in SIEMBRA:
		var o := Objeto.new()
		o.name = str(s["nombre"])
		o.item_id = str(s["id"])
		var t: Vector2i = s["tile"]
		o.position = Vector2((t.x + 0.5) * TILE_PX, (t.y + 0.5) * TILE_PX)
		cont.add_child(o)
		# `owner` es lo que decide qué nodos se guardan en la escena. Sin esto,
		# los objetos existirían en memoria pero no en el archivo.
		o.owner = raiz
		print("  + %s (%s) en %d,%d" % [o.name, o.item_id, t.x, t.y])

	var escena := PackedScene.new()
	if escena.pack(raiz) != OK:
		push_error("No se pudo empaquetar")
		raiz.free()
		quit(1)
		return

	var err := ResourceSaver.save(escena, MUNDO)
	raiz.free()
	if err != OK:
		push_error("No se pudo guardar (%d)" % err)
		quit(1)
		return

	print("✔ %d objetos sembrados en %s" % [SIEMBRA.size(), MUNDO])
	quit(0)
