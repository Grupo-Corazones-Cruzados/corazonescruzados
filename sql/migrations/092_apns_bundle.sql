-- AVISOS PUSH A LAS DOS APPS DE iPHONE (2026-11-14). GCC World (org.grupocc.gccworld) y GCC Miembros
-- (org.grupocc.miembros) comparten la tabla de dispositivos, y APNs exige el identificador de la app que
-- recibe (`apns-topic`). El token no dice de cuál es: el servidor prueba los identificadores de
-- APNS_BUNDLE_ID en orden y guarda aquí el que Apple aceptó, para ir directo la próxima vez.
ALTER TABLE gcc_world.push_devices ADD COLUMN IF NOT EXISTS apns_bundle TEXT;
