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

### ✅ A5. Apagar Spotlight en el M1 (hecho por Fernando, 2026-11-08: «Indexing disabled» en los cuatro discos)
Queda `spotlightknowledged` (el índice de Apple Intelligence de macOS 27) al ~90 % de CPU: no lo controla `mdutil`;
Claude lo vigila. No era lo que frenaba el SSD (ver A6).

### ☐ A6. Cuando te quede a mano: volver a encajar el cable del SSD (no urgente)
**Por qué:** el SSD Sabrent quedó conectado a **12 Mb/s** (velocidad de USB 1.1) en vez de 480 Mb/s como el resto
del adaptador: escribe a 0,9 MB/s (300 MB en 346 s). Los respaldos siguen funcionando, pero tardan ~33 min en vez
de ~4. Pasa cuando el conector no entró del todo o el puerto del adaptador falla.
1. Sin apagar nada, desconectar el cable del **SSD** (solo ese) del adaptador y volver a conectarlo **firme**.
   Si el adaptador tiene otro puerto USB libre, probar en ese.
2. Avisar a Claude: mide de nuevo la velocidad (debe pasar de 30 MB/s).
3. Si sigue a 12 Mb/s, probablemente es el cable del SSD: cambiarlo por otro USB-C de datos.

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

### ✅ B1. Frase de paso en la llave SSH (hecho por Fernando, 2026-11-08; comprobado: con el agente vacío el llavero la carga solo y `publicar.sh` entra sin pedirla)
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

### ✅ C1. Tailscale: que la llave del M1 no caduque (hecho por Fernando, 2026-11-08; comprobado: sin caducidad)
**Por qué:** el **2027-04-07** el M1 saldría de Tailscale y se perdería el acceso remoto sin aviso.
1. Abrir **login.tailscale.com/admin/machines** e iniciar sesión.
2. Buscar **«Fernando's MacBook Air»** (`100.73.251.124`).
3. Pulsar **⋯** al final de esa fila.
4. Elegir **«Disable key expiry»** y confirmar.

**Qué debe verse:** en la caducidad aparece **«Expiry disabled»** en vez de una fecha.

### ✅ C2. Tailscale: borrar los equipos viejos (hecho por Fernando, 2026-11-08; se fue también el iPhone, que no hace falta para el servidor: para volver a tenerlo, iniciar sesión en la app de Tailscale del iPhone)
En la misma página:
1. **railway-app** (aparece *Expired*): **⋯ → Remove → Remove machine**.
2. La **«Luis's MacBook Pro»** que dice **Expired**: **⋯ → Remove**. Hay dos con ese nombre: **no borrar la que
   está en línea**, que es la M4 Pro actual.

**Qué debe verse:** quedan la M4 Pro, el MacBook Air (M1), el iPhone y el iPad.

### ⏸ C3. Router: UPnP (aplazado por Fernando, 2026-11-08: la contraseña de administración ya no es la de fábrica y no la cambiará; apagar UPnP queda para el futuro)
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

### ✅ C4. Dominio: transferencia de `grupocc.org` a Namecheap (terminó el 2026-11-12; vence 2027-11-15)
**Estado el 2026-11-08:** **«pending transfer»** (sigue en Wild West Domains, con los servidores de Microsoft).
Vence el **2026-11-15**.
1. **No cancelar Microsoft 365** hasta que Claude confirme que el dominio está en Namecheap y con los servidores
   de nombres nuevos.
2. Buscar en el correo un mensaje de **Microsoft, Wild West Domains o GoDaddy** sobre la transferencia
   (*transfer approval* o parecido). Si trae botón para **aprobarla**, pulsarlo: la adelanta. Sin aprobación,
   se completa sola en unos 5 días.
3. En **namecheap.com → Domain List**, al terminar, `grupocc.org` aparece como **Active**.
4. **Si el 2026-11-13 sigue pendiente, avisar a Claude**: queda poco margen antes del vencimiento.

### ✅ C5a. Preparar Cloudflare (hecho por Fernando, 2026-11-08)
Cuenta con segundo factor, `grupocc.org` añadido en plan Free y **Pending** (sin activar). Bots: Search permitido,
Training bloqueado, Agents permitido, Bot Preference Sync encendido (Cloudflare antepone al `robots.txt` solo las
líneas de los bots de entrenamiento). 27 registros, todos **DNS only**: los 14 del escaneo más 13 importados de
`respaldos-gcc/cloudflare-importar-faltantes.txt` (5 productos, 6 `_railway-verify`, 2 de Google). Comprobado
preguntando a `dante.ns.cloudflare.com`: responden igual que los de Microsoft.
**Servidores de nombres asignados:** `dante.ns.cloudflare.com` y `dell.ns.cloudflare.com` (no son secretos).

### ✅ C6. Cloudflare: quitar los registros de los productos (hecho por Claude con el token de Fernando, 2026-11-08: quedan 17, sin proxy)
En dash.cloudflare.com → `grupocc.org` → **DNS → Records**, borrar (**Edit → Delete**) estos 10:
- CNAME `reservas`, `pedidos`, `catering`, `planificaciones`, `automatizaciones`
- TXT `_railway-verify.reservas`, `_railway-verify.pedidos`, `_railway-verify.catering`,
  `_railway-verify.planificaciones`, `_railway-verify.automatizaciones`
**NO borrar** `_railway-verify.www`, `www` ni `app`. Deben quedar 17 registros.

### ✅ C5. Servidores de nombres de Cloudflare en Namecheap (hecho por Fernando, 2026-11-11; zona activa a la hora)
Se hace juntos al terminar C4: crear la cuenta de Cloudflare (o entrar) y cambiar en Namecheap los dos servidores
de nombres que dé Cloudflare. Claude prepara antes todos los registros (correo, `www`, productos, passkeys) para
que no se caiga nada. Detrás vienen el túnel al M1, el cortafuegos web y los avisos de caída (fase 3).

---

**Orden recomendado:** hoy, cuando haya 5 minutos, C1, C2 y B1. C3 cuando se pueda. A1 y A2 con tiempo libre en
casa. C4 estos días, y luego C5 con Claude.

---

## D. Después de la mudanza al M1 (2026-11-11)

### ☐ D1. Cancelar Microsoft 365 — no antes del 2026-11-14
El dominio ya no depende de Microsoft (está en Namecheap y lo sirve Cloudflare). Se espera 48 h a que todos los
resolvedores de internet suelten los servidores viejos. Claude avisa cuándo; antes, comprobar que ningún correo o
servicio siga usando la cuenta.

### ✅ D2. Probar la passkey en la app de Android (hecho por Fernando, 2026-11-12: Galaxy S10+ con Android 12; la creó desde la pantalla de inicio de sesión y entró con ella)
Actualizar GCC World, Android System WebView y Servicios de Google Play; entrar con código; Configuración → Perfil →
Passkey → **Añadir**; cerrar sesión y entrar con **Entrar con passkey**.

### ☐ D3. Cuenta de desarrollador de Apple (99 $/año)
Hace falta para las passkeys dentro de las apps de iPhone, iPad y Mac (decisión de Fernando del 2026-11-11: esperar a
la cuenta en vez de usar la ventana del sistema). Con ella, Claude añade el permiso de dominios asociados.

---

## E. Credenciales que estuvieron publicadas en GitHub (encontradas por la auditoría del 2026-11-13)

El repositorio `Grupo-Corazones-Cruzados/corazonescruzados` es **público**. Desde agosto tenía dos documentos con
contraseñas. Claude los sacó del repositorio (quedan solo en tu Mac, ignorados por git), pero siguen en el historial
de git: lo que protege es cambiar las contraseñas.

### ✅ E0. Cuenta `revisor.meta@grupocc.org` de GCC World (hecho por Claude, 2026-11-13)
Contraseña nueva y todas sus sesiones anuladas; comprobado que la vieja ya no entra. Sigue siendo `client` y sin
segundo paso, porque así se le prometió a Meta en la revisión de la app. La contraseña nueva está en el
**Llavero** de la M4 Pro: app **Acceso a Llaveros** → buscar **«revisor.meta»**.

### ☐ E1. Poner la contraseña nueva del revisor en Meta (5 min)
**Por qué:** en la revisión de la app de WhatsApp se prometió a Meta que esa cuenta seguiría entrando durante un año.
Si Meta vuelve a revisar con la contraseña vieja, no entrará.
1. Abrir **developers.facebook.com/apps** → la app de GCC (proveedor de tecnología) → **Revisión de la app**
   (*App Review*) → **Solicitudes** → la solicitud aprobada → instrucciones de prueba / credenciales.
2. Cambiar la contraseña por la del Llavero (E0). Si la solicitud ya cerrada no deja editarla, anotarla en la
   próxima solicitud o en *Configuración → Básica → Instrucciones para revisores* si aparece.
3. Avisar a Claude.

### ☐ E2. Peters Tours: el usuario `meta.review` de su sistema y el PIN de WhatsApp (con Diego)
**Por qué:** `guia-coexistencia-proveedor.html` publicó el usuario y la contraseña de `meta.review` (rol *asesor*,
**lee y responde conversaciones reales** de los clientes de Peters Tours) y el PIN de dos pasos elegido para su
número. Ese sistema es del proyecto de Diego (`Diego/Sistema Contable`, repo privado). Claude no lo tocó porque
es de otro proyecto y porque `docs/REVISION_META.md` de ese proyecto promete a Meta no cambiar esa contraseña
hasta agosto de 2027.
1. Con Diego: cambiar la contraseña de `meta.review` **y el mismo día** actualizarla en la revisión de la app de
   Peters Tours en Meta (igual que E1). Si prefieren, Claude lo hace en ese proyecto cuando lo pidan expresamente.
2. El PIN de dos pasos **todavía no se aplicó** (`is_pin_enabled: false`): cuando se active, usar **otro** PIN, no
   el que figuraba en la guía.
3. Avisar a Peters Tours de que hubo exposición y de qué se cambió. Claude puede redactar el mensaje.

### ☐ E3. Cuenta `revisor.tiendas@gcc.test` (administradora, sin segundo paso)
Su contraseña **no** estaba en GitHub (está solo en Play Console y App Store Connect). Al aprobarse la revisión de
Apple y Google, pedir a Claude que la baje a `client` o le cambie la contraseña.
