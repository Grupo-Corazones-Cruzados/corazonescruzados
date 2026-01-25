-- =====================================================
-- SCRIPT DE AUTENTICACIÓN - SUPABASE
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =====================================================

-- =====================================================
-- TABLA: user_profiles (complementa auth.users de Supabase)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Información básica
    nombre VARCHAR(255),
    apellido VARCHAR(255),
    avatar_url TEXT,
    telefono VARCHAR(50),

    -- Rol y permisos
    rol VARCHAR(50) DEFAULT 'cliente', -- 'cliente', 'miembro', 'admin'

    -- Referencia opcional a miembro (si el usuario es un miembro del grupo)
    id_miembro BIGINT REFERENCES miembros(id) ON DELETE SET NULL,

    -- Metadata
    ultimo_acceso TIMESTAMPTZ,
    verificado BOOLEAN DEFAULT FALSE
);

COMMENT ON TABLE user_profiles IS 'Perfiles de usuario complementarios a auth.users';
COMMENT ON COLUMN user_profiles.rol IS 'Rol del usuario: cliente, miembro, admin';
COMMENT ON COLUMN user_profiles.id_miembro IS 'Si el usuario es miembro, referencia al registro en miembros';

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_rol ON user_profiles(rol);
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_miembro ON user_profiles(id_miembro);

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su propio perfil
CREATE POLICY "Usuarios pueden ver su perfil" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Usuarios pueden actualizar su perfil" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Insertar perfil al registrarse (manejado por trigger)
CREATE POLICY "Insertar perfil propio" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Los admins pueden ver todos los perfiles
CREATE POLICY "Admins pueden ver todos los perfiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- =====================================================
-- TRIGGER: Crear perfil automáticamente al registrarse
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, nombre, apellido)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
        COALESCE(NEW.raw_user_meta_data->>'apellido', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCIÓN: Actualizar último acceso
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_last_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET ultimo_acceso = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIN
-- =====================================================
