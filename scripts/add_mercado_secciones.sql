-- =====================================================
-- AGREGAR MODULO "MERCADO" CON SUS SECCIONES
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Verificar modulos existentes
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos WHERE ruta = '/dashboard/mercado';

-- 1. Crear modulo Mercado si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM modulos WHERE ruta = '/dashboard/mercado') THEN
    INSERT INTO modulos (nombre, descripcion, icono, ruta, orden, requiere_verificacion, roles_permitidos, activo, secciones)
    VALUES (
      'Mercado',
      'Marketplace de productos y servicios',
      'mercado',
      '/dashboard/mercado',
      50,
      false,
      ARRAY['cliente', 'miembro', 'admin']::text[],
      true,
      '[
        {"id": "catalogo", "label": "Catálogo", "href": "/dashboard/mercado", "icono": "mercado"},
        {"id": "carrito", "label": "Mi Carrito", "href": "/dashboard/mercado/carrito", "icono": "cart"},
        {"id": "pedidos", "label": "Mis Pedidos", "href": "/dashboard/mercado/pedidos", "icono": "package"}
      ]'::jsonb
    );
    RAISE NOTICE 'Modulo Mercado creado con todas las secciones';
  ELSE
    RAISE NOTICE 'El modulo Mercado ya existe';
  END IF;
END $$;

-- 2. Agregar seccion "Mis Productos" al modulo Mi Espacio (para miembros)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM modulos WHERE ruta = '/dashboard/miembro') THEN
    -- Verificar si ya existe la seccion
    IF NOT EXISTS (
      SELECT 1 FROM modulos
      WHERE ruta = '/dashboard/miembro'
      AND secciones::text LIKE '%mis-productos%'
    ) THEN
      UPDATE modulos
      SET secciones = COALESCE(secciones, '[]'::jsonb) || '[{"id": "mis-productos", "label": "Mis Productos", "href": "/dashboard/miembro/productos", "icono": "package"}]'::jsonb
      WHERE ruta = '/dashboard/miembro';
      RAISE NOTICE 'Seccion Mis Productos agregada al modulo Mi Espacio';
    ELSE
      RAISE NOTICE 'La seccion Mis Productos ya existe en el modulo Mi Espacio';
    END IF;
  ELSE
    RAISE NOTICE 'El modulo Mi Espacio no existe';
  END IF;
END $$;

-- Verificar resultado final
SELECT id, nombre, ruta, roles_permitidos, secciones FROM modulos WHERE ruta IN ('/dashboard/mercado', '/dashboard/miembro');
