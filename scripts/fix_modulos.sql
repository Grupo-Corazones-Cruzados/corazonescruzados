-- =====================================================
-- SCRIPT PARA CORREGIR MÓDULOS DEL DASHBOARD
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Eliminar módulos existentes
DELETE FROM modulos;

-- Reiniciar secuencia
ALTER SEQUENCE modulos_id_seq RESTART WITH 1;

-- Insertar módulos correctos
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, activo, requiere_verificacion, roles_permitidos) VALUES
(
    'Gestión de Tickets',
    'Crea y gestiona tickets de soporte. Realiza seguimiento de tus solicitudes y comunícate con los miembros del equipo.',
    'tickets',
    '/dashboard/tickets',
    1,
    true,
    true,
    ARRAY['cliente', 'miembro', 'admin']
),
(
    'Proyecto Centralizado',
    'Accede al centro de proyectos. Gestiona reclutamiento, tareas y colabora con tu equipo.',
    'proyecto',
    '/dashboard/proyecto',
    2,
    true,
    true,
    ARRAY['cliente', 'miembro', 'admin']
),
(
    'Mercado',
    'Explora productos y servicios disponibles. Encuentra soluciones listas para implementar.',
    'mercado',
    '/dashboard/mercado',
    3,
    true,
    false,
    ARRAY['cliente', 'miembro', 'admin']
),
(
    'Administración',
    'Panel de administración del sistema. Gestiona usuarios, configuraciones y reportes.',
    'admin',
    '/dashboard/admin',
    4,
    true,
    true,
    ARRAY['admin']
);

-- Verificar módulos insertados
SELECT id, nombre, ruta, orden, activo FROM modulos ORDER BY orden;
