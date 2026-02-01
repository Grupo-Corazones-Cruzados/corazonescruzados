-- Add the Tickets section to the admin module's secciones array
-- This provides admins with a dedicated view to manage all tickets in the system

UPDATE modulos
SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "tickets", "label": "Tickets", "href": "/dashboard/admin/tickets", "icono": "ticket"}]'::jsonb
WHERE ruta = '/dashboard/admin'
AND NOT (secciones::text LIKE '%"id": "tickets"%');

-- Verify the update
SELECT nombre, secciones FROM modulos WHERE ruta = '/dashboard/admin';
