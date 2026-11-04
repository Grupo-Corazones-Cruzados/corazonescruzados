#!/bin/zsh
# Instala o actualiza el espacio de trabajo local. Se puede repetir: la segunda vez actualiza.
#
#   services/espacio-trabajo/instalar.sh lfgonzalezm0@gmail.com
#
# La web corre desde una copia propia de `origin/main` en ~/.gcc-espacio/app, y no desde el
# repositorio de trabajo. Así, ni una sesión que deja el código a medias ni un `next build` de
# otra sesión tumban la herramienta con la que se está corrigiendo.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
DATOS="$HOME/.gcc-espacio"
APP="$DATOS/app"
AGENTES="$HOME/Library/LaunchAgents"
NODO="$(command -v node)"
UID_ACTUAL="$(id -u)"
CORREO_GUARDADO="$DATOS/correo-admin"
mkdir -p "$DATOS" "$AGENTES"
chmod 700 "$DATOS"

[[ -n "${1:-}" ]] && print -r -- "$1" > "$CORREO_GUARDADO"
[[ -f "$CORREO_GUARDADO" ]] || { echo "Falta el correo del administrador: instalar.sh <correo>"; exit 1; }
CORREO="$(cat "$CORREO_GUARDADO")"

echo "→ Trayendo origin/main"
git -C "$REPO" fetch -q origin main
if [[ -e "$APP/.git" ]]; then
  ANTES="$(git -C "$APP" rev-parse HEAD)"
  git -C "$APP" checkout -q --detach origin/main
else
  ANTES=""
  git -C "$REPO" worktree add -q --detach "$APP" origin/main
fi
AHORA="$(git -C "$APP" rev-parse HEAD)"

# Copias, no enlaces: launchd no tiene permiso para seguir un enlace hasta ~/Documents.
cp "$REPO/.env" "$APP/.env"
cp "$REPO/.env.local" "$APP/.env.local"
chmod 600 "$APP/.env" "$APP/.env.local"

if [[ -z "$ANTES" ]] || ! git -C "$APP" diff --quiet "$ANTES" "$AHORA" -- package-lock.json || [[ ! -d "$APP/node_modules" ]]; then
  echo "→ Instalando dependencias de la web"
  (cd "$APP" && npm ci --no-audit --no-fund)
fi
if [[ -z "$ANTES" ]] || ! git -C "$APP" diff --quiet "$ANTES" "$AHORA" -- services/espacio-trabajo/package-lock.json || [[ ! -d "$APP/services/espacio-trabajo/node_modules" ]]; then
  echo "→ Instalando dependencias del servicio"
  (cd "$APP/services/espacio-trabajo" && npm ci --no-audit --no-fund)
fi

echo "→ Compilando la web (varios minutos)"
(cd "$APP" && npm run build > "$DATOS/compilacion.log" 2>&1) || { tail -30 "$DATOS/compilacion.log"; echo "La compilación falló. Lo que estaba en marcha sigue igual."; exit 1; }

plist_servicio="$AGENTES/org.grupocc.espacio-servicio.plist"
plist_web="$AGENTES/org.grupocc.espacio-web.plist"
RUTA="$(dirname "$NODO"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cat > "$plist_servicio" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>org.grupocc.espacio-servicio</string>
  <key>ProgramArguments</key><array><string>$NODO</string><string>$APP/services/espacio-trabajo/servicio.mjs</string></array>
  <key>WorkingDirectory</key><string>$APP/services/espacio-trabajo</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$RUTA</string><key>HOME</key><string>$HOME</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DATOS/servicio.log</string>
  <key>StandardErrorPath</key><string>$DATOS/servicio.log</string>
</dict></plist>
PLIST

cat > "$plist_web" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>org.grupocc.espacio-web</string>
  <key>ProgramArguments</key><array><string>$APP/node_modules/.bin/next</string><string>start</string><string>-H</string><string>127.0.0.1</string><string>-p</string><string>3792</string></array>
  <key>WorkingDirectory</key><string>$APP</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$RUTA</string><key>HOME</key><string>$HOME</string><key>NODE_ENV</key><string>production</string>
    <key>ESPACIO_TRABAJO_LOCAL</key><string>1</string>
    <key>ESPACIO_ADMIN_EMAIL</key><string>$CORREO</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DATOS/web.log</string>
  <key>StandardErrorPath</key><string>$DATOS/web.log</string>
</dict></plist>
PLIST
chmod 600 "$plist_web" "$plist_servicio"

cargar() {
  launchctl bootout "gui/$UID_ACTUAL/$1" 2>/dev/null || true
  # bootout termina en segundo plano: un bootstrap inmediato falla con «5: Input/output error».
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    launchctl bootstrap "gui/$UID_ACTUAL" "$2" 2>/dev/null && return 0
  done
  echo "⚠️ No se pudo cargar $1"; return 1
}

# La web se reinicia siempre. El servicio solo si cambió, porque reiniciarlo corta lo que esté trabajando.
cargar org.grupocc.espacio-web "$plist_web"
if [[ -z "$ANTES" ]] || ! git -C "$APP" diff --quiet "$ANTES" "$AHORA" -- services/espacio-trabajo || ! launchctl print "gui/$UID_ACTUAL/org.grupocc.espacio-servicio" >/dev/null 2>&1; then
  cargar org.grupocc.espacio-servicio "$plist_servicio"
fi

echo "✓ Listo en http://localhost:3792/espacio-acceso"
