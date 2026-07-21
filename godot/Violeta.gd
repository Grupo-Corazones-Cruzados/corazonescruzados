extends CharacterBody2D

## Movimiento de Violeta en 4 direcciones, con teclado y táctil.
##
## Cómo debe estar armada la escena (este script va en el CharacterBody2D):
##   Violeta            (CharacterBody2D)  ← aquí se pega este script
##     ├─ AnimatedSprite2D                 ← con las animaciones de caminar y de parado
##     └─ CollisionShape2D                 ← una forma en los pies (para chocar)
##
## Los nombres de las animaciones se ajustan desde el INSPECTOR (no hace falta
## tocar el código): al seleccionar el nodo verás las casillas y escribes ahí el
## nombre que le pusiste a cada una en el AnimatedSprite2D.

## Velocidad de caminado, en píxeles por segundo.
@export var velocidad: float = 160.0

@export_group("Caminar")
## Caminando hacia la cámara (de frente).
@export var anim_abajo: String = "caminar_abajo"
## Caminando de espaldas.
@export var anim_arriba: String = "caminar_arriba"
## Caminando hacia la derecha.
@export var anim_derecha: String = "caminar_derecha"
## Caminando hacia la izquierda.
@export var anim_izquierda: String = "caminar_izquierda"

@export_group("Parado (idle)")
## Poses de parado por dirección. Pueden ser de 1 solo fotograma. Si dejas
## alguna vacía o con un nombre que no existe, al pararse mirando ahí el
## personaje simplemente se congela en su fotograma actual (sin error).
@export var idle_abajo: String = "idle_abajo"
@export var idle_arriba: String = "idle_arriba"
@export var idle_derecha: String = "idle_derecha"
@export var idle_izquierda: String = "idle_izquierda"

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

## Última dirección hacia la que caminó, para elegir la pose de parado correcta.
var _mirando: String = "abajo"

# --- Táctil: joystick relativo (tocas en cualquier parte y arrastras el dedo
#     para dar la dirección; ese primer toque es el centro). ---
const RADIO_TOUCH := 60.0
var _touch_id: int = -1
var _touch_origen: Vector2 = Vector2.ZERO
var _touch_vector: Vector2 = Vector2.ZERO


func _physics_process(_delta: float) -> void:
	var dir := _direccion()
	velocity = dir * velocidad
	move_and_slide()
	_animar(dir)


## Junta teclado y táctil en un solo vector de dirección (largo máximo 1).
func _direccion() -> Vector2:
	var d := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	if d == Vector2.ZERO and _touch_id != -1:
		d = _touch_vector
	return d.limit_length(1.0)


## Anima según el estado: caminando (usa la dirección actual) o parado (usa la
## pose de parado de la última dirección hacia la que iba).
func _animar(dir: Vector2) -> void:
	if dir == Vector2.ZERO:
		_reproducir_idle()
		return
	# Caminando: actualizar hacia dónde mira (eje dominante, solo 4 vistas).
	if absf(dir.x) > absf(dir.y):
		_mirando = "derecha" if dir.x > 0.0 else "izquierda"
	else:
		_mirando = "abajo" if dir.y > 0.0 else "arriba"
	_reproducir(_anim_caminar())


## Muestra la pose de parado de la dirección actual. Si esa animación de idle no
## existe todavía, congela el fotograma actual (comportamiento seguro).
func _reproducir_idle() -> void:
	var nombre := _anim_idle()
	if sprite.sprite_frames != null and sprite.sprite_frames.has_animation(nombre):
		_reproducir(nombre)
	else:
		sprite.pause()


func _anim_caminar() -> String:
	match _mirando:
		"arriba": return anim_arriba
		"derecha": return anim_derecha
		"izquierda": return anim_izquierda
		_: return anim_abajo


func _anim_idle() -> String:
	match _mirando:
		"arriba": return idle_arriba
		"derecha": return idle_derecha
		"izquierda": return idle_izquierda
		_: return idle_abajo


## Reproduce una animación solo si cambió o estaba pausada, para no reiniciar el
## ciclo en cada fotograma.
func _reproducir(nombre: String) -> void:
	if sprite.animation != nombre or not sprite.is_playing():
		sprite.play(nombre)


func _unhandled_input(evento: InputEvent) -> void:
	if evento is InputEventScreenTouch:
		var t := evento as InputEventScreenTouch
		if t.pressed and _touch_id == -1:
			_touch_id = t.index
			_touch_origen = t.position
			_touch_vector = Vector2.ZERO
		elif not t.pressed and t.index == _touch_id:
			_touch_id = -1
			_touch_vector = Vector2.ZERO
	elif evento is InputEventScreenDrag:
		var d := evento as InputEventScreenDrag
		if d.index == _touch_id:
			_touch_vector = (d.position - _touch_origen).limit_length(RADIO_TOUCH) / RADIO_TOUCH
