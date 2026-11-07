# Servidor propio (MacBook Air M1)

GCC World y los cinco productos pasan de Railway al M1 por decisión de Fernando (2026-11-06): control propio, Railway solo
como segunda opción. Contexto y medidas en `Aprendizaje.md` («GCC World en el M1»).

## Piezas

| Archivo | Dónde corre | Qué hace |
|---|---|---|
| `publicar.sh` | Mac de desarrollo | Compila `origin/main` aquí y lo envía al M1 como versión nueva (`~/gcc/versiones/<fecha>-<commit>`). `~/gcc/app` es un enlace que cambia de golpe; si un servicio no responde, vuelve a la versión anterior. Guarda las 3 últimas. |
| `respaldo-railway.sh` | M1, 03:30 (`org.grupocc.respaldo-railway`) | Copia completa de la base del M1 al Postgres de Railway y comprueba tablas y filas. **No hace nada sin `~/gcc/es-primario`**: hasta la mudanza producción vive en Railway y restaurar encima la borraría. |
| `../mantenimiento/worker.js` | Cloudflare, delante del dominio | Manda el tráfico al M1 (`DESTINO=m1`) o a Railway (`DESTINO=railway`). Si el destino no responde, pantalla de mantenimiento a quien navega y 503 con `Retry-After` al resto. `MANTENIMIENTO=1` la fuerza. Pruebas: `node services/mantenimiento/worker.test.mjs`. |
| `endurecer.sh` | M1, como administrador (`ssh -t <m1> 'sudo bash ~/gcc/endurecer.sh'`) | Cortafuegos de macOS invisible; filtro pf (`/etc/pf.anchors/gcc` en el ancla `com.apple/300.gcc`, recargado al arrancar por `org.grupocc.pf`) que solo deja entrar SSH (casa y Tailscale) y 5900 por Tailscale; SSH sin root, un usuario, solo llave salvo desde la red de casa; ARD y SMB apagados. **Seguro:** se deshace solo a los 5 min si nadie crea `/tmp/gcc-pf-ok` tras probar una conexión nueva. Se puede repetir. |
| `components/providers/AvisoMantenimiento.tsx` | En la app | Si una llamada recibe 503 con `x-gcc-mantenimiento`, tapa la pantalla con el mismo aviso y recarga al volver. |

## En el M1 (`~/gcc`)
- `app` → versión en marcha · `versiones/` · `env/` (entornos, sin claves de envío en la copia de prueba) · `pg/` (Postgres 16 de Postgres.app, solo 127.0.0.1:5433).
- Servicios launchd `org.grupocc.espejo.*`: `pg`, `app` (3100), `reservas` 3101, `pedidos` 3102, `catering` 3103, `planificaciones` 3104, `automatizaciones` 3105, `worker`, `medidor` (`medidas.csv`, una fila por minuto).
- Node propio en `~/gcc/runtime/node` (22.23.4, el oficial con su suma comprobada); lo usan `correr.sh` y `org.grupocc.sri-gastos`. El Homebrew del M1 es de 2024 y no reconoce macOS 26: no sirve para actualizar. Para cambiar de Node: descomprimir al lado y mover el enlace.
- Configuración local de la Mac de desarrollo: `~/.gcc-servidor.env` con `M1_HOST` y `M1_CLAVE`.

## Trampas ya pagadas
- **Accesorios USB:** macOS no activa un adaptador nuevo hasta aceptar el aviso en pantalla. Ajustes → Privacidad y seguridad → «Permitir que se conecten accesorios» → **Siempre**.
- **rsync de macOS (openrsync):** con `--link-dest` se queda sin archivos abiertos. Se clona la versión anterior con `cp -Rc` (APFS, sin espacio extra) y se envían diferencias.
- **Wifi del M1:** 0,37 MB/s; por eso va por cable. El cuello de botella al publicar es el wifi de la Mac de desarrollo.
- **Compilar en el M1, no:** `next build` necesita hasta 6 GB.
- Los estados de salida de una canalización `tar | ssh` mienten: comprobar contando archivos.
- **`pfctl` siempre avisa** de «Use of -f option…» y de ALTQ: validar las reglas por el código de salida, nunca por si imprimió algo.
- **`kickstart -deactivate` de ARD apaga también Compartir pantalla.** Si se quiere de vuelta: `sudo launchctl enable system/com.apple.screensharing && sudo launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.screensharing.plist`.
- **Sin sudo por SSH:** lo que pide administrador lo ejecuta Fernando con `ssh -t … 'sudo …'`; la contraseña no pasa por nosotros.

## Pendiente
Cloudflare (tras cerrar la transferencia de `grupocc.org`), traspaso automático a Railway, mudanza de madrugada, entornos reales con claves.
