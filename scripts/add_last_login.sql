-- =====================================================
-- AGREGAR CAMPO DE ULTIMA CONEXION
-- Ejecutar en: Railway PostgreSQL
-- =====================================================

-- Agregar columna de última conexión
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Crear índice para búsquedas rápidas de usuarios activos
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login ON user_profiles(last_login DESC);

-- Verificar
SELECT 'Columna last_login agregada correctamente' as resultado;
