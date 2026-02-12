-- Add the "Mi Curriculum" section for members in Mi Espacio module

DO $$
BEGIN
  -- Check if there's already a member-specific module
  IF NOT EXISTS (SELECT 1 FROM modulos WHERE ruta = '/dashboard/miembro') THEN
    -- Create the module with all member sections including mi-curriculum
    INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, secciones)
    VALUES (
      'Mi Espacio',
      'Herramientas y acciones del miembro',
      'zap',
      '/dashboard/miembro',
      4,
      true,
      ARRAY['miembro']::text[],
      '[
        {"id": "mis-acciones", "label": "Mis Acciones", "href": "/dashboard/miembro/mis-acciones", "icono": "zap"},
        {"id": "mi-curriculum", "label": "Mi Curriculum", "href": "/dashboard/miembro/mi-curriculum", "icono": "file-text"}
      ]'::jsonb
    );
  ELSE
    -- Add section to existing module if not already there
    UPDATE modulos
    SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mi-curriculum", "label": "Mi Curriculum", "href": "/dashboard/miembro/mi-curriculum", "icono": "file-text"}]'::jsonb
    WHERE ruta = '/dashboard/miembro'
    AND NOT (secciones::text LIKE '%mi-curriculum%');
  END IF;
END $$;

-- Verify the result
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos WHERE ruta = '/dashboard/miembro';
