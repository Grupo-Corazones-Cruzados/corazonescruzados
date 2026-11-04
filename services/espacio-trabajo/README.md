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
- **Pruebas:** `npm test` en esta carpeta (límites de cada sesión).

Reglas de aislamiento y su porqué: `aislamiento.mjs`.
