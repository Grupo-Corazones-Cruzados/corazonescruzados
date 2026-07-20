@tool
class_name Transicion
extends Area2D

## Paso de un mundo a otro, opcionalmente condicionado a una etapa.
##
## Aquí es donde vive la idea más característica del proyecto: **hay pasos que
## solo se abren según resultados REALES registrados en la app**. Se marca
## `etapa_requerida` con el identificador de una etapa (`primer-ticket`, por
## ejemplo) y el paso queda cerrado hasta que el servidor confirme que ese
## jugador la tiene abierta.
##
## Quién decide es SIEMPRE el servidor: el juego pregunta qué etapas tiene
## abiertas y obedece. Nunca al revés. Si alguien manipula el cliente para
## cruzar igualmente, al otro lado no hay recompensa que acuñar — las fichas se
## crean en el servidor, no aquí.
##
## Con `@tool` el área se ve en el editor al colocarla.

## Escena de destino (`pueblo`, `cueva`…). Debe existir en `res://mundos/`.
@export var destino: String = ""

## Casilla en la que aparece el jugador al llegar. Si es (-1,-1) usa el Spawn
## del mapa de destino.
@export var casilla_destino: Vector2i = Vector2i(-1, -1)

## Identificador de la etapa necesaria. Vacío = paso siempre abierto.
@export var etapa_requerida: String = ""

## Mensaje al intentar cruzar sin tener la etapa. Si se deja vacío se usa lo que
## el servidor diga que falta, que suele estar mejor redactado que un texto fijo.
@export var mensaje_bloqueado: String = ""

## Tamaño del área, en casillas.
@export var tamano: Vector2i = Vector2i(1, 1):
	set(valor):
		tamano = valor
		_refrescar()

const TILE_PX := 64.0

signal cruzada(transicion: Transicion)
signal bloqueada(transicion: Transicion, motivo: String)

var _forma: CollisionShape2D
var _pintura: ColorRect


func _ready() -> void:
	_crear_forma()
	_refrescar()
	if Engine.is_editor_hint():
		return
	# Solo el jugador dispara la transición; los NPCs la ignoran.
	body_entered.connect(_on_entra)


func _crear_forma() -> void:
	if _forma != null:
		return
	_forma = CollisionShape2D.new()
	_forma.shape = RectangleShape2D.new()
	add_child(_forma)

	# Rectángulo de ayuda visible SOLO en el editor: colocar un área invisible
	# es adivinar dónde está.
	_pintura = ColorRect.new()
	_pintura.color = Color(0.47, 0.35, 0.85, 0.35)
	_pintura.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_pintura)


func _refrescar() -> void:
	if _forma == null:
		return
	var ancho := maxf(1.0, float(tamano.x)) * TILE_PX
	var alto := maxf(1.0, float(tamano.y)) * TILE_PX
	(_forma.shape as RectangleShape2D).size = Vector2(ancho, alto)
	if _pintura != null:
		_pintura.size = Vector2(ancho, alto)
		_pintura.position = Vector2(-ancho / 2.0, -alto / 2.0)
		_pintura.visible = Engine.is_editor_hint()


## Grupo al que pertenece el jugador. Se usa un grupo y no el nombre del nodo
## porque Godot autogenera nombres para los nodos creados por código, así que
## buscar por nombre falla en silencio.
const GRUPO_JUGADOR := "jugador"


func _on_entra(cuerpo: Node2D) -> void:
	# Solo cruza el jugador; los NPCs que pasen por encima se ignoran.
	if not cuerpo.is_in_group(GRUPO_JUGADOR):
		return
	emit_signal("cruzada", self)


## ¿Está abierto este paso para las etapas que el jugador tiene?
func abierta(etapas_abiertas: Dictionary) -> bool:
	if etapa_requerida.is_empty():
		return true
	return etapas_abiertas.has(etapa_requerida)


## Texto a mostrar cuando el paso está cerrado.
func motivo(etapas_pendientes: Dictionary) -> String:
	if not mensaje_bloqueado.is_empty():
		return mensaje_bloqueado
	# El servidor sabe qué falta exactamente ("Cierra 1 ticket más"), y eso es
	# más útil que un "no puedes pasar".
	var pendiente: Variant = etapas_pendientes.get(etapa_requerida, "")
	if typeof(pendiente) == TYPE_STRING and not (pendiente as String).is_empty():
		return pendiente as String
	return "Aún no puedes pasar por aquí."
