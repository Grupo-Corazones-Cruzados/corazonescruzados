#!/bin/bash
# PUBLICAR EN EL SERVIDOR PROPIO (M1) — se ejecuta en la Mac de desarrollo.
#
# Compila aquí y no en el M1: `next build` necesita hasta 6 GB y el M1 tiene 8 GB sirviendo. Cada
# publicación va a su propia carpeta (`~/gcc/versiones/<fecha>-<commit>`) y `~/gcc/app` es un enlace que
# cambia de golpe a la nueva. Lo que no cambió se enlaza con la versión anterior (no ocupa ni viaja). Si
# algún servicio no responde tras el cambio, vuelve sola a la versión anterior.
#
#   services/servidor-m1/publicar.sh            → publica origin/main
#   services/servidor-m1/publicar.sh HEAD       → publica el commit local (pruebas)
#
# Configuración local, fuera del repositorio: ~/.gcc-servidor.env con M1_HOST y M1_CLAVE.
set -eo pipefail   # sin -u: el bash 3.2 de macOS trata una lista vacía como variable sin definir

[ -f "$HOME/.gcc-servidor.env" ] && . "$HOME/.gcc-servidor.env"
: "${M1_HOST:?Falta M1_HOST en ~/.gcc-servidor.env}"; : "${M1_CLAVE:?Falta M1_CLAVE en ~/.gcc-servidor.env}"
# Una publicación a la vez (la automática tras un push y una a mano no se pisan): se espera hasta 40 min.
CANDADO=/tmp/gcc-publicar.candado
TENGO=0
for i in $(seq 1 240); do mkdir "$CANDADO" 2>/dev/null && { TENGO=1; break; }; [ "$i" = 1 ] && echo "… esperando a otra publicación"; sleep 10; done
[ "$TENGO" = 1 ] || { echo "✖ otra publicación no termina (si no hay ninguna: rmdir $CANDADO)"; exit 1; }
trap 'rmdir "$CANDADO" 2>/dev/null' EXIT   # cualquier salida suelta el candado (abajo se amplía)
SSH=(ssh -i "$M1_CLAVE" -o BatchMode=yes -o ServerAliveInterval=30)
remoto() { "${SSH[@]}" "$M1_HOST" "$@"; }

R=$(git rev-parse --show-toplevel)
REF=${1:-origin/main}
[ "$REF" = origin/main ] && git -C "$R" fetch -q origin main
SHA=$(git -C "$R" rev-parse "$REF")
CORTO=${SHA:0:8}
PRODUCTOS=(reservas pedidos catering planificaciones automatizaciones)
PUERTOS=(3101 3102 3103 3104 3105)

ANTERIOR=$(remoto 'cat ~/gcc/publicado 2>/dev/null || true')
echo "▶ Publicando ${CORTO} (anterior: ${ANTERIOR:0:8})"
[ "$ANTERIOR" = "$SHA" ] && { echo "Ya está publicado."; exit 0; }

# Qué cambió desde lo publicado: si no se sabe, se compila todo.
cambio() { [ -z "$ANTERIOR" ] || ! git -C "$R" cat-file -e "$ANTERIOR" 2>/dev/null || ! git -C "$R" diff --quiet "$ANTERIOR" "$SHA" -- "$@"; }
COMPILAR=()
for p in "${PRODUCTOS[@]}"; do cambio "productos/$p" && COMPILAR+=("$p"); done
APP_LOCK=$(git -C "$R" rev-parse "$SHA:package-lock.json")

W=$(mktemp -d /tmp/gcc-publicar.XXXXXX)
limpiar() { rm -f "$W/node_modules" "$W"/productos/*/node_modules "$W/.env" "$W/.env.local" "$W"/productos/*/.env; git -C "$R" worktree remove --force "$W" 2>/dev/null || rm -rf "$W"; }
trap 'limpiar; rmdir "$CANDADO" 2>/dev/null' EXIT
git -C "$R" worktree add --detach "$W" "$SHA" >/dev/null 2>&1

# Compilar. Las páginas prerenderizadas leen la base: el .env local da la cadena.
ln -s "$R/node_modules" "$W/node_modules"
cp "$R/.env" "$W/.env"; [ -f "$R/.env.local" ] && cp "$R/.env.local" "$W/.env.local"
ini=$(date +%s)
( cd "$W" && npm run build >/tmp/gcc-publicar-app.log 2>&1 ) || { echo "✖ Falló la compilación de la app: /tmp/gcc-publicar-app.log"; exit 1; }
for p in "${COMPILAR[@]}"; do
  ln -s "$R/productos/$p/node_modules" "$W/productos/$p/node_modules"; cp "$R/productos/$p/.env" "$W/productos/$p/.env"
  ( cd "$W/productos/$p" && NODE_OPTIONS=--max-old-space-size=4096 npm run build >"/tmp/gcc-publicar-$p.log" 2>&1 ) \
    || { echo "✖ Falló la compilación de $p: /tmp/gcc-publicar-$p.log"; exit 1; }
done
echo "  compilado en $(( $(date +%s)-ini )) s (productos: ${COMPILAR[*]:-ninguno})"

# Enviar a una carpeta nueva que empieza como CLON de la versión en marcha: APFS lo hace en segundos y sin
# ocupar espacio, y rsync solo reemplaza lo distinto (escribe aparte y renombra: la versión en marcha no se
# toca). No se usa --link-dest: el rsync de macOS (openrsync) se queda sin archivos abiertos con él.
NUEVA="versiones/$(date +%Y%m%d-%H%M%S)-$CORTO"
ini=$(date +%s)
remoto "set -e; G=~/gcc; cd \$G
  if [ -d app ] && [ ! -L app ]; then mkdir -p versiones; mv app versiones/inicial; ln -s versiones/inicial app; fi
  cp -Rc \"\$(readlink app)\" '$NUEVA'"
RS=(rsync -a --delete --rsync-path="ulimit -n 4096; /usr/bin/rsync" -e "${SSH[*]}")
EXCL=(--exclude .git --exclude godot --exclude movil --exclude node_modules --exclude '.env*' --exclude '.next/cache'
      --exclude data --exclude '*.tsbuildinfo' --exclude '/productos/*/.next')
"${RS[@]}" "${EXCL[@]}" "$W/" "$M1_HOST:gcc/$NUEVA/"
for p in "${COMPILAR[@]}"; do
  "${RS[@]}" --exclude cache "$W/productos/$p/.next/" "$M1_HOST:gcc/$NUEVA/productos/$p/.next/"
done
# Las dependencias solo viajan si cambió su package-lock.
if [ "$(remoto 'cat ~/gcc/lock-app 2>/dev/null || true')" != "$APP_LOCK" ]; then
  echo "  dependencias de la app: comprobando diferencias"
  "${RS[@]}" --exclude .cache "$R/node_modules/" "$M1_HOST:gcc/$NUEVA/node_modules/"
fi
for p in "${COMPILAR[@]}"; do
  if [ -z "$ANTERIOR" ] || ! git -C "$R" diff --quiet "$ANTERIOR" "$SHA" -- "productos/$p/package-lock.json" 2>/dev/null; then
    "${RS[@]}" --exclude .cache "$R/productos/$p/node_modules/" "$M1_HOST:gcc/$NUEVA/productos/$p/node_modules/"
  fi
done
echo "  enviado en $(( $(date +%s)-ini )) s"

# Cambiar de versión y reiniciar lo que cambió; si algo no responde, volver atrás.
REINICIAR="app ${COMPILAR[*]}"
[[ " ${COMPILAR[*]} " == *" automatizaciones "* ]] && REINICIAR+=" worker"
remoto "set -e; cd ~/gcc; U=\$(id -u)
  PREVIA=\$(readlink app); ln -sfn '$NUEVA' app.nuevo && mv -fh app.nuevo app
  for s in $REINICIAR; do launchctl kickstart -k gui/\$U/org.grupocc.espejo.\$s; done
  ok=1
  for p in 3100 ${PUERTOS[*]}; do
    for i in \$(seq 1 30); do c=\$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:\$p/ || true); [ \"\$c\" -ge 200 ] && [ \"\$c\" -lt 500 ] && break; sleep 2; done
    [ \"\$c\" -ge 200 ] && [ \"\$c\" -lt 500 ] || { echo \"  ✖ el puerto \$p no responde (\$c)\"; ok=0; }
  done
  if [ \$ok = 0 ]; then
    ln -sfn \"\$PREVIA\" app.nuevo && mv -fh app.nuevo app
    for s in $REINICIAR; do launchctl kickstart -k gui/\$U/org.grupocc.espejo.\$s; done
    echo '  ↩ vuelto a la versión anterior'; exit 1
  fi
  echo '$SHA' > publicado; echo '$APP_LOCK' > lock-app
  ls -1dt versiones/* | tail -n +4 | while read v; do [ \"\$v\" = \"\$(readlink app)\" ] || rm -rf \"\$v\"; done"
echo "✔ Publicado $CORTO en el M1"
