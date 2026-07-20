@tool
class_name Objeto
extends Node2D

## Objeto recogible que se coloca en el editor de Godot.
##
## Se arrastra al mapa, se elige `item_id` en el inspector y ya está. Con `@tool`
## el sprite se ve dentro del editor, así se coloca mirando el mapa y no a ciegas.
##
## **Su identidad para el servidor es la RUTA DEL NODO en la escena.** No hay
## que inventar identificadores a mano: mover el objeto no cambia su identidad,
## pero renombrarlo sí. Eso importa porque el servidor lleva la cuenta de qué
## objetos ha recogido cada jugador: si se renombra un objeto ya recogido,
## reaparecerá una vez para todo el mundo.

const DIR_OBJETOS := "res://assets/objetos"

## Identificador del catálogo (`sword`, `apple`, `barrel`…). Ver
## `godot/assets/objetos/objetos.json` para la lista completa.
@export var item_id: String = "coin":
	set(valor):
		item_id = valor
		_refrescar()

## Cuántas unidades entrega al recogerlo.
@export var cantidad: int = 1

## Si está marcado, flota suavemente para que se note que es recogible.
@export var flotar: bool = true

var _sprite: Sprite2D
var _t := 0.0
var _y_base := 0.0


func _ready() -> void:
	_y_base = position.y
	_crear_sprite()
	_refrescar()
	if Engine.is_editor_hint():
		return
	# Fuera del editor, el `_process` solo sirve para el flotado.
	set_process(flotar)


func _crear_sprite() -> void:
	if _sprite != null:
		return
	_sprite = Sprite2D.new()
	# Pixel art: sin esto Godot lo interpola al escalar.
	_sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	add_child(_sprite)


func _refrescar() -> void:
	if _sprite == null:
		return
	var ruta := "%s/%s.png" % [DIR_OBJETOS, item_id]
	if ResourceLoader.exists(ruta):
		_sprite.texture = load(ruta)
	else:
		# Un id mal escrito deja el objeto sin textura. Se avisa en vez de
		# dejarlo invisible: un objeto invisible con el que se puede
		# interactuar es de los fallos más difíciles de encontrar.
		_sprite.texture = null
		if not Engine.is_editor_hint():
			push_warning("Objeto '%s': no existe la imagen %s" % [name, ruta])


func _process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	_t += delta
	position.y = _y_base + sin(_t * 2.0) * 4.0


## Identidad estable de esta colocación, tal como la conoce el servidor.
## Es la ruta dentro de la escena, sin la raíz.
func id_colocacion() -> String:
	var raiz := owner if owner != null else get_parent()
	return str(raiz.get_path_to(self)) if raiz != null else name


## Datos que van al manifiesto que valida el servidor.
func a_manifiesto(escena: String, tile_px: float) -> Dictionary:
	return {
		"scene": escena,
		"placementId": id_colocacion(),
		"itemId": item_id,
		"cantidad": cantidad,
		# En tiles, no en píxeles: así el manifiesto no depende de la escala de
		# dibujo y sigue valiendo si algún día cambia.
		#
		# `floor`, no `round`: un objeto se coloca en el CENTRO de su casilla, y
		# redondear 31,5 daría 32 — el objeto quedaría registrado en la casilla
		# de al lado. Con floor cae siempre en la que se ve.
		"x": int(floor(global_position.x / tile_px)),
		"y": int(floor(global_position.y / tile_px)),
	}
