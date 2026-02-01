-- Add the Proyectos section to the admin module's secciones array
-- This provides admins with a dedicated view to manage all projects in the system

UPDATE modulos
SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "proyectos", "label": "Proyectos", "href": "/dashboard/admin/proyectos", "icono": "folder"}]'::jsonb
WHERE ruta = '/dashboard/admin'
AND NOT (secciones::text LIKE '%"id": "proyectos"%');

-- Verify the update
SELECT nombre, secciones FROM modulos WHERE ruta = '/dashboard/admin';
