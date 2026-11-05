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
# La clave de Google va por ruta relativa y git no la trae: sin ella, aquí no sale ningún correo.
CLAVE_GOOGLE="$(sed -n 's/^GOOGLE_SA_KEY_PATH=//p' "$REPO/.env.local" | tr -d '"')"
if [[ -n "$CLAVE_GOOGLE" && "$CLAVE_GOOGLE" != /* && -f "$REPO/$CLAVE_GOOGLE" ]]; then
  mkdir -p "$APP/$(dirname "$CLAVE_GOOGLE")"
  cp "$REPO/$CLAVE_GOOGLE" "$APP/$CLAVE_GOOGLE"
  chmod 600 "$APP/$CLAVE_GOOGLE"
fi

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

cat > "$plist_servicio.nuevo" <<PLIST
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

cat > "$plist_web.nuevo" <<PLIST
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
chmod 600 "$plist_web.nuevo" "$plist_servicio.nuevo"

cargada() { launchctl print "gui/$UID_ACTUAL/$1" >/dev/null 2>&1; }

# Reiniciar con kickstart no deja hueco: lo hace launchd, y aunque maten este instalador a la mitad
# (o lo haya lanzado una sesión del propio servicio) la tarea vuelve sola. Entre bootout y bootstrap, en
# cambio, un corte la deja descargada hasta que alguien la cargue: así cayó el 2026-11-04. Por eso se
# descarga solo si la configuración cambió de verdad.
cargar() {
  if cargada "$1" && cmp -s "$2.nuevo" "$2"; then
    rm -f "$2.nuevo"
    launchctl kickstart -k "gui/$UID_ACTUAL/$1"
    return
  fi
  launchctl bootout "gui/$UID_ACTUAL/$1" 2>/dev/null || true
  mv "$2.nuevo" "$2"
  # bootout termina en segundo plano: un bootstrap inmediato falla con «5: Input/output error».
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    launchctl bootstrap "gui/$UID_ACTUAL" "$2" 2>/dev/null && return 0
  done
  echo "⚠️ No se pudo cargar $1"; return 1
}

# La web se reinicia siempre. El servicio solo si cambió, porque reiniciarlo corta lo que esté trabajando.
# Este instalador y el README no son parte de lo que corre: cambiarlos no es motivo para cortar nada.
cargar org.grupocc.espacio-web "$plist_web"
if [[ -z "$ANTES" ]] || ! git -C "$APP" diff --quiet "$ANTES" "$AHORA" -- services/espacio-trabajo ':(exclude)services/espacio-trabajo/instalar.sh' ':(exclude)services/espacio-trabajo/README.md' || ! cargada org.grupocc.espacio-servicio || ! cmp -s "$plist_servicio.nuevo" "$plist_servicio"; then
  # Reiniciarlo corta la respuesta en curso: se espera a que no haya ninguna (hasta 15 minutos).
  for i in {1..90}; do
    curl -s -m 5 -H "Authorization: Bearer $(cat "$DATOS/token" 2>/dev/null)" http://127.0.0.1:3791/vivas | grep -q -E '"estado":"(trabajando|espera)"|"tareas":[1-9]' || break
    [[ $i == 1 ]] && echo "→ Hay una sesión trabajando: espero a que termine para reiniciar el servicio"
    sleep 10
  done
  cargar org.grupocc.espacio-servicio "$plist_servicio"
else
  rm -f "$plist_servicio.nuevo"
fi

echo "✓ Listo en http://localhost:3792/espacio-acceso"
