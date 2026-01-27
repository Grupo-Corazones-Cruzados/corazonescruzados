-- Add the "Mis Acciones" section for members
-- This adds a navigation link to /dashboard/mis-acciones

-- First, check if there's a module for members
-- If there's a module with 'miembro' in roles_permitidos, add the section there
-- Otherwise, we can create a new module or add to the main dashboard

-- Option 1: Add to an existing member module (if exists)
-- Check current modules:
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos ORDER BY orden;

-- Option 2: Create a new module for members (uncomment if needed)
/*
INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, secciones)
VALUES (
  'Mi Espacio',
  'Herramientas para miembros',
  'zap',
  '/dashboard/miembro',
  5,
  true,
  ARRAY['miembro']::text[],
  '[{"id": "mis-acciones", "label": "Mis Acciones", "href": "/dashboard/mis-acciones", "icono": "zap"}]'::jsonb
)
ON CONFLICT DO NOTHING;
*/

-- Option 3: Add "Mis Acciones" section to the main Dashboard module for members
-- This adds it alongside other sections but only visible to members via role check in frontend

-- Find the main dashboard module and add the section
UPDATE modulos
SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mis-acciones", "label": "Mis Acciones", "href": "/dashboard/mis-acciones", "icono": "zap"}]'::jsonb
WHERE ruta = '/dashboard' OR nombre ILIKE '%inicio%' OR nombre ILIKE '%dashboard%'
AND NOT (secciones::text LIKE '%mis-acciones%');

-- Alternative: If you want a dedicated module for members, run this instead:
-- (First, check if module exists)
DO $$
BEGIN
  -- Check if there's already a member-specific module
  IF NOT EXISTS (SELECT 1 FROM modulos WHERE ruta = '/dashboard/miembro') THEN
    -- Create the module
    INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, secciones)
    VALUES (
      'Mi Espacio',
      'Herramientas y acciones del miembro',
      'zap',
      '/dashboard/miembro',
      4,
      true,
      ARRAY['miembro']::text[],
      '[{"id": "mis-acciones", "label": "Mis Acciones", "href": "/dashboard/mis-acciones", "icono": "zap"}]'::jsonb
    );
  ELSE
    -- Add section to existing module if not already there
    UPDATE modulos
    SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mis-acciones", "label": "Mis Acciones", "href": "/dashboard/mis-acciones", "icono": "zap"}]'::jsonb
    WHERE ruta = '/dashboard/miembro'
    AND NOT (secciones::text LIKE '%mis-acciones%');
  END IF;
END $$;

-- Verify the result
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos ORDER BY orden;
