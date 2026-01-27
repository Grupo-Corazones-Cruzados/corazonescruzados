-- =====================================================
-- AGREGAR SECCION "MIS PROYECTOS" AL MODULO MI ESPACIO
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Verificar modulos existentes
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos WHERE ruta = '/dashboard/miembro';

-- Agregar seccion Mis Proyectos al modulo Mi Espacio
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM modulos WHERE ruta = '/dashboard/miembro') THEN
    -- El modulo no existe, crearlo completo
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
        {"id": "mis-tickets", "label": "Mis Tickets", "href": "/dashboard/miembro/tickets", "icono": "ticket"},
        {"id": "mis-proyectos", "label": "Mis Proyectos", "href": "/dashboard/miembro/proyectos", "icono": "folder"}
      ]'::jsonb
    );
    RAISE NOTICE 'Modulo Mi Espacio creado con todas las secciones';
  ELSE
    -- El modulo ya existe, agregar solo la seccion Mis Proyectos si no esta
    IF NOT EXISTS (
      SELECT 1 FROM modulos
      WHERE ruta = '/dashboard/miembro'
      AND secciones::text LIKE '%mis-proyectos%'
    ) THEN
      UPDATE modulos
      SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mis-proyectos", "label": "Mis Proyectos", "href": "/dashboard/miembro/proyectos", "icono": "folder"}]'::jsonb
      WHERE ruta = '/dashboard/miembro';
      RAISE NOTICE 'Seccion Mis Proyectos agregada al modulo Mi Espacio';
    ELSE
      RAISE NOTICE 'La seccion Mis Proyectos ya existe en el modulo Mi Espacio';
    END IF;
  END IF;
END $$;

-- Verificar resultado final
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos WHERE ruta = '/dashboard/miembro';
