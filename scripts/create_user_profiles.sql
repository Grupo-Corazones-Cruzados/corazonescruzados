-- =====================================================
-- SCRIPT: Crear tabla user_profiles para autenticación
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Crear extensión para UUID si no existe
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Crear tabla user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255),
    apellido VARCHAR(255),
    avatar_url TEXT,
    telefono VARCHAR(50),
    rol VARCHAR(20) DEFAULT 'cliente' CHECK (rol IN ('cliente', 'miembro', 'admin')),
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE SET NULL,
    verificado BOOLEAN DEFAULT FALSE
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_rol ON user_profiles(rol);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_miembro ON user_profiles(id_miembro);

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
SELECT 'Tabla user_profiles creada correctamente' as resultado;
