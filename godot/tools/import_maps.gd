extends SceneTree

## Convierte los mapas exportados de Postgres en escenas de Godot de verdad.
##
## Se ejecuta así, desde la raíz del repositorio:
##   godot --headless --path godot --script res://tools/import_maps.gd
##
## Por qué existe: al pasar la autoría a Godot, los mundos dejan de vivir en la
## base de datos. Pero ya hay un mapa pintado a mano, y perderlo sería tirar
## trabajo. Este puente es de UNA sola pasada; a partir de aquí los mapas se
## editan en Godot y este script deja de usarse.
##
## Detalle que importa: **es Godot quien escribe el formato del tilemap**. Los
## datos de celdas se guardan en un binario propio que cambia entre versiones;
## generarlo a mano desde fuera provoca pérdidas silenciosas de tiles. Por eso
## la conversión se hace aquí dentro y no en el script de Node.

const TILE := 32
const MAPS_DIR := "res://import/maps"
const TILES_DIR := "res://assets/tiles"
const OUT_DIR := "res://mundos"

## Fuente reservada para los tiles de color sólido, que no salen de una hoja.
const COLOR_SOURCE_ID := 1000


func _initialize() -> void:
	var hojas: Dictionary = _leer_json(TILES_DIR + "/sheets.json")
	if hojas.is_empty():
		push_error("No hay sheets.json. Ejecuta antes: node scripts/prepare-godot-assets.mjs")
		quit(1)
		return

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))

	var dir := DirAccess.open(MAPS_DIR)
	if dir == null:
		push_error("No hay mapas en %s. Ejecuta: node scripts/export-maps-to-godot.mjs" % MAPS_DIR)
		quit(1)
		return

	var convertidos := 0
	for archivo in dir.get_files():
		if not archivo.ends_with(".json"):
			continue
		var mapa: Dictionary = _leer_json(MAPS_DIR + "/" + archivo)
		if mapa.is_empty():
			continue
		if _convertir(mapa, hojas):
			convertidos += 1

	print("\n%d mapa(s) convertidos → %s" % [convertidos, OUT_DIR])
	quit(0)


func _leer_json(ruta: String) -> Dictionary:
	if not FileAccess.file_exists(ruta):
		return {}
	var texto := FileAccess.get_file_as_string(ruta)
	var datos: Variant = JSON.parse_string(texto)
	return datos if typeof(datos) == TYPE_DICTIONARY else {}


func _convertir(mapa: Dictionary, hojas: Dictionary) -> bool:
	var nombre: String = mapa.get("name", "sin_nombre")

	# --- TileSet: una fuente por hoja usada, más la de colores ---------------
	var tile_set := TileSet.new()
	tile_set.tile_size = Vector2i(TILE, TILE)
	# Capa de física para que los tiles marcados como sólidos choquen de verdad.
	tile_set.add_physics_layer()

	var fuente_por_hoja: Dictionary = {}  # índice de hoja -> id de fuente
	for h in hojas.get("sheets", []):
		var idx: int = int(h["index"])
		var tex: Texture2D = load(TILES_DIR + "/" + str(h["file"]))
		if tex == null:
			push_warning("No se pudo cargar la textura de la hoja %d" % idx)
			continue
		var fuente := TileSetAtlasSource.new()
		fuente.texture = tex
		fuente.texture_region_size = Vector2i(TILE, TILE)
		var id_fuente: int = tile_set.add_source(fuente, idx)
		fuente_por_hoja[idx] = id_fuente

	var colores: Array = hojas.get("colors", [])
	var fuente_colores: TileSetAtlasSource = null
	if colores.size() > 0:
		var tex_col: Texture2D = load(TILES_DIR + "/" + str(hojas.get("colorsFile", "colors.png")))
		if tex_col != null:
			fuente_colores = TileSetAtlasSource.new()
			fuente_colores.texture = tex_col
			fuente_colores.texture_region_size = Vector2i(TILE, TILE)
			tile_set.add_source(fuente_colores, COLOR_SOURCE_ID)

	# --- Raíz de la escena ---------------------------------------------------
	var raiz := Node2D.new()
	raiz.name = "Mapa"

	var creados: Dictionary = {}  # "fuente:sx:sy" -> true, para no recrear
	var con_colision: Dictionary = {}  # "fuente:sx:sy" -> id de alternativa
	var total_celdas := 0

	var capas: Array = mapa.get("layers", [])
	for i in capas.size():
		var capa: Dictionary = capas[i]
		var nodo := TileMapLayer.new()
		nodo.name = _nombre_valido(capa.get("name", "Capa %d" % (i + 1)))
		nodo.tile_set = tile_set
		nodo.enabled = bool(capa.get("visible", true))
		# Escala x2, como el juego anterior: tile de 32 px se ve a 64.
		nodo.scale = Vector2(2, 2)

		for t in capa.get("tiles", []):
			var celda := Vector2i(int(t["x"]), int(t["y"]))
			var solido: bool = int(t.get("c", 0)) == 1

			var id_fuente: int
			var atlas: Vector2i

			if t.has("color") and str(t["color"]) != "":
				if fuente_colores == null:
					continue
				var ci: int = colores.find(str(t["color"]))
				if ci < 0:
					continue
				id_fuente = COLOR_SOURCE_ID
				atlas = Vector2i(ci, 0)
			else:
				var hoja: int = int(t["s"])
				if not fuente_por_hoja.has(hoja):
					continue  # hoja desconocida en datos viejos: se ignora
				id_fuente = fuente_por_hoja[hoja]
				atlas = Vector2i(int(t["sx"]), int(t["sy"]))

			var fuente: TileSetAtlasSource = tile_set.get_source(id_fuente)
			var clave := "%d:%d:%d" % [id_fuente, atlas.x, atlas.y]

			# Godot exige crear explícitamente cada tile del atlas antes de usarlo.
			if not creados.has(clave):
				if fuente.has_tile(atlas):
					pass
				else:
					fuente.create_tile(atlas)
				creados[clave] = true

			var alternativa := 0
			if solido:
				# La colisión en el formato viejo es POR TILE COLOCADO, pero en
				# Godot vive en la definición del atlas. El mismo dibujo puede
				# ser sólido en un sitio y no en otro, así que la variante
				# sólida se crea como "tile alternativo".
				if con_colision.has(clave):
					alternativa = con_colision[clave]
				else:
					alternativa = fuente.create_alternative_tile(atlas)
					var datos := fuente.get_tile_data(atlas, alternativa)
					datos.add_collision_polygon(0)
					var mitad := TILE / 2.0
					datos.set_collision_polygon_points(
						0,
						0,
						PackedVector2Array(
							[
								Vector2(-mitad, -mitad),
								Vector2(mitad, -mitad),
								Vector2(mitad, mitad),
								Vector2(-mitad, mitad),
							]
						)
					)
					con_colision[clave] = alternativa

			nodo.set_cell(celda, id_fuente, atlas, alternativa)
			total_celdas += 1

		raiz.add_child(nodo)
		nodo.owner = raiz

	# --- Punto de aparición --------------------------------------------------
	var spawn: Dictionary = mapa.get("spawn", {})
	var marca := Marker2D.new()
	marca.name = "Spawn"
	marca.position = Vector2(
		(float(spawn.get("x", 2)) + 0.5) * TILE * 2.0, (float(spawn.get("y", 2)) + 0.5) * TILE * 2.0
	)
	raiz.add_child(marca)
	marca.owner = raiz

	# --- NPCs: se dejan como marcadores con sus datos ------------------------
	# No se generan personajes aquí: su aspecto son 12 capas LPC que hay que
	# rehacer en Godot. Lo que sí se conserva es DÓNDE estaban y QUÉ decían,
	# que es la parte que costó escribir.
	var npcs: Array = mapa.get("npcs", [])
	if npcs.size() > 0:
		var cont := Node2D.new()
		cont.name = "NPCs"
		raiz.add_child(cont)
		cont.owner = raiz
		for n in npcs:
			var m := Marker2D.new()
			m.name = _nombre_valido(str(n.get("name", "NPC")))
			m.position = Vector2(
				(float(n.get("x", 0)) + 0.5) * TILE * 2.0, (float(n.get("y", 0)) + 0.5) * TILE * 2.0
			)
			m.set_meta("dialogo", n.get("dialogue", []))
			m.set_meta("mirando", n.get("facing", "s"))
			# Capas ya resueltas al exportar. Evita que el motor tenga que
			# conocer las tablas de estilos o pedirlas por red NPC a NPC.
			m.set_meta("capas", n.get("layers", []))
			m.set_meta("complexion", (n.get("config", {}) as Dictionary).get("bodyType", "medio"))
			m.set_meta("escala", n.get("scale", 1))
			m.set_meta("animacion", n.get("animation", "idle"))
			cont.add_child(m)
			m.owner = raiz

	# --- Guardar -------------------------------------------------------------
	var escena := PackedScene.new()
	var err := escena.pack(raiz)
	if err != OK:
		push_error("No se pudo empaquetar %s (error %d)" % [nombre, err])
		return false

	var destino := "%s/%s.tscn" % [OUT_DIR, nombre]
	err = ResourceSaver.save(escena, destino)

	# Liberar el árbol: sin esto el script deja fugas al salir. No afecta al
	# resultado, pero llena la salida de errores que ocultan los de verdad.
	raiz.free()

	if err != OK:
		push_error("No se pudo guardar %s (error %d)" % [destino, err])
		return false

	print(
		(
			"✔ %-16s %d celdas, %d capa(s), %d NPC(s) → %s"
			% [nombre, total_celdas, capas.size(), npcs.size(), destino]
		)
	)
	return true


## Los nombres de nodo no admiten ciertos caracteres; Godot los sustituiría en
## silencio y el nombre dejaría de coincidir con el del editor anterior.
func _nombre_valido(bruto: String) -> String:
	var limpio := bruto.strip_edges()
	for c in [".", ":", "@", "/", "\\", "%", "\""]:
		limpio = limpio.replace(c, "_")
	return limpio if limpio != "" else "Nodo"
