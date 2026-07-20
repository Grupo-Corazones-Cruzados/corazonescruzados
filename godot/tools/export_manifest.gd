extends SceneTree

## Exporta el manifiesto de objetos colocados en los mundos.
##
##   godot --headless --path godot --script res://tools/export_manifest.gd
##
## **Por qué existe, que es lo importante:** las fichas se canjean por productos
## reales, así que el servidor NO puede fiarse de lo que diga el juego al
## recoger algo. Tiene que poder comprobar por su cuenta que ese objeto existe
## y dónde está.
##
## Mientras los mapas vivían en Postgres eso salía gratis. Al pasar la autoría a
## Godot, los mapas son parte del build y el servidor se queda ciego. Este
## manifiesto es el puente: se genera al exportar y se sincroniza a la base de
## datos, de modo que la validación sigue siendo del lado del servidor aunque el
## diseño se haga en el editor.
##
## Consecuencia práctica del flujo elegido: **hay que regenerarlo y sincronizarlo
## cada vez que se cambian los objetos de un mapa**, igual que hay que desplegar.

const DIR_MUNDOS := "res://mundos"
const SALIDA := "res://import/manifiesto.json"
## Un tile se dibuja a 64 px (32 nativos × 2).
const TILE_PX := 64.0


func _initialize() -> void:
	var dir := DirAccess.open(DIR_MUNDOS)
	if dir == null:
		# Aún no hay mundos construidos: manifiesto vacío en vez de fallar, para
		# que el comando de publicación no se rompa con el proyecto recién
		# reiniciado. El sync a Postgres no borrará nada (no hay escenas).
		_escribir({"tilePx": TILE_PX, "placements": []})
		print("✔ Sin mundos todavía; manifiesto vacío → %s" % SALIDA)
		quit(0)
		return

	var colocaciones: Array = []
	var escenas := 0

	for archivo in dir.get_files():
		if not archivo.ends_with(".tscn"):
			continue
		var slug := archivo.get_basename()
		var empaquetada: PackedScene = load("%s/%s" % [DIR_MUNDOS, archivo])
		if empaquetada == null:
			push_warning("No se pudo cargar %s" % archivo)
			continue

		var raiz: Node = empaquetada.instantiate()
		escenas += 1
		for obj in _buscar_objetos(raiz):
			colocaciones.append(obj.a_manifiesto(slug, TILE_PX))
		raiz.free()

	# Detectar identidades repetidas: dos objetos con la misma ruta harían que
	# recoger uno marcara el otro como recogido. Es un fallo silencioso y caro.
	var vistos := {}
	var duplicados: Array = []
	for c in colocaciones:
		var clave := "%s|%s" % [c["scene"], c["placementId"]]
		if vistos.has(clave):
			duplicados.append(clave)
		vistos[clave] = true

	if not duplicados.is_empty():
		push_error("Identidades repetidas: %s" % ", ".join(duplicados))
		quit(1)
		return

	_escribir({"tilePx": TILE_PX, "placements": colocaciones})
	print("✔ %d objeto(s) en %d escena(s) → %s" % [colocaciones.size(), escenas, SALIDA])
	quit(0)


## Escribe el manifiesto a disco. La carpeta puede no existir tras un reinicio.
func _escribir(datos: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(SALIDA.get_base_dir()))
	var f := FileAccess.open(SALIDA, FileAccess.WRITE)
	if f == null:
		push_error("No se pudo escribir %s" % SALIDA)
		quit(1)
		return
	f.store_string(JSON.stringify(datos, "  "))
	f.close()


## Recorre el árbol entero: los objetos pueden estar anidados en contenedores.
func _buscar_objetos(nodo: Node) -> Array:
	var salida: Array = []
	if nodo is Objeto:
		salida.append(nodo)
	for hijo in nodo.get_children():
		salida.append_array(_buscar_objetos(hijo))
	return salida
