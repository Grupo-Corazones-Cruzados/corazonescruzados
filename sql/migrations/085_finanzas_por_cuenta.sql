-- ⭐ EL ESTADO FINANCIERO ES DE CADA CUENTA (Fernando, 2026-11-09: modelo económico de la plataforma).
-- Deroga «uno para toda la organización»: cada mes pertenece a un usuario. Todo lo registrado hasta hoy es de
-- lfgonzalezm0@grupocc.org (3fdb4891-…), que es también el dueño de lo que se anota solo (`DUENO_FINANZAS_GCC`
-- en lib/finance.ts) hasta que exista la facturación por usuario.
-- Los renglones y `finance_source_log` siguen siendo GLOBALES: un origen (factura, ticket, clave del SRI) se
-- anota una sola vez en toda la plataforma, sea de quien sea el mes.
--
-- PASO 1 DE 2, compatible con el código que ya está desplegado: la columna nace con DEFAULT (el código viejo
-- inserta meses sin dueño) y la unicidad vieja (year, month) se queda, porque el código viejo hace
-- `ON CONFLICT (year, month)`. El paso 2 (086) quita las dos cosas cuando el código nuevo ya está en marcha.
-- Idempotente. No borra nada (el mes 1999-01 de pruebas se queda).
ALTER TABLE gcc_world.finance_months ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE gcc_world.finance_months ALTER COLUMN owner_user_id SET DEFAULT '3fdb4891-6a51-456f-aa6f-f3b03b4a9555';
UPDATE gcc_world.finance_months SET owner_user_id = '3fdb4891-6a51-456f-aa6f-f3b03b4a9555' WHERE owner_user_id IS NULL;
ALTER TABLE gcc_world.finance_months ALTER COLUMN owner_user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS finance_months_owner_year_month_key
  ON gcc_world.finance_months (owner_user_id, year, month);
