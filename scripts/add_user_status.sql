-- =====================================================
-- AGREGAR CAMPO DE ESTADO/BLOQUEO A USUARIOS
-- Ejecutar en: Railway PostgreSQL
-- =====================================================

-- Agregar columna de bloqueo
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bloqueado_en TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS motivo_bloqueo TEXT;

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_user_profiles_bloqueado ON user_profiles(bloqueado);

-- Verificar
SELECT 'Columnas agregadas correctamente' as resultado;
