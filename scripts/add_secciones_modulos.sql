-- =====================================================
-- AGREGAR COLUMNA SECCIONES A MÓDULOS
-- Ejecutar en: psql o Supabase Dashboard > SQL Editor
-- =====================================================

-- Agregar columna secciones (JSONB)
ALTER TABLE modulos ADD COLUMN IF NOT EXISTS secciones JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN modulos.secciones IS 'Secciones/navegación interna del módulo en formato JSON';

-- Actualizar módulos con sus secciones

-- 1. Gestión de Tickets
UPDATE modulos SET secciones = '[
  {"id": "tickets", "label": "Mis Tickets", "href": "/dashboard/tickets", "icono": "ticket"},
  {"id": "nuevo", "label": "Nuevo Ticket", "href": "/dashboard/tickets/new", "icono": "plus"},
  {"id": "proyectos", "label": "Proyectos", "href": "/dashboard/projects", "icono": "folder"}
]'::jsonb
WHERE ruta = '/dashboard/tickets';

-- 2. Proyecto Centralizado (vacío por ahora, solo el submódulo)
UPDATE modulos SET secciones = '[
  {"id": "reclutamiento", "label": "Reclutamiento y Selección", "href": "/dashboard/proyecto/reclutamiento", "icono": "users"}
]'::jsonb
WHERE ruta = '/dashboard/proyecto';

-- 3. Mercado (vacío por ahora)
UPDATE modulos SET secciones = '[]'::jsonb
WHERE ruta = '/dashboard/mercado';

-- 4. Administración
UPDATE modulos SET secciones = '[
  {"id": "usuarios", "label": "Usuarios", "href": "/dashboard/admin", "icono": "users"},
  {"id": "miembros", "label": "Miembros", "href": "/dashboard/admin/miembros", "icono": "user-check"}
]'::jsonb
WHERE ruta = '/dashboard/admin';

-- Verificar resultado
SELECT id, nombre, ruta, secciones FROM modulos ORDER BY orden;
