extends AnimatedSprite2D

## Viste al jugador con el personaje que creó en la web.
##
## Va en el AnimatedSprite2D del jugador. Al arrancar busca la hoja de sprites
## que la app deja preparada y, si la encuentra, sustituye las animaciones por
## las del personaje del usuario. Si no la encuentra, no pasa nada: se queda con
## las del editor, así el juego siempre arranca.
##
## POR QUÉ LA HOJA LLEGA POR ARCHIVO Y NO POR HTTP
## El endpoint que la genera (`/api/character/hoja`) exige sesión iniciada, y la
## sesión vive en una cookie del navegador. Las peticiones que hace Godot desde
## el export web NO arrastran esa cookie, así que pedirla desde aquí daría 401.
## Por eso la descarga la hace la app —que sí tiene la sesión— y nos la deja en
## `user://personaje.png` (ver `components/game/GodotGame.tsx`).
##
## CÓMO ESTÁ CORTADA LA HOJA
## 384×128 px = cuatro celdas de 96×128, en este orden:
##   0 frente · 1 espalda · 2 perfil izquierdo · 3 perfil derecho
## De momento cada vista es UNA pose (el personaje aún no tiene fotogramas de
## caminar), así que se generan animaciones de un solo fotograma. Cuando la hoja
## traiga más columnas por vista, solo hay que cambiar FOTOGRAMAS_POR_VISTA.

const RUTA_HOJA := "user://personaje.png"
const ANCHO_CELDA := 96
const ALTO_CELDA := 128
const FOTOGRAMAS_POR_VISTA := 1
## Nombre de la animación por vista, en el orden en que están en la hoja.
const VISTAS := ["idle_abajo", "idle_arriba", "idle_izquierda", "idle_derecha"]

## Cuántas veces se reintenta antes de rendirse. La app copia la hoja justo
## después de arrancar el motor, así que puede no estar lista en el primer
## fotograma; se espera un poco en vez de dar el personaje por perdido.
@export var intentos: int = 20
@export var espera_entre_intentos: float = 0.25

func _ready() -> void:
	_buscar_hoja()

func _buscar_hoja() -> void:
	for i in intentos:
		if FileAccess.file_exists(RUTA_HOJA):
			if _vestir(RUTA_HOJA):
				return
		await get_tree().create_timer(espera_entre_intentos).timeout
	push_warning("No llegó la hoja del personaje; se usan las animaciones del editor.")

## Corta la hoja y arma las animaciones. Devuelve false si la imagen no sirve.
func _vestir(ruta: String) -> bool:
	var imagen := Image.new()
	if imagen.load(ruta) != OK:
		push_warning("La hoja del personaje no se pudo leer: %s" % ruta)
		return false

	var esperado := ANCHO_CELDA * VISTAS.size() * FOTOGRAMAS_POR_VISTA
	if imagen.get_width() != esperado or imagen.get_height() != ALTO_CELDA:
		push_warning("La hoja mide %dx%d y se esperaba %dx%d" % [
			imagen.get_width(), imagen.get_height(), esperado, ALTO_CELDA])
		return false

	var textura := ImageTexture.create_from_image(imagen)
	var marcos := SpriteFrames.new()
	# SpriteFrames trae siempre una animación "default"; sobra.
	marcos.remove_animation("default")

	for vista in VISTAS.size():
		var nombre: String = VISTAS[vista]
		marcos.add_animation(nombre)
		marcos.set_animation_loop(nombre, true)
		marcos.set_animation_speed(nombre, 6.0)
		for f in FOTOGRAMAS_POR_VISTA:
			var trozo := AtlasTexture.new()
			trozo.atlas = textura
			trozo.region = Rect2(
				(vista * FOTOGRAMAS_POR_VISTA + f) * ANCHO_CELDA, 0,
				ANCHO_CELDA, ALTO_CELDA)
			marcos.add_frame(nombre, trozo)

	sprite_frames = marcos
	play(VISTAS[0])
	# El pixel art no se interpola: sin esto la figura sale borrosa al escalar.
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	return true
