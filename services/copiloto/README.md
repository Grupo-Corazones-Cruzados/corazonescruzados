# Gumdramon (Copiloto de reuniones)

El código y los datos siguen llamándose `copiloto`; el nombre visible es Gumdramon. El identificador `org.grupocc.copiloto` no se cambia, porque macOS le ata los permisos de micrófono y audio.

El icono usa arte del Digimon Gumdramon, propiedad de sus titulares, tomado de Wikimon. Es para uso interno: no sirve si la app se distribuye o se vende. Como este repositorio es público, la imagen no está aquí: vive en `~/.gcc-copiloto/recursos/gumdramon.png` (origen: `wikimon.net/Gumdramon`, archivo `Gumdramon4.png`, recortado a su contenido).

Widget flotante que escucha una reunión, detecta preguntas y responde con lo que sabe el negocio. Solo existe en esta Mac; nada de esto se despliega.

```
Micrófono (Fernando) ─┐
Audio del equipo (Cliente) ─┴→ Gumdramon.app → núcleo en 127.0.0.1:3793 → whisper-server (local)
                                                      ├→ filtro local → clasificador (haiku) → sesión real del Espacio de trabajo
                                                      └→ al terminar → Next local :3792 → Recordatorios
```

- **Instalar o actualizar:** `services/copiloto/instalar.sh`. El recordatorio necesita además el Espacio de trabajo al día (`services/espacio-trabajo/instalar.sh`).
- **Datos:** `~/.gcc-copiloto/` (token, `.env`, `sesiones/`, `servicio.log`). La transcripción se escribe línea a línea y se borra al confirmarse el recordatorio. El audio no se guarda.
- **Pruebas:** `npm test` en esta carpeta.
- **Minimizar:** el botón amarillo de arriba a la izquierda (como el de las ventanas de macOS, con área de clic de 22 px) lo esconde y pone a Gumdramon en el Dock, sin dejar de escuchar; al pulsar el icono vuelve el panel y el icono se va. Con el panel a la vista no hay icono, para no estorbar al compartir pantalla. `--minimizar` arranca ya minimizado.
- **Llamadas desde el teléfono:** el audio de la llamada sale por el teléfono, así que el Mac solo lo oye por su micrófono y lo apunta todo como Fernando: no responde al cliente. Pasó con una llamada de WhatsApp el 2026-11-07. Para que funcione, la llamada se atiende en el Mac (WhatsApp para Mac). El iPhone tampoco sirve, porque iOS no deja grabar durante una llamada.
- **Captura en la Mac (Teams y compañía):** las apps de llamadas cambian el dispositivo o su frecuencia en cualquier momento, también con la captura parada. Por eso cada apertura del micrófono usa un `AVAudioEngine` nuevo con `installTap(format: nil)`, y las excepciones de AVFAudio se atrapan en `Sources/CapturaObjC` (Swift no puede, y una sin atrapar tumbó la app en una reunión). Un `Supervisor` reabre cada canal si deja de llegar audio 3 s (con silencio también llegan búferes), y a los 5 s lo dice en el widget con el punto naranja. El audio del equipo se rehace al cambiar la salida por defecto o el formato del tap. Si la app se reabre con el núcleo activo, vuelve a escuchar sola; si el micrófono lo tiene el iPhone, el Mac no escucha y lo avisa.
- **Teléfono:** `/gumdramon` en la web local, por Tailscale y con la contraseña del Espacio; en las apps, Admin ▸ Gumdramon, en un marco. Sin compilar ni firmar nada. Su micrófono entra como `mic`: todo lo que oye es de Fernando, así que allí solo se pregunta con la clave. El micrófono es del último dispositivo que activó.
- **App de iPhone:** `services/copiloto/ios/`, nativa y aparte, para seguir escuchando en segundo plano y con la pantalla bloqueada. Se instala con `ios/instalar.sh`. Con el equipo personal caduca a los 7 días: repetir el comando.
- **Órdenes de voz (solo micrófono):** «GUMDRAMON, …» pregunta, y la pregunta acaba tras 4 s de silencio, con cuenta atrás en el widget (máximo 10 min); «GUMDRAMON, la sesión ha terminado» cierra y crea el recordatorio; «GUMDRAMON, recordatorio» y lo que dictes crea un recordatorio con pasos en la cuenta de Fernando (`nucleo/recordatorio.mjs`, con cola en disco si algo falla).
- **La sesión:** es una sesión normal de Claude Code en el proyecto Gumdramon del Espacio de trabajo (carpeta `~/.gcc-copiloto/sesion`, con su `CLAUDE.md`). Se abre desde el widget y se puede seguir allí.
- **Sesiones (pestaña del widget, 2026-11-08):** lista las sesiones de Gumdramon. Tocar una la **retoma**: las preguntas siguientes van a esa conversación y el widget enseña lo ya preguntado (sin el contexto de la reunión, y «Sin respuesta» si Claude no llegó a responder). También se les cambia el nombre (queda fijo: el Espacio lo guarda en `titulos.json`, que manda sobre el resumen de Claude Code, y «Reunión <hora>» solo se pone una vez a las sesiones nuevas) y se eliminan (papelera del Espacio, 30 días). «Nueva sesión» hace que la siguiente pregunta abra otra. Rutas del núcleo: `GET /sesiones`, `POST /sesiones/nueva`, `POST /sesiones/:id/{retomar|titulo|eliminar}`.
- **Seguridad:** lo que se oye lo puede decir cualquiera, como el WhatsApp de las incidencias. Por eso va en modo `dontAsk` con los permisos que escribe `instalar.sh`: `Read`, `WebSearch`, subagentes, la búsqueda en todos los proyectos (`nucleo/buscar.mjs`, porque esta versión de Claude Code no trae `Grep` ni `Glob` y un `grep` libre leería los `.env`) y un SELECT de solo lectura (`nucleo/bd.mjs`). Sin escritura y sin `WebFetch`. `peter-tours` y las llaves están vedados.

## Base de datos del copiloto (2026-11-14)
`consultar-bd.mjs` entra con el usuario **`copiloto_lectura`** del Postgres del M1, por el túnel local
`127.0.0.1:55433`. Ese usuario:
- tiene la transacción en solo lectura y un límite de 5 s por consulta;
- puede leer `gcc_world` **sin** las columnas de contraseñas, tokens, hashes y claves cifradas;
- no puede usar `pg_read_file` y no es superusuario.

La cadena vive en `~/.gcc-copiloto/.env` (600) y no está en el repositorio. Antes entraba como superusuario
en la copia de Railway, y el filtro de texto de `bd.mjs` se podía saltar.

Una tabla nueva **no** es legible hasta que se repitan los permisos. Para eso hay que volver a correr, en el
M1, el bloque `GRANT SELECT (columnas sin secretos)` sobre las tablas de `gcc_world`, con el mismo filtro de
nombres.
