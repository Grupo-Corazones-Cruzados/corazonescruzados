# Tareas manuales de Fernando — servidor propio (M1) y seguridad

Lo que solo puede hacer Fernando: pide su contraseña, su cuenta o estar junto al equipo. Lo demás lo hace
Claude. Al terminar cada una, avisar a Claude para que lo compruebe y la marque aquí. Ninguna contraseña,
frase ni código se escribe en este archivo.

Anotado el 2026-11-07. Contexto en `Aprendizaje.md` («SEGURIDAD DEL SERVIDOR PROPIO»).

## 1. Ahora, cuando tengas un momento (unos 5 minutos en total)

### ☐ 1.1 Tailscale: que la llave del M1 no caduque
Si caduca (el **2027-04-07**), el M1 sale de Tailscale y se pierde el acceso remoto sin aviso.
1. Entrar en **login.tailscale.com** → **Machines**.
2. En **«Fernando's MacBook Air»** → **⋯** → **Disable key expiry**.
3. Debe quedar sin fecha de caducidad.

### ☐ 1.2 Tailscale: borrar los equipos viejos
En la misma página, borrar (**⋯ → Remove**) los dos que dicen **Expired**:
- **railway-app**
- la **«Luis's MacBook Pro»** caducada. La que está **en línea** es la Mac M4 Pro actual: esa no se toca.

### ☐ 1.3 Frase de paso en la llave SSH de la Mac M4 Pro
Hoy, quien use la Mac M4 Pro sin ti puede entrar al servidor. `~/.ssh/config` ya está preparado para
guardar la frase en el llavero y que las publicaciones no la pidan. En la Terminal de la M4 Pro:
```
ssh-keygen -p -f ~/.ssh/gcc_m1_ed25519
```
Pide la frase nueva dos veces (si pregunta la anterior: Enter, no tenía). Después:
```
ssh-add --apple-use-keychain ~/.ssh/gcc_m1_ed25519
```
Guardar la frase en el gestor de contraseñas. **Avisar a Claude**: comprueba que `publicar.sh` sigue
funcionando sin pedirla.

### ☐ 1.4 Contraseña de administración del router
Entrar a la página del router (`http://192.168.100.1`, la puerta de enlace de la red de casa), cambiar la contraseña de administración por
una larga y única, y de paso mirar que **UPnP esté apagado** y el firmware al día.

## 2. Cuando estés en casa y con media hora libre

### ☐ 2.1 Actualizar macOS del M1 (26.2 → 26.7.2)
Trae arreglos de seguridad. Se reinicia y, con FileVault, el M1 queda bloqueado hasta desbloquearlo **desde
la red de casa** (Tailscale no funciona antes del desbloqueo). Mientras tanto la copia del M1 no responde;
la producción sigue en Railway, así que no afecta a nadie.
1. Avisar a Claude antes de empezar.
2. En la Terminal de la M4 Pro, **conectada a la red de casa**:
   ```
   ssh -t fernandogonzalez@192.168.100.15 'sudo softwareupdate -i -a -R'
   ```
   Pide la contraseña del M1. Descarga, instala y reinicia solo (pueden ser 20-40 minutos).
3. Cuando el M1 vuelva a responder (probar cada pocos minutos), desbloquear FileVault:
   ```
   ssh fernandogonzalez@192.168.100.15
   ```
   Escribir la contraseña del M1: eso desbloquea el disco y termina de arrancar.
   Si sale **«REMOTE HOST IDENTIFICATION HAS CHANGED»**, es normal antes del desbloqueo (el arranque usa otra llave): no borrar nada y avisar a Claude.
4. Avisar a Claude: comprueba la versión, los servicios, el filtro de red y los respaldos.

### ☐ 2.2 Si vas junto al M1: permitir accesorios siempre
Ajustes del Sistema → Privacidad y seguridad → **«Permitir que se conecten accesorios»** → **Siempre**.
Así un adaptador o un disco nuevos no se quedan esperando una aceptación en pantalla.

## 3. El dominio (lo que bloquea la mudanza)

### ☐ 3.1 Terminar la transferencia de `grupocc.org` a Namecheap
El registro vence el **2026-11-15**. **No cancelar Microsoft 365 antes** de que la transferencia termine.
Estado el 2026-11-08: **«pending transfer»** (sigue en Wild West Domains, servidores de Microsoft). El registrador anterior la aprueba sola en unos 5 días; se adelanta aprobándola en el correo que manda. Si el 2026-11-13 sigue pendiente, avisar a Claude.

### ☐ 3.2 Después, con Claude: pasar el dominio a Cloudflare
Cambiar los servidores de nombres en Namecheap a los que dé Cloudflare. Se hace junto con Claude, porque
detrás vienen el túnel al M1, el cortafuegos web y los avisos de caída (fase 3).

## 4. A futuro (decidido dejarlo para después)

### ☐ 4.1 Encender Compartir pantalla en el M1 (solo por Tailscale)
Se apagó al desactivar Gestión remota. El filtro de red ya lo limita a Tailscale. Cuando se quiera:
```
ssh -t fernandogonzalez@100.73.251.124 'sudo launchctl enable system/com.apple.screensharing && sudo launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.screensharing.plist'
```
Para entrar: Finder → Ir → Conectarse al servidor → `vnc://100.73.251.124`.
