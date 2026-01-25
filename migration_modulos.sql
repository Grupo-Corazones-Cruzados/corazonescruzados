-- =====================================================
-- SCRIPT DE MÓDULOS - SUPABASE
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- =====================================================

-- Tabla de módulos de la aplicación
CREATE TABLE IF NOT EXISTS modulos (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    icono VARCHAR(50),
    ruta VARCHAR(100) NOT NULL,
    orden INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    requiere_verificacion BOOLEAN DEFAULT TRUE,
    roles_permitidos TEXT[] DEFAULT ARRAY['cliente', 'miembro', 'admin']
);

COMMENT ON TABLE modulos IS 'Módulos disponibles en la aplicación';
COMMENT ON COLUMN modulos.requiere_verificacion IS 'Si es true, el usuario debe tener email verificado para acceder';
COMMENT ON COLUMN modulos.roles_permitidos IS 'Roles que pueden acceder al módulo';

-- Habilitar RLS
ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;

-- Política: todos pueden ver los módulos activos
CREATE POLICY "Todos pueden ver módulos activos" ON modulos
    FOR SELECT USING (activo = true);

-- Insertar módulos iniciales
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion) VALUES
(
    'Gestión de Tickets',
    'Crea y gestiona tickets de soporte. Realiza seguimiento de tus solicitudes y comunícate con los miembros del equipo.',
    'tickets',
    '/dashboard/tickets',
    1,
    true
),
(
    'Proyecto Centralizado',
    'Accede al centro de proyectos. Visualiza el progreso, tareas asignadas y colabora con tu equipo.',
    'proyecto',
    '/dashboard/proyecto',
    2,
    true
),
(
    'Mercado',
    'Explora productos y servicios disponibles. Encuentra soluciones listas para implementar.',
    'mercado',
    '/mercado',
    3,
    false
);

-- =====================================================
-- Actualizar tabla user_profiles para tracking de verificación
-- =====================================================

-- Agregar columna si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'email_verificado_at'
    ) THEN
        ALTER TABLE user_profiles ADD COLUMN email_verificado_at TIMESTAMPTZ;
    END IF;
END $$;

-- =====================================================
-- FIN
-- =====================================================
