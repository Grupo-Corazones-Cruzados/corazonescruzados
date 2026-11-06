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
- **Teléfono:** `/gumdramon` en la web local, por Tailscale y con la contraseña del Espacio; en las apps, Admin ▸ Gumdramon, en un marco. Sin compilar ni firmar nada. Su micrófono entra como `mic`: todo lo que oye es de Fernando, así que allí solo se pregunta con la clave. El micrófono es del último dispositivo que activó.
- **Órdenes de voz (solo micrófono):** «GUMDRAMON, …» pregunta, y la pregunta acaba tras 4 s de silencio, con cuenta atrás en el widget (máximo 10 min); «GUMDRAMON, la sesión ha terminado» cierra y crea el recordatorio.
- **La sesión:** es una sesión normal de Claude Code en el proyecto Gumdramon del Espacio de trabajo (carpeta `~/.gcc-copiloto/sesion`, con su `CLAUDE.md`). Se abre desde el widget y se puede seguir allí.
- **Seguridad:** lo que se oye lo puede decir cualquiera, como el WhatsApp de las incidencias. Por eso va en modo `dontAsk` con los permisos que escribe `instalar.sh`: `Read`, `WebSearch`, subagentes, la búsqueda en todos los proyectos (`nucleo/buscar.mjs`, porque esta versión de Claude Code no trae `Grep` ni `Glob` y un `grep` libre leería los `.env`) y un SELECT de solo lectura (`nucleo/bd.mjs`). Sin escritura y sin `WebFetch`. `peter-tours` y las llaves están vedados.
