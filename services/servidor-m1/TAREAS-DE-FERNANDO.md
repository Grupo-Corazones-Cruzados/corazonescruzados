# Tareas manuales de Fernando — servidor propio (M1) y seguridad

Lo que solo puede hacer Fernando: pide su contraseña, su cuenta o estar junto al equipo. Lo demás lo hace
Claude. Al terminar cada una, avisar a Claude para que lo compruebe y la marque aquí. Ninguna contraseña,
frase ni código se escribe en este archivo.

Anotado el 2026-11-07; ordenado por equipo el 2026-11-08: primero el M1, luego la MacBook M4 Pro y al final lo
que se hace desde cualquier navegador. Contexto en `Aprendizaje.md` («SEGURIDAD DEL SERVIDOR PROPIO»).

---

## A. En el M1 (MacBook Air)

### ✅ A1. Actualizar macOS del M1 (hecho por Fernando, 2026-11-08: quedó en **macOS 27.2**)
Comprobado tras el reinicio: servicios, filtro de red, cortafuegos, SSH, Tailscale y Node, todo en pie. Falta volver a conectar cargador y adaptador (ver A4).

### ✅ A4. Volver a conectar el M1 (hecho por Fernando, 2026-11-08; comprobado: sale por el cable `192.168.100.15`, carga y el SSD se desbloquea solo)

### ☐ A5. Apagar Spotlight en el M1 (a distancia, 1 minuto, desde la Terminal de la M4 Pro)
**Por qué:** tras actualizar, Spotlight reindexa todo (un proceso al 99 % de CPU) y también indexa el SSD de
respaldos, que tiene una base de datos dentro: el respaldo de prueba escribió a 0,9 MB/s cuando el USB da ~35. En
un servidor no sirve para nada y ralentiza respaldos, publicaciones y la base.
1. En la Terminal de la M4 Pro pegar:
   ```
   ssh -t fernandogonzalez@100.73.251.124 'sudo mdutil -a -i off && sudo mdutil -E /Volumes/GCC-Respaldos'
   ```
2. Escribir la contraseña del M1. Debe responder **«Indexing disabled.»** por cada disco.
3. Avisar a Claude: comprueba que el proceso de Spotlight bajó y mide de nuevo la velocidad del SSD.

<details><summary>Pasos que se usaron para actualizar</summary>

**Antes del reinicio:** el M1 tiene que estar con el cargador y el adaptador (cable de red + SSD) puestos. Por wifi su IP es otra (`192.168.100.32`): si el cable no está, usar esa en los pasos 4 y 5.
**Por qué:** trae arreglos de seguridad. Hay que estar **en casa**: tras el reinicio el disco queda cifrado
hasta desbloquearlo desde la red de casa, y Tailscale no funciona hasta entonces. Los comandos se escriben en
la Terminal de la M4 Pro, pero lo que se actualiza es el M1. No afecta a nadie: producción sigue en Railway.
1. **Avisar a Claude antes de empezar**, para vigilar desde aquí.
2. Con la MacBook M4 Pro **conectada al wifi de casa**, abrir la Terminal y pegar:
   ```
   ssh -t fernandogonzalez@192.168.100.15 'sudo softwareupdate -i -a -R'
   ```
3. Escribir la **contraseña del usuario del M1** (al teclear no se ve nada; es normal). Descarga, instala y
   reinicia solo; no cerrar la Terminal hasta que diga que se cierra la conexión.
4. Esperar unos 20-30 minutos y pegar:
   ```
   ssh fernandogonzalez@192.168.100.15
   ```
   Si da error de conexión, aún está instalando: probar de nuevo cada 5 minutos.
5. Cuando conecte, escribir la **contraseña del M1**: eso desbloquea el disco y termina de arrancar.
   Si sale **«REMOTE HOST IDENTIFICATION HAS CHANGED»**, es normal antes del desbloqueo (el arranque usa otra
   llave): **no borrar nada** y avisar a Claude.
6. Avisar a Claude: comprueba la versión, los servicios, el filtro de red y los respaldos.

</details>

### ✅ A2. Junto al M1: permitir accesorios siempre (hecho por Fernando, 2026-11-08)
**Por qué:** sin esto, un adaptador o un disco nuevos se quedan esperando una aceptación en la pantalla del M1.
1. En el M1: menú  → **Ajustes del Sistema → Privacidad y seguridad**.
2. Bajar hasta **«Permitir que se conecten accesorios»** y elegir **«Siempre»**.
3. Pide la contraseña del M1.

### ✅ A3. Compartir pantalla en el M1, solo por Tailscale (hecho por Fernando, 2026-11-08; comprobado: 5900 abierto por Tailscale y cerrado por la red de casa)
Se apagó al desactivar Gestión remota; Fernando lo deja para más adelante. Cuando se quiera, en la Terminal de
la M4 Pro:
```
ssh -t fernandogonzalez@100.73.251.124 'sudo launchctl enable system/com.apple.screensharing && sudo launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.screensharing.plist'
```
Para usarlo: Finder → **Ir → Conectarse al servidor** → `vnc://100.73.251.124`.

---

## B. En la MacBook M4 Pro

### ☐ B1. Frase de paso en la llave SSH (2 minutos)
**Por qué:** hoy, quien use la M4 Pro sin ti puede entrar al servidor. `~/.ssh/config` ya está preparado para
guardar la frase en el llavero.
1. Abrir la **Terminal** de la M4 Pro.
2. Pegar y pulsar Enter:
   ```
   ssh-keygen -p -f ~/.ssh/gcc_m1_ed25519
   ```
3. Si pregunta la frase anterior (*old passphrase*): **Enter**, no tenía.
4. Escribir una frase nueva, larga y que no se use en otro sitio (p. ej. cuatro palabras), y repetirla.
5. Debe decir **«Your identification has been saved with the new passphrase»**.
6. Pegar y escribir la frase una vez más:
   ```
   ssh-add --apple-use-keychain ~/.ssh/gcc_m1_ed25519
   ```
7. Debe decir **«Identity added»**. Desde ahí el llavero la recuerda y las publicaciones no la piden.
8. Guardar la frase en el gestor de contraseñas.

**Si sale mal:** si no coincidió al repetirla, empezar de nuevo desde el paso 2. **Avisar a Claude**: comprueba
que `publicar.sh` sigue funcionando sin pedirla.

---

## C. Desde cualquier navegador (no depende de una Mac)

### ☐ C1. Tailscale: que la llave del M1 no caduque (2 minutos)
**Por qué:** el **2027-04-07** el M1 saldría de Tailscale y se perdería el acceso remoto sin aviso.
1. Abrir **login.tailscale.com/admin/machines** e iniciar sesión.
2. Buscar **«Fernando's MacBook Air»** (`100.73.251.124`).
3. Pulsar **⋯** al final de esa fila.
4. Elegir **«Disable key expiry»** y confirmar.

**Qué debe verse:** en la caducidad aparece **«Expiry disabled»** en vez de una fecha.

### ☐ C2. Tailscale: borrar los equipos viejos (1 minuto)
En la misma página:
1. **railway-app** (aparece *Expired*): **⋯ → Remove → Remove machine**.
2. La **«Luis's MacBook Pro»** que dice **Expired**: **⋯ → Remove**. Hay dos con ese nombre: **no borrar la que
   está en línea**, que es la M4 Pro actual.

**Qué debe verse:** quedan la M4 Pro, el MacBook Air (M1), el iPhone y el iPad.

### ☐ C3. Router: contraseña de administración y UPnP (5-10 minutos; desde casa, con cualquier equipo)
**Por qué:** quien entre al wifi y adivine la contraseña del router puede abrir puertos hacia el M1.
1. Desde un equipo o el teléfono **conectado a la red de casa**, abrir **http://192.168.100.1**.
2. Entrar con el usuario y la contraseña de administración (si nunca se cambiaron, suelen venir en la etiqueta
   de debajo del router).
3. Buscar **Administración / Sistema / Gestión → Contraseña** (cambia según la marca) y poner una larga y única.
   Guardarla en el gestor.
4. Buscar **UPnP** (en *Red*, *Avanzado* o *NAT*) y **apagarlo**.
5. Si hay **Firmware / Actualización**, instalar la más reciente si la ofrece.

**Si no se encuentra una opción:** mandar a Claude una captura del menú. Apagar UPnP no afecta al M1: no recibe
nada desde internet.

### ☐ C4. Dominio: terminar la transferencia de `grupocc.org` (lo que bloquea la mudanza)
**Estado el 2026-11-08:** **«pending transfer»** (sigue en Wild West Domains, con los servidores de Microsoft).
Vence el **2026-11-15**.
1. **No cancelar Microsoft 365** hasta que Claude confirme que el dominio está en Namecheap y con los servidores
   de nombres nuevos.
2. Buscar en el correo un mensaje de **Microsoft, Wild West Domains o GoDaddy** sobre la transferencia
   (*transfer approval* o parecido). Si trae botón para **aprobarla**, pulsarlo: la adelanta. Sin aprobación,
   se completa sola en unos 5 días.
3. En **namecheap.com → Domain List**, al terminar, `grupocc.org` aparece como **Active**.
4. **Si el 2026-11-13 sigue pendiente, avisar a Claude**: queda poco margen antes del vencimiento.

### ☐ C5. Después, con Claude: pasar el dominio a Cloudflare
Se hace juntos al terminar C4: crear la cuenta de Cloudflare (o entrar) y cambiar en Namecheap los dos servidores
de nombres que dé Cloudflare. Claude prepara antes todos los registros (correo, `www`, productos, passkeys) para
que no se caiga nada. Detrás vienen el túnel al M1, el cortafuegos web y los avisos de caída (fase 3).

---

**Orden recomendado:** hoy, cuando haya 5 minutos, C1, C2 y B1. C3 cuando se pueda. A1 y A2 con tiempo libre en
casa. C4 estos días, y luego C5 con Claude.
