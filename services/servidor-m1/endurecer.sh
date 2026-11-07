#!/bin/bash
# ENDURECER EL SERVIDOR PROPIO (M1) — se ejecuta EN el M1 como administrador. Se puede repetir.
#
#   ssh -t <m1> 'sudo bash ~/gcc/endurecer.sh'
#
# 1. Cortafuegos de macOS encendido y en modo invisible.
# 2. Filtro de red (pf): entra solo SSH (red de casa y Tailscale) y Compartir pantalla (solo Tailscale).
#    Todo lo demás que escucha (AirPlay, multimedia, SMB, Gestión remota…) queda inalcanzable desde fuera.
# 3. SSH: sin root, solo el usuario del servidor y solo con llave; con contraseña únicamente desde la red
#    de casa, para no arriesgar el desbloqueo de FileVault por SSH tras un reinicio.
# 4. Gestión remota (ARD) y Compartir archivos (SMB) apagados.
#
# SEGURO: el filtro se retira solo a los 5 minutos salvo que exista /tmp/gcc-pf-ok. Ese archivo lo crea,
# desde la Mac de desarrollo, quien compruebe que una conexión SSH NUEVA sigue entrando por las dos vías.
set -eo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecutar con sudo"; exit 1; }

USUARIO=fernandogonzalez
LAN=192.168.100.0/26          # red de casa (en5: 192.168.100.15/26)
ANCLA=com.apple/300.gcc       # cuelga del «anchor com.apple/*» que ya trae /etc/pf.conf
REGLAS=/etc/pf.anchors/gcc
DEMONIO=/Library/LaunchDaemons/org.grupocc.pf.plist
FW=/usr/libexec/ApplicationFirewall/socketfilterfw

echo "▶ Cortafuegos de macOS"
$FW --setglobalstate on >/dev/null; $FW --setallowsigned on >/dev/null
$FW --setallowsignedapp on >/dev/null; $FW --setstealthmode on >/dev/null
$FW --getglobalstate; $FW --getstealthmode

echo "▶ Gestión remota y Compartir archivos"
/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart \
  -deactivate -configure -access -off >/dev/null 2>&1 || echo "  (ARD: no se pudo desactivar; pf lo bloquea igual)"
launchctl disable system/com.apple.smbd 2>/dev/null || true
launchctl bootout system/com.apple.smbd 2>/dev/null || true

echo "▶ SSH"
cat > /etc/ssh/sshd_config.d/050-gcc.conf <<EOF
# GCC: servidor propio. La primera aparición de cada opción manda; por eso va antes que 100-macos.conf.
PermitRootLogin no
AllowUsers $USUARIO
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
cat > /etc/ssh/sshd_config.d/zzz-gcc-red-casa.conf <<EOF
# GCC: con contraseña solo desde la red de casa (desbloqueo de FileVault por SSH tras reiniciar).
Match Address $LAN
    PasswordAuthentication yes
    KbdInteractiveAuthentication yes
Match all
EOF
if ! /usr/sbin/sshd -t; then
  rm -f /etc/ssh/sshd_config.d/050-gcc.conf /etc/ssh/sshd_config.d/zzz-gcc-red-casa.conf
  echo "✖ La configuración de SSH no valida; se retiró sin tocar nada"; exit 1
fi
echo "  configuración válida (vale para las conexiones nuevas; la actual no se corta)"

echo "▶ Filtro de red"
cat > "$REGLAS" <<EOF
# GCC: lo que entra al servidor propio. Todo lo de 127.0.0.1 (app, productos, Postgres) no pasa por aquí.
lan = "$LAN"
pass quick on lo0 all
# Salida libre y con estado: las respuestas vuelven solas. «flags any» recoge las conexiones ya abiertas.
pass out quick proto tcp all flags any keep state
pass out quick proto { udp, icmp } all keep state
pass out quick inet6 proto icmp6 all keep state
pass in  quick inet  proto icmp all
pass in  quick inet6 proto icmp6 all
pass in  quick inet  proto udp from any port 67  to any port 68
pass in  quick inet6 proto udp from any port 547 to any port 546
pass in  quick proto tcp from { \$lan, 100.64.0.0/10, fd7a:115c:a1e0::/48 } to any port 22   flags any keep state
pass in  quick proto tcp from { 100.64.0.0/10, fd7a:115c:a1e0::/48 }       to any port 5900 flags any keep state
block in quick all
EOF
# pfctl siempre avisa de «-f» y de ALTQ: se decide por el código de salida, no por lo que imprime.
RUIDO="ALTQ|could result in flushing|present in the main ruleset|pf.conf for further|^$"
if ! SALIDA=$(pfctl -nf "$REGLAS" -a "$ANCLA" 2>&1); then
  echo "$SALIDA" | grep -Ev "$RUIDO"; rm -f "$REGLAS"; echo "✖ Las reglas no validan; no se cargó nada"; exit 1
fi
pfctl -sr 2>/dev/null | grep -q 'anchor "com.apple/\*"' || pfctl -f /etc/pf.conf >/dev/null 2>&1
pfctl -a "$ANCLA" -f "$REGLAS" 2>&1 | grep -Ev "$RUIDO" || true
pfctl -E 2>&1 | grep -v "ALTQ" | grep -i "enabled\|token" | head -1 || true

cat > "$DEMONIO" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>org.grupocc.pf</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string>
    <string>sleep 5; /sbin/pfctl -sr 2>/dev/null | grep -q com.apple || /sbin/pfctl -f /etc/pf.conf; /sbin/pfctl -a $ANCLA -f $REGLAS; /sbin/pfctl -E</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
EOF
chmod 644 "$DEMONIO"; chown root:wheel "$DEMONIO"

# Seguro anti-bloqueo.
rm -f /tmp/gcc-pf-ok; date +%s > /tmp/gcc-pf-pendiente; chmod 644 /tmp/gcc-pf-pendiente
nohup /bin/bash -c "
  for i in \$(seq 1 60); do [ -f /tmp/gcc-pf-ok ] && { rm -f /tmp/gcc-pf-pendiente; exit 0; }; sleep 5; done
  /sbin/pfctl -a $ANCLA -F all; rm -f $DEMONIO /tmp/gcc-pf-pendiente
  rm -f /etc/ssh/sshd_config.d/050-gcc.conf /etc/ssh/sshd_config.d/zzz-gcc-red-casa.conf
  echo \"\$(date) retirado por falta de confirmación\" >> /var/log/gcc-endurecer.log
" >/dev/null 2>&1 &
disown
echo "✔ Aplicado. Si en 5 minutos no se confirma que SSH sigue entrando, se deshace solo."
