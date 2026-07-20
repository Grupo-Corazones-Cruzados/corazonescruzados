class_name Personaje
extends CharacterBody2D

## Personaje LPC compuesto en tiempo de ejecución.
##
## Las ~11 capas (cuerpo, pantalón, zapatos, ropa, cabeza, ojos, cejas, barba,
## pelo, mochila, gafas) se descargan y se apilan en UNA sola imagen, y de ahí
## salen los fotogramas. Dos motivos para hacerlo así y no empaquetarlo:
##
##  1. **Tamaño.** El set LPC completo son 19 MB. Meterlo en el juego lo haría
##     inviable en móvil, que es requisito. Descargando solo lo que este jugador
##     usa son ~1 MB.
##  2. **Una sola fuente de verdad.** Qué capas tocan lo decide el servidor
##     (`/api/character/layers`), que ya conoce las tablas de estilos. Si se
##     duplicaran aquí, al añadir un peinado habría que tocarlo en dos sitios.

const FRAME := 64
## La hoja universal LPC mide 832 px = 13 columnas de 64.
const COLS := 13
## Escala de dibujo heredada del juego anterior.
const ESCALA := 3.0

## Filas por animación y dirección, y su ritmo. Copiado del catálogo LPC.
## `hurt` es especial: solo existe mirando al sur.
const ANIMS := {
	"idle": {"rows": {"n": 8, "w": 9, "s": 10, "e": 11}, "frames": 1, "fps": 1},
	"walk": {"rows": {"n": 8, "w": 9, "s": 10, "e": 11}, "frames": 9, "fps": 8},
	"cast": {"rows": {"n": 0, "w": 1, "s": 2, "e": 3}, "frames": 7, "fps": 8},
	"thrust": {"rows": {"n": 4, "w": 5, "s": 6, "e": 7}, "frames": 8, "fps": 10},
	"slash": {"rows": {"n": 12, "w": 13, "s": 14, "e": 15}, "frames": 6, "fps": 12},
	"shoot": {"rows": {"n": 16, "w": 17, "s": 18, "e": 19}, "frames": 13, "fps": 12},
	"hurt": {"rows": 20, "frames": 6, "fps": 6},
	"sit": {"rows": {"n": 30, "w": 31, "s": 32, "e": 33}, "frames": 3, "fps": 4},
}

## LPC solo trae 3 siluetas; los 5 niveles se diferencian estirando el ancho.
const ANCHO_POR_COMPLEXION := {
	"muy_delgado": 0.86,
	"delgado": 0.94,
	"medio": 1.0,
	"obeso": 1.08,
	"muy_obeso": 1.2,
}

signal listo

var sprite: AnimatedSprite2D
var _mirando := "s"
var _origen := ""


func _ready() -> void:
	sprite = AnimatedSprite2D.new()
	# El arte es pixelado: sin esto Godot lo interpola y pierde el filo.
	sprite.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	sprite.scale = Vector2(ESCALA, ESCALA)
	# El origen del sprite queda en los pies, no en el centro del marco: así la
	# posición del nodo es "dónde pisa", que es lo que usan cámara y colisiones.
	sprite.offset = Vector2(0, -FRAME / 2.0)
	add_child(sprite)

	var forma := CollisionShape2D.new()
	var caja := RectangleShape2D.new()
	# La caja son LOS PIES. Con el marco entero de 64×64 el personaje chocaría
	# con las paredes por la cabeza y no cabría por huecos de un tile.
	caja.size = Vector2(20, 12)
	forma.shape = caja
	forma.position = Vector2(0, -6)
	add_child(forma)


## Descarga las capas del jugador y compone el personaje.
## Devuelve `false` si no hay sesión o el jugador no tiene personaje creado.
func cargar_desde_servidor() -> bool:
	if not OS.has_feature("web"):
		return false
	var origen: Variant = JavaScriptBridge.eval("window.location.origin", true)
	if typeof(origen) != TYPE_STRING:
		return false
	_origen = str(origen)

	var desc: Variant = await _pedir_json(_origen + "/api/character/layers")
	if typeof(desc) != TYPE_DICTIONARY or not desc.has("layers"):
		return false

	var rutas: Array = desc["layers"]
	var imagenes: Array[Image] = []
	for ruta in rutas:
		var img: Image = await _descargar_imagen(_origen + str(ruta))
		if img != null:
			imagenes.append(img)

	if imagenes.is_empty():
		return false

	_componer(imagenes)
	_aplicar_complexion(str(desc.get("bodyType", "medio")))
	reproducir("idle", _mirando)
	listo.emit()
	return true


## Apila las capas en una imagen y construye los fotogramas.
func _componer(capas: Array[Image]) -> void:
	# El lienzo toma el tamaño de la capa MÁS GRANDE: algunos accesorios traen
	# menos filas que el cuerpo, y recortar por la más pequeña cortaría
	# animaciones enteras.
	var ancho := 0
	var alto := 0
	for img in capas:
		ancho = maxi(ancho, img.get_width())
		alto = maxi(alto, img.get_height())

	var lienzo := Image.create(ancho, alto, false, Image.FORMAT_RGBA8)
	for img in capas:
		if img.get_format() != Image.FORMAT_RGBA8:
			img.convert(Image.FORMAT_RGBA8)
		# blend_rect respeta el alfa, así que las capas se superponen bien.
		lienzo.blend_rect(img, Rect2i(Vector2i.ZERO, img.get_size()), Vector2i.ZERO)

	var atlas := ImageTexture.create_from_image(lienzo)
	var filas := int(alto / FRAME)

	var frames := SpriteFrames.new()
	frames.remove_animation("default")

	for nombre in ANIMS:
		var def: Dictionary = ANIMS[nombre]
		for dir in ["n", "s", "e", "w"]:
			var fila: int = (
				int(def["rows"]) if typeof(def["rows"]) == TYPE_INT else int(def["rows"][dir])
			)
			if fila >= filas:
				continue  # esta hoja no llega a esa fila; se omite la animación
			var clave := "%s_%s" % [nombre, dir]
			frames.add_animation(clave)
			# Se respeta el fps de CADA animación. En el juego anterior estaba
			# declarado pero no se usaba: todo avanzaba a un ritmo fijo.
			frames.set_animation_speed(clave, float(def["fps"]))
			frames.set_animation_loop(clave, nombre == "walk" or nombre == "idle")
			for i in int(def["frames"]):
				var trozo := AtlasTexture.new()
				trozo.atlas = atlas
				trozo.region = Rect2i(i * FRAME, fila * FRAME, FRAME, FRAME)
				frames.add_frame(clave, trozo)

	sprite.sprite_frames = frames


func _aplicar_complexion(complexion: String) -> void:
	var factor: float = ANCHO_POR_COMPLEXION.get(complexion, 1.0)
	sprite.scale = Vector2(ESCALA * factor, ESCALA)


## Cambia la animación solo si de verdad cambió: llamar a play() cada frame
## reiniciaría el ciclo y el personaje se quedaría congelado en el primer paso.
func reproducir(animacion: String, mirando: String) -> void:
	if sprite == null or sprite.sprite_frames == null:
		return
	_mirando = mirando
	var clave := "%s_%s" % [animacion, mirando]
	if not sprite.sprite_frames.has_animation(clave):
		return
	if sprite.animation != clave or not sprite.is_playing():
		sprite.play(clave)


func mirando() -> String:
	return _mirando


# --- utilidades de red -------------------------------------------------------


func _pedir_json(url: String) -> Variant:
	var http := HTTPRequest.new()
	add_child(http)
	var err := http.request(url)
	if err != OK:
		http.queue_free()
		return null
	var res: Array = await http.request_completed
	http.queue_free()
	if int(res[1]) != 200:
		return null
	return JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())


func _descargar_imagen(url: String) -> Image:
	var http := HTTPRequest.new()
	add_child(http)
	var err := http.request(url)
	if err != OK:
		http.queue_free()
		return null
	var res: Array = await http.request_completed
	http.queue_free()
	if int(res[1]) != 200:
		return null
	var img := Image.new()
	if img.load_png_from_buffer(res[3] as PackedByteArray) != OK:
		return null
	return img
