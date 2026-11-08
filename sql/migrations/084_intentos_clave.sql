-- Fallos de contraseña recientes (seguridad, 2026-11-07). `lib/auth/intentos.ts` corta a los 10 fallos de una
-- cuenta o a los 30 de una IP en 15 minutos. Correo e IP van con hash; las filas de más de un día se borran solas.
CREATE TABLE IF NOT EXISTS gcc_world.intentos_clave (
  id     BIGSERIAL PRIMARY KEY,
  clave  TEXT NOT NULL,
  creado TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS intentos_clave_clave_creado ON gcc_world.intentos_clave (clave, creado);
