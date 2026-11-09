-- PASO 2 DE 2 de 085 (finanzas por cuenta). Se aplica cuando el código que escribe `owner_user_id` y hace
-- `ON CONFLICT (owner_user_id, year, month)` ya está desplegado. Quita la unicidad de toda la organización
-- (si no, dos cuentas no podrían tener el mismo mes) y el DEFAULT que solo servía de puente.
ALTER TABLE gcc_world.finance_months DROP CONSTRAINT IF EXISTS finance_months_year_month_key;
DROP INDEX IF EXISTS gcc_world.finance_months_year_month_key;
ALTER TABLE gcc_world.finance_months ALTER COLUMN owner_user_id DROP DEFAULT;
