#!/bin/sh
# Fase de compilación «Instalar Python»: mete en el .app la biblioteca estándar, el módulo de la app
# (`python/` → `app/`) y los paquetes (`app_packages/`, de preparar.sh), y convierte cada .so en el
# framework firmado que exige iOS (utils.sh de BeeWare).
set -e
if [ ! -d "$PROJECT_DIR/Python.xcframework" ] || [ ! -d "$PROJECT_DIR/app_packages" ]; then
  echo "error: falta Python.xcframework o app_packages. Ejecuta ./preparar.sh" >&2
  exit 1
fi
. "$PROJECT_DIR/Python.xcframework/build/utils.sh"

rsync -a --delete --exclude __pycache__ "$PROJECT_DIR/python/" "$CODESIGNING_FOLDER_PATH/app/"
rsync -a --delete "$PROJECT_DIR/app_packages/" "$CODESIGNING_FOLDER_PATH/app_packages/"

install_stdlib Python.xcframework
# Lo que la app no usa de la biblioteca estándar (pruebas, interfaz Tk, instalador de pip…).
LIB="$CODESIGNING_FOLDER_PATH/python/lib/python3.14"
rm -rf "$LIB/test" "$LIB/idlelib" "$LIB/tkinter" "$LIB/turtledemo" "$LIB/ensurepip" "$LIB/pydoc_data"
rm -f "$LIB"/lib-dynload/_test*.so "$LIB"/lib-dynload/_xxtestfuzz*.so "$LIB"/lib-dynload/_ctypes_test*.so
process_dylibs Python.xcframework python/lib/python3.14/lib-dynload
