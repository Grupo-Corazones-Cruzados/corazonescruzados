# Gumdramon (Copiloto de reuniones)

El código y los datos siguen llamándose `copiloto`; el nombre visible es Gumdramon. El identificador `org.grupocc.copiloto` no se cambia, porque macOS le ata los permisos de micrófono y audio.

El icono usa arte del Digimon Gumdramon, propiedad de sus titulares, tomado de Wikimon. Es para uso interno: no sirve si la app se distribuye o se vende. Como este repositorio es público, la imagen no está aquí: vive en `~/.gcc-copiloto/recursos/gumdramon.png` (origen: `wikimon.net/Gumdramon`, archivo `Gumdramon4.png`, recortado a su contenido).

Widget flotante que escucha una reunión, detecta preguntas y responde con lo que sabe el negocio. Solo existe en esta Mac; nada de esto se despliega.

```
Micrófono (Fernando) ─┐
Audio del equipo (Cliente) ─┴→ Gumdramon.app → núcleo en 127.0.0.1:3793 → whisper-server (local)
                                                      ├→ filtro local → Claude Code (suscripción, solo lectura)
                                                      └→ al terminar → Next local :3792 → Recordatorios
```

- **Instalar o actualizar:** `services/copiloto/instalar.sh`. El recordatorio necesita además el Espacio de trabajo al día (`services/espacio-trabajo/instalar.sh`).
- **Datos:** `~/.gcc-copiloto/` (token, `.env`, `sesiones/`, `servicio.log`). La transcripción se escribe línea a línea y se borra al confirmarse el recordatorio. El audio no se guarda.
- **Pruebas:** `npm test` en esta carpeta.
- **Órdenes de voz (solo micrófono):** «GUMDRAMON, …» pregunta, y la pregunta acaba tras 2,5 s de silencio (máximo 90 s); «GUMDRAMON, la sesión ha terminado» cierra y crea el recordatorio.
- **Seguridad:** lo que se oye lo puede decir cualquiera, así que el agente solo tiene `Read`, `Grep`, `Glob`, `WebSearch` y un SELECT de solo lectura (`nucleo/bd.mjs`). Sin `Bash`, sin escritura y sin `WebFetch`. `peter-tours` y las llaves están vedados.
