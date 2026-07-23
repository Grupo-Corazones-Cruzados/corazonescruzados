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

## Cuando es false, Violeta no responde a teclado ni táctil (se queda quieta).
## La intro lo pone en false mientras la cámara baja del cielo, y lo devuelve a
## true al aterrizar. En el juego normal siempre está en true.
var control_habilitado: bool = true

## Última dirección hacia la que caminó, para elegir la pose de parado correcta.
var _mirando: String = "abajo"


func _physics_process(_delta: float) -> void:
	# Si el control está bloqueado (p. ej. durante la intro), se queda quieta.
	if not control_habilitado:
		velocity = Vector2.ZERO
		_animar(Vector2.ZERO)
		return
	var dir := _direccion()
	velocity = dir * velocidad
	move_and_slide()
	_animar(dir)


## Dirección de movimiento (largo máximo 1). Lee las acciones ui_left/right/up/down,
## que alimentan tanto el TECLADO como el JOYSTICK táctil en pantalla
## (ver ControlesTactiles.gd), así que aquí no hay que distinguir el dispositivo.
func _direccion() -> Vector2:
	return Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down").limit_length(1.0)


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
