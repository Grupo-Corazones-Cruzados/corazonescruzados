-- Add the Tablas (Tables) section to the Admin module
-- The secciones are stored as JSONB in the modulos table

-- View current admin module sections
SELECT id, nombre, ruta, secciones FROM modulos WHERE ruta = '/dashboard/admin';

-- Add the Tablas section to the admin module's secciones array
UPDATE modulos
SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "tablas", "label": "Tablas", "href": "/dashboard/admin/tablas", "icono": "database"}]'::jsonb
WHERE ruta = '/dashboard/admin'
AND NOT (secciones::text LIKE '%tablas%');

-- Verify the update
SELECT id, nombre, ruta, secciones FROM modulos WHERE ruta = '/dashboard/admin';
