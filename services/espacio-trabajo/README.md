# Espacio de trabajo local

Interfaz en Admin para trabajar con Claude Code en todos los proyectos. Solo existe en esta Mac:
en Railway no hay variable ni servicio y todo responde 404.

```
Teléfono ─ Tailscale (HTTPS, solo la red privada) ─┐
Navegador de la Mac ───────────────────────────────┴→ Next en 127.0.0.1:3792 → servicio en 127.0.0.1:3791 → Claude Code
                                                       (copia en ~/.gcc-espacio/app)
```

- **Instalar o actualizar:** `services/espacio-trabajo/instalar.sh <correo-admin>`. Compila `origin/main`, nunca
  el árbol de trabajo. Reinicia el servicio solo si su código cambió, porque eso corta lo que esté trabajando.
- **Datos:** `~/.gcc-espacio/` (token, contraseña, proyectos, incidencias, registros). Las conversaciones
  son los archivos de Claude Code; aquí no se copian.
- **Registros:** `~/.gcc-espacio/servicio.log` y `web.log`.
- **Teléfono:** `tailscale serve --bg --https=443 http://127.0.0.1:3792`, y entrar a `/espacio-acceso`.
- **Pruebas:** `npm test` en esta carpeta.
- **Diagrama de flujo:** el botón de cada proyecto abre una sesión normal con la orden de `flujo.mjs` y las reglas de `flujo-reglas.md`. La sesión escribe un borrador en `~/.gcc-espacio/flujos/<proyecto>` y publica con `publicar-flujo.mjs`, que solo sustituye lo publicado si el borrador es válido. Nada se guarda en el repositorio del cliente. Las piezas: `flujo-catalogo.mjs` (lo comparten validador y web).
- **Compartir el diagrama:** `POST /api/espacio-trabajo/flujo-compartido` lee el diagrama de este servicio y guarda una copia sin `origen` en `gcc_world.flujos_compartidos`; `/flujo/<token>` la lee desde la web. El instalador copia también la clave de Google, porque es una ruta relativa que git no trae.
- **Generación de Contenido:** `/generar-json` escribe los textos con Claude Code, y `/videos/…` sube cada video a `~/Movies/GCC-Edicion` y abre su sesión. Ver `videos.mjs` y `generar.mjs`.

Por defecto cada sesión tiene acceso completo, como en la terminal. Solo se aíslan un proyecto marcado así y las sesiones nacidas de una incidencia. Reglas y porqué: `aislamiento.mjs`.
