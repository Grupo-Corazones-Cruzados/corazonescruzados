extends Node2D

## Prueba de humo del export web de Godot dentro de GCC World.
##
## Comprueba lo que de verdad decide si Godot es viable aquí:
##
##  1. **Que arranca en un teléfono real.** Es el riesgo conocido: el motor pesa
##     ~6,6 MB comprimidos y hay un problema de memoria en iOS abierto. Si el
##     navegador recarga la página al abrirla, lo sabremos aquí y no después de
##     rehacer los NPCs, los diálogos y las cinemáticas.
##
##  2. **Que la sesión del usuario llega.** Al servirse desde el mismo dominio
##     que la app, `HTTPRequest` manda las peticiones con `same-origin` por
##     defecto, así que la cookie httpOnly de sesión debería viajar sola, sin
##     tener que pasar tokens a mano. Si esto funciona, la integración con el
##     dashboard (etapas, fichas) está resuelta.

@onready var titulo: Label = $UI/Titulo
@onready var estado: Label = $UI/Estado
@onready var http: HTTPRequest = $HTTPRequest

var _t0_ms: int = 0


func _ready() -> void:
	_t0_ms = Time.get_ticks_msec()
	titulo.text = "GCC World — prueba de motor"
	estado.text = "Motor arrancado.\nConsultando la sesión…"

	http.request_completed.connect(_on_respuesta)
	# Ruta relativa a propósito: obliga a que sea mismo origen, que es la
	# condición para que la cookie de sesión viaje.
	var err := http.request("/api/game/stages")
	if err != OK:
		estado.text = "No se pudo lanzar la petición (código %d)" % err


func _on_respuesta(
	_result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray
) -> void:
	var arranque_s := (Time.get_ticks_msec() - _t0_ms) / 1000.0
	var lineas: Array[String] = []
	lineas.append("Motor: Godot %s" % Engine.get_version_info().string)
	lineas.append("Arranque: %.2f s" % arranque_s)
	lineas.append("Respuesta del servidor: HTTP %d" % response_code)

	match response_code:
		200:
			var datos: Variant = JSON.parse_string(body.get_string_from_utf8())
			if typeof(datos) == TYPE_DICTIONARY and datos.has("stages"):
				lineas.append("")
				lineas.append("✔ LA SESIÓN LLEGA AL JUEGO")
				lineas.append("Etapas recibidas: %d" % (datos["stages"] as Array).size())
				var saldos: Variant = datos.get("balances", {})
				if typeof(saldos) == TYPE_DICTIONARY:
					lineas.append("Fichas: %s" % str(saldos.get("ficha", 0)))
			else:
				lineas.append("Respondió, pero sin el formato esperado.")
		401:
			# No es un fallo del motor: significa que no hay sesión iniciada en
			# el navegador. La prueba de red sí pasó.
			lineas.append("")
			lineas.append("✔ La red funciona (HTTP 401 = sin sesión iniciada)")
			lineas.append("Inicia sesión en la app y recarga para ver tus datos.")
		_:
			lineas.append("Respuesta inesperada.")

	estado.text = "\n".join(lineas)


func _process(_delta: float) -> void:
	# Movimiento mínimo: si esto se ve fluido en el teléfono, el motor va bien
	# ahí. Si se ve a tirones, es un aviso temprano.
	var t := Time.get_ticks_msec() / 1000.0
	$Testigo.position = Vector2(480.0 + cos(t) * 220.0, 400.0 + sin(t * 2.0) * 60.0)
	$Testigo.rotation = t
