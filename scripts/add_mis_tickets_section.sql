-- =====================================================
-- AGREGAR SECCION "MIS TICKETS" AL MODULO MI ESPACIO
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Primero verificar que modulos existen
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos ORDER BY orden;

-- Si el modulo Mi Espacio NO existe, crearlo con ambas secciones
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM modulos WHERE ruta = '/dashboard/miembro') THEN
    INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, activo, secciones)
    VALUES (
      'Mi Espacio',
      'Herramientas y acciones del miembro',
      'zap',
      '/dashboard/miembro',
      4,
      true,
      ARRAY['miembro']::text[],
      true,
      '[
        {"id": "mis-acciones", "label": "Mis Acciones", "href": "/dashboard/mis-acciones", "icono": "zap"},
        {"id": "mis-tickets", "label": "Mis Tickets", "href": "/dashboard/miembro/tickets", "icono": "ticket"}
      ]'::jsonb
    );
    RAISE NOTICE 'Modulo Mi Espacio creado con secciones Mis Acciones y Mis Tickets';
  ELSE
    -- El modulo ya existe, agregar solo la seccion Mis Tickets si no esta
    IF NOT EXISTS (
      SELECT 1 FROM modulos
      WHERE ruta = '/dashboard/miembro'
      AND secciones::text LIKE '%mis-tickets%'
    ) THEN
      UPDATE modulos
      SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mis-tickets", "label": "Mis Tickets", "href": "/dashboard/miembro/tickets", "icono": "ticket"}]'::jsonb
      WHERE ruta = '/dashboard/miembro';
      RAISE NOTICE 'Seccion Mis Tickets agregada al modulo Mi Espacio';
    ELSE
      RAISE NOTICE 'La seccion Mis Tickets ya existe en el modulo Mi Espacio';
    END IF;
  END IF;
END $$;

-- Verificar resultado final
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos WHERE ruta = '/dashboard/miembro';
