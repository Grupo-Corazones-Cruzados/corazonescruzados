-- =====================================================
-- CORREGIR ROLES DE "MI ESPACIO"
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Ver estado actual del módulo Mi Espacio
SELECT id, nombre, ruta, roles_permitidos
FROM modulos
WHERE ruta = '/dashboard/miembro';

-- Actualizar roles_permitidos para que solo "miembro" pueda acceder
UPDATE modulos
SET roles_permitidos = ARRAY['miembro']
WHERE ruta = '/dashboard/miembro';

-- Verificar el cambio
SELECT id, nombre, ruta, roles_permitidos
FROM modulos
WHERE ruta = '/dashboard/miembro';
