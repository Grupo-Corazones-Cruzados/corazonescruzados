-- ─────────────────────────────────────────────────────────────────────────────
-- LOS PROYECTOS TIENEN TAGS PROPIOS
--
-- ── POR QUÉ, SI YA TENÍAN LOS TALENTOS ────────────────────────────────────────
-- No son lo mismo y hacían falta las dos cosas:
--   · El **talento** dice *quién* puede hacerlo (y ahora, en qué CV aparece). Es una
--     de las categorías del grupo, cerrada y compartida por toda la app.
--   · Los **tags** dicen *con qué se hizo* — «RPA», «Oracle», «WhatsApp Business
--     API»—. Es lo que un cliente o un reclutador reconoce de un vistazo.
-- Usar el talento como tag dejaba a los diez proyectos con la misma etiqueta
-- repetida, que no distingue nada.
--
-- ── LOS VALORES NO SON INVENTADOS ─────────────────────────────────────────────
-- Cada lista sale de la descripción del proyecto y de los títulos de SUS
-- requerimientos. Se etiquetan los 24, **en cualquier estado**: un borrador o una
-- cotización también se consultan, y sin tags la tabla se lee peor justo donde hay
-- más proyectos parecidos.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE gcc_world.projects
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

COMMENT ON COLUMN gcc_world.projects.tags IS
  'Con qué se hizo el proyecto (RPA, Oracle, WhatsApp Business API…). Distinto de los talentos de sus requerimientos, que dicen QUIÉN puede hacerlo.';

UPDATE gcc_world.projects SET tags = v.tags
  FROM (VALUES
    (3,  ARRAY['Power Apps','Migración a código','Gestión de proyectos']),
    (4,  ARRAY['PostgreSQL','Integración con ERP','Presupuestos','Migración de datos']),
    (5,  ARRAY['Agentes de IA','Extracción de documentos','Reglas de negocio','PostgreSQL']),
    (6,  ARRAY['RPA','Web scraping','Validación de datos','Reportes']),
    (7,  ARRAY['Aplicación web','Modelado de datos','Dashboard','Logística']),
    (8,  ARRAY['RPA','Chatbot','Formularios','Validación de pagos']),
    (10, ARRAY['WhatsApp Business API','Meta','Correo masivo','Plantillas']),
    (11, ARRAY['Formularios','Presupuestos','Notificaciones por correo']),
    (12, ARRAY['Agentes de IA','Oracle Database','Integración de APIs']),
    (13, ARRAY['Agentes de IA','Atención automatizada']),
    (14, ARRAY['Inventario','Compras','Reportes']),
    (15, ARRAY['Integración de APIs','Contifico','Facturación','Seguridad web']),
    (16, ARRAY['Agentes de IA','Presupuestos','Modelado de datos']),
    (17, ARRAY['Microsoft Azure','OAuth 2.0','Worker','Automatización de correo']),
    (18, ARRAY['Correo masivo','Outlook','Despliegue en servidor']),
    (19, ARRAY['Contabilidad','Aplicación web','Despliegue en servidor']),
    (24, ARRAY['Reconocimiento facial','Nómina','Recursos Humanos','App móvil']),
    (25, ARRAY['App móvil','Odoo','Integración de APIs','Modo sin conexión']),
    (26, ARRAY['WhatsApp Business API','Agentes de IA','Meta']),
    (27, ARRAY['Sitio web','Diseño UX/UI','WhatsApp']),
    (29, ARRAY['RPA','Extracción de PDF','Facturación','Reglas de negocio']),
    (30, ARRAY['Conciliación bancaria','Power Automate','SharePoint','Excel']),
    (31, ARRAY['Facturación electrónica SRI','Next.js','Worker','PostgreSQL']),
    (32, ARRAY['RPA','Integración de APIs','Sincronización de datos'])
  ) AS v(id, tags)
 WHERE gcc_world.projects.id = v.id;
