# Servidor propio (MacBook Air M1)

GCC World y los cinco productos pasan de Railway al M1 por decisión de Fernando (2026-11-06): control propio, Railway solo
como segunda opción. Contexto y medidas en `Aprendizaje.md` («GCC World en el M1»).

## Piezas

| Archivo | Dónde corre | Qué hace |
|---|---|---|
| `publicar.sh` | Mac de desarrollo | Compila `origin/main` aquí y lo envía al M1 como versión nueva (`~/gcc/versiones/<fecha>-<commit>`). `~/gcc/app` es un enlace que cambia de golpe; si un servicio no responde, vuelve a la versión anterior. Guarda las 3 últimas. |
| `respaldo-railway.sh` | M1, 03:30 (`org.grupocc.respaldo-railway`) | Copia completa de la base del M1 al Postgres de Railway y comprueba tablas y filas. **No hace nada sin `~/gcc/es-primario`**: hasta la mudanza producción vive en Railway y restaurar encima la borraría. |
| `../mantenimiento/worker.js` | Cloudflare, delante del dominio | Manda el tráfico al M1 (`DESTINO=m1`) o a Railway (`DESTINO=railway`). Si el destino no responde, pantalla de mantenimiento a quien navega y 503 con `Retry-After` al resto. `MANTENIMIENTO=1` la fuerza. Pruebas: `node services/mantenimiento/worker.test.mjs`. |
| `components/providers/AvisoMantenimiento.tsx` | En la app | Si una llamada recibe 503 con `x-gcc-mantenimiento`, tapa la pantalla con el mismo aviso y recarga al volver. |

## En el M1 (`~/gcc`)
- `app` → versión en marcha · `versiones/` · `env/` (entornos, sin claves de envío en la copia de prueba) · `pg/` (Postgres 16 de Postgres.app, solo 127.0.0.1:5433).
- Servicios launchd `org.grupocc.espejo.*`: `pg`, `app` (3100), `reservas` 3101, `pedidos` 3102, `catering` 3103, `planificaciones` 3104, `automatizaciones` 3105, `worker`, `medidor` (`medidas.csv`, una fila por minuto).
- Configuración local de la Mac de desarrollo: `~/.gcc-servidor.env` con `M1_HOST` y `M1_CLAVE`.

## Trampas ya pagadas
- **Accesorios USB:** macOS no activa un adaptador nuevo hasta aceptar el aviso en pantalla. Ajustes → Privacidad y seguridad → «Permitir que se conecten accesorios» → **Siempre**.
- **rsync de macOS (openrsync):** con `--link-dest` se queda sin archivos abiertos. Se clona la versión anterior con `cp -Rc` (APFS, sin espacio extra) y se envían diferencias.
- **Wifi del M1:** 0,37 MB/s; por eso va por cable. El cuello de botella al publicar es el wifi de la Mac de desarrollo.
- **Compilar en el M1, no:** `next build` necesita hasta 6 GB.
- Los estados de salida de una canalización `tar | ssh` mienten: comprobar contando archivos.

## Pendiente
Cloudflare (tras cerrar la transferencia de `grupocc.org`), traspaso automático a Railway, mudanza de madrugada, entornos reales con claves.
