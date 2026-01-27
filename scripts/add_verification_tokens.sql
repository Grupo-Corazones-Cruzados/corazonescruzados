-- =====================================================
-- AGREGAR TABLA DE TOKENS DE VERIFICACION
-- Ejecutar en: Railway PostgreSQL
-- =====================================================

-- Tabla para tokens de verificación de email
CREATE TABLE IF NOT EXISTS verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL DEFAULT 'email_verification',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires ON verification_tokens(expires_at);

-- Verificar
SELECT 'Tabla verification_tokens creada correctamente' as resultado;
