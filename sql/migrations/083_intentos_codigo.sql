-- Intentos contra un código de acceso (seguridad, 2026-11-07).
-- Un código de 6 dígitos tiene un millón de valores: sin contar intentos se adivina a fuerza de peticiones
-- en sus 15 minutos de vida. `lib/auth/codigo-acceso.ts` suma el intento ANTES de comparar y lo anula al quinto.
ALTER TABLE gcc_world.users   ADD COLUMN IF NOT EXISTS login_code_intentos    integer NOT NULL DEFAULT 0;
ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS recovery_code_intentos integer NOT NULL DEFAULT 0;
