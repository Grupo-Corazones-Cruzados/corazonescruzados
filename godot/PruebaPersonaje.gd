extends Node2D

## Banco de pruebas del personaje articulado.
##
## Sirve para juzgar la animación sin arrancar la web: abre esta escena y pulsa
## F6. El personaje camina solo y va rotando entre las cuatro vistas cada pocos
## segundos, que es justo lo que hay que mirar para saber si el rig aguanta.
##
## Teclas: ESPACIO parar/andar · ← → cambiar de vista a mano.

@onready var articulado := $Articulado
var _vista := 0
var _reloj := 0.0
var _auto := true

func _ready() -> void:
	# Se espera a que monte las piezas (la hoja tarda un instante).
	await get_tree().create_timer(0.6).timeout
	articulado.andar(true)

func _process(delta: float) -> void:
	if not _auto:
		return
	_reloj += delta
	if _reloj >= 3.0:
		_reloj = 0.0
		_vista = (_vista + 1) % 4
		articulado.mirar(_vista)
		$Etiqueta.text = _nombre_vista()

func _unhandled_input(evento: InputEvent) -> void:
	if evento is InputEventKey and evento.pressed and not evento.echo:
		match evento.keycode:
			KEY_SPACE:
				_auto = not _auto
				articulado.andar(_auto)
			KEY_RIGHT:
				_vista = (_vista + 1) % 4
				articulado.mirar(_vista)
				$Etiqueta.text = _nombre_vista()
			KEY_LEFT:
				_vista = (_vista + 3) % 4
				articulado.mirar(_vista)
				$Etiqueta.text = _nombre_vista()

func _nombre_vista() -> String:
	return ["Frente", "Espalda", "Izquierda", "Derecha"][_vista] + "   (espacio: parar · ←→: girar)"
